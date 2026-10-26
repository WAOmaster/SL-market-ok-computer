const test = require('node:test');
const assert = require('node:assert');
const resolve = require('../js/resolve.js');
const links = require('../js/links.js');

const CATALOGUE = {
  '117953': { name: 'Keells Semolina 500g', price: 375, uom: 'NO' },
  '42551': { name: 'Keells Chilli Pieces 100g', price: 180, uom: 'NO' },
  '42554': { name: 'Keells Chilli Powder 100g', price: 180, uom: 'NO' },
  '92951': { name: 'Ambewela Uht Milk Tetra 200ml', price: 140, uom: 'NO' },
  '120573': { name: 'Catch Roasted Chilli Powder 100g', price: 390, uom: 'NO' },
  '913066': { name: 'Salad Cucumber', price: 340, uom: 'KG' },
  '11678': { name: "Ma's Chilli Powder 100g", price: 320, uom: 'NO' }
};

test.beforeEach(() => {
  links.clear();
  resolve.setLinks({});
  resolve.setItems(CATALOGUE);
});

test('the catalogue is searchable by name, which the barcode join is not', () => {
  const hits = resolve.searchItems('semolina');
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].itemCode, '117953');
  assert.strictEqual(hits[0].price, 375);
});

test('every word has to appear, so two words narrow the list', () => {
  assert.ok(resolve.searchItems('chilli').length >= 3);

  const narrowed = resolve.searchItems('keells chilli');
  assert.strictEqual(narrowed.length, 2);
  assert.ok(narrowed.every(h => h.name.startsWith('Keells Chilli')));
});

test('a name that starts with the search beats one that merely contains it', () => {
  // "Catch Roasted..." starts with it; "Ma's Chilli Powder" does not.
  assert.strictEqual(resolve.searchItems('catch')[0].itemCode, '120573');
});

test('a stray keystroke does not return the whole shop', () => {
  assert.deepStrictEqual(resolve.searchItems('a'), []);
  assert.deepStrictEqual(resolve.searchItems(''), []);
  assert.deepStrictEqual(resolve.searchItems('   '), []);
});

test('naming a packet links its barcode to that catalogue row', () => {
  // The Keells Semolina scanned on 20-09: in no barcode table anywhere.
  assert.strictEqual(resolve.lookupSync('4796002100485'), null);

  links.remember('4796002100485', { itemCode: '117953', name: 'Keells Semolina 500g' });
  resolve.setLinks(links.all());

  const hit = resolve.lookupSync('4796002100485');
  assert.strictEqual(hit.name, 'Keells Semolina 500g');
  assert.strictEqual(hit.price, 375);
  assert.strictEqual(hit.itemCode, '117953');
  assert.strictEqual(hit.linked, true);
});

test('a link stores the row, not the price, so it survives a price change', () => {
  links.remember('4796002100485', { itemCode: '117953', name: 'Keells Semolina 500g', price: 375 });
  resolve.setLinks(links.all());

  // The shop puts semolina up; the catalogue refresh carries the new price.
  resolve.setItems(Object.assign({}, CATALOGUE, {
    '117953': { name: 'Keells Semolina 500g', price: 410, uom: 'NO' }
  }));

  assert.strictEqual(resolve.lookupSync('4796002100485').price, 410);
});

test('links survive being written and read back', () => {
  links.remember('4796003698448', { itemCode: '42551', name: 'Keells Chilli Pieces 100g' });
  links.remember('4796003698493', { itemCode: '42554', name: 'Keells Chilli Powder 100g' });

  assert.strictEqual(links.count(), 2);
  assert.strictEqual(links.get('4796003698448').itemCode, '42551');

  const exported = links.toJSON();
  assert.strictEqual(exported.format, 'slscan.links.v1');
  assert.strictEqual(exported.count, 2);

  assert.strictEqual(links.forget('4796003698448'), true);
  assert.strictEqual(links.count(), 1);
  assert.strictEqual(links.forget('4796003698448'), false);
});

test('a junk link is refused rather than stored', () => {
  assert.strictEqual(links.remember('', { itemCode: '117953' }), null);
  assert.strictEqual(links.remember('4796002100485', null), null);
  assert.strictEqual(links.remember('4796002100485', { name: 'no item code' }), null);
  assert.strictEqual(links.count(), 0);
});

test('a link to a row that is no longer in the catalogue does not crash a scan', () => {
  links.remember('4796002100485', { itemCode: '999999', name: 'Discontinued thing' });
  resolve.setLinks(links.all());

  const hit = resolve.lookupSync('4796002100485');
  assert.strictEqual(hit.name, 'Discontinued thing');
  assert.strictEqual(hit.price, 0, 'unpriced rather than wrong');
});
