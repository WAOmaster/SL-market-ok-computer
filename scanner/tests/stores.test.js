const test = require('node:test');
const assert = require('node:assert');
const barcode = require('../js/barcode.js');
const catalog = require('../js/catalog.js');
const stores = require('../js/stores.js');

test.beforeEach(() => { stores.reset(); catalog.reset(); });

test('branches of a chain share a price list, other chains do not', () => {
  assert.strictEqual(stores.chainOf('Keells - Panadura'), 'keells');
  assert.strictEqual(stores.chainOf('keells nugegoda'), 'keells');
  assert.strictEqual(stores.chainOf('Cargills Food City Kalutara'), 'cargills');
  assert.strictEqual(stores.chainOf(''), '');
});

test('a price from another chain is offered, never charged silently', () => {
  // The built-in list is Keells data.
  const home = catalog.find('915013', { store: 'keells' });
  assert.strictEqual(home.name, 'Potatoes');
  assert.ok(!home.fromOtherStore);

  const away = catalog.find('915013', { store: 'cargills' });
  assert.strictEqual(away.unitPrice, 390);
  assert.strictEqual(away.fromOtherStore, true, 'must be flagged for confirmation');
  assert.strictEqual(away.store, 'keells', 'and say where the price came from');
});

test('naming a code at one chain does not disturb another', () => {
  catalog.upsert({ code: '915013', name: 'Potato (Cargills)', unitPrice: 420, pricing: 'weight', store: 'cargills' });

  assert.strictEqual(catalog.find('915013', { store: 'cargills' }).unitPrice, 420);
  assert.strictEqual(catalog.find('915013', { store: 'keells' }).unitPrice, 390);
});

test('the same item code can mean different things in different chains', () => {
  catalog.upsert({ code: '914044', name: 'Something Else', unitPrice: 500, pricing: 'weight', store: 'cargills' });

  assert.strictEqual(catalog.find('914044', { store: 'keells' }).name, 'Ribbed Gourd');
  assert.strictEqual(catalog.find('914044', { store: 'cargills' }).name, 'Something Else');
});

test('a label format is learned from one confirmed weight', () => {
  // The ribbed gourd label: 914044 | 00570 | 2, weighed at 0.570 kg.
  const rule = barcode.learnRule('914044005702', { weightKg: 0.570, storeId: 'keells', storeName: 'Keells' });

  assert.ok(rule);
  assert.strictEqual(rule.length, 12);
  assert.strictEqual(rule.itemLength, 6);
  assert.strictEqual(rule.valueStart, 6);
  assert.strictEqual(rule.valueLength, 5);
  assert.strictEqual(rule.valueType, 'weight_g');
});

test('what is learned from one label reads the rest of the shop', () => {
  const rule = barcode.learnRule('914044005702', { weightKg: 0.570, storeId: 'keells' });
  barcode.registerRules([rule]);

  assert.strictEqual(barcode.parse('915013018044').best.weightKg, 1.804);
  assert.strictEqual(barcode.parse('923010012187').best.weightKg, 1.218);

  barcode.registerRules([]);
});

test('a store that hides the price instead of the weight is learned too', () => {
  // A made-up 13-digit layout: item(7) + total price in cents(5) + check.
  const body = '2312345' + '01234';
  const code = body + barcode.checkDigit(body);

  const rule = barcode.learnRule(code, { totalPrice: 12.34, storeId: 'elsewhere' });
  assert.strictEqual(rule.valueType, 'price_cents');
  assert.strictEqual(rule.itemLength, 7);

  barcode.registerRules([rule]);
  assert.strictEqual(barcode.parse(code).best.totalPrice, 12.34);
  barcode.registerRules([]);
});

test('nothing is learned from a label that says nothing', () => {
  assert.strictEqual(barcode.learnRule('914044005702', {}), null);
  assert.strictEqual(barcode.learnRule('914044005702', { weightKg: 0 }), null);
  // A weight that appears nowhere in the code teaches nothing.
  assert.strictEqual(barcode.learnRule('914044005702', { weightKg: 9.999 }), null);
  // Not a valid barcode at all.
  assert.strictEqual(barcode.learnRule('12345', { weightKg: 1 }), null);
});

test('a learned format is kept per store, and can be forgotten', () => {
  const rule = barcode.learnRule('914044005702', { weightKg: 0.570, storeId: 'keells' });
  assert.ok(stores.rememberRule('Keells - Panadura', rule));
  // The same format is not stored twice.
  assert.strictEqual(stores.rememberRule('Keells - Panadura', rule), null);

  assert.strictEqual(stores.rulesFor('Keells Nugegoda').length, 1, 'shared across branches');
  assert.strictEqual(stores.rulesFor('Cargills').length, 0);

  assert.strictEqual(stores.forgetRule(rule.id), true);
  assert.strictEqual(stores.allRules().length, 0);
});

test('this chain\'s own format is preferred when two could fit', () => {
  const rule = barcode.learnRule('914044005702', { weightKg: 0.570, storeId: 'keells' });
  stores.rememberRule('Keells', rule);
  stores.registerAll('Keells');

  const parsed = barcode.parse('914044005702');
  assert.strictEqual(parsed.best.learned, true);
  assert.strictEqual(parsed.best.weightKg, 0.570);
});

test('a scale label with no check digit at all is still learned', () => {
  /*
   * Rathna Super prints a 14-digit code with no EAN check digit - the weight
   * runs to the very last digit:
   *
   *     000000592 | 00568     0.568 kg
   */
  const rule = barcode.learnRule('00000059200568', { weightKg: 0.568, storeId: 'rathna' });

  assert.ok(rule, 'a label that is not an EAN must still teach its format');
  assert.strictEqual(rule.length, 14);
  assert.strictEqual(rule.itemLength, 9);
  assert.strictEqual(rule.valueLength, 5);
  assert.strictEqual(rule.requireCheckDigit, false);

  barcode.registerRules([rule]);
  const parsed = barcode.parse('00000059200568');
  assert.strictEqual(parsed.itemCode, '000000592');
  assert.strictEqual(parsed.best.weightKg, 0.568);
  // The till charged 0.568 x 199.00.
  assert.strictEqual(barcode.round2(parsed.best.weightKg * 199), 113.03);

  // A heavier pack of the same product resolves to the same item.
  const next = barcode.parse('00000059201200');
  assert.strictEqual(next.itemCode, '000000592');
  assert.strictEqual(next.best.weightKg, 1.2);

  barcode.registerRules([]);
});

test('a learned check-digit-free format does not swallow ordinary barcodes', () => {
  const rule = barcode.learnRule('00000059200568', { weightKg: 0.568, storeId: 'rathna' });
  barcode.registerRules([rule]);

  // Products scanned on the same trip: 13 digits, so the 14-digit rule cannot apply.
  ['4796003510023', '4792212011221', '4791034026017'].forEach(code => {
    assert.strictEqual(barcode.parse(code).type, 'retail', code);
  });
  // And the Keells layout still reads its own labels.
  assert.strictEqual(barcode.parse('923010012187').best.weightKg, 1.218);

  barcode.registerRules([]);
});

test('the built-in layouts still insist on a valid check digit', () => {
  // Same shape as a Keells label but with the wrong check digit: not decoded.
  assert.strictEqual(barcode.parse('923010012188').type, 'retail');
  assert.strictEqual(barcode.parse('923010012187').type, 'embedded');
});
