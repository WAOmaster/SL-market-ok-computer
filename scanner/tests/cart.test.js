const test = require('node:test');
const assert = require('node:assert');
const cart = require('../js/cart.js');

test.beforeEach(() => cart.clear());

test('counting: scanning the same packet twice makes it x2', () => {
  cart.add({ code: '4791111', name: 'Milk 1L', pricing: 'unit', unitPrice: 690 });
  const second = cart.add({ code: '4791111', name: 'Milk 1L', pricing: 'unit', unitPrice: 690 });

  assert.strictEqual(second.merged, true);
  assert.strictEqual(cart.items().length, 1);
  assert.strictEqual(cart.items()[0].qty, 2);
  assert.strictEqual(cart.totals().subtotal, 1380);
  assert.strictEqual(cart.totals().itemCount, 2);
});

test('weighed packs stay on their own lines', () => {
  cart.add({ code: '915013', name: 'Potatoes', pricing: 'weight', unitPrice: 390, weightKg: 1.804 });
  cart.add({ code: '915013', name: 'Potatoes', pricing: 'weight', unitPrice: 390, weightKg: 0.5 });

  assert.strictEqual(cart.items().length, 2);
  assert.strictEqual(cart.totals().weightKg, 2.304);
  assert.strictEqual(cart.totals().subtotal, 898.56);
});

test('the four sample labels total correctly', () => {
  cart.add({ code: '923010', name: 'Banana - Seeni', pricing: 'weight', unitPrice: 240, weightKg: 1.218 });
  cart.add({ code: '915013', name: 'Potatoes', pricing: 'weight', unitPrice: 390, weightKg: 1.804 });
  cart.add({ code: '914047', name: 'Snake Gourd', pricing: 'weight', unitPrice: 240, weightKg: 0.220 });
  cart.add({ code: '914005', name: 'Onions Big', pricing: 'weight', unitPrice: 380, weightKg: 2.380 });

  const t = cart.totals();
  assert.strictEqual(t.lines, 4);
  assert.strictEqual(t.itemCount, 4);
  // 292.32 + 703.56 + 52.80 + 904.40
  assert.strictEqual(t.subtotal, 1953.08);
  assert.strictEqual(t.total, 1953.08);
});

test('a price override wins over the arithmetic', () => {
  cart.add({ code: '914047', name: 'Snake Gourd', pricing: 'weight', unitPrice: 240, weightKg: 0.220, priceOverride: 55 });
  assert.strictEqual(cart.totals().subtotal, 55);
});

test('discounts then tax, in that order', () => {
  cart.add({ name: 'Rice 5kg', pricing: 'unit', unitPrice: 1000, qty: 1 });
  cart.setSettings({ discountPercent: 10, discountAmount: 50, taxPercent: 10 });

  const t = cart.totals();
  assert.strictEqual(t.subtotal, 1000);
  assert.strictEqual(t.discount, 150);   // 100 + 50
  assert.strictEqual(t.tax, 85);         // 10% of 850
  assert.strictEqual(t.total, 935);
});

test('a discount cannot push the bill below zero', () => {
  cart.add({ name: 'Salt', pricing: 'unit', unitPrice: 100, qty: 1 });
  cart.setSettings({ discountAmount: 500 });
  assert.strictEqual(cart.totals().total, 0);
});

test('the budget flags an overspend', () => {
  cart.add({ name: 'Chicken', pricing: 'weight', unitPrice: 1500, weightKg: 1.2 });
  cart.setSettings({ budget: 1000 });

  const t = cart.totals();
  assert.strictEqual(t.overBudget, true);
  assert.strictEqual(t.budgetLeft, -800);
});

test('quantities never fall below one, and removal works', () => {
  const added = cart.add({ code: '111', name: 'Tea', pricing: 'unit', unitPrice: 250 });
  cart.changeQty(added.item.id, -5);
  assert.strictEqual(cart.items()[0].qty, 1);

  assert.strictEqual(cart.remove(added.item.id), true);
  assert.strictEqual(cart.items().length, 0);
  assert.strictEqual(cart.totals().total, 0);
});

