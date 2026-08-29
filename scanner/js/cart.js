/**
 * The basket: what was scanned, how many, at what price, and what it all adds
 * up to.
 *
 * Two kinds of line exist because supermarkets price two ways:
 *   - unit lines   -> quantity x unit price (scanning the same barcode again
 *                     bumps the count instead of adding a duplicate line)
 *   - weight lines -> weight in kg x price per kg (each scale label is its own
 *                     line, since every pack weighs something different)
 */
(function (root, factory) {
  const api = factory(root.SLScan && root.SLScan.barcode ? root.SLScan.barcode : require('./barcode.js'));
  root.SLScan = root.SLScan || {};
  root.SLScan.cart = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function (barcode) {
  'use strict';

  const STORAGE_KEY = 'slscan.cart.v1';
  const round2 = barcode.round2;

  function defaultState() {
    return {
      id: 'trip-' + Date.now(),
      store: '',
      startedAt: new Date().toISOString(),
      items: [],
      settings: {
        currency: 'Rs.',
        taxPercent: 0,      // most SL supermarket shelf prices already include VAT
        discountPercent: 0,
        discountAmount: 0,
        budget: 0,
        mergeDuplicates: true
      }
    };
  }

  let state = defaultState();

  function storage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (err) { /* ignore */ }
    return null;
  }

  function load() {
    const store = storage();
    if (!store) return state;
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = Object.assign(defaultState(), parsed);
        state.settings = Object.assign(defaultState().settings, parsed.settings || {});
        state.items = (parsed.items || []).map(normalizeItem).filter(Boolean);
      }
    } catch (err) {
      console.warn('Saved basket could not be read; starting a fresh one.', err);
      state = defaultState();
    }
    return state;
  }

  function save() {
    const store = storage();
    if (!store) return;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Basket could not be saved.', err);
    }
  }

  function normalizeItem(raw) {
    if (!raw) return null;
    const pricing = raw.pricing === 'weight' ? 'weight' : 'unit';
    const item = {
      id: raw.id || ('line-' + Math.random().toString(36).slice(2, 10)),
      code: barcode.normalize(raw.code || ''),
      barcode: raw.barcode || raw.code || '',
      name: String(raw.name || 'Unnamed item').trim(),
      category: raw.category || 'Other',
      pricing: pricing,
      unit: raw.unit || (pricing === 'weight' ? 'kg' : 'pc'),
      unitPrice: Number(raw.unitPrice) || 0,
      qty: pricing === 'weight' ? 1 : Math.max(1, parseInt(raw.qty, 10) || 1),
      weightKg: pricing === 'weight' ? Number(raw.weightKg) || 0 : 0,
      source: raw.source || 'manual',
      note: raw.note || '',
      priceOverride: raw.priceOverride == null ? null : Number(raw.priceOverride),
      addedAt: raw.addedAt || new Date().toISOString()
    };
    item.lineTotal = lineTotal(item);
    return item;
  }

  /** A line total honours a manual override (label price wins over arithmetic). */
  function lineTotal(item) {
    if (item.priceOverride != null && Number.isFinite(item.priceOverride)) {
      return round2(item.priceOverride);
    }
    if (item.pricing === 'weight') return round2(item.weightKg * item.unitPrice);
    return round2(item.qty * item.unitPrice);
  }

  function items() { return state.items.slice(); }
  function getState() { return state; }

  function findMergeTarget(candidate) {
    if (!state.settings.mergeDuplicates) return null;
    if (candidate.pricing !== 'unit' || !candidate.code) return null;
    return state.items.find(i =>
      i.pricing === 'unit' &&
      i.code === candidate.code &&
      i.unitPrice === candidate.unitPrice &&
      i.priceOverride == null) || null;
  }

  /**
   * Add a scanned or manually entered line.
   * Returns { item, merged } so the UI can say "x2" instead of flashing a new row.
   */
  function add(raw) {
    const item = normalizeItem(raw);
    if (!item) return null;

    const target = findMergeTarget(item);
    if (target) {
      target.qty += item.qty;
      target.lineTotal = lineTotal(target);
      save();
      return { item: target, merged: true };
    }

    state.items.unshift(item);
    save();
    return { item: item, merged: false };
  }

  function update(id, changes) {
    const item = state.items.find(i => i.id === id);
    if (!item) return null;
    Object.assign(item, changes);
    if (item.pricing === 'unit') {
      item.qty = Math.max(1, parseInt(item.qty, 10) || 1);
      item.weightKg = 0;
    } else {
      item.qty = 1;
      item.weightKg = Math.max(0, Number(item.weightKg) || 0);
    }
    item.unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    if (changes.priceOverride === '' || changes.priceOverride === null) item.priceOverride = null;
    item.lineTotal = lineTotal(item);
    save();
    return item;
  }

  function changeQty(id, delta) {
    const item = state.items.find(i => i.id === id);
    if (!item) return null;
    if (item.pricing === 'weight') return item;
    item.qty = Math.max(1, item.qty + delta);
    item.lineTotal = lineTotal(item);
    save();
    return item;
  }

  function remove(id) {
    const before = state.items.length;
    state.items = state.items.filter(i => i.id !== id);
    if (state.items.length !== before) save();
    return state.items.length !== before;
  }

  function setSettings(changes) {
    Object.assign(state.settings, changes || {});
    ['taxPercent', 'discountPercent', 'discountAmount', 'budget'].forEach(k => {
      state.settings[k] = Math.max(0, Number(state.settings[k]) || 0);
    });
    save();
    return state.settings;
  }

  function setStore(name) {
    state.store = String(name || '').trim();
    save();
    return state.store;
  }

  /** Everything the receipt panel needs, in one pass. */
  function totals() {
    const s = state.settings;
    let subtotal = 0;
    let units = 0;
    let weightKg = 0;

    state.items.forEach(i => {
      subtotal += i.lineTotal;
      if (i.pricing === 'weight') weightKg += i.weightKg;
      else units += i.qty;
    });

    subtotal = round2(subtotal);
    const percentOff = round2(subtotal * (s.discountPercent / 100));
    const discount = round2(Math.min(subtotal, percentOff + s.discountAmount));
    const taxable = round2(subtotal - discount);
    const tax = round2(taxable * (s.taxPercent / 100));
    const total = round2(taxable + tax);

    return {
      lines: state.items.length,
      units: units,
      weightKg: barcode.round3(weightKg),
      // "Items" as a shopper counts them: each pack of loose produce counts once.
      itemCount: units + state.items.filter(i => i.pricing === 'weight').length,
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      total: total,
      budget: s.budget,
      overBudget: s.budget > 0 && total > s.budget,
      budgetLeft: s.budget > 0 ? round2(s.budget - total) : 0,
      currency: s.currency
    };
  }

  /** Totals per category - the "where did the money go" breakdown. */
  function byCategory() {
    const map = {};
    state.items.forEach(i => {
      const key = i.category || 'Other';
      map[key] = map[key] || { category: key, lines: 0, total: 0 };
      map[key].lines++;
      map[key].total = round2(map[key].total + i.lineTotal);
    });
    return Object.keys(map).map(k => map[k]).sort((a, b) => b.total - a.total);
  }

  function clear() {
    state = defaultState();
    save();
    return state;
  }

  function toJSON() {
    return {
      id: state.id,
      store: state.store,
      startedAt: state.startedAt,
      savedAt: new Date().toISOString(),
      settings: state.settings,
      items: items(),
      totals: totals()
    };
  }

  function toCSV() {
    const head = ['Code', 'Product', 'Category', 'Pricing', 'Qty', 'Weight (kg)', 'Unit price', 'Line total'];
    const rows = state.items.map(i => [
      i.code,
      i.name,
      i.category,
      i.pricing,
      i.pricing === 'unit' ? i.qty : '',
      i.pricing === 'weight' ? i.weightKg.toFixed(3) : '',
      i.unitPrice.toFixed(2),
      i.lineTotal.toFixed(2)
    ]);
    const t = totals();
    rows.push([]);
    rows.push(['', 'Subtotal', '', '', '', '', '', t.subtotal.toFixed(2)]);
    if (t.discount) rows.push(['', 'Discount', '', '', '', '', '', '-' + t.discount.toFixed(2)]);
    if (t.tax) rows.push(['', 'Tax', '', '', '', '', '', t.tax.toFixed(2)]);
    rows.push(['', 'TOTAL', '', '', '', '', '', t.total.toFixed(2)]);

    return [head].concat(rows).map(r => r.map(cell => {
      const v = cell == null ? '' : String(cell);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',')).join('\n');
  }

  function replaceAll(payload) {
    if (!payload) return state;
    state = Object.assign(defaultState(), {
      id: payload.id || ('trip-' + Date.now()),
      store: payload.store || '',
      startedAt: payload.startedAt || new Date().toISOString()
    });
    state.settings = Object.assign(defaultState().settings, payload.settings || {});
    state.items = (payload.items || []).map(normalizeItem).filter(Boolean);
    save();
    return state;
  }

  return {
    load, save, items, getState, add, update, changeQty, remove,
    setSettings, setStore, totals, byCategory, clear, toJSON, toCSV,
    replaceAll, lineTotal, normalizeItem, STORAGE_KEY
  };
});
