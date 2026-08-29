/**
 * Reads the printed text of a scale label.
 *
 * The barcode alone gives an item code and a weight; the sticker also prints the
 * product name, the price per kilo and the total. When the barcode is damaged,
 * creased or out of focus - which is most of the time on a crumpled produce bag -
 * this text is what saves the scan, so OCR output is parsed here and used both as
 * a fallback and as a cross-check on the barcode reading.
 *
 * OCR itself (Tesseract.js) is loaded lazily and only when the user asks for it;
 * the parser below is pure text handling and is unit tested.
 */
(function (root, factory) {
  const api = factory(root.SLScan && root.SLScan.barcode ? root.SLScan.barcode : require('./barcode.js'));
  root.SLScan = root.SLScan || {};
  root.SLScan.label = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function (barcode) {
  'use strict';

  const NUMBER = '(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';

  function toNumber(text) {
    if (text == null) return null;
    const n = parseFloat(String(text).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function firstMatch(text, patterns) {
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        const n = toNumber(m[1]);
        if (n != null) return n;
      }
    }
    return null;
  }

  /**
   * Scale labels print their numbers in a row and the captions in the row above
   * or below ("1.218  240.00  292.32" / "Weight  U/Price  T/Price"), so no
   * caption sits next to its own value. Matching the two rows by column position
   * is what actually reads these labels; the regexes below are the fallback for
   * layouts that do keep caption and value together.
   */
  const CAPTIONS = [
    { field: 'totalPrice', re: /T\s*\/?\s*Price/ig },
    { field: 'unitPrice', re: /U\s*\/?\s*Price/ig },
    { field: 'weightKg', re: /Weight/ig }
  ];

  function numbersIn(line) {
    const matches = line.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?/g) || [];
    return matches
      .filter(m => m.length <= 10)          // drop barcodes and date stamps
      .map(toNumber)
      .filter(n => n != null);
  }

  function parseColumns(lines) {
    for (let i = 0; i < lines.length; i++) {
      const found = [];
      CAPTIONS.forEach(cap => {
        cap.re.lastIndex = 0;
        let m;
        while ((m = cap.re.exec(lines[i])) !== null) found.push({ field: cap.field, at: m.index });
      });

      // Two captions on one line is what makes a caption row identifiable.
      const unique = [];
      found.sort((a, b) => a.at - b.at).forEach(f => {
        if (!unique.some(u => u.field === f.field)) unique.push(f);
      });
      if (unique.length < 2) continue;

      const neighbours = [lines[i - 1], lines[i + 1]].filter(Boolean);
      for (const neighbour of neighbours) {
        const values = numbersIn(neighbour);
        if (values.length !== unique.length) continue;
        const out = {};
        unique.forEach((cap, idx) => { out[cap.field] = values[idx]; });
        return out;
      }
    }
    return null;
  }

  /**
   * Pull the fields out of raw OCR text. Everything is optional - the caller
   * decides what it can use.
   */
  function parse(rawText) {
    const text = String(rawText || '');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const flat = lines.join(' ');

    const result = {
      raw: text,
      name: null,
      itemCode: null,
      barcode: null,
      weightKg: null,
      unitPrice: null,
      totalPrice: null,
      confidence: 0
    };

    // A 13-digit run is the barcode; a lone 6-digit run is the item code header.
    const ean = flat.match(/\b(\d{13})\b/);
    if (ean) {
      result.barcode = ean[1];
      result.itemCode = ean[1].slice(0, 6);
    } else {
      const item = flat.match(/\b(9\d{5})\b/);
      if (item) result.itemCode = item[1];
    }

    const columns = parseColumns(lines) || {};
    if (columns.weightKg != null) result.weightKg = columns.weightKg;
    if (columns.unitPrice != null) result.unitPrice = columns.unitPrice;
    if (columns.totalPrice != null) result.totalPrice = columns.totalPrice;

    if (result.totalPrice == null) result.totalPrice = firstMatch(flat, [
      new RegExp(NUMBER + '\\s*T\\s*/?\\s*Price', 'i'),
      new RegExp('T\\s*/?\\s*Price\\D{0,12}' + NUMBER, 'i'),
      new RegExp('Total\\D{0,12}' + NUMBER, 'i')
    ]);

    if (result.unitPrice == null) result.unitPrice = firstMatch(flat, [
      new RegExp(NUMBER + '\\s*U\\s*/?\\s*price', 'i'),
      new RegExp('U\\s*/?\\s*price\\D{0,12}' + NUMBER, 'i'),
      new RegExp(NUMBER + '\\s*Rs\\.?\\s*/\\s*Kg', 'i')
    ]);

    if (result.weightKg == null) result.weightKg = firstMatch(flat, [
      new RegExp('Weight\\D{0,12}' + NUMBER, 'i'),
      new RegExp(NUMBER + '\\s*\\bkg\\b', 'i'),
      /\b(\d\.\d{3})\b/
    ]);

    // Grams printed as "220 g" rather than "0.220 kg".
    const grams = flat.match(new RegExp(NUMBER + '\\s*\\bg\\b(?!\\w)', 'i'));
    if (result.weightKg == null && grams) {
      const g = toNumber(grams[1]);
      if (g != null && g > 20) result.weightKg = barcode.round3(g / 1000);
    }

    result.name = pickName(lines);

    // Fill in whichever of the three price fields is missing but derivable.
    reconcile(result);

    let score = 0;
    if (result.name) score += 0.25;
    if (result.weightKg) score += 0.25;
    if (result.unitPrice) score += 0.2;
    if (result.totalPrice) score += 0.2;
    if (result.barcode && barcode.isValidEan(result.barcode)) score += 0.1;
    result.confidence = Math.min(1, Math.round(score * 100) / 100);

    return result;
  }

  /**
   * The product name is the line that carries real words.
   *
   * Everything else on the sticker is either digits or a field caption
   * ("Weight", "U/Price", "Rs./Kg."), so a line made up only of caption tokens is
   * discarded however long it is - which matters, because "Kg Rs./Kg. Rs./Kg."
   * is longer than most product names.
   */
  const NOISE_TOKENS = new Set([
    'weight', 'wt', 'net', 'u', 't', 'price', 'uprice', 'tprice', 'total',
    'rs', 'kg', 'kgs', 'g', 'gm', 'gms', 'no', 'barcode', 'qty', 'each', 'date'
  ]);

  function pickName(lines) {
    let best = null;
    let bestScore = 0;

    lines.forEach(line => {
      const cleaned = line.replace(/[^A-Za-z0-9 &\-\/']/g, ' ').replace(/\s+/g, ' ').trim();
      if (!cleaned) return;

      const tokens = cleaned.split(/[\s\/]+/).filter(Boolean);
      const content = tokens.filter(tok => !NOISE_TOKENS.has(tok.toLowerCase()));
      const words = content.filter(tok => (tok.match(/[A-Za-z]/g) || []).length >= 3);
      if (!words.length) return;

      const letters = words.join('').replace(/[^A-Za-z]/g, '').length;
      if (letters < 3) return;

      // Product names are printed in caps on these labels.
      const score = letters + (line === line.toUpperCase() ? 5 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = words.join(' ');
      }
    });

    return best ? titleCase(best) : null;
  }

  function titleCase(s) {
    return s.toLowerCase().replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
  }

  /** weight x unit price = total: given any two, derive the third. */
  function reconcile(r) {
    const near = (a, b) => Math.abs(a - b) <= Math.max(0.05, b * 0.02);

    if (r.weightKg && r.unitPrice && r.totalPrice) {
      if (!near(r.weightKg * r.unitPrice, r.totalPrice)) r.mismatch = true;
      return r;
    }
    if (r.weightKg && r.unitPrice && !r.totalPrice) {
      r.totalPrice = barcode.round2(r.weightKg * r.unitPrice);
      r.derived = 'totalPrice';
    } else if (r.weightKg && r.totalPrice && !r.unitPrice) {
      r.unitPrice = barcode.round2(r.totalPrice / r.weightKg);
      r.derived = 'unitPrice';
    } else if (r.unitPrice && r.totalPrice && !r.weightKg && r.unitPrice > 0) {
      r.weightKg = barcode.round3(r.totalPrice / r.unitPrice);
      r.derived = 'weightKg';
    }
    return r;
  }

  /**
   * Merge an OCR reading with a barcode reading into the line the app will add.
   * The barcode wins on identity, the label wins on money.
   */
  function merge(barcodeResult, ocrResult, catalogEntry) {
    const out = {
      code: (barcodeResult && barcodeResult.itemCode) || (ocrResult && ocrResult.itemCode) || '',
      barcode: (barcodeResult && barcodeResult.ean13) || (ocrResult && ocrResult.barcode) || '',
      name: (catalogEntry && catalogEntry.name) || (ocrResult && ocrResult.name) || '',
      category: (catalogEntry && catalogEntry.category) || 'Other',
      pricing: 'unit',
      unit: 'pc',
      qty: 1,
      weightKg: 0,
      unitPrice: (catalogEntry && catalogEntry.unitPrice) || 0,
      source: 'scan'
    };

    const best = barcodeResult && barcodeResult.best;
    if ((best && best.kind === 'weight') || (ocrResult && ocrResult.weightKg) ||
        (catalogEntry && catalogEntry.pricing === 'weight')) {
      out.pricing = 'weight';
      out.unit = 'kg';
      out.weightKg = (best && best.weightKg) || (ocrResult && ocrResult.weightKg) || 0;
    }

    if (ocrResult && ocrResult.unitPrice) out.unitPrice = ocrResult.unitPrice;
    if (best && best.kind === 'price') out.priceOverride = best.totalPrice;
    if (ocrResult && ocrResult.totalPrice) {
      const computed = out.pricing === 'weight' ? out.weightKg * out.unitPrice : out.qty * out.unitPrice;
      // Trust the printed total when the arithmetic disagrees with it.
      if (!computed || Math.abs(computed - ocrResult.totalPrice) > 0.05) {
        out.priceOverride = ocrResult.totalPrice;
      }
    }
    return out;
  }

  return { parse, merge, reconcile, pickName };
});
