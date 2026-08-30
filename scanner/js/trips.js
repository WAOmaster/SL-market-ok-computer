/**
 * Finished shopping trips, kept.
 *
 * Until now a trip was built by report.js, downloaded, and then lost - starting
 * a new trip overwrote the cart and the previous one was gone. That single gap
 * is why the app could add up a trolley but could not answer "what am I
 * spending?". Everything in the monthly view falls out of simply keeping them.
 *
 * Stored in localStorage next to the cart, so the history is as offline as the
 * rest of the app and never leaves the phone.
 */
(function (root, factory) {
  const api = factory();
  root.SLScan = root.SLScan || {};
  root.SLScan.trips = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'slscan.trips.v1';
  // A trip is a few KB. localStorage is ~5MB, and a heavy shopper does perhaps
  // 40 trips a year, so this is decades of history - the cap only stops a
  // runaway loop from filling the quota and breaking the cart.
  const MAX_TRIPS = 500;

  let cache = null;

  function storage() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return null;
      // Node ships a localStorage that exists but throws unless it is given a
      // backing file, and some embedded browsers ship a similar stub. Existing
      // is not the same as working.
      if (typeof localStorage.setItem !== 'function') return null;
      return localStorage;
    } catch (err) { /* private mode / sandboxed frame */ }
    return null;
  }

  function load() {
    if (cache) return cache;
    cache = [];
    const store = storage();
    if (store) {
      try {
        const raw = store.getItem(STORAGE_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        if (Array.isArray(saved)) cache = saved;
      } catch (err) {
        console.warn('Trip history could not be read; starting empty.', err);
      }
    }
    return cache;
  }

  /*
   * Failing to write must never destroy history.
   *
   * Shedding the oldest trips is the right answer to a full quota and the wrong
   * answer to everything else - a stubbed or disabled localStorage would
   * silently delete half the shopper's record for no reason at all. So trim
   * only when there is something to trim, and if the retry also fails keep the
   * full list in memory: this session still shows everything.
   */
  function persist() {
    const store = storage();
    if (!store) return false;
    const list = load();
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      if (list.length < 2) return false;
      const trimmed = list.slice(0, Math.floor(list.length / 2));
      try {
        store.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        cache = trimmed;
        console.warn('Trip history full; dropped the oldest trips.', err);
        return true;
      } catch (err2) {
        return false;
      }
    }
  }

  /**
   * Flatten a report into the handful of fields the history actually reads,
   * and keep the full report alongside so nothing is lost.
   */
  function summarise(report) {
    const trip = (report && report.trip) || {};
    const totals = trip.totals || {};
    const items = Array.isArray(trip.items) ? trip.items : [];
    const till = (report && report.billCheck && report.billCheck.tillTotal) || null;
    return {
      id: trip.id || ('trip-' + Math.random().toString(36).slice(2, 10)),
      savedAt: trip.savedAt || (report && report.generatedAt) || new Date().toISOString(),
      startedAt: trip.startedAt || null,
      store: trip.store || '',
      lines: items.length,
      itemCount: totals.itemCount || 0,
      unpriced: totals.unpriced || 0,
      // What the app worked out, and - when the shopper typed it in - what the
      // till actually charged. Keeping both is what makes the estimate
      // measurable instead of merely plausible.
      total: Number(totals.total) || 0,
      tillTotal: till == null ? null : Number(till),
      currency: totals.currency || 'LKR',
      report: report || null
    };
  }

  function save(report) {
    const rec = summarise(report);
    const list = load();
    const existing = list.findIndex(t => t.id === rec.id);
    if (existing >= 0) list[existing] = rec;
    else list.unshift(rec);
    list.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    if (list.length > MAX_TRIPS) list.length = MAX_TRIPS;
    persist();
    return rec;
  }

  function list() { return load().slice(); }
  function get(id) { return load().find(t => t.id === id) || null; }

  function remove(id) {
    const l = load();
    const i = l.findIndex(t => t.id === id);
    if (i < 0) return false;
    l.splice(i, 1);
    persist();
    return true;
  }

  function clear() {
    cache = [];
    const store = storage();
    if (store) {
      try { store.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
    }
    return [];
  }

  /** Prefer what the till charged; fall back to what the app worked out. */
  function spendOf(t) {
    return t.tillTotal != null && t.tillTotal > 0 ? t.tillTotal : t.total;
  }

  /** Spend per calendar month, newest first. */
  function monthly() {
    const buckets = {};
    load().forEach(t => {
      const month = String(t.savedAt).slice(0, 7);
      if (!month) return;
      const b = buckets[month] || (buckets[month] = {
        month: month, trips: 0, total: 0, items: 0, unpriced: 0, estimated: 0
      });
      b.trips++;
      b.total += spendOf(t);
      b.items += t.itemCount;
      b.unpriced += t.unpriced;
      if (t.tillTotal == null) b.estimated++;
    });
    return Object.keys(buckets).sort().reverse().map(m => {
      const b = buckets[m];
      b.total = Math.round(b.total * 100) / 100;
      return b;
    });
  }

  /** Where the money goes: one row per product, biggest spend first. */
  function topItems(limit) {
    const byCode = {};
    load().forEach(t => {
      const items = (t.report && t.report.trip && t.report.trip.items) || [];
      items.forEach(i => {
        const k = i.code || i.name;
        if (!k) return;
        const row = byCode[k] || (byCode[k] = {
          code: i.code || '', name: i.name, category: i.category || 'Other',
          spend: 0, times: 0, lastSeen: null
        });
        row.spend += Number(i.lineTotal) || 0;
        row.times++;
        // Trips are stored newest-first, so the first sighting is the latest.
        if (!row.lastSeen) row.lastSeen = t.savedAt;
      });
    });
    return Object.keys(byCode)
      .map(k => {
        byCode[k].spend = Math.round(byCode[k].spend * 100) / 100;
        return byCode[k];
      })
      .sort((a, b) => b.spend - a.spend)
      .slice(0, limit || 10);
  }

  return { save, list, get, remove, clear, monthly, topItems, summarise, STORAGE_KEY, MAX_TRIPS };
});
