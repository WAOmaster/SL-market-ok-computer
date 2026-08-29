/**
 * Optional sync with the SL Market backend.
 *
 * The app is deliberately usable with no server at all - a supermarket basement
 * is the last place to rely on a network. When an API base URL is configured and
 * reachable, the shared catalog and finished trips are synced to it.
 */
(function (root, factory) {
  const api = factory();
  root.SLScan = root.SLScan || {};
  root.SLScan.api = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'slscan.apiBase.v1';
  const TIMEOUT_MS = 6000;

  function storage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (err) { /* ignore */ }
    return null;
  }

  function getBase() {
    const store = storage();
    if (!store) return '';
    try {
      return (store.getItem(STORAGE_KEY) || '').replace(/\/+$/, '');
    } catch (err) {
      return '';
    }
  }

  function setBase(url) {
    const clean = String(url || '').trim().replace(/\/+$/, '');
    const store = storage();
    if (store) {
      try {
        if (clean) store.setItem(STORAGE_KEY, clean);
        else store.removeItem(STORAGE_KEY);
      } catch (err) { /* ignore */ }
    }
    return clean;
  }

  function isEnabled() { return !!getBase(); }

  async function request(path, options) {
    const base = getBase();
    if (!base) throw new Error('No API URL configured.');

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

    try {
      const res = await fetch(base + path, Object.assign({
        headers: { 'Content-Type': 'application/json' },
        signal: controller ? controller.signal : undefined
      }, options || {}));

      if (!res.ok) {
        let detail = 'HTTP ' + res.status;
        try {
          const body = await res.json();
          detail = body.detail || body.error || detail;
        } catch (err) { /* non-JSON error body */ }
        throw new Error(detail);
      }
      return res.status === 204 ? null : await res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('The API did not respond in time.');
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const ping = () => request('/health');
  const fetchCatalog = () => request('/api/scanner/catalog');
  const pushProduct = (product) => request('/api/scanner/catalog', {
    method: 'POST', body: JSON.stringify(product)
  });
  const lookup = (code) => request('/api/scanner/lookup/' + encodeURIComponent(code));
  const saveSession = (session) => request('/api/scanner/sessions', {
    method: 'POST', body: JSON.stringify(session)
  });
  const listSessions = () => request('/api/scanner/sessions');

  return { getBase, setBase, isEnabled, request, ping, fetchCatalog, pushProduct, lookup, saveSession, listSessions, STORAGE_KEY };
});
