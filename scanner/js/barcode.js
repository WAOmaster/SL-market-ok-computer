/**
 * Barcode utilities for the Supermarket Scanner app.
 *
 * Handles three families of codes found on Sri Lankan supermarket items:
 *   1. Plain retail barcodes (EAN-13 / UPC-A / EAN-8) -> looked up in the catalog,
 *      priced per unit and counted.
 *   2. In-store "weighed item" labels printed at the scale (prefix 91/92 here).
 *      These embed the item code plus the weight or the total price in the barcode.
 *   3. Bare PLU codes (4-5 digits) typed in by hand for loose produce.
 *
 * Store label layouts differ, so the embedded-field layout is data driven
 * (see EMBEDDED_RULES) and every decode is validated against the EAN-13
 * check digit before it is offered to the app.
 */
(function (root, factory) {
  const api = factory();
  root.SLScan = root.SLScan || {};
  root.SLScan.barcode = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIGITS_ONLY = /^\d+$/;

  /** Strip spaces/dashes that OCR and manual entry tend to introduce. */
  function normalize(raw) {
    return String(raw == null ? '' : raw).replace(/[^0-9]/g, '');
  }

  /** EAN-13 / UPC-A check digit for the first n-1 digits of `body`. */
  function checkDigit(body) {
    let sum = 0;
    // Weights alternate 1,3 counting from the right-most body digit.
    for (let i = 0; i < body.length; i++) {
      const d = body.charCodeAt(body.length - 1 - i) - 48;
      sum += i % 2 === 0 ? d * 3 : d;
    }
    return (10 - (sum % 10)) % 10;
  }

  function isValidEan(code) {
    const c = normalize(code);
    if (![8, 12, 13, 14].includes(c.length)) return false;
    return checkDigit(c.slice(0, -1)) === c.charCodeAt(c.length - 1) - 48;
  }

  /** UPC-A (12) is an EAN-13 with a leading zero; normalise so lookups match. */
  function toEan13(code) {
    const c = normalize(code);
    if (c.length === 12) return '0' + c;
    return c;
  }

  /**
   * Layouts for scale-printed labels. `value` is the variable field: either the
   * net weight in grams or the total price in cents.
   *
   * The Keells/Cargills style labels in the sample photos read
   * `91/92 + 4-digit item + variable field + check digit`; some scales insert an
   * extra internal check digit before the variable field, so both are tried and
   * the caller picks the candidate that agrees with the catalog price.
   */
  const EMBEDDED_RULES = [
    {
      /*
       * Confirmed against a full Keells shop (36 camera scans reconciled line by
       * line with the printed bill): the scale prints a 12-digit UPC-A of
       *
       *     ITEM(6) + NET WEIGHT IN GRAMS(5) + CHECK(1)
       *
       * e.g. 923010|01218|7 -> item 923010 (Banana Seeni), 1.218 kg.
       *
       * There is no prefix to key off: produce items read 91xxxx/92xxxx but
       * grocery scale items are plain numbers padded to six digits (004681 rice,
       * 021445 sugar, 015427 red kekulu), so length plus a valid check digit is
       * what identifies the format.
       */
      id: 'sl-upc12-weight',
      label: 'Keells scale label - 12 digit, weight in grams',
      length: 12,
      prefixes: null,
      requireCheckDigit: true,
      itemStart: 0, itemLength: 6,
      valueStart: 6, valueLength: 5,
      valueType: 'weight_g'
    },
    {
      // Confirmed against the sample labels: 923010|1|01218|8 = item 923010,
      // internal check digit 1, net weight 1.218 kg, EAN check digit 8.
      id: 'sl-weight-5',
      label: 'SL scale label - internal check + 5 digit weight (grams)',
      prefixes: ['91', '92'],
      requireCheckDigit: true,
      itemStart: 0, itemLength: 6,
      valueStart: 7, valueLength: 5,
      valueType: 'weight_g'
    },
    {
      id: 'sl-weight-6',
      label: 'SL scale label - 6 digit weight (grams)',
      prefixes: ['91', '92'],
      requireCheckDigit: true,
      itemStart: 0, itemLength: 6,
      valueStart: 6, valueLength: 6,
      valueType: 'weight_g'
    },
    {
      id: 'sl-price-6',
      label: 'SL scale label - 6 digit total price (cents)',
      prefixes: ['91', '92'],
      requireCheckDigit: true,
      itemStart: 0, itemLength: 6,
      valueStart: 6, valueLength: 6,
      valueType: 'price_cents'
    },
    {
      id: 'gs1-price-20',
      label: 'GS1 variable measure - price (cents)',
      prefixes: ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29'],
      requireCheckDigit: true,
      itemStart: 0, itemLength: 7,
      valueStart: 7, valueLength: 5,
      valueType: 'price_cents'
    }
  ];

  /*
   * Layouts worked out from a real label at a store the app had not seen before
   * (see learnRule). They are kept by the caller and registered here so the
   * decoder treats them like any built-in rule.
   */
  let learnedRules = [];

  function registerRules(rules) {
    learnedRules = (rules || []).filter(r => r && r.valueLength > 0);
    return learnedRules.slice();
  }

  function allRules() {
    return learnedRules.concat(EMBEDDED_RULES);
  }

  function ruleById(id) {
    return allRules().find(r => r.id === id) || null;
  }

  /**
   * Work out where a store hides the weight (or the price) in its scale labels,
   * from one label whose true value the shopper has just typed in.
   *
   * Every format seen so far puts the variable field immediately before the
   * check digit, so that is tried first; anything else is matched right to left.
   * The result is an ordinary rule, so one confirmed label teaches the app to
   * read every later label from that store on its own.
   */
  function learnRule(code, options) {
    const opts = options || {};
    const c = normalize(code);
    if (c.length < 8 || c.length > 18) return null;

    // Not every scale label is an EAN. Plenty are Code 128 or ITF, which carry
    // whatever digits the scale chose and no check digit to verify them.
    const hasCheckDigit = isValidEan(c);

    const targets = [];
    if (Number(opts.weightKg) > 0) {
      targets.push({ value: Math.round(opts.weightKg * 1000), type: 'weight_g' });
    }
    if (Number(opts.totalPrice) > 0) {
      targets.push({ value: Math.round(opts.totalPrice * 100), type: 'price_cents' });
    }
    if (!targets.length) return null;

    /*
     * Two framings, because a store either ends its code with a check digit or
     * ends it with the value itself. The one that matches the sample wins; if
     * the code validates as an EAN the check-digit framing is tried first.
     */
    const bodies = hasCheckDigit
      ? [{ body: c.slice(0, -1), requireCheckDigit: true }, { body: c, requireCheckDigit: false }]
      : [{ body: c, requireCheckDigit: false }];

    for (const target of targets) {
      for (const length of [5, 6, 4, 7]) {
        const needle = String(target.value).padStart(length, '0');
        if (needle.length !== length) continue;

        for (const framing of bodies) {
          const body = framing.body;

          // The field almost always ends the body; failing that, take the
          // right-most place the value appears.
          const positions = [body.length - length];
          for (let i = body.length - length - 1; i >= 4; i--) positions.push(i);

          for (const start of positions) {
            // Leave room for an item code worth looking up.
            if (start < 4 || body.substr(start, length) !== needle) continue;

            return {
              id: 'learned-' + (opts.storeId || 'store') + '-' + c.length + '-' +
                  start + '-' + length + '-' + target.type,
              label: (opts.storeName || 'This store') + ' - ' + c.length + ' digit, ' +
                     (target.type === 'weight_g' ? 'weight in grams' : 'price in cents') +
                     ' at position ' + start,
              learned: true,
              storeId: opts.storeId || '',
              length: c.length,
              prefixes: null,
              requireCheckDigit: framing.requireCheckDigit,
              itemStart: 0, itemLength: start,
              valueStart: start, valueLength: length,
              valueType: target.type
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * Decode a single embedded-field candidate, or null when the rule does not
   * apply to this code.
   */
  function applyRule(code, rule) {
    const c = normalize(code);
    if (c.length !== (rule.length || 13)) return null;
    // A rule without a prefix list applies to any code of the right length;
    // the check digit and the plausibility of the weight are what qualify it.
    if (rule.prefixes && !rule.prefixes.some(p => c.startsWith(p))) return null;
    /*
     * Only where the symbology actually has one. The built-in UPC/EAN layouts
     * need it, since without it any 12-digit product barcode would look like a
     * scale label. In-store labels printed as Code 128 or ITF carry arbitrary
     * digits and no check digit at all, so a learned rule says for itself
     * whether one applies.
     */
    if (rule.requireCheckDigit !== false && !isValidEan(c)) return null;

    const itemCode = c.substr(rule.itemStart, rule.itemLength);
    const rawValue = c.substr(rule.valueStart, rule.valueLength);
    if (!DIGITS_ONLY.test(itemCode) || !DIGITS_ONLY.test(rawValue)) return null;

    const value = parseInt(rawValue, 10);
    if (!Number.isFinite(value) || value <= 0) return null;

    const candidate = {
      ruleId: rule.id,
      ruleLabel: rule.label,
      learned: !!rule.learned,
      itemCode: itemCode,
      raw: rawValue
    };
    if (rule.valueType === 'weight_g') {
      candidate.weightKg = round3(value / 1000);
      candidate.kind = 'weight';
      // A hand-weighed pack, not a pallet: anything heavier means the layout is
      // wrong or the camera stitched two barcodes together.
      if (candidate.weightKg > 25) return null;
      /*
       * A misread of a scale label is still a valid barcode - the check digit
       * cannot catch it - but it decodes to a weight nobody carries. Flag it so
       * the shopper is warned before confirming rather than after paying.
       */
      if (candidate.weightKg > 8) candidate.unusualWeight = true;
    } else {
      candidate.totalPrice = round2(value / 100);
      candidate.kind = 'price';
    }
    return candidate;
  }

  /**
   * All plausible readings of a scale label, best first.
   *
   * `catalogUnitPrice` (Rs/kg) disambiguates weight-vs-price layouts: the
   * reading whose implied line total is sane wins.
   */
  function decodeEmbedded(code, options) {
    const opts = options || {};
    const rules = opts.rules && opts.rules.length
      ? opts.rules.map(r => (typeof r === 'string' ? ruleById(r) : r)).filter(Boolean)
      : allRules();

    const candidates = [];
    rules.forEach(rule => {
      const hit = applyRule(code, rule);
      if (hit) candidates.push(hit);
    });

    const unitPrice = Number(opts.catalogUnitPrice) || 0;
    const expectedTotal = Number(opts.expectedTotal) || 0;

    candidates.forEach(c => {
      let score = 0;
      if (opts.preferredRuleId && c.ruleId === opts.preferredRuleId) score += 100;
      if (c.learned) score += 40;
      if (c.kind === 'weight') {
        // Typical supermarket weighed pack: 100 g - 5 kg.
        if (c.weightKg >= 0.05 && c.weightKg <= 5) score += 20;
        else if (c.weightKg <= 15) score += 8;
        if (unitPrice > 0) {
          const total = c.weightKg * unitPrice;
          if (expectedTotal > 0 && Math.abs(total - expectedTotal) < 0.05) score += 60;
          else if (total >= 10 && total <= 20000) score += 10;
        }
      } else {
        if (c.totalPrice >= 10 && c.totalPrice <= 20000) score += 15;
        if (expectedTotal > 0 && Math.abs(c.totalPrice - expectedTotal) < 0.05) score += 60;
      }
      c.score = score;
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  /**
   * Single entry point used by the app: classify anything the camera, the image
   * decoder or the manual entry box produces.
   */
  function parse(raw, options) {
    const opts = options || {};
    const code = normalize(raw);
    const result = {
      raw: String(raw == null ? '' : raw).trim(),
      code: code,
      ean13: toEan13(code),
      valid: false,
      type: 'unknown',
      itemCode: code,
      candidates: []
    };
    if (!code) return result;

    if (code.length === 4 || code.length === 5) {
      result.type = 'plu';
      result.valid = true;
      result.itemCode = code;
      return result;
    }

    result.valid = isValidEan(code);

    /*
     * Try the code exactly as the scanner reported it before padding a 12-digit
     * UPC-A out to EAN-13: padding first would push a scale label's item code
     * along by one and lose the format entirely.
     */
    const forms = code.length === 12 ? [code, result.ean13] : [result.ean13, code];
    for (const form of forms) {
      const candidates = decodeEmbedded(form, opts);
      if (candidates.length) {
        result.type = 'embedded';
        result.candidates = candidates;
        result.itemCode = candidates[0].itemCode;
        result.best = candidates[0];
        return result;
      }
    }

    result.type = result.ean13.length === 8 ? 'ean8' : 'retail';
    result.itemCode = result.ean13;
    return result;
  }

  function round2(n) { return Math.round(n * 100) / 100; }
  function round3(n) { return Math.round(n * 1000) / 1000; }

  return {
    normalize,
    checkDigit,
    isValidEan,
    toEan13,
    parse,
    decodeEmbedded,
    learnRule,
    registerRules,
    allRules,
    applyRule,
    ruleById,
    EMBEDDED_RULES,
    round2,
    round3
  };
});
