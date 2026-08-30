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
 * IDENTITY ONLY - names, categories, images. No prices: the table's prices run
 * 5-10% below Keells, so they would be wrong at the shelf. The price comes from
 * the shop you are standing in, or from the bill afterwards.
 */
(function (root, factory) {
  const api = factory(root.SLScan && root.SLScan.barcode ? root.SLScan.barcode : require('./barcode.js'));
  root.SLScan = root.SLScan || {};
  root.SLScan.resolve = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function (barcode) {
  'use strict';

  const DATA_URL = 'data/barcodes.json';

  let table = null;      // code -> record, once loaded
  let loading = null;    // in-flight promise, so concurrent scans load it once
  let meta = { source: '', builtAt: '', count: 0 };

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
    meta = Object.assign({ source: 'injected', builtAt: '', count: Object.keys(table).length }, info || {});
    return meta.count;
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
    loading = fetch(DATA_URL)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && Array.isArray(data.products)) {
          setTable(data.products, { source: data.source || '', builtAt: data.builtAt || '' });
        } else {
          table = {};
        }
        return table;
      })
      .catch(err => {
        console.warn('Barcode table unavailable; unknown packets will stay unnamed.', err);
        table = {};
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
      if (code && table[code]) return table[code];
    }
    return null;
  }

  function lookup(codeOrParsed) {
    return load().then(() => lookupSync(codeOrParsed));
  }

  function info() {
    return Object.assign({}, meta, { loaded: !!table });
  }

  return { load, lookup, lookupSync, setTable, info, DATA_URL };
});
