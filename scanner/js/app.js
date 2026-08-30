/**
 * UI wiring for Cart Scan.
 *
 * Flow of a scan:
 *   code -> barcode.parse -> catalog.find -> known?  add the line and beep
 *                                          -> unknown? open the item dialog once,
 *                                             remember it, and never ask again.
 */
(function () {
  'use strict';

  const { barcode, catalog, cart, label, scanner, api, scanlog, report, stores, resolve, trips } = window.SLScan;

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.prototype.slice.call(document.querySelectorAll(sel));

  const el = {
    headerTotal: $('#headerTotal'),
    storeLabel: $('#storeLabel'),
    cartBadge: $('#cartBadge'),
    viewfinder: $('#viewfinder'),
    video: $('#video'),
    btnCamera: $('#btnCamera'),
    btnTorch: $('#btnTorch'),
    btnPhoto: $('#btnPhoto'),
    btnReadLabel: $('#btnReadLabel'),
    filePhoto: $('#filePhoto'),
    fileLabel: $('#fileLabel'),
    scanStatus: $('#scanStatus'),
    manualForm: $('#manualForm'),
    manualCode: $('#manualCode'),
    btnAddFree: $('#btnAddFree'),
    recentScans: $('#recentScans'),
    cartLines: $('#cartLines'),
    totalsPanel: $('#totalsPanel'),
    categoryChips: $('#categoryChips'),
    catalogList: $('#catalogList'),
    catalogSearch: $('#catalogSearch'),
    catalogForm: $('#catalogForm'),
    catalogStatus: $('#catalogStatus'),
    itemDialog: $('#itemDialog'),
    itemForm: $('#itemForm'),
    receipt: $('#receipt'),
    setTestOut: $('#setTestOut'),
    apiStatus: $('#apiStatus'),
    exportStatus: $('#exportStatus'),
    billStatus: $('#billStatus'),
    logStatus: $('#logStatus'),
    learnedRules: $('#learnedRules'),
    storeChain: $('#storeChain'),
    historyMonths: $('#historyMonths'),
    historyItems: $('#historyItems'),
    historyTrips: $('#historyTrips')
  };

  let recent = [];
  let torchAvailable = false;

  /*
   * Shelf tickets. A ticket prices the packet scanned just before it, so both
   * of these are about not letting the camera's repeat reads do damage:
   * ignore the same ticket read again within a moment, and only attach a
   * ticket to a line the shopper scanned seconds ago.
   */
  const TICKET_REPEAT_MS = 4000;
  const TICKET_LINK_MS = 90000;
  let lastTicket = { code: null, at: 0 };

  /* ---------------- helpers ---------------- */

  function currency() { return cart.getState().settings.currency || 'Rs.'; }

  /** The chain being shopped, which scopes both prices and label formats. */
  function chain() { return stores.chainOf(cart.getState().store); }

  function scope() { return { store: chain() }; }

  function money(n) {
    return currency() + ' ' + (Number(n) || 0).toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function setStatus(node, message, kind) {
    if (!node) return;
    node.textContent = message;
    node.className = 'status' + (kind ? ' ' + kind : '');
    node.hidden = false;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /** A short confirmation beep; silently ignored where audio is blocked. */
  function beep(ok) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = beep.ctx || (beep.ctx = new Ctx());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = ok ? 1180 : 320;
      gain.gain.value = 0.05;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (ok ? 0.09 : 0.22));
    } catch (err) { /* audio is a nicety, not a requirement */ }
    if (navigator.vibrate) {
      try { navigator.vibrate(ok ? 35 : [40, 60, 40]); } catch (err) { /* ignore */ }
    }
  }

  /* ---------------- tabs ---------------- */

  function showView(name) {
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.id === 'tab-' + name)));
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + name; });
    if (name === 'catalog') renderCatalog();
    if (name === 'history') renderHistory();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => showView(tab.id.replace('tab-', '')));
  });

  /* ---------------- rendering ---------------- */

  function render() {
    renderCart();
    renderTotals();
    renderRecent();
    updateBadge();
    renderBillCheck();
  }

  function updateBadge() {
    const t = cart.totals();
    el.cartBadge.textContent = t.itemCount ? String(t.itemCount) : '';
    el.cartBadge.hidden = !t.itemCount;
    el.headerTotal.textContent = money(t.total);
    el.headerTotal.classList.toggle('over', !!t.overBudget);
    const store = cart.getState().store;
    el.storeLabel.textContent = store || 'Supermarket scanner';
  }

  function lineHTML(item) {
    const isWeight = item.pricing === 'weight';
    const pills = [
      isWeight ? '<span class="pill weight">per kg</span>' : '',
      item.priceOverride != null ? '<span class="pill override">label price</span>' : ''
    ].join('');

    const measure = isWeight
      ? item.weightKg.toFixed(3) + ' kg &times; ' + money(item.unitPrice) + '/kg'
      : item.qty + ' &times; ' + money(item.unitPrice);

    const control = isWeight
      ? '<label class="visually-hidden" for="w-' + item.id + '">Weight in kg</label>' +
        '<input class="mini" type="number" min="0" step="0.001" id="w-' + item.id + '" ' +
        'data-weight="' + item.id + '" value="' + item.weightKg.toFixed(3) + '">' +
        '<span class="unit-hint">kg</span>'
      : '<div class="stepper">' +
        '<button type="button" data-dec="' + item.id + '" aria-label="One fewer">&minus;</button>' +
        '<span class="count">' + item.qty + '</span>' +
        '<button type="button" data-inc="' + item.id + '" aria-label="One more">+</button>' +
        '</div>';

    return '<div class="line" data-line="' + item.id + '">' +
      '<div class="name">' + escapeHtml(item.name) + ' ' + pills + '</div>' +
      '<div class="total">' + money(item.lineTotal) + '</div>' +
      '<div class="meta">' + (item.code ? escapeHtml(item.code) + ' &middot; ' : '') + measure + '</div>' +
      '<div class="controls">' + control +
        '<label class="visually-hidden" for="p-' + item.id + '">Line price override</label>' +
        '<input class="mini" type="number" min="0" step="0.01" id="p-' + item.id + '" ' +
        'data-price="' + item.id + '" placeholder="Rs. total" value="' +
        (item.priceOverride != null ? item.priceOverride.toFixed(2) : '') + '">' +
        '<button type="button" class="btn small danger" data-del="' + item.id + '">Remove</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * Update one row in place.
   *
   * Rebuilding the whole list while the shopper is still in a weight or price
   * box rips the focused input out of the DOM mid-event, which Chromium refuses
   * to do, so an edit refreshes only the row it touched.
   */
  function refreshLine(id) {
    const item = cart.items().find(i => i.id === id);
    const row = el.cartLines.querySelector('[data-line="' + id + '"]');
    if (!item || !row) { renderCart(); return; }

    row.querySelector('.total').textContent = money(item.lineTotal);
    row.querySelector('.meta').innerHTML =
      (item.code ? escapeHtml(item.code) + ' &middot; ' : '') +
      (item.pricing === 'weight'
        ? item.weightKg.toFixed(3) + ' kg &times; ' + money(item.unitPrice) + '/kg'
        : item.qty + ' &times; ' + money(item.unitPrice));

    const name = row.querySelector('.name');
    const hasPill = !!name.querySelector('.pill.override');
    if (item.priceOverride != null && !hasPill) {
      name.insertAdjacentHTML('beforeend', ' <span class="pill override">label price</span>');
    } else if (item.priceOverride == null && hasPill) {
      name.querySelector('.pill.override').remove();
    }

    const count = row.querySelector('.stepper .count');
    if (count) count.textContent = item.qty;
  }

  function renderCart() {
    const items = cart.items();
    if (!items.length) {
      el.cartLines.innerHTML = '<div class="empty"><span class="big" aria-hidden="true">&#128722;</span>' +
        'The trolley is empty.<br>Scan something on the Scan tab.</div>';
      return;
    }
    el.cartLines.innerHTML = items.map(lineHTML).join('');
  }

  /**
   * The month view. Every number here comes from trips already on this phone -
   * there is nothing to fetch, and nothing leaves the device.
   */
  function renderHistory() {
    const months = trips.monthly();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    if (!months.length) {
      el.historyMonths.innerHTML =
        '<p class="hint">No finished trips yet. Scan a shop, then tap ' +
        '&ldquo;Empty the trolley&rdquo; when you are done and it will be kept here.</p>';
      el.historyItems.innerHTML = '';
      el.historyTrips.innerHTML = '';
      return;
    }

    el.historyMonths.innerHTML = months.map(m => {
      // An estimate is a trip whose till total was never entered, so it is
      // still the app's arithmetic rather than what the card was charged.
      const caveat = m.estimated
        ? ' <span class="hint">(' + m.estimated + ' estimated)</span>'
        : '';
      return '<div class="row"><span>' + escapeHtml(m.month) + ' &middot; ' +
        m.trips + (m.trips === 1 ? ' trip' : ' trips') + caveat + '</span><span>' +
        money(m.total) + '</span></div>';
    }).join('');

    el.historyItems.innerHTML = trips.topItems(8).map(i =>
      '<div class="row"><span>' + escapeHtml(i.name) +
      ' <span class="hint">&times;' + i.times + '</span></span><span>' +
      money(i.spend) + '</span></div>').join('') ||
      '<p class="hint">Nothing recorded yet.</p>';

    el.historyTrips.innerHTML = trips.list().map(t => {
      const d = new Date(t.savedAt);
      const when = isNaN(d) ? t.savedAt
        : dayNames[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
      const paid = t.tillTotal != null && t.tillTotal > 0;
      const bits = [t.itemCount + ' items'];
      if (t.unpriced) bits.push(t.unpriced + ' unpriced');
      if (!paid) bits.push('estimate');
      return '<div class="line">' +
        '<div class="name">' + escapeHtml(t.store || 'Trip') + '</div>' +
        '<div class="total">' + money(paid ? t.tillTotal : t.total) + '</div>' +
        '<div class="meta">' + escapeHtml(when) + ' &middot; ' + bits.join(' &middot; ') + '</div>' +
        '<div class="controls">' +
          '<button type="button" class="btn small danger" data-deltrip="' + escapeHtml(t.id) + '">Remove</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  if (el.historyTrips) {
    el.historyTrips.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-deltrip]');
      if (!btn) return;
      if (!window.confirm('Remove this trip from your history? This cannot be undone.')) return;
      trips.remove(btn.dataset.deltrip);
      renderHistory();
    });
  }

  function renderTotals() {
    const t = cart.totals();
    const rows = [
      ['Lines', String(t.lines)],
      ['Items counted', String(t.itemCount)],
      ['Weighed produce', t.weightKg.toFixed(3) + ' kg'],
      ['Subtotal', money(t.subtotal)]
    ];
    if (t.discount) rows.push(['Discount', '-' + money(t.discount)]);
    if (t.tax) rows.push(['Tax', money(t.tax)]);

    let html = rows.map(r =>
      '<div class="row"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>').join('');
    html += '<div class="row grand"><span>Total</span><span>' + money(t.total) + '</span></div>';

    /*
     * Say plainly when the total is incomplete. A running total that silently
     * omits three unpriced packets is worse than no total at all - the shopper
     * plans around it and is caught out at the till.
     */
    if (t.unpriced) {
      html += '<div class="row warn"><span>Not yet priced</span><span>' +
        t.unpriced + (t.unpriced === 1 ? ' item' : ' items') + '</span></div>';
    }

    if (t.budget > 0) {
      const pct = Math.min(100, (t.total / t.budget) * 100);
      html += '<div class="row"><span>Budget ' + money(t.budget) + '</span><span>' +
        (t.overBudget ? 'over by ' + money(Math.abs(t.budgetLeft)) : money(t.budgetLeft) + ' left') +
        '</span></div>' +
        '<div class="budget-bar' + (t.overBudget ? ' over' : '') + '"><span style="width:' + pct + '%"></span></div>';
    }

    el.totalsPanel.innerHTML = html;
    el.categoryChips.innerHTML = cart.byCategory()
      .map(c => '<span class="chip">' + escapeHtml(c.category) + ' &middot; ' + money(c.total) + '</span>')
      .join('');
  }

  function renderRecent() {
    if (!recent.length) {
      el.recentScans.innerHTML = '<div class="empty"><span class="big" aria-hidden="true">&#128203;</span>Nothing scanned yet.</div>';
      return;
    }
    el.recentScans.innerHTML = recent.slice(0, 6).map(r =>
      '<div class="line"><div class="name">' + escapeHtml(r.name) + '</div>' +
      '<div class="total">' + money(r.total) + '</div>' +
      '<div class="meta">' + escapeHtml(r.detail) + '</div></div>').join('');
  }

  function renderCatalog() {
    const products = catalog.search(el.catalogSearch.value, scope());
    if (!products.length) {
      el.catalogList.innerHTML = '<div class="empty">No products match that search.</div>';
      return;
    }
    el.catalogList.innerHTML = products.map(p =>
      '<div class="catalog-item">' +
        '<div class="info"><b>' + escapeHtml(p.name) + '</b>' +
        '<span>' + escapeHtml(p.code) + ' &middot; ' + escapeHtml(p.category) + '</span></div>' +
        '<div class="price">' + money(p.unitPrice) + (p.pricing === 'weight' ? '/kg' : '') + '</div>' +
        '<button class="btn small" data-edit="' + escapeHtml(p.code) + '">Edit</button>' +
        '<button class="btn small danger" data-remove="' + escapeHtml(p.code) + '">&times;</button>' +
      '</div>').join('');
  }

  /* ---------------- adding items ---------------- */

  function pushRecent(item, note) {
    recent.unshift({
      name: item.name,
      total: item.lineTotal,
      detail: (item.code ? item.code + ' - ' : '') +
        (item.pricing === 'weight' ? item.weightKg.toFixed(3) + ' kg' : 'x' + item.qty) +
        (note ? ' - ' + note : '')
    });
    recent = recent.slice(0, 12);
  }

  function addToCart(payload, note) {
    const outcome = cart.add(payload);
    if (!outcome) return null;
    pushRecent(outcome.item, outcome.merged ? 'count now ' + outcome.item.qty : note);
    render();
    beep(true);

    const row = el.cartLines.querySelector('[data-line="' + outcome.item.id + '"]');
    if (row) row.classList.add('flash');
    return outcome;
  }

  /**
   * Turn a raw code into a cart line. Known code -> straight in. Unknown code ->
   * ask once, then remember it.
   */
  function handleCode(raw, meta) {
    const info = meta || {};
    const source = info.source || (info.engine === 'manual' ? 'manual' : 'camera');
    const preferredRuleId = cart.getState().settings.preferredRuleId;
    const known = catalog.find(barcode.parse(raw), scope());
    const parsed = barcode.parse(raw, {
      preferredRuleId: preferredRuleId,
      catalogUnitPrice: known ? known.unitPrice : 0
    });
    const product = known || catalog.find(parsed, scope());

    if (!parsed.code) {
      setStatus(el.scanStatus, 'That does not look like a barcode.', 'err');
      beep(false);
      scanlog.record({
        source: source, engine: info.engine, raw: raw, parsed: parsed,
        outcome: 'rejected', message: 'No digits in the scanned value.'
      });
      updateLogStatus();
      return;
    }

    /*
     * A shelf-edge ticket, not a product.
     *
     * Keells prints one under every facing, carrying the item code the till
     * uses. Scanning it is the shopper's way of telling the app exactly which
     * Keells product they are holding - which no barcode can do, because
     * nothing published maps an EAN-13 to a Keells item code.
     *
     * So a ticket does two jobs: it prices the packet just scanned, and it
     * records that packet's barcode against the item code for good. One ticket
     * scan, once per product, and the aisle knows that product's price for
     * ever afterwards.
     */
    /*
     * Half a ticket. The camera caught the item code and then lost the rest, so
     * there is no price to read and nothing to add - the packet it belongs to
     * is already in the trolley waiting. Ask for another look rather than
     * inventing a line out of the fragment.
     */
    if (parsed.type === 'shelf-partial') {
      beep(false);
      setStatus(el.scanStatus, 'Only half that shelf ticket came through - hold steady and scan it again.', 'warn');
      scanlog.record({
        source: source, engine: info.engine, raw: raw, parsed: parsed,
        outcome: 'rejected', message: 'Partial shelf-ticket read; not added.'
      });
      updateLogStatus();
      return;
    }

    if (parsed.type === 'shelf') {
      /*
       * A camera pointed at a ticket reads it many times a second. Without a
       * guard one ticket fired six times in nine seconds and priced four
       * different products - a real trolley came out at Rs 6,830 of things the
       * shopper had not chosen.
       */
      // Keyed on the item code, not the raw text: the camera renders the
      // ticket's separator differently on each pass, so the same ticket arrives
      // as several different strings and a raw-text guard never catches it.
      if (lastTicket.code === parsed.itemCode && Date.now() - lastTicket.at < TICKET_REPEAT_MS) {
        return;
      }
      lastTicket = { code: parsed.itemCode, at: Date.now() };

      const priced = resolve.byItemCode(parsed.itemCode);

      /*
       * Which line does a ticket belong to? Only the one the shopper scanned
       * immediately before it - they picked up a packet, then pointed at the
       * ticket beneath it.
       *
       * It used to take *any* unpriced line, which is how the Sunlight ticket
       * priced a packet scanned two minutes earlier, and then priced two other
       * shelf tickets that had themselves been mistaken for products. So:
       * the newest line only, still unpriced, scanned moments ago, and never a
       * line that is itself a ticket.
       */
      const newest = cart.items()[0];
      const fresh = newest && newest.addedAt &&
        (Date.now() - new Date(newest.addedAt).getTime()) < TICKET_LINK_MS;
      const isTicket = newest && barcode.parse(newest.barcode || newest.code).type === 'shelf';
      const pending = (newest && newest.unpriced && fresh && !isTicket) ? newest : null;

      if (!priced) {
        beep(false);
        setStatus(el.scanStatus, 'Shelf ticket for item ' + parsed.itemCode +
          ' - that code is not in the price list yet.', 'warn');
        scanlog.record({
          source: source, engine: info.engine, raw: raw, parsed: parsed,
          outcome: 'prompted', message: 'Shelf ticket scanned; item code unknown to the price list.'
        });
        updateLogStatus();
        return;
      }

      if (!pending) {
        beep(true);
        setStatus(el.scanStatus, priced.name + ' - ' + money(priced.price) +
          '. Scan the packet first and the ticket will price it.', 'ok');
        scanlog.record({
          source: source, engine: info.engine, raw: raw, parsed: parsed, product: priced,
          outcome: 'added', message: 'Shelf ticket read; nothing waiting to be priced.'
        });
        updateLogStatus();
        return;
      }

      cart.update(pending.id, {
        name: pending.nameSource ? pending.name : priced.name,
        unitPrice: priced.price,
        pricing: priced.uom === 'KG' ? 'weight' : 'unit'
      });

      // Remember it. The barcode on the packet now has a Keells price against
      // it, so the next trip prices this product the instant it is scanned.
      if (pending.barcode) {
        catalog.upsert({
          code: pending.barcode,
          name: pending.nameSource ? pending.name : priced.name,
          unitPrice: priced.price,
          pricing: priced.uom === 'KG' ? 'weight' : 'unit',
          unit: priced.uom === 'KG' ? 'kg' : 'pc',
          category: pending.category,
          store: chain() || 'keells'
        });
      }

      beep(true);
      setStatus(el.scanStatus, priced.name + ' - ' + money(priced.price) +
        ' (learned from the shelf ticket).', 'ok');
      scanlog.record({
        source: source, engine: info.engine, raw: raw, parsed: parsed, product: priced,
        outcome: 'confirmed',
        message: 'Shelf ticket priced ' + (pending.barcode || pending.code) +
          ' at item ' + parsed.itemCode + '; saved to the catalog.'
      });
      updateLogStatus();
      render();
      return;
    }

    /*
     * A price recorded at another chain is a starting point, not a price. The
     * item codes collide across chains and the prices differ, so it is offered
     * in the dialog, prefilled, for the shopper to check against the shelf.
     */
    if (product && product.fromOtherStore) {
      beep(false);
      const weighed = parsed.candidates.find(c => c.kind === 'weight');
      setStatus(el.scanStatus, product.name + ' is priced from another shop (' +
        money(product.unitPrice) + (product.pricing === 'weight' ? '/kg' : '') +
        '). Check it against the shelf before adding.', 'warn');
      scanlog.record({
        source: source, engine: info.engine, raw: raw, parsed: parsed, product: product,
        outcome: 'prompted', message: 'Known only at another chain (' + product.store + '); asked the shopper.'
      });
      updateLogStatus();
      openItemDialog({
        code: product.code,
        barcode: parsed.ean13,
        name: product.name,
        category: product.category,
        pricing: product.pricing,
        unitPrice: product.unitPrice,
        weightKg: weighed ? weighed.weightKg : 0,
        unusualWeight: !!(weighed && weighed.unusualWeight),
        fromOtherStore: product.store,
        source: source
      });
      return;
    }

    /*
     * An unknown code must NEVER stop the shopper.
     *
     * This used to open the item dialog and wait for a name and a price. In an
     * aisle, one hand on a trolley, that fires on most of a first shop - and
     * people quit. The line goes into the trolley unpriced instead, the offline
     * table names it if it can, and the running total says how many lines are
     * still waiting. The bill fills the prices in afterwards, or the shopper
     * taps the line when it suits them.
     */
    if (!product) {
      const named = resolve.lookupSync(parsed);
      const embeddedPrice = parsed.best && parsed.best.kind === 'price' ? parsed.best.totalPrice : null;
      const weighed = parsed.best && parsed.best.kind === 'weight' ? parsed.best : null;

      // A shelf price from the pre-joined Keells table is the real thing, not
      // an estimate: the barcode was matched to a Keells item code offline and
      // this is that item's price. It is what makes a scan answer "what will
      // this cost" instead of merely "what is this".
      const shelfPrice = named && named.price > 0 ? named.price : 0;

      const outcome = cart.add({
        code: parsed.itemCode || parsed.code,
        // The code exactly as scanned - the format is learned from this, and
        // padding it to 13 digits would move the field.
        barcode: parsed.code,
        name: named ? named.name : ('Unknown item ' + parsed.code),
        category: named && named.category ? named.category : 'Other',
        nameSource: named ? 'barcodes' : '',
        pricing: weighed ? 'weight' : 'unit',
        weightKg: weighed ? weighed.weightKg : 0,
        unitPrice: shelfPrice,
        // A scale label that carries its own total price is already priced.
        priceOverride: embeddedPrice,
        unpriced: embeddedPrice == null && !shelfPrice,
        source: source
      });

      beep(!!named);
      setStatus(el.scanStatus,
        shelfPrice
          ? named.name + ' - ' + money(shelfPrice) +
            (named.ambiguous ? ' (two barcodes share this item, check the shelf)' : '')
          : named
            ? named.name + ' added - no price yet, the bill will fill it in.'
            : 'Added as unpriced. Carry on; you can name it later.',
        shelfPrice && !named.ambiguous ? 'ok' : 'warn');
      scanlog.record({
        source: source, engine: info.engine, raw: raw, parsed: parsed,
        product: named || null,
        outcome: 'added',
        message: named
          ? (named.price > 0 ? 'Named and priced from the Keells join.' : 'Named from the offline barcode table; added unpriced.')
          : 'Unknown code; added unpriced rather than stopping the shopper.'
      });
      updateLogStatus();
      render();
      return outcome;
    }

    const line = {
      code: product.code,
      barcode: parsed.ean13,
      name: product.name,
      category: product.category,
      pricing: product.pricing,
      unit: product.unit,
      unitPrice: product.unitPrice,
      qty: 1,
      weightKg: 0,
      source: source
    };

    if (product.pricing === 'weight') {
      const weighed = parsed.candidates.find(c => c.kind === 'weight');
      line.decoded = !!weighed;
      if (weighed) {
        line.weightKg = weighed.weightKg;
      } else {
        // A per-kilo product scanned without a weight in the code: ask for it.
        scanlog.record({
          source: source, engine: info.engine, raw: raw, parsed: parsed, product: product,
          outcome: 'prompted', message: 'Priced per kg but the code carried no weight; asked for it.'
        });
        updateLogStatus();
        openItemDialog(Object.assign(line, { needWeight: true }));
        return;
      }
    }

    const priced = parsed.candidates.find(c => c.kind === 'price');
    if (priced && product.pricing !== 'weight') line.priceOverride = priced.totalPrice;

    const outcome = addToCart(line);
    scanlog.record({
      source: source, engine: info.engine, raw: raw, parsed: parsed, product: product,
      outcome: outcome && outcome.merged ? 'merged' : 'added',
      line: outcome && outcome.item
    });
    updateLogStatus();

    setStatus(el.scanStatus, 'Added ' + product.name + ' - ' +
      (line.pricing === 'weight' ? line.weightKg.toFixed(3) + ' kg' : 'x1') + '.', 'ok');
  }

  /* ---------------- item dialog ---------------- */

  let dialogContext = null;
  let dialogResolved = false;

  function openItemDialog(context) {
    dialogContext = context || {};
    dialogResolved = false;
    const isWeight = dialogContext.pricing === 'weight';

    $('#itemDialogTitle').textContent = dialogContext.name ? 'Check this item' : 'New item';
    $('#itemDialogHint').textContent = dialogContext.code
      ? 'Code ' + dialogContext.code +
        (dialogContext.weightKg ? ' - ' + dialogContext.weightKg.toFixed(3) + ' kg from the barcode' : '') +
        (dialogContext.unusualWeight
          ? '. That weight looks wrong for a hand-carried pack - the camera may have misread the label, so check it against the sticker.'
          : '') +
        (dialogContext.fromOtherStore
          ? '. The price shown is what this code cost at ' + dialogContext.fromOtherStore +
            ' - check it against the shelf here.'
          : '')
      : 'Not everything has a barcode - add it by hand.';

    $('#dName').value = dialogContext.name || '';
    $('#dPricing').value = isWeight ? 'weight' : 'unit';
    $('#dPrice').value = dialogContext.unitPrice ? dialogContext.unitPrice : '';
    $('#dQty').value = dialogContext.qty || 1;
    $('#dWeight').value = dialogContext.weightKg || '';
    $('#dCategory').value = dialogContext.category || 'Other';
    $('#dRemember').checked = !!dialogContext.code;
    syncDialogMode();

    if (typeof el.itemDialog.showModal === 'function') el.itemDialog.showModal();
    else el.itemDialog.setAttribute('open', 'open');
    setTimeout(() => $('#dName').focus(), 50);
  }

  function syncDialogMode() {
    const isWeight = $('#dPricing').value === 'weight';
    $('#dQtyWrap').hidden = isWeight;
    $('#dWeightWrap').hidden = !isWeight;
    $('#dWeight').required = isWeight;
    $('#dPriceWrap').firstChild.textContent = isWeight ? 'Price per kg (Rs.) ' : 'Price (Rs.) ';
  }

  $('#dPricing').addEventListener('change', syncDialogMode);

  /*
   * A prompt the shopper walks away from is worth recording: it is an item that
   * was scanned and never made it into the trolley, which is exactly the kind of
   * gap that only shows up against the till receipt afterwards.
   */
  el.itemDialog.addEventListener('close', () => {
    if (!dialogContext || dialogResolved) { dialogContext = null; return; }
    scanlog.record({
      source: dialogContext.source || 'manual',
      raw: dialogContext.barcode || dialogContext.code || null,
      outcome: 'cancelled',
      message: 'Asked the shopper; the item was not added.'
    });
    updateLogStatus();
    dialogContext = null;
  });

  el.itemForm.addEventListener('submit', (event) => {
    if (event.submitter && event.submitter.value === 'cancel') return;
    dialogResolved = true;

    const isWeight = $('#dPricing').value === 'weight';
    const ctx = dialogContext || {};
    const weightKg = isWeight ? Number($('#dWeight').value) || 0 : 0;
    const product = {
      code: ctx.code || '',
      name: $('#dName').value.trim(),
      unitPrice: Number($('#dPrice').value) || 0,
      pricing: isWeight ? 'weight' : 'unit',
      unit: isWeight ? 'kg' : 'pc',
      category: $('#dCategory').value.trim() || 'Other',
      store: chain()
    };

    if ($('#dRemember').checked && product.code) {
      catalog.upsert(product);
      syncProductToApi(product);
    }

    const learned = learnLabelFormat(ctx, weightKg);


    const outcome = addToCart({
      code: product.code,
      barcode: ctx.barcode || product.code,
      name: product.name,
      category: product.category,
      pricing: product.pricing,
      unit: product.unit,
      unitPrice: product.unitPrice,
      qty: isWeight ? 1 : Math.max(1, parseInt($('#dQty').value, 10) || 1),
      weightKg: weightKg,
      priceOverride: ctx.priceOverride != null ? ctx.priceOverride : null,
      source: ctx.source || 'manual'
    });

    if (learned && $('#dRemember').checked && product.code) {
      refileUnderItemCode(ctx.barcode, product.code, outcome && outcome.item && outcome.item.id);
    }

    scanlog.record({
      source: ctx.source || 'manual',
      raw: ctx.barcode || ctx.code || null,
      product: product,
      ocr: ctx.ocrReading || null,
      keepRawText: keepOcrText(),
      outcome: 'confirmed',
      line: outcome && outcome.item,
      message: $('#dRemember').checked && product.code
        ? 'Confirmed by the shopper and saved to the catalog.'
        : 'Confirmed by the shopper.'
    });
    updateLogStatus();

    setStatus(el.scanStatus, 'Added ' + product.name + '.' + (learned
      ? ' Learned how ' + cart.getState().store + ' writes its labels (' +
        learned.itemLength + '-digit item code, then a ' + learned.valueLength +
        '-digit weight) - the next one will price itself.'
      : ''), 'ok');
  });

  /**
   * Work out this store's label format from a label the shopper has just
   * confirmed by hand.
   *
   * The first weighed item at a new supermarket is typed in; from the code and
   * that weight the layout can be derived, and every later label at that chain
   * decodes on its own. Nothing is learned from a code that already decoded, or
   * from a store with no name set - a format has to belong to somewhere.
   */
  function learnLabelFormat(context, weightKg) {
    const storeName = cart.getState().store;
    if (!storeName || !context || !context.barcode) return null;
    if (context.decoded) return null;
    if (!(weightKg > 0)) return null;

    const rule = barcode.learnRule(context.barcode, {
      weightKg: weightKg,
      storeId: chain(),
      storeName: storeName
    });
    if (!rule) return null;

    const remembered = stores.rememberRule(storeName, rule);
    if (!remembered) return null;

    stores.registerAll(storeName);
    renderLearnedRules();
    return remembered;
  }

  /**
   * Re-file the product that taught us the format.
   *
   * It was saved before the layout was known, so its key is the whole barcode -
   * weight and all - which no second pack will ever match. Learning the format
   * is the moment the real item code becomes visible, so the entry moves to it.
   */
  function refileUnderItemCode(rawCode, savedCode, lineId) {
    if (!rawCode || !savedCode) return null;

    const parsed = barcode.parse(rawCode);
    if (parsed.type !== 'embedded' || !parsed.itemCode) return null;
    if (parsed.itemCode === savedCode) return null;

    const saved = catalog.find(savedCode, scope());
    if (!saved || saved.fromOtherStore) return null;

    catalog.upsert(Object.assign({}, saved, { code: parsed.itemCode, store: chain() }));
    catalog.remove(savedCode, chain());
    if (lineId) cart.update(lineId, { code: parsed.itemCode });

    return parsed.itemCode;
  }

  function renderLearnedRules() {
    if (!el.learnedRules) return;
    const rules = stores.allRules();
    if (!rules.length) {
      el.learnedRules.innerHTML =
        '<div class="empty">No label formats learned yet. Set the store name, then confirm one weighed item by hand and the format is worked out from it.</div>';
      return;
    }
    el.learnedRules.innerHTML = rules.map(r =>
      '<div class="catalog-item"><div class="info"><b>' + escapeHtml(r.label) + '</b>' +
      '<span>' + escapeHtml(r.storeId || 'any store') + ' &middot; item ' + r.itemLength +
      ' digits, then ' + r.valueLength + '</span></div>' +
      '<button class="btn small danger" data-forget="' + escapeHtml(r.id) + '">&times;</button></div>').join('');
  }

  /* ---------------- camera ---------------- */

  async function toggleCamera() {
    if (scanner.isRunning()) {
      await scanner.stop();
      el.viewfinder.classList.remove('live');
      el.btnCamera.textContent = 'Start camera';
      el.btnTorch.hidden = true;
      setStatus(el.scanStatus, 'Camera stopped.', '');
      return;
    }

    setStatus(el.scanStatus, 'Opening the camera...', '');
    el.btnCamera.disabled = true;
    try {
      const info = await scanner.start({
        video: el.video,
        onDetect: (code, meta) => handleCode(code, Object.assign({ source: 'camera' }, meta)),
        onError: err => setStatus(el.scanStatus, err.message || String(err), 'err')
      });
      el.viewfinder.classList.add('live');
      el.btnCamera.textContent = 'Stop camera';
      setStatus(el.scanStatus, 'Scanning with the ' +
        (info.engine === 'native' ? 'built-in' : 'ZXing') + ' decoder. Hold the barcode inside the frame.', 'ok');

      torchAvailable = await scanner.setTorch(false).then(() => true).catch(() => false);
      el.btnTorch.hidden = !torchAvailable;
    } catch (err) {
      setStatus(el.scanStatus, err.message || 'The camera could not be opened.', 'err');
    } finally {
      el.btnCamera.disabled = false;
    }
  }

  el.btnCamera.addEventListener('click', toggleCamera);

  let torchOn = false;
  el.btnTorch.addEventListener('click', async () => {
    torchOn = !torchOn;
    try {
      await scanner.setTorch(torchOn);
      el.btnTorch.textContent = torchOn ? 'Torch off' : 'Torch';
    } catch (err) {
      setStatus(el.scanStatus, 'This device will not let the app control the torch.', 'warn');
    }
  });

  el.btnPhoto.addEventListener('click', () => el.filePhoto.click());

  el.filePhoto.addEventListener('change', async () => {
    const file = el.filePhoto.files && el.filePhoto.files[0];
    if (!file) return;
    setStatus(el.scanStatus, 'Looking for a barcode in that photo...', '');
    try {
      const hit = await scanner.scanImage(file);
      setStatus(el.scanStatus, 'Found ' + hit.code + '.', 'ok');
      handleCode(hit.code, { engine: hit.engine, source: 'photo' });
    } catch (err) {
      beep(false);
      setStatus(el.scanStatus, err.message, 'err');
      scanlog.record({ source: 'photo', outcome: 'error', message: err.message });
      updateLogStatus();
    } finally {
      el.filePhoto.value = '';
    }
  });

  el.btnReadLabel.addEventListener('click', () => {
    // A live camera frame is quicker than picking a file; otherwise ask for one.
    const frame = scanner.isRunning() ? scanner.captureFrame(el.video) : null;
    if (frame) readLabelFrom(frame);
    else el.fileLabel.click();
  });

  el.fileLabel.addEventListener('change', () => {
    const file = el.fileLabel.files && el.fileLabel.files[0];
    if (file) readLabelFrom(file);
    el.fileLabel.value = '';
  });

  /** OCR path: read the printed sticker when the barcode will not decode. */
  async function readLabelFrom(source) {
    setStatus(el.scanStatus, 'Reading the label text... (the reader downloads once, ~2 MB)', '');
    try {
      const text = await scanner.readText(source, p => {
        setStatus(el.scanStatus, 'Reading the label text... ' + Math.round(p * 100) + '%', '');
      });
      const parsed = label.parse(text);
      if (!parsed.name && !parsed.totalPrice && !parsed.weightKg) {
        beep(false);
        setStatus(el.scanStatus, 'Could not make out that label. Try a straight, close photo of the sticker.', 'err');
        scanlog.record({
          source: 'ocr', outcome: 'rejected', ocr: parsed, keepRawText: keepOcrText(),
          message: 'OCR found no usable fields on the label.'
        });
        updateLogStatus();
        return;
      }

      const known = parsed.itemCode ? catalog.find(parsed.itemCode) : null;
      const bc = parsed.barcode ? barcode.parse(parsed.barcode, {
        catalogUnitPrice: known ? known.unitPrice : parsed.unitPrice || 0,
        expectedTotal: parsed.totalPrice || 0
      }) : null;

      const merged = label.merge(bc, parsed, known);
      merged.name = merged.name || parsed.name || 'Label item';

      scanlog.record({
        source: 'ocr', raw: parsed.barcode, parsed: bc, product: known, ocr: parsed,
        keepRawText: keepOcrText(), outcome: 'prompted',
        message: 'Label read; waiting for the shopper to confirm.'
      });
      updateLogStatus();

      openItemDialog(Object.assign(merged, {
        qty: 1,
        source: 'ocr',
        ocrReading: parsed
      }));
      setStatus(el.scanStatus, 'Read: ' + (parsed.name || 'item') +
        (parsed.totalPrice ? ' - ' + money(parsed.totalPrice) : '') +
        ' (confidence ' + Math.round(parsed.confidence * 100) + '%). Check it before adding.', 'warn');
    } catch (err) {
      beep(false);
      setStatus(el.scanStatus, err.message || 'The label could not be read.', 'err');
      scanlog.record({ source: 'ocr', outcome: 'error', message: err.message || String(err) });
      updateLogStatus();
    }
  }

  /* ---------------- manual entry ---------------- */

  el.manualForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = el.manualCode.value.trim();
    if (!code) return;
    handleCode(code, { engine: 'manual', source: 'manual' });
    el.manualCode.value = '';
  });

  el.btnAddFree.addEventListener('click', () => openItemDialog({ pricing: 'unit', qty: 1 }));

  /* ---------------- cart interactions ---------------- */

  el.cartLines.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;

    if (target.dataset.inc || target.dataset.dec) {
      const id = target.dataset.inc || target.dataset.dec;
      cart.changeQty(id, target.dataset.inc ? 1 : -1);
      refreshLine(id);
      renderTotals();
      updateBadge();
    } else if (target.dataset.del) {
      cart.remove(target.dataset.del);
      render();
    }
  });

  el.cartLines.addEventListener('change', (event) => {
    const input = event.target;
    const id = input.dataset.weight || input.dataset.price;
    if (!id) return;

    if (input.dataset.weight) {
      cart.update(id, { weightKg: Number(input.value) });
    } else {
      const raw = input.value.trim();
      cart.update(id, { priceOverride: raw === '' ? null : Number(raw) });
    }

    refreshLine(id);
    renderTotals();
    updateBadge();
  });

  $('#btnClear').addEventListener('click', () => {
    if (!cart.items().length) return;
    if (!window.confirm('Empty the trolley and start a new trip? The scan log is cleared too.')) return;
    // Keep the finished trip before throwing the trolley away. This is the
    // whole difference between an adding machine and a spending record - the
    // app built this report already, it was just never kept.
    try {
      const saved = trips.save(report.build());
      setStatus(el.exportStatus, 'Trip saved to history (' + money(saved.total) + ').', 'ok');
    } catch (err) {
      console.warn('Trip could not be saved to history.', err);
    }
    // A new trip starts a new log, so an export never mixes two trips together.
    cart.clear();
    scanlog.clear();
    recent = [];
    render();
    loadSettingsIntoForm();
    updateLogStatus();
  });

  /* ---------------- exports ---------------- */

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function stamp() { return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'); }

  function keepOcrText() { return !!cart.getState().settings.keepOcrText; }

  function reportOptions() {
    return {
      tillTotal: cart.getState().settings.tillTotal || 0,
      notes: cart.getState().settings.notes || null
    };
  }

  /** The whole trip as one JSON object: cart, totals, verification and scan log. */
  function reportText() { return report.toText(reportOptions()); }

  $('#btnCSV').addEventListener('click', () => download('cart-scan-' + stamp() + '.csv', cart.toCSV(), 'text/csv'));

  $('#btnJSON').addEventListener('click', () => {
    download('cart-scan-' + stamp() + '.json', reportText(), 'application/json');
    setStatus(el.exportStatus, 'Downloaded the trip, its totals and ' +
      scanlog.all().length + ' scan events as one JSON file.', 'ok');
  });

  /**
   * Copying beats downloading on a phone, where a downloaded file is awkward to
   * get back out again. Falls back to a hidden textarea where the clipboard API
   * is unavailable (older iOS, insecure origins).
   */
  $('#btnCopyJSON').addEventListener('click', async () => {
    const text = reportText();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'readonly');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(area);
        if (!ok) throw new Error('The browser refused the copy.');
      }
      setStatus(el.exportStatus, 'Copied ' + Math.round(text.length / 1024) +
        ' KB to the clipboard - paste it wherever you want it analysed.', 'ok');
    } catch (err) {
      setStatus(el.exportStatus, 'Could not copy automatically: ' + err.message +
        ' Use "Download JSON" instead.', 'err');
    }
  });

  function renderBillCheck() {
    const check = report.billCheck(cart.toJSON(), cart.getState().settings.tillTotal);
    if (!check) { el.billStatus.hidden = true; return; }
    setStatus(el.billStatus,
      'Till ' + money(check.tillTotal) + ' vs app ' + money(check.appTotal) + ' - ' +
      (check.matches ? 'they match.' : 'off by ' + money(Math.abs(check.difference)) + '. ' + check.note),
      check.matches ? 'ok' : 'warn');
  }

  $('#setTill').addEventListener('change', (event) => {
    cart.setSettings({ tillTotal: Math.max(0, Number(event.target.value) || 0) });
    renderBillCheck();
  });

  $('#btnPrint').addEventListener('click', () => {
    buildReceipt();
    window.print();
  });

  function buildReceipt() {
    const state = cart.getState();
    const t = cart.totals();
    const rows = cart.items().map(i =>
      '<tr><td>' + escapeHtml(i.name) + '<br><small>' +
        (i.pricing === 'weight'
          ? i.weightKg.toFixed(3) + ' kg @ ' + i.unitPrice.toFixed(2)
          : i.qty + ' @ ' + i.unitPrice.toFixed(2)) +
      '</small></td><td class="num">' + i.lineTotal.toFixed(2) + '</td></tr>').join('');

    let foot = '<tr class="rule"><td>Subtotal</td><td class="num">' + t.subtotal.toFixed(2) + '</td></tr>';
    if (t.discount) foot += '<tr><td>Discount</td><td class="num">-' + t.discount.toFixed(2) + '</td></tr>';
    if (t.tax) foot += '<tr><td>Tax</td><td class="num">' + t.tax.toFixed(2) + '</td></tr>';
    foot += '<tr class="grand"><td>TOTAL ' + escapeHtml(t.currency) + '</td><td class="num">' + t.total.toFixed(2) + '</td></tr>';

    el.receipt.innerHTML =
      '<h1>' + escapeHtml(state.store || 'Cart Scan') + '</h1>' +
      '<div class="sub">' + new Date().toLocaleString() + '<br>' +
      plural(t.itemCount, 'item') + ' &middot; ' + plural(t.lines, 'line') + '</div>' +
      '<table>' + rows + foot + '</table>' +
      '<div class="sub" style="margin-top:10px">Counted before the till, not a tax invoice.</div>';
  }

  /* ---------------- catalog tab ---------------- */

  el.catalogSearch.addEventListener('input', renderCatalog);

  el.catalogForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const product = {
      code: $('#pCode').value.trim(),
      name: $('#pName').value.trim(),
      pricing: $('#pPricing').value,
      unitPrice: Number($('#pPrice').value) || 0,
      unit: $('#pPricing').value === 'weight' ? 'kg' : 'pc',
      category: $('#pCategory').value.trim() || 'Other',
      store: chain()
    };
    const saved = catalog.upsert(product);
    if (!saved) {
      setStatus(el.catalogStatus, 'A code and a name are both needed.', 'err');
      return;
    }
    syncProductToApi(saved);
    el.catalogForm.reset();
    renderCatalog();
    setStatus(el.catalogStatus, 'Saved ' + saved.name + '.', 'ok');
  });

  el.catalogList.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.edit) {
      const product = catalog.find(button.dataset.edit, scope());
      if (!product) return;
      $('#pCode').value = product.code;
      $('#pName').value = product.name;
      $('#pPricing').value = product.pricing;
      $('#pPrice').value = product.unitPrice;
      $('#pCategory').value = product.category;
      $('#pName').focus();
    } else if (button.dataset.remove) {
      if (!window.confirm('Remove this product from the catalog?')) return;
      catalog.remove(button.dataset.remove, chain());
      renderCatalog();
    }
  });

  $('#btnCatalogExport').addEventListener('click', () =>
    download('cart-scan-catalog.json', JSON.stringify(catalog.all(), null, 2), 'application/json'));

  $('#btnCatalogImport').addEventListener('click', () => $('#fileCatalog').click());

  $('#fileCatalog').addEventListener('change', async () => {
    const file = $('#fileCatalog').files && $('#fileCatalog').files[0];
    if (!file) return;
    try {
      const records = JSON.parse(await file.text());
      const summary = catalog.importMany(Array.isArray(records) ? records : records.products);
      renderCatalog();
      setStatus(el.catalogStatus, summary.added + ' added, ' + summary.updated + ' updated.', 'ok');
    } catch (err) {
      setStatus(el.catalogStatus, 'That file is not a catalog export.', 'err');
    } finally {
      $('#fileCatalog').value = '';
    }
  });

  $('#btnCatalogReset').addEventListener('click', () => {
    if (!window.confirm('Reset the catalog to the built-in product list?')) return;
    catalog.reset();
    renderCatalog();
    setStatus(el.catalogStatus, 'Catalog reset.', 'ok');
  });

  /* ---------------- scan log ---------------- */

  function updateLogStatus() {
    if (!el.logStatus) return;
    const summary = scanlog.summary();
    if (!summary.events) {
      setStatus(el.logStatus, 'No scans recorded yet.', '');
      return;
    }
    const parts = Object.keys(summary.byOutcome)
      .map(k => summary.byOutcome[k] + ' ' + k);
    setStatus(el.logStatus,
      summary.events + ' scans recorded: ' + parts.join(', ') + '.' +
      (summary.unresolved.length ? ' ' + summary.unresolved.length + ' need a look.' : ''),
      summary.unresolved.length ? 'warn' : 'ok');
  }

  $('#btnClearLog').addEventListener('click', () => {
    if (!window.confirm('Clear the scan log? The trolley itself is not touched.')) return;
    scanlog.clear();
    updateLogStatus();
  });

  $('#setKeepOcrText').addEventListener('change', e =>
    cart.setSettings({ keepOcrText: e.target.checked }));

  /* ---------------- settings ---------------- */

  function loadSettingsIntoForm() {
    const s = cart.getState().settings;
    $('#setStore').value = cart.getState().store || '';
    $('#setBudget').value = s.budget || '';
    $('#setDiscountPercent').value = s.discountPercent || '';
    $('#setDiscountAmount').value = s.discountAmount || '';
    $('#setTax').value = s.taxPercent || '';
    $('#setMerge').checked = s.mergeDuplicates !== false;
    $('#setKeepOcrText').checked = !!s.keepOcrText;
    $('#setTill').value = s.tillTotal || '';
    $('#setApi').value = api.getBase();

    const select = $('#setRule');
    select.innerHTML = '<option value="">Try every known format (recommended)</option>' +
      barcode.EMBEDDED_RULES.map(r =>
        '<option value="' + r.id + '">' + escapeHtml(r.label) + '</option>').join('');
    select.value = s.preferredRuleId || '';
  }

  function renderStoreScope() {
    if (!el.storeChain) return;
    const name = cart.getState().store;
    const id = chain();
    if (!id) {
      setStatus(el.storeChain,
        'No store set. Prices and learned label formats are shared across every shop until you name one.', 'warn');
      return;
    }
    const mine = catalog.search('', { store: id }).length;
    setStatus(el.storeChain,
      'Prices and label formats are kept under "' + id + '", so ' + name +
      ' cannot be priced from another chain. ' + mine + ' products known here.', 'ok');
  }

  $('#setStore').addEventListener('change', e => {
    cart.setStore(e.target.value);
    // A new store means a different price list and a different label format.
    stores.registerAll(cart.getState().store);
    updateBadge();
    renderStoreScope();
    renderCatalog();
    renderLearnedRules();
  });

  $('#learnedRules').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-forget]');
    if (!button) return;
    if (!window.confirm('Forget this label format? It can be learned again from the next label.')) return;
    stores.forgetRule(button.dataset.forget);
    renderLearnedRules();
  });
  ['setBudget', 'setDiscountPercent', 'setDiscountAmount', 'setTax'].forEach(id => {
    $('#' + id).addEventListener('change', () => {
      cart.setSettings({
        budget: $('#setBudget').value,
        discountPercent: $('#setDiscountPercent').value,
        discountAmount: $('#setDiscountAmount').value,
        taxPercent: $('#setTax').value
      });
      render();
    });
  });
  $('#setMerge').addEventListener('change', e => cart.setSettings({ mergeDuplicates: e.target.checked }));
  $('#setRule').addEventListener('change', e => cart.setSettings({ preferredRuleId: e.target.value }));

  $('#setTest').addEventListener('input', (event) => {
    const value = event.target.value.trim();
    if (!value) { el.setTestOut.hidden = true; return; }

    const parsed = barcode.parse(value, { preferredRuleId: cart.getState().settings.preferredRuleId });
    const known = catalog.find(parsed);
    const lines = [
      'Type: ' + parsed.type + (parsed.valid ? ' (check digit ok)' : ' (check digit does NOT match)'),
      'Item code: ' + parsed.itemCode,
      'Catalog: ' + (known ? known.name + ' at ' + money(known.unitPrice) + (known.pricing === 'weight' ? '/kg' : '') : 'not in the catalog')
    ];
    parsed.candidates.forEach(c => {
      lines.push(c.kind === 'weight'
        ? c.ruleLabel + ' -> ' + c.weightKg.toFixed(3) + ' kg' +
          (known && known.pricing === 'weight' ? ' = ' + money(c.weightKg * known.unitPrice) : '')
        : c.ruleLabel + ' -> ' + money(c.totalPrice));
    });
    setStatus(el.setTestOut, lines.join('\n'), parsed.valid ? 'ok' : 'warn');
    el.setTestOut.style.whiteSpace = 'pre-line';
  });

  /* ---------------- optional API sync ---------------- */

  function syncProductToApi(product) {
    if (!api.isEnabled()) return;
    api.pushProduct(product).catch(() => { /* offline is fine; localStorage already has it */ });
  }

  $('#setApi').addEventListener('change', e => api.setBase(e.target.value));

  $('#btnApiTest').addEventListener('click', async () => {
    api.setBase($('#setApi').value);
    if (!api.isEnabled()) {
      setStatus(el.apiStatus, 'No URL set - the app stays offline, which is fine.', 'warn');
      return;
    }
    setStatus(el.apiStatus, 'Contacting the API...', '');
    try {
      await api.ping();
      const remote = await api.fetchCatalog();
      const summary = catalog.importMany(remote && remote.products ? remote.products : remote);
      renderCatalog();
      setStatus(el.apiStatus, 'Connected. Catalog synced: ' + summary.added + ' added, ' + summary.updated + ' updated.', 'ok');
    } catch (err) {
      setStatus(el.apiStatus, 'Could not reach the API: ' + err.message, 'err');
    }
  });

  $('#btnApiPush').addEventListener('click', async () => {
    api.setBase($('#setApi').value);
    if (!api.isEnabled()) {
      setStatus(el.apiStatus, 'Set an API URL first.', 'warn');
      return;
    }
    try {
      const saved = await api.saveSession(cart.toJSON());
      setStatus(el.apiStatus, 'Trip saved to the API' + (saved && saved.id ? ' as #' + saved.id : '') + '.', 'ok');
    } catch (err) {
      setStatus(el.apiStatus, 'Could not save the trip: ' + err.message, 'err');
    }
  });

  /* ---------------- start ---------------- */

  cart.load();
  // A trip restored from a previous session should not look like a blank slate.
  recent = cart.items().slice(0, 6).map(i => ({
    name: i.name,
    total: i.lineTotal,
    detail: (i.code ? i.code + ' - ' : '') +
      (i.pricing === 'weight' ? i.weightKg.toFixed(3) + ' kg' : 'x' + i.qty) + ' - restored'
  }));
  loadSettingsIntoForm();
  stores.registerAll(cart.getState().store);
  render();
  updateLogStatus();
  renderBillCheck();
  renderStoreScope();
  renderLearnedRules();

  if (!scanner.hasNativeDetector()) {
    setStatus(el.scanStatus,
      'This browser has no built-in barcode reader, so the ZXing decoder is downloaded the first time you start the camera.', '');
  }

  window.addEventListener('beforeunload', () => { scanner.stop(); });

  /*
   * Warm the offline barcode table now, not on the first scan. It is one file
   * fetched once; doing it at the shelf would add a stall to exactly the moment
   * that has to feel instant. A failure here is silent by design - the app
   * still scans, unknown packets just stay unnamed.
   */
  resolve.load().then(() => {
    const info = resolve.info();
    if (info.count) {
      console.info('Barcode table ready: ' + info.count + ' products from ' + info.source);
    }
  });

  // Keep the scan box focused on desktop so a USB/Bluetooth barcode gun,
  // which simply types digits and presses Enter, works with no extra setup.
  if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    el.manualCode.focus();
  }
})();
