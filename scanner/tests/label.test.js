const test = require('node:test');
const assert = require('node:assert');
const label = require('../js/label.js');

// Roughly what Tesseract returns for the banana sticker in the sample photos.
const BANANA_OCR = [
  '923010',
  'BANANA SEENI',
  '1.218   240.00   292.32',
  'Weight  U/Price  T/Price',
  'Kg      Rs./Kg.  Rs./Kg.',
  '9230101012188  26-08-29 17:31'
].join('\n');

test('a scale label is read into its fields', () => {
  const r = label.parse(BANANA_OCR);
  assert.strictEqual(r.name, 'Banana Seeni');
  assert.strictEqual(r.barcode, '9230101012188');
  assert.strictEqual(r.itemCode, '923010');
  assert.strictEqual(r.weightKg, 1.218);
  assert.strictEqual(r.unitPrice, 240);
  assert.strictEqual(r.totalPrice, 292.32);
  assert.ok(r.confidence >= 0.9);
});

test('a missing field is derived from the other two', () => {
  const r = label.parse('POTATOES\nWeight 1.804 Kg\nU/Price 390.00');
  assert.strictEqual(r.totalPrice, 703.56);
  assert.strictEqual(r.derived, 'totalPrice');

  const r2 = label.parse('ONIONS\n904.40 T/Price\n380.00 U/price');
  assert.strictEqual(r2.weightKg, 2.38);
  assert.strictEqual(r2.derived, 'weightKg');
});

test('grams are converted to kilograms', () => {
  const r = label.parse('SNAKE GOURD\n220 g\n240.00 U/price');
  assert.strictEqual(r.weightKg, 0.22);
  assert.strictEqual(r.totalPrice, 52.8);
});

test('a misprinted label is flagged rather than silently accepted', () => {
  const r = label.parse('CARROT\nWeight 1.000\nU/price 690.00\n999.00 T/Price');
  assert.strictEqual(r.mismatch, true);
});

test('field captions are never mistaken for the product name', () => {
  const r = label.parse('Weight\nU/Price\nT/Price\nRED ONIONS\nRs./Kg.');
  assert.strictEqual(r.name, 'Red Onions');
});

test('unreadable text yields an empty, low-confidence reading', () => {
  const r = label.parse('|||  ###  ~~~');
  assert.strictEqual(r.name, null);
  assert.strictEqual(r.totalPrice, null);
  assert.strictEqual(r.confidence, 0);
});

test('barcode and label readings merge, with the label winning on price', () => {
  const merged = label.merge(
    { itemCode: '923010', ean13: '9230101012188', best: { kind: 'weight', weightKg: 1.218 } },
    label.parse(BANANA_OCR),
    { name: 'Banana - Seeni', unitPrice: 240, pricing: 'weight', category: 'Fruit' }
  );

  assert.strictEqual(merged.name, 'Banana - Seeni');
  assert.strictEqual(merged.pricing, 'weight');
  assert.strictEqual(merged.weightKg, 1.218);
  assert.strictEqual(merged.unitPrice, 240);
  // Arithmetic already agrees with the sticker, so nothing is overridden.
  assert.strictEqual(merged.priceOverride, undefined);
});

test('when the sticker total disagrees with the maths, the sticker wins', () => {
  const ocr = label.parse('MANIOC\nWeight 1.000\nU/price 320.00\n350.00 T/Price');
  const merged = label.merge(null, ocr, { name: 'Manioc', unitPrice: 320, pricing: 'weight', category: 'Vegetable' });
  assert.strictEqual(merged.priceOverride, 350);
});
