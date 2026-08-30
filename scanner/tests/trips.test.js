const test = require('node:test');
const assert = require('node:assert');
const trips = require('../js/trips.js');

test.beforeEach(() => trips.clear());

/** A report shaped the way report.build() shapes one. */
function report(id, savedAt, items, opts) {
  const o = opts || {};
  const total = items.reduce((s, i) => s + i.lineTotal, 0);
  return {
    format: 'cart-scan.trip.v1',
    generatedAt: savedAt,
    trip: {
      id: id,
      savedAt: savedAt,
      store: o.store || 'Keells - Panadura 3',
      items: items,
      totals: {
        total: Math.round(total * 100) / 100,
        itemCount: items.length,
        unpriced: items.filter(i => i.unpriced).length,
        currency: 'LKR'
      }
    },
    billCheck: o.tillTotal == null ? null : { tillTotal: o.tillTotal }
  };
}

const line = (code, name, lineTotal, extra) =>
  Object.assign({ code, name, category: 'Grocery', lineTotal }, extra || {});

test('a saved trip survives and carries its numbers', () => {
  trips.save(report('t1', '2026-08-29T13:03:46Z', [
    line('4791034017015', 'Maliban Lemon Puff 200g', 270),
    line('923010', 'Banana - Seeni', 388.8)
  ]));

  const all = trips.list();
  assert.strictEqual(all.length, 1);
  assert.strictEqual(all[0].total, 658.8);
  assert.strictEqual(all[0].lines, 2);
  assert.strictEqual(all[0].store, 'Keells - Panadura 3');
});

test('saving the same trip twice updates it rather than duplicating', () => {
  trips.save(report('t1', '2026-08-29T13:03:46Z', [line('a', 'A', 100)]));
  trips.save(report('t1', '2026-08-29T13:03:46Z', [line('a', 'A', 100), line('b', 'B', 50)]));

  assert.strictEqual(trips.list().length, 1);
  assert.strictEqual(trips.list()[0].total, 150);
});

test('unpriced lines are carried through to the history', () => {
  trips.save(report('t1', '2026-08-29T13:03:46Z', [
    line('a', 'A', 100),
    line('b', 'Unknown item 4792', 0, { unpriced: true })
  ]));
  assert.strictEqual(trips.list()[0].unpriced, 1);
});

test('monthly spend groups by calendar month, newest first', () => {
  trips.save(report('t1', '2026-07-12T09:29:09Z', [line('a', 'A', 5300.1)]));
  trips.save(report('t2', '2026-08-08T13:44:25Z', [line('a', 'A', 11129.18)]));
  trips.save(report('t3', '2026-08-29T13:03:46Z', [line('a', 'A', 7473.64)]));

  const m = trips.monthly();
  assert.deepStrictEqual(m.map(x => x.month), ['2026-08', '2026-07']);
  assert.strictEqual(m[0].trips, 2);
  assert.strictEqual(m[0].total, 18602.82);
  assert.strictEqual(m[1].total, 5300.1);
});

test('what the till charged beats what the app estimated', () => {
  // The 29-Aug bill: the app worked out the gross, the till charged the net.
  trips.save(report('t1', '2026-08-29T13:03:46Z', [line('a', 'A', 7916.64)], { tillTotal: 7473.64 }));

  const m = trips.monthly();
  assert.strictEqual(m[0].total, 7473.64, 'must count what was actually paid');
  assert.strictEqual(m[0].estimated, 0, 'a trip with a till total is not an estimate');
});

test('top items add a product up across trips', () => {
  trips.save(report('t1', '2026-07-12T09:29:09Z', [
    line('4792116211109', 'Ambewela Milk 200ml', 140),
    line('4791034017015', 'Maliban Lemon Puff', 270)
  ]));
  trips.save(report('t2', '2026-08-29T13:03:46Z', [
    line('4792116211109', 'Ambewela Milk 200ml', 420)
  ]));

  const top = trips.topItems(5);
  assert.strictEqual(top[0].name, 'Ambewela Milk 200ml');
  assert.strictEqual(top[0].spend, 560);
  assert.strictEqual(top[0].times, 2, 'bought on two separate trips');
  assert.strictEqual(top[0].lastSeen, '2026-08-29T13:03:46Z', 'newest sighting wins');
  assert.strictEqual(top[1].spend, 270);
});

test('removing a trip removes it from the monthly total too', () => {
  trips.save(report('t1', '2026-08-01T00:00:00Z', [line('a', 'A', 100)]));
  trips.save(report('t2', '2026-08-02T00:00:00Z', [line('a', 'A', 250)]));

  assert.strictEqual(trips.remove('t1'), true);
  assert.strictEqual(trips.remove('nope'), false);
  assert.strictEqual(trips.monthly()[0].total, 250);
});
