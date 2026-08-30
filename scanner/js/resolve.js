/**
 * Offline barcode -> product identity.
 *
 * No Sri Lankan supermarket resolves an EAN-13. Verified against all four:
 * Keells, Cargills and SPAR all return "no results" for a printed barcode, and
 * Keells' own search does not even index its internal item codes. Open Food
 * Facts knows roughly a quarter of a real trolley and no household goods at all.
 *
 * What does work is a handful of small Sri Lankan shops that put the real
 * barcode in their SKU field. `tools/fetch_barcodes.py` pulls that table once
 * into `data/barcodes.json`; this module reads it.
 *
 * Deliberately offline. A supermarket aisle has poor signal, a lookup that
 * stalls at the shelf is worse than no lookup, and hammering a small shop's
 * website once per scan would be rude.
 *
 * The mirror itself carries identity only - names, categories, images. Its own
 * prices are NOT used: they run 5-10% below Keells and would be wrong at the
 * shelf. The price comes from `data/prices.json`, where tools/match_keells.py
 * has already joined each barcode to a Keells item code and its real shelf
 * price by matching product names offline.
 */
(function (root, factory) {
  const api = factory(root.SLScan && root.SLScan.barcode ? root.SLScan.barcode : require('./barcode.js'));
  root.SLScan = root.SLScan || {};
  root.SLScan.resolve = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function (barcode) {
  'use strict';

  const DATA_URL = 'data/barcodes.json';
  /*
   * barcode -> Keells item code -> exact shelf price, pre-joined offline by
   * tools/match_keells.py. This is what makes a scan show the real price
   * instead of a guess: no supermarket resolves an EAN-13, so the join has to
   * be computed ahead of time and shipped.
   */
  const PRICE_URL = 'data/prices.json';

  let table = null;      // code -> record, once loaded
  let prices = null;     // code -> { itemCode, price, ... }
  let loading = null;    // in-flight promise, so concurrent scans load it once
  let meta = { source: '', builtAt: '', count: 0, priced: 0, store: '' };

  function index(products) {
    const map = {};
    (products || []).forEach(p => {
      const code = barcode.normalize(p && p.code);
      if (!code || !p.name) return;
      map[code] = {
        code: code,
        name: String(p.name).trim(),
        category: p.category || '',
        image: p.image || ''
      };
    });
    return map;
  }

  /** Used by the tests, and by anyone who wants to supply their own table. */
  function setTable(products, info) {
    table = index(products);
    meta = Object.assign({ source: 'injected', builtAt: '',
      count: Object.keys(table).length, priced: prices ? Object.keys(prices).length : 0 },
      info || {});
    return meta.count;
  }

  /** Same, for the barcode -> Keells price join. */
  function setPrices(map, info) {
    prices = {};
    Object.keys(map || {}).forEach(k => {
      const code = barcode.normalize(k);
      if (code && map[k] && Number(map[k].price) > 0) prices[code] = map[k];
    });
    meta.priced = Object.keys(prices).length;
    if (info && info.store) meta.store = info.store;
    return meta.priced;
  }

  /**
   * Load the shipped table. Resolves to an empty map rather than rejecting -
   * a missing table must degrade to "we don't know this packet", never to a
   * broken scan.
   */
  function load() {
    if (table) return Promise.resolve(table);
    if (loading) return loading;
    if (typeof fetch !== 'function') {
      table = {};
      return Promise.resolve(table);
    }
    // Both files are fetched together, and a failure in either is survivable:
    // no names means unnamed packets, no prices means unpriced ones. Neither
    // may break a scan.
    const grab = url => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);

    loading = Promise.all([grab(DATA_URL), grab(PRICE_URL)])
      .then(([data, priceDoc]) => {
        if (data && Array.isArray(data.products)) {
          setTable(data.products, { source: data.source || '', builtAt: data.builtAt || '' });
        } else {
          console.warn('Barcode table unavailable; unknown packets will stay unnamed.');
          table = {};
        }
        if (priceDoc && priceDoc.prices) {
          setPrices(priceDoc.prices, { store: priceDoc.store || '' });
        } else {
          prices = {};
        }
        return table;
      })
      .finally(() => { loading = null; });
    return loading;
  }

  /**
   * Look a scan up in the offline table.
   *
   * Only retail barcodes are tried. A scale label carries a Keells item code,
   * not a GS1 barcode, and those two numbering systems collide - 914000 is Ash
   * Plantains at Keells and would be a meaningless prefix here. Feeding one to
   * the other is how you end up charging for the wrong thing.
   */
  function lookupSync(codeOrParsed) {
    if (!table) return null;
    const parsed = typeof codeOrParsed === 'object' && codeOrParsed
      ? codeOrParsed
      : barcode.parse(codeOrParsed);

    const tries = [];
    if (parsed.ean13) {
      tries.push(parsed.ean13);
      // A 12-digit UPC-A is the same product as the EAN-13 with a leading zero.
      if (parsed.ean13.charAt(0) === '0') tries.push(parsed.ean13.slice(1));
      else tries.push('0' + parsed.ean13);
    }
    if (parsed.kind === 'retail' && parsed.code) tries.push(parsed.code);

    for (const t of tries) {
      const code = barcode.normalize(t);
      if (!code || !table[code]) continue;
      const hit = table[code];
      const p = prices && prices[code];
      if (!p) return hit;
      // The price is the whole point, so it travels with the identity.
      return Object.assign({}, hit, {
        itemCode: p.itemCode,
        price: Number(p.price) || 0,
        uom: p.uom || 'NO',
        storeName: p.name || '',
        ambiguous: !!p.ambiguous,
        matchMethod: p.method || '',
        matchConfidence: p.confidence
      });
    }
    return null;
  }

  function lookup(codeOrParsed) {
    return load().then(() => lookupSync(codeOrParsed));
  }

  function info() {
    return Object.assign({}, meta, { loaded: !!table });
  }

  return { load, lookup, lookupSync, setTable, setPrices, info, DATA_URL, PRICE_URL };
});
