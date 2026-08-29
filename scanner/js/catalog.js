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
    /*
     * Verified against a Keells bill (Panadura, 29-08-2026): the codes are the
     * six-digit item codes the scale prints inside the label barcode, and the
     * prices are what the till charged. Packaged goods are keyed by their own
     * EAN-13.
     */
    { code: '923010', name: 'Banana - Seeni', unitPrice: 240.00, pricing: 'weight', unit: 'kg', category: 'Fruit' },
    { code: '923063', name: 'Melon - Red Fantasy', unitPrice: 80.00, pricing: 'weight', unit: 'kg', category: 'Fruit' },
    { code: '914005', name: 'Pre-packed Big Onions', unitPrice: 380.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914000', name: 'Ash Plantains', unitPrice: 210.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914009', name: 'Cucumber', unitPrice: 130.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914014', name: 'Garlic', unitPrice: 890.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914034', name: 'Nivithi', unitPrice: 210.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914036', name: 'Onion Leaves', unitPrice: 360.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914039', name: 'Pumpkin', unitPrice: 120.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914044', name: 'Ribbed Gourd', unitPrice: 360.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914047', name: 'Snake Gourd', unitPrice: 240.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '914049', name: 'Sweet Potato', unitPrice: 210.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '913055', name: 'Minchi Leaves', unitPrice: 1690.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '913066', name: 'Salad Cucumber', unitPrice: 360.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '915005', name: 'Cabbage', unitPrice: 340.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '915006', name: 'Capsicum', unitPrice: 650.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '915007', name: 'Carrot', unitPrice: 280.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '915008', name: 'Green Beans', unitPrice: 550.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '915013', name: 'Potatoes', unitPrice: 390.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '915016', name: 'Tomatoes', unitPrice: 440.00, pricing: 'weight', unit: 'kg', category: 'Vegetable' },
    { code: '004681', name: 'Rice - Samba Bulk', unitPrice: 240.00, pricing: 'weight', unit: 'kg', category: 'Grocery' },
    { code: '015427', name: 'Rice - Red Kekulu Samba Bulk', unitPrice: 240.00, pricing: 'weight', unit: 'kg', category: 'Grocery' },
    { code: '021445', name: 'White Sugar Bulk', unitPrice: 212.00, pricing: 'weight', unit: 'kg', category: 'Grocery' },
    { code: '4792037107741', name: 'Harpic Power Plus 10X 500ml', unitPrice: 480.00, pricing: 'unit', unit: 'pc', category: 'Household' },
    { code: '4792081018024', name: 'Lifebuoy Handwash Total 180ml', unitPrice: 350.00, pricing: 'unit', unit: 'pc', category: 'Household' },
    { code: '4792081044740', name: 'Sunlight Matic Liquid 1L', unitPrice: 600.00, pricing: 'unit', unit: 'pc', category: 'Household' },
    { code: '4792083010118', name: 'Harischandra Plain Noodles 400g', unitPrice: 280.00, pricing: 'unit', unit: 'pc', category: 'Grocery' },
    { code: '4792173000012', name: 'Wijaya Chilli Pieces 100g', unitPrice: 220.00, pricing: 'unit', unit: 'pc', category: 'Grocery' },
    { code: '4791034017015', name: 'Maliban Lemon Puff 200g', unitPrice: 270.00, pricing: 'unit', unit: 'pc', category: 'Bakery' },
    { code: '4796033940166', name: 'Keells Pepper Powder 50g', unitPrice: 210.00, pricing: 'unit', unit: 'pc', category: 'Grocery' },
    { code: '4792116211109', name: 'Ambewela Full Cream UHT Milk 200ml', unitPrice: 140.00, pricing: 'unit', unit: 'pc', category: 'Dairy' }
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

    const attempts = [parsed.code, parsed.ean13, parsed.itemCode];
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
