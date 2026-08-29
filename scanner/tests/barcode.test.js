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

/*
 * The decisive cases: 36 camera scans from one Keells shop, reconciled against
 * the printed bill. The scale prints a 12-digit UPC-A, not the 13-digit EAN the
 * label photographs suggested.
 */
test('the real Keells scale labels decode to the weights the till charged', () => {
  const samples = [
    { code: '923010012187', item: '923010', weight: 1.218, price: 240.00, till: 292.32 },
    { code: '923010004021', item: '923010', weight: 0.402, price: 240.00, till: 96.48 },
    { code: '915013018044', item: '915013', weight: 1.804, price: 390.00, till: 703.56 },
    { code: '914005023806', item: '914005', weight: 2.380, price: 380.00, till: 904.40 },
    { code: '914047002203', item: '914047', weight: 0.220, price: 240.00, till: 52.80 },
    { code: '913055000263', item: '913055', weight: 0.026, price: 1690.00, till: 43.94 },
    { code: '914034000823', item: '914034', weight: 0.082, price: 210.00, till: 17.22 },
    { code: '915016005102', item: '915016', weight: 0.510, price: 440.00, till: 224.40 },
    // Grocery scale items carry no 91/92 prefix - their item code is padded.
    { code: '004681010068', item: '004681', weight: 1.006, price: 240.00, till: 241.44 },
    { code: '015427005644', item: '015427', weight: 0.564, price: 240.00, till: 135.36 },
    { code: '021445011666', item: '021445', weight: 1.166, price: 212.00, till: 247.19 }
  ];

  samples.forEach(s => {
    const parsed = barcode.parse(s.code, { catalogUnitPrice: s.price });
    assert.strictEqual(parsed.type, 'embedded', s.code + ' type');
    assert.strictEqual(parsed.valid, true, s.code + ' check digit');
    assert.strictEqual(parsed.itemCode, s.item, s.code + ' item code');
    assert.strictEqual(parsed.best.weightKg, s.weight, s.code + ' weight');
    assert.strictEqual(barcode.round2(s.weight * s.price), s.till, s.code + ' line total');
  });
});

test('a 12-digit label is not padded to EAN-13 before it is decoded', () => {
  // Padding first shifts the item code along by one and loses the format.
  const parsed = barcode.parse('923010012187');
  assert.strictEqual(parsed.itemCode, '923010');
  assert.notStrictEqual(parsed.itemCode, '092301');
});

test('a Sri Lankan product barcode stays a retail code', () => {
  ['4792037107741', '4792116211109', '4791034017015', '4796033940166'].forEach(code => {
    const parsed = barcode.parse(code);
    assert.strictEqual(parsed.type, 'retail', code);
    assert.strictEqual(parsed.itemCode, code, code);
  });
});

test('a camera misread decodes to a weight nobody carries, and is flagged', () => {
  // Both are valid barcodes, so no check digit can reject them; the weight can.
  const gourd = barcode.parse('541400092702');
  assert.strictEqual(gourd.best.weightKg, 9.27);
  assert.strictEqual(gourd.best.unusualWeight, true);

  const rice = barcode.parse('544446141007');
  assert.strictEqual(rice.best.weightKg, 14.1);
  assert.strictEqual(rice.best.unusualWeight, true);

  // A real pack is not flagged.
  assert.strictEqual(barcode.parse('914005023806').best.unusualWeight, undefined);
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
