/**
 * Store profiles.
 *
 * Two supermarkets are not interchangeable: they encode their scale labels
 * differently, they price the same vegetable differently, and their internal
 * item codes collide - 914044 is Ribbed Gourd at Keells and could be anything
 * at the next chain. A profile keeps each store's learned label formats, and
 * the catalog records which store a price came from, so a price is never
 * silently carried across the road.
 */
(function (root, factory) {
  const api = factory(root.SLScan && root.SLScan.barcode ? root.SLScan.barcode : require('./barcode.js'));
  root.SLScan = root.SLScan || {};
  root.SLScan.stores = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function (barcode) {
  'use strict';

  const STORAGE_KEY = 'slscan.stores.v1';

  let profiles = null;

  function storage() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return null;
      // Node ships a localStorage that exists but throws unless it is given a
      // backing file, and some embedded browsers ship a similar stub. Existing
      // is not the same as working.
      if (typeof localStorage.setItem !== 'function') return null;
      return localStorage;
    } catch (err) { /* private mode */ }
    return null;
  }

  /** "Keells - Panadura" and "keells panadura" are the same shop. */
  function slug(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  /**
   * The chain, which is what prices and label formats actually belong to.
   * "Keells - Panadura" and "Keells Nugegoda" are both `keells`: two branches of
   * one chain price a vegetable within a few rupees of each other, while the
   * chain across the road does not, and uses its own item codes entirely.
   */
  function chainOf(name) {
    return slug(name).split('-')[0] || '';
  }

  function load() {
    if (profiles) return profiles;
    profiles = {};
    const store = storage();
    if (store) {
      try {
        const raw = store.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') profiles = parsed;
        }
      } catch (err) {
        console.warn('Store profiles could not be read; starting fresh.', err);
      }
    }
    return profiles;
  }

  function persist() {
    const store = storage();
    if (!store) return;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch (err) {
      console.warn('Store profiles could not be saved.', err);
    }
  }

  /**
   * Profiles are held per chain, like prices: a format learned at one Keells
   * reads the labels at every other Keells. The branch name is kept for
   * display only.
   */
  function profileFor(name, create) {
    const map = load();
    const id = chainOf(name);
    if (!id) return null;
    if (!map[id] && create) {
      map[id] = {
        id: id,
        name: String(name).trim(),
        branches: [],
        rules: [],
        firstSeen: new Date().toISOString()
      };
      persist();
    }
    const profile = map[id];
    if (profile && create) {
      const branch = String(name).trim();
      profile.branches = profile.branches || [];
      if (branch && !profile.branches.includes(branch)) {
        profile.branches.push(branch);
        persist();
      }
    }
    return profile || null;
  }

  function all() {
    const map = load();
    return Object.keys(map).map(k => map[k]);
  }

  /** Keep a layout worked out at this store, unless an identical one is held. */
  function rememberRule(storeName, rule) {
    if (!rule) return null;
    const profile = profileFor(storeName, true);
    if (!profile) return null;
    if (profile.rules.some(r => r.id === rule.id)) return null;

    profile.rules.push(rule);
    persist();
    registerAll();
    return rule;
  }

  function forgetRule(ruleId) {
    const map = load();
    let removed = false;
    Object.keys(map).forEach(id => {
      const before = map[id].rules.length;
      map[id].rules = map[id].rules.filter(r => r.id !== ruleId);
      if (map[id].rules.length !== before) removed = true;
    });
    if (removed) {
      persist();
      registerAll();
    }
    return removed;
  }

  function rulesFor(storeName) {
    const profile = profileFor(storeName, false);
    return profile ? profile.rules.slice() : [];
  }

  function allRules() {
    return all().reduce((acc, p) => acc.concat(p.rules || []), []);
  }

  /**
   * Hand every learned layout to the decoder. Rules from other stores stay in
   * play - a shopper may be standing in one and have typed the store name of
   * another - but the decoder scores this store's own rules first.
   */
  function registerAll(currentStoreName) {
    const mine = currentStoreName ? rulesFor(currentStoreName) : [];
    const others = allRules().filter(r => !mine.some(m => m.id === r.id));
    return barcode.registerRules(mine.concat(others));
  }

  function reset() {
    profiles = {};
    const store = storage();
    if (store) {
      try { store.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
    }
    barcode.registerRules([]);
    return profiles;
  }

  return { slug, chainOf, profileFor, all, rememberRule, forgetRule, rulesFor, allRules, registerAll, reset, STORAGE_KEY };
});
