/**
 * Run with: node --test scanner/tests
 * The pure modules (barcode, cart, label parsing) are testable outside a browser;
 * the camera layer is not, and is exercised by hand.
 */
const test = require('node:test');
const assert = require('node:assert');
const barcode = require('../js/barcode.js');

test('EAN-13 check digits', () => {
  // The banana label from the sample photos.
  assert.strictEqual(barcode.checkDigit('923010101218'), 8);
  assert.ok(barcode.isValidEan('9230101012188'));
  assert.ok(!barcode.isValidEan('9230101012187'));
  assert.ok(barcode.isValidEan('4006381333931'));
});

test('UPC-A is padded to EAN-13', () => {
  assert.strictEqual(barcode.toEan13('012345678905'), '0012345678905');
  assert.strictEqual(barcode.toEan13('9230101012188'), '9230101012188');
});

test('separators and stray characters are stripped', () => {
  assert.strictEqual(barcode.normalize(' 923010 1012188 '), '9230101012188');
  assert.strictEqual(barcode.normalize('92-3010-1012188'), '9230101012188');
});

test('the banana scale label decodes to 1.218 kg', () => {
  const parsed = barcode.parse('9230101012188', { catalogUnitPrice: 240 });
  assert.strictEqual(parsed.type, 'embedded');
  assert.strictEqual(parsed.valid, true);
  assert.strictEqual(parsed.itemCode, '923010');
  assert.strictEqual(parsed.best.kind, 'weight');
  assert.strictEqual(parsed.best.weightKg, 1.218);
  // The printed total on the sticker.
  assert.strictEqual(barcode.round2(parsed.best.weightKg * 240), 292.32);
});

test('the sample labels all reproduce their printed totals', () => {
  const samples = [
    { code: '923010', weight: 1.218, unitPrice: 240.00, printed: 292.32 },
    { code: '915013', weight: 1.804, unitPrice: 390.00, printed: 703.56 },
    { code: '914047', weight: 0.220, unitPrice: 240.00, printed: 52.80 },
    { code: '914005', weight: 2.380, unitPrice: 380.00, printed: 904.40 }
  ];

  samples.forEach(s => {
    const grams = String(Math.round(s.weight * 1000)).padStart(5, '0');
    const body = s.code + '0' + grams;
    const full = body + barcode.checkDigit(body);

    const parsed = barcode.parse(full, { catalogUnitPrice: s.unitPrice, expectedTotal: s.printed });
    assert.strictEqual(parsed.itemCode, s.code, s.code + ' item code');
    assert.strictEqual(parsed.best.weightKg, s.weight, s.code + ' weight');
    assert.strictEqual(barcode.round2(parsed.best.weightKg * s.unitPrice), s.printed, s.code + ' total');
  });
});

test('a plain retail barcode is not treated as a weighed label', () => {
  const parsed = barcode.parse('4006381333931');
  assert.strictEqual(parsed.type, 'retail');
  assert.strictEqual(parsed.itemCode, '4006381333931');
  assert.strictEqual(parsed.candidates.length, 0);
});

test('PLU codes are recognised', () => {
  const parsed = barcode.parse('4011');
  assert.strictEqual(parsed.type, 'plu');
  assert.strictEqual(parsed.itemCode, '4011');
});

test('an absurd weight rules a layout out', () => {
  // 99.999 kg of gourd is not a layout that applies.
  const candidates = barcode.decodeEmbedded('9140479999998', { rules: ['sl-weight-6'] });
  assert.strictEqual(candidates.length, 0);
});

test('the printed total picks the right layout when two could fit', () => {
  const body = '914005' + '0' + '02380';
  const full = body + barcode.checkDigit(body);
  const candidates = barcode.decodeEmbedded(full, { catalogUnitPrice: 380, expectedTotal: 904.40 });
  assert.strictEqual(candidates[0].kind, 'weight');
  assert.strictEqual(candidates[0].weightKg, 2.380);
});

test('empty and junk input is handled without throwing', () => {
  assert.strictEqual(barcode.parse('').type, 'unknown');
  assert.strictEqual(barcode.parse(null).code, '');
  assert.strictEqual(barcode.parse('abc').type, 'unknown');
});
