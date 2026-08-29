/**
 * Product catalog: barcode/item-code -> product record.
 *
 * The catalog is the app's memory. Every scan that resolves to a known code is
 * priced automatically; an unknown code is added on the spot (name + price
 * entered once) and is recognised for good afterwards. Stored in localStorage
 * so the app is fully usable offline at the checkout queue.
 */
(function (root, factory) {
  const api = factory(root.SLScan && root.SLScan.barcode ? root.SLScan.barcode : require('./barcode.js'));
  root.SLScan = root.SLScan || {};
  root.SLScan.catalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function (barcode) {
  'use strict';

  const STORAGE_KEY = 'slscan.catalog.v1';

  /**
   * Seeded from real Keells-style scale labels (prices in LKR, Aug 2026).
   * `pricing: 'weight'` items are priced per kilogram and the weight comes from
   * the barcode; `pricing: 'unit'` items are counted.
   */
  const SEED = [
    { code: '923010', name: 'Banana - Seeni', unitPrice: 240.00, pricing: 'weight', unit: 'kg', category: 'Fruit' },
    { code: '915013', name: 'Potatoes', unitPrice: 390.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914047', name: 'Snake Gourd', unitPrice: 240.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914005', name: 'Onions Big (pre-packed)', unitPrice: 380.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914004', name: 'Onions Big', unitPrice: 380.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914010', name: 'Carrot', unitPrice: 690.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914021', name: 'Tomato', unitPrice: 480.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914033', name: 'Cabbage', unitPrice: 360.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914052', name: 'Brinjal', unitPrice: 420.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914060', name: 'Manioc', unitPrice: 320.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '923004', name: 'Banana - Ambul', unitPrice: 420.00, pricing: 'weight', unit: 'kg', category: 'Fruit' },
    { code: '922010', name: 'Red Kekulu Samba Rice 1kg', unitPrice: 285.00, pricing: 'unit', unit: 'pack', category: 'Grocery' },
    { code: '4011', name: 'Banana (PLU 4011)', unitPrice: 380.00, pricing: 'weight', unit: 'kg', category: 'Fruit' },
    { code: '4072', name: 'Green Chilli (PLU 4072)', unitPrice: 950.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' }
  ];

  let cache = null;

  function storage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (err) { /* private mode / sandboxed frame */ }
    return null;
  }

  function load() {
    if (cache) return cache;
    const store = storage();
    let saved = null;
    if (store) {
      try {
        const raw = store.getItem(STORAGE_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch (err) {
        console.warn('Catalog could not be read, starting from the seed list.', err);
      }
    }
    cache = {};
    (Array.isArray(saved) && saved.length ? saved : SEED).forEach(p => {
      const rec = normalizeRecord(p);
      if (rec) cache[rec.code] = rec;
    });
    return cache;
  }

  function persist() {
    const store = storage();
    if (!store) return;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(all()));
    } catch (err) {
      console.warn('Catalog could not be saved.', err);
    }
  }

  function normalizeRecord(p) {
    if (!p || !p.code) return null;
    const code = barcode.normalize(p.code);
    if (!code) return null;
    return {
      code: code,
      name: String(p.name || 'Unnamed item').trim(),
      unitPrice: Number(p.unitPrice) || 0,
      pricing: p.pricing === 'weight' ? 'weight' : 'unit',
      unit: p.unit || (p.pricing === 'weight' ? 'kg' : 'pc'),
      category: p.category || 'Other',
      updatedAt: p.updatedAt || new Date().toISOString()
    };
  }

  function all() {
    const map = load();
    return Object.keys(map)
      .map(k => map[k])
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Look a scan up. Scale labels are matched on the embedded item code, retail
   * barcodes on the full EAN-13 with a UPC-A fallback.
   */
  function find(codeOrParsed) {
    const map = load();
    const parsed = typeof codeOrParsed === 'object' && codeOrParsed
      ? codeOrParsed
      : barcode.parse(codeOrParsed);

    const attempts = [parsed.itemCode, parsed.ean13, parsed.code];
    if (parsed.candidates) parsed.candidates.forEach(c => attempts.push(c.itemCode));
    if (parsed.ean13 && parsed.ean13.charAt(0) === '0') attempts.push(parsed.ean13.slice(1));

    for (const attempt of attempts) {
      const key = barcode.normalize(attempt);
      if (key && map[key]) return map[key];
    }
    return null;
  }

  function upsert(product) {
    const rec = normalizeRecord(product);
    if (!rec) return null;
    const map = load();
    rec.updatedAt = new Date().toISOString();
    map[rec.code] = rec;
    persist();
    return rec;
  }

  function remove(code) {
    const map = load();
    const key = barcode.normalize(code);
    if (map[key]) {
      delete map[key];
      persist();
      return true;
    }
    return false;
  }

  function search(term) {
    const q = String(term || '').trim().toLowerCase();
    if (!q) return all();
    return all().filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.code.includes(q) ||
      p.category.toLowerCase().includes(q));
  }

  /** Merge records from the API or a file import; existing prices are updated. */
  function importMany(records, options) {
    const opts = options || {};
    const map = load();
    let added = 0, updated = 0;
    (records || []).forEach(r => {
      const rec = normalizeRecord(r);
      if (!rec) return;
      if (map[rec.code]) {
        if (opts.overwrite === false) return;
        updated++;
      } else {
        added++;
      }
      map[rec.code] = rec;
    });
    persist();
    return { added, updated, total: all().length };
  }

  function reset() {
    cache = null;
    const store = storage();
    if (store) {
      try { store.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
    }
    return all();
  }

  return { all, find, upsert, remove, search, importMany, reset, SEED, STORAGE_KEY };
});
