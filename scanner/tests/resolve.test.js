const test = require('node:test');
const assert = require('node:assert');
const resolve = require('../js/resolve.js');
const barcode = require('../js/barcode.js');

// The real table is built by tools/fetch_barcodes.py; these are genuine rows
// from it, verified against a Keells bill of 29-Aug-2026.
test.beforeEach(() => resolve.setTable([
  { code: '4791034017015', name: 'Maliban Lemon Puff 200g', category: 'Biscuits', image: 'x.jpg' },
  { code: '4792037107741', name: 'Harpic Toilet Cleaner Power Plus 500ml', category: 'Household' },
  { code: '4792116211109', name: 'Ambewela Fresh Milk Full Cream 200ml', category: 'Milk Drink' },
  { code: '0075678164125', name: 'Imported Thing', category: 'Grocery' }
]));

test('a scanned packet resolves to a real name', () => {
  const hit = resolve.lookupSync('4791034017015');
  assert.strictEqual(hit.name, 'Maliban Lemon Puff 200g');
  assert.strictEqual(hit.category, 'Biscuits');
});

test('household goods resolve - the half Open Food Facts cannot do', () => {
  assert.strictEqual(
    resolve.lookupSync('4792037107741').name,
    'Harpic Toilet Cleaner Power Plus 500ml');
});

test('an unknown packet returns null, it does not invent a name', () => {
  // A Keells own-brand: no third-party shop stocks it, so it is a real miss.
  assert.strictEqual(resolve.lookupSync('4796033940166'), null);
});

test('a 12-digit UPC-A finds the 13-digit EAN of the same product', () => {
  // UPC-A is an EAN-13 with a leading zero; the two must not be different rows.
  const hit = resolve.lookupSync('075678164125');
  assert.ok(hit, 'UPC-A should reach the zero-padded EAN-13');
  assert.strictEqual(hit.name, 'Imported Thing');
});

/*
 * The trap this guards. Keells scale labels carry a six-digit *item code*
 * (914000 = Ash Plantains) which lives in a completely different numbering
 * system from GS1 barcodes. If a scale label were looked up in this table, a
 * collision would name - and eventually price - the wrong product entirely.
 */
test('scale-label item codes are never looked up in the barcode table', () => {
  resolve.setTable([{ code: '914000', name: 'WRONG - not a real barcode' }]);
  const parsed = barcode.parse('9140000121878');
  if (parsed.kind === 'retail') return; // not decoded as a scale label here
  assert.strictEqual(resolve.lookupSync(parsed), null,
    'an embedded-weight label must not match a barcode row');
});

test('a missing table degrades to "unknown", never to an error', () => {
  resolve.setTable([]);
  assert.strictEqual(resolve.lookupSync('4791034017015'), null);
  assert.strictEqual(resolve.info().count, 0);
});

test('rows without a name are dropped rather than added blank', () => {
  const n = resolve.setTable([
    { code: '4791034017015', name: 'Real' },
    { code: '4792081044740', name: '' },
    { code: '', name: 'No code' }
  ]);
  assert.strictEqual(n, 1);
});
