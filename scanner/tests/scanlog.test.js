const test = require('node:test');
const assert = require('node:assert');
const scanlog = require('../js/scanlog.js');

test.beforeEach(() => scanlog.clear());

test('a scan is recorded with its decode detail', () => {
  const event = scanlog.record({
    source: 'camera', engine: 'native', raw: '9230101012188',
    parsed: {
      type: 'embedded', valid: true, code: '9230101012188', ean13: '9230101012188', itemCode: '923010',
      candidates: [{ ruleId: 'sl-weight-5', kind: 'weight', weightKg: 1.218, score: 130, ruleLabel: 'noise' }]
    },
    product: { code: '923010', name: 'Banana - Seeni', unitPrice: 240, pricing: 'weight', category: 'Fruit' },
    outcome: 'added',
    line: { id: 'line-1', name: 'Banana - Seeni', pricing: 'weight', weightKg: 1.218, unitPrice: 240, lineTotal: 292.32 }
  });

  assert.strictEqual(event.seq, 1);
  assert.strictEqual(event.outcome, 'added');
  assert.strictEqual(event.catalog.hit, true);
  assert.strictEqual(event.parsed.candidates[0].weightKg, 1.218);
  // Only the fields worth reading back are kept.
  assert.strictEqual(event.parsed.candidates[0].ruleLabel, undefined);
  assert.ok(event.at);
});

test('a failed scan is recorded too', () => {
  scanlog.record({ source: 'photo', outcome: 'error', message: 'No barcode found in that photo.' });
  const events = scanlog.all();

  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].catalog.hit, false);
  assert.strictEqual(events[0].line, null);
  assert.strictEqual(events[0].message, 'No barcode found in that photo.');
});

test('an unrecognised outcome is stored as an error rather than silently kept', () => {
  assert.strictEqual(scanlog.record({ outcome: 'banana' }).outcome, 'error');
});

test('raw OCR text is kept only when asked for', () => {
  const ocr = { name: 'Potatoes', weightKg: 1.804, unitPrice: 390, totalPrice: 703.56,
                confidence: 0.9, raw: 'POTATOES\n1.804 390.00 703.56' };

  assert.strictEqual(scanlog.record({ outcome: 'prompted', ocr: ocr }).ocr.rawText, undefined);
  assert.match(scanlog.record({ outcome: 'prompted', ocr: ocr, keepRawText: true }).ocr.rawText, /POTATOES/);
});

test('the summary counts outcomes, sources and winning rules', () => {
  scanlog.record({ source: 'camera', outcome: 'added',
    parsed: { type: 'embedded', valid: true, code: '9230101012188', candidates: [{ ruleId: 'sl-weight-5' }] } });
  scanlog.record({ source: 'camera', outcome: 'merged',
    parsed: { type: 'retail', valid: true, code: '4006381333931', candidates: [] } });
  scanlog.record({ source: 'manual', outcome: 'rejected', raw: 'abc', message: 'No digits.' });

  const s = scanlog.summary();
  assert.strictEqual(s.events, 3);
  assert.strictEqual(s.byOutcome.added, 1);
  assert.strictEqual(s.bySource.camera, 2);
  assert.strictEqual(s.ruleHits['sl-weight-5'], 1);
  assert.strictEqual(s.unresolved.length, 1);
  assert.strictEqual(s.unresolved[0].raw, 'abc');
});

test('a bad check digit is surfaced in the summary', () => {
  scanlog.record({ source: 'camera', outcome: 'added',
    parsed: { type: 'retail', valid: false, code: '9230101012187', candidates: [] } });
  assert.deepStrictEqual(scanlog.summary().checkDigitFailures, ['9230101012187']);
});

test('the log is capped so a long trip cannot grow without limit', () => {
  for (let i = 0; i < scanlog.MAX_EVENTS + 25; i++) {
    scanlog.record({ source: 'manual', outcome: 'added', raw: String(i) });
  }
  const events = scanlog.all();
  assert.strictEqual(events.length, scanlog.MAX_EVENTS);
  // The newest scans are the ones kept.
  assert.strictEqual(events[events.length - 1].raw, String(scanlog.MAX_EVENTS + 24));
});
