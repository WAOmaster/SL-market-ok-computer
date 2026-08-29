const test = require('node:test');
const assert = require('node:assert');
const cart = require('../js/cart.js');
const scanlog = require('../js/scanlog.js');
const report = require('../js/report.js');

test.beforeEach(() => { cart.clear(); scanlog.clear(); });

test('the report carries the trip, its totals and the scan log', () => {
  cart.setStore('Keells - Nugegoda');
  const added = cart.add({
    code: '923010', name: 'Banana - Seeni', category: 'Fruit',
    pricing: 'weight', unitPrice: 240, weightKg: 1.218
  });
  scanlog.record({
    source: 'camera', engine: 'native', raw: '9230101012188',
    parsed: { type: 'embedded', valid: true, code: '9230101012188', ean13: '9230101012188',
              itemCode: '923010', candidates: [{ ruleId: 'sl-weight-5', kind: 'weight', weightKg: 1.218, score: 130 }] },
    product: { code: '923010', name: 'Banana - Seeni', unitPrice: 240, pricing: 'weight', category: 'Fruit' },
    outcome: 'added', line: added.item
  });

  const out = report.build();
  assert.strictEqual(out.format, 'cart-scan.trip.v1');
  assert.strictEqual(out.trip.store, 'Keells - Nugegoda');
  assert.strictEqual(out.trip.totals.total, 292.32);
  assert.strictEqual(out.scanLog.events.length, 1);
  assert.strictEqual(out.scanLog.events[0].parsed.candidates[0].ruleId, 'sl-weight-5');
  assert.strictEqual(out.scanLog.summary.byOutcome.added, 1);
  assert.strictEqual(out.scanLog.summary.ruleHits['sl-weight-5'], 1);
});

test('verification recomputes every line independently', () => {
  cart.add({ name: 'Potatoes', pricing: 'weight', unitPrice: 390, weightKg: 1.804 });
  cart.add({ name: 'Milk 1L', pricing: 'unit', unitPrice: 690, qty: 2 });

  const v = report.build().verification;
  assert.strictEqual(v.lineCount, 2);
  assert.strictEqual(v.recomputedSubtotal, 2083.56);
  assert.strictEqual(v.subtotalAgrees, true);
  assert.strictEqual(v.disagreements.length, 0);
});

test('a line priced off the label is reported as overridden, not as an error', () => {
  cart.add({ name: 'Snake Gourd', pricing: 'weight', unitPrice: 240, weightKg: 0.220, priceOverride: 55 });

  const line = report.build().verification.lines[0];
  assert.strictEqual(line.arithmetic, 52.8);
  assert.strictEqual(line.overriddenTo, 55);
  assert.strictEqual(line.reported, 55);
  assert.strictEqual(line.agrees, true);
});

test('a line whose stored total drifted from its parts is flagged', () => {
  cart.add({ name: 'Carrot', pricing: 'weight', unitPrice: 690, weightKg: 1 });
  // Simulate a corrupted saved basket rather than a deliberate override.
  cart.getState().items[0].lineTotal = 123.45;

  const v = report.build().verification;
  assert.strictEqual(v.disagreements.length, 1);
  assert.strictEqual(v.disagreements[0].arithmetic, 690);
  assert.strictEqual(v.disagreements[0].reported, 123.45);
});

test('the till total is compared with the app total', () => {
  cart.add({ name: 'Potatoes', pricing: 'weight', unitPrice: 390, weightKg: 1.804 });

  const exact = report.build({ tillTotal: 703.56 }).billCheck;
  assert.strictEqual(exact.matches, true);
  assert.strictEqual(exact.difference, 0);

  const short = report.build({ tillTotal: 803.56 }).billCheck;
  assert.strictEqual(short.matches, false);
  assert.strictEqual(short.difference, 100);
  assert.match(short.note, /till charged more/);

  const over = report.build({ tillTotal: 603.56 }).billCheck;
  assert.strictEqual(over.difference, -100);
  assert.match(over.note, /app counted more/);
});

test('no till total means no bill check, not a broken one', () => {
  cart.add({ name: 'Bread', pricing: 'unit', unitPrice: 210 });
  assert.strictEqual(report.build().billCheck, null);
  assert.strictEqual(report.build({ tillTotal: 0 }).billCheck, null);
  assert.strictEqual(report.build({ tillTotal: 'abc' }).billCheck, null);
});

test('the report is valid JSON and round-trips', () => {
  cart.add({ code: '915013', name: 'Potatoes', pricing: 'weight', unitPrice: 390, weightKg: 1.804 });
  scanlog.record({ source: 'manual', raw: '915013', outcome: 'added' });

  const parsed = JSON.parse(report.toText({ tillTotal: 703.56, notes: 'first test run' }));
  assert.strictEqual(parsed.notes, 'first test run');
  assert.strictEqual(parsed.trip.items.length, 1);
  assert.strictEqual(parsed.billCheck.matches, true);
});
