/**
 * Barcode -> catalogue item links the shopper made themselves.
 *
 * The shipped join reaches about one packet in nine, because it can only link
 * what a mirrored barcode table happens to carry, and that table belongs to
 * another shop: it knows almost no own-brand goods. Every time a shopper names
 * an unknown packet from the store's own catalogue, that gap closes by one - so
 * the answer is kept.
 *
 * A link records which catalogue row a barcode points at, never the price. The
 * price is read back from the catalogue each time, so a link made in August is
 * still right in September.
 */
(function (root, factory) {
  const deps = root.SLScan || {};
  const api = factory(
    deps.barcode || require('./barcode.js'),
    deps.stores || require('./stores.js')
  );
  root.SLScan = root.SLScan || {};
  root.SLScan.links = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function (barcode, stores) {
  'use strict';

  const STORAGE_KEY = 'slscan.links.v1';

  let cache = null;

  function storage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (err) { /* private mode */ }
    return null;
  }

  function load() {
    if (cache) return cache;
    cache = {};
    const store = storage();
    if (store) {
      try {
        const raw = store.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') cache = parsed;
        }
      } catch (err) {
        console.warn('Saved item links could not be read; starting fresh.', err);
      }
    }
    return cache;
  }

  function persist() {
    const store = storage();
    if (!store) return;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch (err) {
      console.warn('Item links could not be saved.', err);
    }
  }

  /** Remember that this barcode is that catalogue row. */
  function remember(code, details) {
    const key = barcode.normalize(code);
    if (!key || !details || !details.itemCode) return null;

    const map = load();
    map[key] = {
      itemCode: String(details.itemCode),
      name: details.name || '',
      category: details.category || '',
      store: details.store || '',
      at: new Date().toISOString()
    };
    persist();
    return map[key];
  }

  function get(code) {
    const key = barcode.normalize(code);
    return key ? (load()[key] || null) : null;
  }

  function forget(code) {
    const key = barcode.normalize(code);
    const map = load();
    if (!map[key]) return false;
    delete map[key];
    persist();
    return true;
  }

  function all() { return Object.assign({}, load()); }

  function count() { return Object.keys(load()).length; }

  function clear() {
    cache = {};
    const store = storage();
    if (store) {
      try { store.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
    }
    return cache;
  }

  /**
   * Everything learned so far, as a file the project can fold back into the
   * shipped join - one shopper's afternoon is the next shopper's coverage.
   */
  function toJSON() {
    const map = load();
    return {
      format: 'slscan.links.v1',
      store: stores && stores.chainOf ? undefined : undefined,
      exportedAt: new Date().toISOString(),
      count: Object.keys(map).length,
      links: map
    };
  }

  return { remember, get, forget, all, count, clear, load, toJSON, STORAGE_KEY };
});
