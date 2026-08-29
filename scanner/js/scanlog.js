/**
 * A diary of what the scanner actually did.
 *
 * The cart says what ended up in the trolley; this says how each line got there
 * - the raw code, how it was decoded, which layout rule won, whether the catalog
 *   knew it, and what OCR made of the label. Scans that were rejected or that
 *   never became a line are recorded too, because those are the ones worth
 *   looking at after a test run.
 *
 * It exists so a shopping trip can be exported as one JSON object and read back
 * later - by a person or by Claude - against the printed till receipt.
 */
(function (root, factory) {
  const api = factory();
  root.SLScan = root.SLScan || {};
  root.SLScan.scanlog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'slscan.scanlog.v1';
  const MAX_EVENTS = 300;
  const MAX_OCR_TEXT = 1200;

  const OUTCOMES = [
    'added',      // scanned, priced from the catalog, straight into the cart
    'merged',     // same packet again: its count went up
    'prompted',   // unknown or incomplete: the shopper was asked
    'confirmed',  // the shopper answered the prompt and the line was added
    'cancelled',  // the shopper was asked and walked away from it
    'rejected',   // nothing usable came out of the scan
    'error'       // the camera, the decoder or OCR failed
  ];

  let events = null;
  let seq = 0;

  function storage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (err) { /* private mode */ }
    return null;
  }

  function load() {
    if (events) return events;
    events = [];
    const store = storage();
    if (store) {
      try {
        const raw = store.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) events = parsed;
        }
      } catch (err) {
        console.warn('Scan log could not be read; starting a fresh one.', err);
      }
    }
    seq = events.reduce((max, e) => Math.max(max, e.seq || 0), 0);
    return events;
  }

  function persist() {
    const store = storage();
    if (!store) return;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (err) {
      // A full quota should never cost the shopper their trolley: drop the
      // oldest half of the log and try once more.
      events = events.slice(-Math.floor(MAX_EVENTS / 2));
      try { store.setItem(STORAGE_KEY, JSON.stringify(events)); } catch (err2) { /* give up quietly */ }
    }
  }

  /** Keep only the fields worth reading back, and keep them small. */
  function trimParsed(parsed) {
    if (!parsed) return null;
    return {
      type: parsed.type,
      valid: parsed.valid,
      code: parsed.code,
      ean13: parsed.ean13,
      itemCode: parsed.itemCode,
      candidates: (parsed.candidates || []).map(c => ({
        ruleId: c.ruleId,
        kind: c.kind,
        weightKg: c.weightKg,
        totalPrice: c.totalPrice,
        score: c.score
      }))
    };
  }

  function trimProduct(product) {
    if (!product) return { hit: false };
    return {
      hit: true,
      code: product.code,
      name: product.name,
      unitPrice: product.unitPrice,
      pricing: product.pricing,
      category: product.category
    };
  }

  function trimOcr(ocr, keepRawText) {
    if (!ocr) return null;
    const out = {
      name: ocr.name,
      itemCode: ocr.itemCode,
      barcode: ocr.barcode,
      weightKg: ocr.weightKg,
      unitPrice: ocr.unitPrice,
      totalPrice: ocr.totalPrice,
      confidence: ocr.confidence,
      derived: ocr.derived || null,
      mismatch: !!ocr.mismatch
    };
    if (keepRawText && ocr.raw) out.rawText = String(ocr.raw).slice(0, MAX_OCR_TEXT);
    return out;
  }

  function trimLine(item) {
    if (!item) return null;
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      pricing: item.pricing,
      qty: item.qty,
      weightKg: item.weightKg,
      unitPrice: item.unitPrice,
      priceOverride: item.priceOverride == null ? null : item.priceOverride,
      lineTotal: item.lineTotal
    };
  }

  /**
   * Record one scan. Everything except `outcome` is optional - a rejected scan
   * legitimately has no product and no line.
   */
  function record(entry) {
    load();
    const e = entry || {};
    const event = {
      seq: ++seq,
      at: new Date().toISOString(),
      source: e.source || 'unknown',
      engine: e.engine || null,
      raw: e.raw == null ? null : String(e.raw).slice(0, 64),
      outcome: OUTCOMES.includes(e.outcome) ? e.outcome : 'error',
      message: e.message || null,
      parsed: trimParsed(e.parsed),
      catalog: trimProduct(e.product),
      ocr: trimOcr(e.ocr, e.keepRawText),
      line: trimLine(e.line)
    };

    events.push(event);
    if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
    persist();
    return event;
  }

  function all() { return load().slice(); }

  function clear() {
    events = [];
    seq = 0;
    const store = storage();
    if (store) {
      try { store.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
    }
    return [];
  }

  /**
   * What went right and what did not, at a glance - the part worth reading
   * first when a test run comes back.
   */
  function summary() {
    const log = load();
    const byOutcome = {};
    const bySource = {};
    const unresolved = [];
    const ruleHits = {};

    log.forEach(e => {
      byOutcome[e.outcome] = (byOutcome[e.outcome] || 0) + 1;
      bySource[e.source] = (bySource[e.source] || 0) + 1;

      if (e.outcome === 'rejected' || e.outcome === 'error' || e.outcome === 'cancelled') {
        unresolved.push({ seq: e.seq, raw: e.raw, source: e.source, message: e.message });
      }
      const winner = e.parsed && e.parsed.candidates && e.parsed.candidates[0];
      if (winner && winner.ruleId) ruleHits[winner.ruleId] = (ruleHits[winner.ruleId] || 0) + 1;
    });

    const decoded = log.filter(e => e.parsed && e.parsed.type && e.parsed.type !== 'unknown').length;
    const checkDigitFailures = log
      .filter(e => e.parsed && e.parsed.code && e.parsed.code.length >= 8 && e.parsed.valid === false)
      .map(e => e.parsed.code);

    return {
      events: log.length,
      byOutcome: byOutcome,
      bySource: bySource,
      decoded: decoded,
      ruleHits: ruleHits,
      checkDigitFailures: checkDigitFailures,
      unresolved: unresolved
    };
  }

  return { record, all, clear, summary, STORAGE_KEY, MAX_EVENTS, OUTCOMES };
});
