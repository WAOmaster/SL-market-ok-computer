/**
 * Builds the single JSON object that describes a whole shopping trip.
 *
 * Written to be read by someone who was not there: what was scanned, what it was
 * decoded as, what the app charged, and - independently recomputed here - what
 * the arithmetic says it should have charged. If the app and the recomputation
 * disagree, the report says so rather than quietly agreeing with itself.
 *
 * When the shopper types in what the till actually charged, the report also
 * carries that variance, which is the whole point of a test run.
 */
(function (root, factory) {
  const deps = root.SLScan || {};
  const api = factory(
    deps.cart || require('./cart.js'),
    deps.scanlog || require('./scanlog.js'),
    deps.barcode || require('./barcode.js')
  );
  root.SLScan = root.SLScan || {};
  root.SLScan.report = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function (cart, scanlog, barcode) {
  'use strict';

  const FORMAT = 'cart-scan.trip.v1';
  const round2 = barcode.round2;

  function environment() {
    if (typeof navigator === 'undefined') return { runtime: 'node' };
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      secureContext: typeof window !== 'undefined' ? !!window.isSecureContext : null,
      nativeBarcodeDetector: typeof window !== 'undefined' && 'BarcodeDetector' in window,
      screen: typeof window !== 'undefined'
        ? { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio }
        : null
    };
  }

  /**
   * Recompute every line from its own parts. A line only "agrees" when the
   * stored total matches the arithmetic, or when it was deliberately overridden
   * from the printed label - which is flagged rather than hidden.
   */
  function verify(trip) {
    const lines = [];
    let recomputed = 0;

    (trip.items || []).forEach(item => {
      const arithmetic = round2(
        item.pricing === 'weight'
          ? (item.weightKg || 0) * (item.unitPrice || 0)
          : (item.qty || 0) * (item.unitPrice || 0)
      );
      const expected = item.priceOverride != null ? round2(item.priceOverride) : arithmetic;
      const reported = round2(item.lineTotal || 0);
      recomputed += reported;

      lines.push({
        id: item.id,
        name: item.name,
        code: item.code,
        pricing: item.pricing,
        qty: item.qty,
        weightKg: item.weightKg,
        unitPrice: item.unitPrice,
        arithmetic: arithmetic,
        overriddenTo: item.priceOverride == null ? null : round2(item.priceOverride),
        reported: reported,
        agrees: Math.abs(expected - reported) < 0.005
      });
    });

    recomputed = round2(recomputed);
    const reportedSubtotal = round2((trip.totals && trip.totals.subtotal) || 0);

    return {
      lineCount: lines.length,
      recomputedSubtotal: recomputed,
      reportedSubtotal: reportedSubtotal,
      subtotalAgrees: Math.abs(recomputed - reportedSubtotal) < 0.005,
      disagreements: lines.filter(l => !l.agrees),
      lines: lines
    };
  }

  /** The app's total against what the till actually charged. */
  function billCheck(trip, tillTotal) {
    const till = Number(tillTotal);
    if (!Number.isFinite(till) || till <= 0) return null;

    const appTotal = round2((trip.totals && trip.totals.total) || 0);
    const difference = round2(till - appTotal);

    return {
      tillTotal: round2(till),
      appTotal: appTotal,
      difference: difference,
      matches: Math.abs(difference) < 0.005,
      // Which way the app is wrong is the first thing to know.
      note: Math.abs(difference) < 0.005
        ? 'The app matched the till.'
        : (difference > 0
          ? 'The till charged more than the app counted - something was missed or underpriced.'
          : 'The app counted more than the till charged - something was double counted or overpriced.')
    };
  }

  /**
   * The whole trip as one object.
   * `options.tillTotal` is what the printed bill says; `options.notes` is free text.
   */
  function build(options) {
    const opts = options || {};
    const trip = cart.toJSON();

    return {
      format: FORMAT,
      generatedAt: new Date().toISOString(),
      environment: environment(),
      trip: trip,
      verification: verify(trip),
      billCheck: billCheck(trip, opts.tillTotal),
      notes: opts.notes || null,
      scanLog: {
        summary: scanlog.summary(),
        events: scanlog.all()
      }
    };
  }

  function toText(options) {
    return JSON.stringify(build(options), null, 2);
  }

  return { build, toText, verify, billCheck, environment, FORMAT };
});