test('per-category breakdown adds up to the subtotal', () => {
  cart.add({ name: 'Potatoes', category: 'Vegetable', pricing: 'weight', unitPrice: 390, weightKg: 1 });
  cart.add({ name: 'Banana', category: 'Fruit', pricing: 'weight', unitPrice: 240, weightKg: 1 });
  cart.add({ name: 'Carrot', category: 'Vegetable', pricing: 'weight', unitPrice: 690, weightKg: 1 });

  const byCat = cart.byCategory();
  assert.strictEqual(byCat[0].category, 'Vegetable');
  assert.strictEqual(byCat[0].total, 1080);
  assert.strictEqual(byCat.reduce((s, c) => s + c.total, 0), cart.totals().subtotal);
});

test('CSV export carries every line and the total', () => {
  cart.add({ code: '923010', name: 'Banana, Seeni', pricing: 'weight', unitPrice: 240, weightKg: 1.218 });
  const csv = cart.toCSV();

  assert.match(csv, /"Banana, Seeni"/);   // the comma in the name is quoted
  assert.match(csv, /1\.218/);
  assert.match(csv, /TOTAL,+292\.32/);
});

test('a trip can be saved and restored', () => {
  cart.setStore('Keells - Nugegoda');
  cart.add({ name: 'Bread', pricing: 'unit', unitPrice: 210, qty: 2 });
  const snapshot = cart.toJSON();

  cart.clear();
  assert.strictEqual(cart.items().length, 0);

  cart.replaceAll(snapshot);
  assert.strictEqual(cart.getState().store, 'Keells - Nugegoda');
  assert.strictEqual(cart.totals().total, 420);
});

test('the whole Keells trip totals to the cent', () => {
  // Every weighed line from the 29-08-2026 bill, priced from the label weight.
  [
    ['923010', 'Banana - Seeni', 240, 1.218], ['923010', 'Banana - Seeni', 240, 0.402],
    ['914005', 'Pre-packed Big Onions', 380, 2.380], ['015427', 'Red Kekulu Samba', 240, 0.564],
    ['914014', 'Garlic', 890, 0.280], ['915013', 'Potatoes', 390, 1.804],
    ['004681', 'Rice Samba Bulk', 240, 1.006], ['021445', 'White Sugar', 212, 1.166],
    ['021445', 'White Sugar', 212, 0.522], ['923063', 'Melon', 80, 2.0],
    ['913055', 'Minchi Leaves', 1690, 0.026], ['915016', 'Tomatoes', 440, 0.510],
    ['915005', 'Cabbage', 340, 0.192], ['914009', 'Cucumber', 130, 0.452],
    ['914000', 'Ash Plantains', 210, 0.378], ['915006', 'Capsicum', 650, 0.146],
    ['914036', 'Onion Leaves', 360, 0.070], ['914044', 'Ribbed Gourd', 360, 0.570],
    ['915007', 'Carrot', 280, 0.378], ['913066', 'Salad Cucumber', 360, 0.420],
    ['915008', 'Green Beans', 550, 0.122], ['914034', 'Nivithi', 210, 0.082],
    ['914039', 'Pumpkin', 120, 0.246], ['914047', 'Snake Gourd', 240, 0.220],
    ['914049', 'Sweet Potato', 210, 0.168]
  ].forEach(([code, name, price, kg]) =>
    cart.add({ code, name, pricing: 'weight', unitPrice: price, weightKg: kg }));

  [
    ['Harpic', 480, 1], ['Lifebuoy', 350, 1], ['Sunlight Matic', 600, 1],
    ['Harischandra Noodles', 280, 1], ['Wijaya Chilli', 220, 1], ['Ahmad Tea', 680, 1],
    ['Maliban Lemon Puff', 270, 1], ['Keells Pepper Powder', 210, 1],
    ['Ambewela Milk', 140, 3], ['Polythene Bag', 5, 2]
  ].forEach(([name, price, qty]) =>
    cart.add({ name, pricing: 'unit', unitPrice: price, qty: qty }));

  const t = cart.totals();
  // The till's gross was 7,916.64; the app splits the two sugar packs and the
  // two banana packs into their own lines, which rounds one cent differently.
  assert.strictEqual(t.subtotal, 7916.63);

  // The till then took Rs 443.00 of promotions off.
  cart.setSettings({ discountAmount: 443 });
  assert.strictEqual(cart.totals().total, 7473.63);
});
