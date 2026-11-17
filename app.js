/* =====================================================================
 * app.js: UI for Treasure Map (Phase 2)
 * Needs data.js (window.TM) and engine.js (window.Engine) loaded first.
 *
 * Sections:
 *   1. helpers + icons
 *   2. SVG map (offline Gold Coast: coast, Broadwater, river, roads)
 *   3. map view: project, pan, zoom, fly-to, area chips
 *   4. markers (chests / bags / gems with pulse + coin labels)
 *   5. card power-up switcher
 *   6. offer sheet + "use offer" + coin burst + coin counter
 *   7. Discover feed (Near you / Top Heroes / New Heroes + category chips)
 *   8. Pot tab (ring, breakdown, history)
 *   9. tabs, demo controls, init
 *
 * Phase 3 hooks: window.App.highlightShops(ids), App.flyTo(area), App.openOffer(id)
 * ===================================================================== */
(function () {
  'use strict';
  const TM = window.TM;
  const E = window.Engine;

  /* ======================= 1. helpers + icons ======================= */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (n) => '$' + Math.round(n).toLocaleString('en-AU');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateLabel(iso) {
    const diff = TM.util.daysBetween(iso, TM.TODAY);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return +iso.slice(8, 10) + ' ' + MONTHS[+iso.slice(5, 7) - 1];
  }

  const ICONS = {
    chest: '<svg viewBox="0 0 32 32"><path d="M4 15h24v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="#a85a1c"/><path d="M4 15a12 9 0 0 1 24 0z" fill="#e08a2c"/><rect x="8" y="9" width="2.5" height="19" fill="#ffc93c" opacity=".6"/><rect x="21.5" y="9" width="2.5" height="19" fill="#ffc93c" opacity=".6"/><rect x="4" y="14" width="24" height="3" fill="#ffc93c"/><rect x="13.5" y="16" width="5" height="6" rx="1.2" fill="#ffe08a" stroke="#7a3f10" stroke-width=".8"/></svg>',
    bag: '<svg viewBox="0 0 32 32"><path d="M12 11V9a4 4 0 0 1 8 0v2" fill="none" stroke="#ffd6d6" stroke-width="2.2" stroke-linecap="round"/><path d="M6.5 11h19l-1.6 15.4A2 2 0 0 1 21.9 28H10.1a2 2 0 0 1-2-1.6z" fill="#ff6b6b"/><path d="M6.5 11h19l-.3 3H6.8z" fill="#ff9a9a"/><text x="16" y="24.6" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">$</text></svg>',
    gem: '<svg viewBox="0 0 32 32"><path d="M9 5h14l6 8-13 15L3 13z" fill="#5cc8ff"/><path d="M3 13h26L23 5H9z" fill="#a8e6ff"/><path d="M3 13h26M12.5 13 16 5l3.5 8L16 28z" fill="none" stroke="#eafaff" stroke-width="1.1" stroke-linejoin="round"/></svg>',
    coin: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16.5" r="14" fill="#e08a00"/><circle cx="16" cy="15" r="13" fill="#ffc93c"/><circle cx="16" cy="15" r="9.5" fill="none" stroke="#f59e0b" stroke-width="1.6"/><path d="M16 9.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8L16 18l-3.4 1.9.7-3.8-2.8-2.6 3.8-.5z" fill="#fff4cc"/></svg>',
  };
  const SOURCE_ICON = { Extras: 'chest', ShopBack: 'bag', Altitude: 'gem' };
  const srcClass = (s) => 'src-' + s.source.toLowerCase();

  /* ======================= 2. SVG map ======================= */
  // World coords: x grows east, y grows south. 1 unit ≈ 111 m.
  const W0 = { lng: 153.36, lat: -27.9, kx: 883, ky: 1000 };
  const world = (lat, lng) => [(lng - W0.lng) * W0.kx, (W0.lat - lat) * W0.ky];
  const toPath = (pts, close) =>
    pts.map((p, i) => { const [x, y] = world(p[0], p[1]); return (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2); }).join('') + (close ? 'Z' : '');

  const COAST = [
    [-27.9, 153.426], [-27.94, 153.428], [-27.96, 153.43], [-27.98, 153.4325], [-28.0, 153.4337],
    [-28.02, 153.4352], [-28.04, 153.4385], [-28.06, 153.4432], [-28.08, 153.45], [-28.086, 153.4572],
    [-28.093, 153.4568], [-28.11, 153.4645], [-28.125, 153.478], [-28.14, 153.49], [-28.155, 153.505],
    [-28.163, 153.52], [-28.166, 153.535], [-28.162, 153.548], [-28.166, 153.556], [-28.185, 153.564], [-28.24, 153.578],
  ];
  const OCEAN = [[-27.86, 153.64], [-27.86, 153.426]].concat(COAST, [[-28.24, 153.64]]);
  const BROADWATER = [[-27.86, 153.398], [-27.86, 153.4235], [-27.95, 153.4255], [-27.968, 153.4235], [-27.976, 153.421], [-27.966, 153.413], [-27.946, 153.409], [-27.925, 153.404]];
  const NERANG = [[-27.974, 153.4222], [-27.988, 153.4243], [-27.999, 153.4245], [-28.008, 153.4205], [-28.006, 153.41], [-28.0, 153.398], [-27.996, 153.38], [-28.0, 153.35]];
  const M1 = [[-27.86, 153.388], [-27.95, 153.386], [-28.02, 153.382], [-28.06, 153.385], [-28.09, 153.4], [-28.12, 153.435], [-28.15, 153.475], [-28.17, 153.515]];
  const HIGHWAY = COAST.slice(1, 16).map(([la, ln]) => [la, ln - 0.0038]);
  const HILLS = [[-27.99, 153.355, 14, 9], [-28.05, 153.365, 18, 12], [-28.12, 153.39, 20, 13], [-28.17, 153.44, 16, 10], [-27.93, 153.37, 12, 8]];
  const WAVES = [[-27.95, 153.47], [-27.99, 153.5], [-28.02, 153.46], [-28.05, 153.52], [-28.08, 153.48], [-28.1, 153.55], [-28.13, 153.52], [-28.0, 153.57], [-27.92, 153.53], [-28.06, 153.6], [-28.15, 153.6]];
  const PLACES = [
    ['Southport', -27.957, 153.392], ['Nerang', -27.993, 153.356], ['Surfers Paradise', -28.013, 153.417],
    ['Broadbeach', -28.036, 153.421], ['Mermaid Beach', -28.052, 153.425], ['Miami', -28.075, 153.43],
    ['Burleigh Heads', -28.097, 153.438], ['Palm Beach', -28.119, 153.452], ['Currumbin', -28.137, 153.468],
    ['Robina', -28.088, 153.372], ['Coolangatta', -28.176, 153.527],
    ['Coral Sea', -28.04, 153.5, 'sea'], ['Broadwater', -27.925, 153.414, 'sea'],
  ];

  function buildMapSvg() {
    const svg = $('#map-svg');
    const ns = 'vector-effect="non-scaling-stroke"';
    svg.innerHTML = `
      <defs>
        <linearGradient id="g-ocean" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style="stop-color:var(--map-ocean-1)"/><stop offset=".35" style="stop-color:var(--map-ocean-2)"/><stop offset="1" style="stop-color:var(--map-ocean-3)"/>
        </linearGradient>
        <pattern id="p-grid" width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M5 0H0V5" fill="none" style="stroke:var(--map-grid)" stroke-width=".18"/>
        </pattern>
      </defs>
      <rect x="-300" y="-300" width="900" height="900" style="fill:var(--map-land)"/>
      <rect x="-300" y="-300" width="900" height="900" fill="url(#p-grid)" style="opacity:var(--map-grid-opacity)"/>
      ${HILLS.map(([la, ln, rx, ry]) => { const [x, y] = world(la, ln); return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" style="fill:var(--map-hill)" opacity=".8"/>`; }).join('')}
      <path d="${toPath(M1)}" fill="none" style="stroke:var(--map-m1)" stroke-width="5" stroke-linecap="round" ${ns}/>
      <path d="${toPath(M1)}" fill="none" style="stroke:var(--map-m1-dash);stroke-opacity:var(--map-m1-dash-opacity)" stroke-width="1" stroke-dasharray="1.5 1.5" ${ns}/>
      <path d="${toPath(HIGHWAY)}" fill="none" style="stroke:var(--map-hwy)" stroke-width="3" stroke-linecap="round" ${ns}/>
      <path d="${toPath(BROADWATER, true)}" style="fill:var(--map-water)"/>
      <path d="${toPath(NERANG)}" fill="none" style="stroke:var(--map-water)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" ${ns}/>
      <path d="${toPath(OCEAN, true)}" fill="url(#g-ocean)"/>
      <path d="${toPath(COAST)}" fill="none" style="stroke:var(--map-beach)" stroke-width="6" stroke-linejoin="round" ${ns}/>
      <path d="${toPath(COAST)}" fill="none" style="stroke:var(--map-beach-edge)" stroke-width="1.5" stroke-linejoin="round" ${ns}/>
      ${WAVES.map(([la, ln]) => { const [x, y] = world(la, ln); return `<path d="M${x - 3} ${y}q1.5 -1.4 3 0t3 0" fill="none" style="stroke:var(--map-wave);stroke-opacity:var(--map-wave-opacity)" stroke-width="1.6" stroke-linecap="round" ${ns}/>`; }).join('')}`;
  }

  let placeEls = [];
  function buildLabels() {
    const layer = $('#map-labels');
    layer.innerHTML = '';
    placeEls = PLACES.map(([name, lat, lng, kind]) => {
      const el = document.createElement('div');
      el.className = 'place' + (kind === 'sea' ? ' sea' : '');
      el.textContent = name;
      layer.appendChild(el);
      return { el, lat, lng };
    });
    const you = document.createElement('div');
    you.className = 'you';
    you.innerHTML = '<span class="you-ring"></span><span class="you-dot"></span><span class="you-label">You</span>';
    layer.appendChild(you);
    placeEls.push({ el: you, lat: TM.USER.work.lat, lng: TM.USER.work.lng, raw: true });
  }

  /* ======================= 3. map view ======================= */
  const AREAS = [
    { id: 'near', label: '📍 Near me', lat: -28.006, lng: 153.428, span: 0.045 },
    { id: 'southport', label: 'Southport', lat: -27.968, lng: 153.404, span: 0.035 },
    { id: 'broadbeach', label: 'Broadbeach', lat: -28.036, lng: 153.433, span: 0.045 },
    { id: 'burleigh', label: 'Burleigh', lat: -28.096, lng: 153.455, span: 0.05 },
    { id: 'robina', label: 'Robina', lat: -28.078, lng: 153.386, span: 0.035 },
    { id: 'coolangatta', label: 'Coolangatta', lat: -28.166, lng: 153.522, span: 0.06 },
    { id: 'all', label: '🌏 Whole coast', lat: -28.06, lng: 153.455, span: 0.2 },
  ];
  const view = { lat: AREAS[0].lat, lng: AREAS[0].lng, span: AREAS[0].span };
  let mapSize = { w: 1, h: 1 };

  function viewBox() {
    const w = view.span * W0.kx;
    const h = (w * mapSize.h) / mapSize.w;
    const [cx, cy] = world(view.lat, view.lng);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }
  function project(lat, lng, vb) {
    const [x, y] = world(lat, lng);
    return [((x - vb.x) / vb.w) * mapSize.w, ((y - vb.y) / vb.h) * mapSize.h];
  }

  // Push overlapping markers apart (screen space) so dense areas stay tappable
  function relax(pts, active, minD) {
    for (let it = 0; it < 12; it++) {
      for (let i = 0; i < pts.length; i++) {
        if (!active[i]) continue;
        for (let j = i + 1; j < pts.length; j++) {
          if (!active[j]) continue;
          let dx = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1];
          let d = Math.hypot(dx, dy);
          if (d >= minD) continue;
          if (d < 0.01) { dx = 1; dy = 0.6; d = 1.17; }
          const push = (minD - d) / 2, ux = dx / d, uy = dy / d;
          pts[i][0] -= ux * push; pts[i][1] -= uy * push;
          pts[j][0] += ux * push; pts[j][1] += uy * push;
        }
      }
    }
  }

  function renderMap() {
    const el = $('#map');
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    mapSize = { w: r.width, h: r.height };
    const vb = viewBox();
    $('#map-svg').setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);

    placeEls.forEach(({ el: p, lat, lng }) => {
      const [x, y] = project(lat, lng, vb);
      p.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });

    const tier = TM.getState().user.cardTier;
    const pts = TM.SHOPS.map((s) => project(s.lat, s.lng, vb));
    const active = TM.SHOPS.map((s) => E.coinsFor(s, tier) > 0);
    relax(pts, active, 44);
    TM.SHOPS.forEach((s, i) => {
      markers.get(s.id).style.transform = `translate(${pts[i][0].toFixed(1)}px, ${pts[i][1].toFixed(1)}px)`;
    });
  }

  let flyRaf = 0;
  function flyTo(target, ms) {
    cancelAnimationFrame(flyRaf);
    const from = { lat: view.lat, lng: view.lng, span: view.span };
    const t0 = performance.now(), dur = ms || 650;
    const ease = (k) => 1 - Math.pow(1 - k, 3);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = ease(k);
      view.lat = from.lat + (target.lat - from.lat) * e;
      view.lng = from.lng + (target.lng - from.lng) * e;
      view.span = Math.exp(Math.log(from.span) + (Math.log(target.span) - Math.log(from.span)) * e);
      renderMap();
      if (k < 1) flyRaf = requestAnimationFrame(step);
    };
    flyRaf = requestAnimationFrame(step);
  }
  function setActiveArea(id) {
    $$('#map-chips .chip').forEach((c) => c.classList.toggle('is-active', c.dataset.area === id));
  }
  function goArea(id) {
    const a = AREAS.find((x) => x.id === id);
    if (!a) return;
    setActiveArea(id);
    flyTo(a);
  }
  function zoomBy(f, animate) {
    const t = { lat: view.lat, lng: view.lng, span: clamp(view.span * f, 0.015, 0.24) };
    setActiveArea(null);
    if (animate) flyTo(t, 250);
    else { Object.assign(view, t); renderMap(); }
  }

  function buildChips() {
    $('#map-chips').innerHTML = AREAS.map((a) =>
      `<button type="button" class="chip ${a.id === 'near' ? 'is-active' : ''}" data-area="${a.id}">${esc(a.label)}</button>`).join('');
    $('#map-chips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-area]');
      if (b) goArea(b.dataset.area);
    });
    $('#zoom-in').addEventListener('click', () => zoomBy(1 / 1.5, true));
    $('#zoom-out').addEventListener('click', () => zoomBy(1.5, true));
  }

  function bindPan() {
    const el = $('#map');
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.marker, .map-chips, .map-zoom, .map-legend')) return;
      cancelAnimationFrame(flyRaf);
      drag = { x: e.clientX, y: e.clientY, lat: view.lat, lng: view.lng };
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const vb = viewBox();
      view.lng = clamp(drag.lng - ((e.clientX - drag.x) / mapSize.w) * (vb.w / W0.kx), 153.34, 153.6);
      view.lat = clamp(drag.lat + ((e.clientY - drag.y) / mapSize.h) * (vb.h / W0.ky), -28.22, -27.9);
      setActiveArea(null);
      renderMap();
    });
    const end = () => { drag = null; el.classList.remove('is-dragging'); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(e.deltaY > 0 ? 1.15 : 1 / 1.15, false); }, { passive: false });
  }

  /* ======================= 4. markers ======================= */
  const markers = new Map();
  function buildMarkers() {
    const layer = $('#map-markers');
    layer.innerHTML = '';
    TM.SHOPS.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'marker ' + srcClass(s);
      b.dataset.id = s.id;
      b.style.setProperty('--d', (i * 0.17).toFixed(2) + 's');
      b.setAttribute('aria-label', `${s.name}: ${s.offer.text}`);
      b.innerHTML = `<span class="marker-body"><span class="marker-pulse"></span><span class="marker-icon">${ICONS[SOURCE_ICON[s.source]]}</span><span class="marker-coins"></span></span>`;
      b.addEventListener('click', () => openOffer(s.id));
      layer.appendChild(b);
      markers.set(s.id, b);
    });
  }
  function updateMarkers(pop) {
    const tier = TM.getState().user.cardTier;
    TM.SHOPS.forEach((s) => {
      const el = markers.get(s.id);
      const coins = E.coinsFor(s, tier);
      const used = E.isUsed(s.id);
      el.classList.toggle('is-hidden', coins === 0);
      el.classList.toggle('is-used', used);
      el.tabIndex = coins ? 0 : -1;
      const lab = el.querySelector('.marker-coins');
      lab.textContent = used ? '✓' : '+' + coins;
      if (pop && coins) { lab.classList.remove('pop'); void lab.offsetWidth; lab.classList.add('pop'); }
    });
    renderMap();
  }
  function highlightShops(ids) {
    const set = new Set(ids || []);
    markers.forEach((el, id) => el.classList.toggle('is-glow', set.has(id)));
  }

  /* ======================= 5. card power-up ======================= */
  function renderPowerup() {
    const cur = TM.getState().user.cardTier;
    $('#powerup').innerHTML = Object.values(TM.CARD_TIERS).map((t) => `
      <button type="button" role="radio" aria-checked="${t.id === cur}" class="pu pu-${t.id} ${t.id === cur ? 'is-active' : ''}" data-tier="${t.id}">
        <span class="pu-card"></span>
        <span class="pu-text"><b>${esc(t.label.replace(/^(Altitude|Westpac) /, ''))}</b><small>${esc(t.type === 'debit' ? 'ShopBack only' : t.badge)}</small></span>
      </button>`).join('');
  }
  function bindPowerup() {
    $('#powerup').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tier]');
      if (!b || b.dataset.tier === TM.getState().user.cardTier) return;
      TM.setCardTier(b.dataset.tier); // triggers renderAll via TM.onChange
      const t = TM.CARD_TIERS[b.dataset.tier];
      updateMarkers(true);
      toast(t.type === 'debit' ? `💳 ${t.label}: ShopBack chests only` : `⚡ Power-up! ${t.label}: coins ×${t.multiplier}`);
      const map = $('#map');
      map.classList.remove('flash'); void map.offsetWidth; map.classList.add('flash');
    });
  }

  /* ======================= 6. offer sheet + coins ======================= */
  let sheetShop = null;
  function openOffer(id) {
    const s = E.shopById(id);
    if (!s || !E.coinsFor(s)) return;
    sheetShop = id;
    renderSheet();
    $('#sheet').classList.add('is-open');
    $('#sheet-backdrop').classList.add('is-open');
    markers.forEach((el, k) => el.classList.toggle('is-selected', k === id));
  }
  function closeSheet() {
    sheetShop = null;
    $('#sheet').classList.remove('is-open');
    $('#sheet-backdrop').classList.remove('is-open');
    markers.forEach((el) => el.classList.remove('is-selected'));
  }
  function refreshSheet() {
    if (!sheetShop) return;
    if (!E.coinsFor(E.shopById(sheetShop))) return closeSheet();
    renderSheet();
  }
  function renderSheet() {
    const s = E.shopById(sheetShop);
    const m = E.coinMath(s);
    const used = E.isUsed(s.id);
    const cat = TM.CATEGORIES[s.category];
    const src = TM.SOURCES[s.source];
    $('#sheet').innerHTML = `
      <div class="sheet-grip"></div>
      <div class="sheet-head">
        <div class="sheet-icon ${srcClass(s)}">${ICONS[SOURCE_ICON[s.source]]}</div>
        <div class="sheet-title-wrap">
          <h3 id="sheet-title">${esc(s.name)}</h3>
          <div class="muted">${cat.emoji} ${esc(cat.label)} · ${esc(s.suburb)} · ${E.formatDistance(E.distanceFromUser(s))}</div>
        </div>
        <button type="button" class="sheet-close" aria-label="Close">✕</button>
      </div>
      <div class="offer-big ${srcClass(s)}">
        <span class="badge">${esc(src.label)}</span>
        <div class="offer-text">${esc(s.offer.text)}</div>
      </div>
      <div class="coin-math">
        <div><small>Base coins</small><b>${m.base}</b></div>
        <span class="op">×</span>
        <div><small>${esc(m.cardLabel)}</small><b>${m.multiplier}</b></div>
        <span class="op">=</span>
        <div class="coin-total"><small>You get</small><b><i class="ci">${ICONS.coin}</i>${m.coins}</b></div>
      </div>
      <p class="coin-note">≈ ${fmt(m.dollars)} goes to your ${E.activeGoal().emoji} ${esc(E.activeGoal().name)} goal</p>
      <div class="why" id="sheet-why"><span>💡 Why this?</span> <em id="sheet-why-text">${esc(E.reasonFor(s))}</em></div>
      <button type="button" class="btn-use ${used ? 'is-used' : ''}" id="btn-use" ${used ? 'disabled' : ''}>
        ${used ? '✓ Used today: coins are in your Pot' : `Use offer · collect ${m.coins} coins`}
      </button>
      <p class="demo-hint">${used ? 'Come back tomorrow for more treasure.' : 'Demo: simulates paying here with your card.'}</p>`;
    $('.sheet-close', $('#sheet')).addEventListener('click', closeSheet);
    if (!used) $('#btn-use').addEventListener('click', (e) => useOffer(s.id, e.currentTarget));
    // AI line replaces the rule-based one when it arrives; the rule-based text stays if the call fails
    window.AI.why(s).then((r) => {
      const t = $('#sheet-why-text');
      if (sheetShop !== s.id || !t) return;
      t.textContent = r.text;
      if (r.source === 'ai' && !$('#sheet-why .ai-tag')) $('#sheet-why').insertAdjacentHTML('afterbegin', '<span class="ai-tag">AI</span> ');
    });
  }

  function useOffer(id, fromEl) {
    const entry = E.useOffer(id);
    if (!entry) return;
    coinBurst(fromEl || markers.get(id), $('#coin-counter'), () => {
      animateCount(E.coins());
      const c = $('#coin-counter');
      c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
    });
    toast(`+${entry.coins} coins → ${fmt(entry.amount)} added to your Pot`);
    $('#pot-dot').classList.add('is-on');
    updateMarkers();
    renderFeed();
    renderPot();
    renderSheet();
  }

  function coinBurst(fromEl, toEl, done) {
    const phone = $('#app').getBoundingClientRect();
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const sx = a.left + a.width / 2 - phone.left, sy = a.top + a.height / 2 - phone.top;
    const tx = b.left + 18 - phone.left, ty = b.top + b.height / 2 - phone.top;
    const fx = $('#fx');
    for (let i = 0; i < 10; i++) {
      const c = document.createElement('div');
      c.className = 'fx-coin';
      c.innerHTML = ICONS.coin;
      c.style.left = sx + 'px';
      c.style.top = sy + 'px';
      fx.appendChild(c);
      const ang = Math.random() * Math.PI * 2, r = 28 + Math.random() * 46;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        c.style.transform = `translate(${Math.cos(ang) * r}px, ${Math.sin(ang) * r}px) scale(1.1)`;
      }));
      setTimeout(() => {
        c.classList.add('fly');
        c.style.transform = `translate(${tx - sx}px, ${ty - sy}px) scale(.45)`;
        c.style.opacity = '0.3';
      }, 280 + i * 45);
      setTimeout(() => c.remove(), 1400 + i * 45);
    }
    setTimeout(done, 880);
  }

  let shownCoins = 0, countRaf = 0;
  function animateCount(to) {
    cancelAnimationFrame(countRaf);
    const from = shownCoins, t0 = performance.now(), ms = 900;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      shownCoins = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      $('#coin-count').textContent = shownCoins.toLocaleString('en-AU');
      if (k < 1) countRaf = requestAnimationFrame(step);
    };
    countRaf = requestAnimationFrame(step);
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2400);
  }

  /* ======================= 7. Discover feed ======================= */
  let feedCat = 'all';
  function shopCard(s) {
    const coins = E.coinsFor(s);
    const used = E.isUsed(s.id);
    const cat = TM.CATEGORIES[s.category];
    return `
      <button type="button" class="shop-card ${srcClass(s)} ${used ? 'is-used' : ''}" data-shop="${s.id}">
        <div class="shop-art cat-${s.category}">
          <span class="shop-emoji">${cat.emoji}</span>
          <span class="shop-src">${ICONS[SOURCE_ICON[s.source]]}</span>
          ${s.isNew ? '<span class="shop-new">NEW</span>' : ''}
        </div>
        <div class="shop-body">
          <b>${esc(s.name)}</b>
          <small>${esc(s.suburb)} · ${E.formatDistance(E.distanceFromUser(s))}</small>
          <span class="shop-offer">${esc(s.offer.text)}</span>
          <span class="shop-coins">${used ? '✓ Used' : `<i class="ci">${ICONS.coin}</i>+${coins}`}</span>
        </div>
      </button>`;
  }
  function renderFeed() {
    const cats = E.categories();
    if (feedCat !== 'all' && !cats.includes(feedCat)) feedCat = 'all';
    $('#category-chips').innerHTML = [['all', '✨', 'All']]
      .concat(cats.map((c) => [c, TM.CATEGORIES[c].emoji, TM.CATEGORIES[c].label]))
      .map(([id, em, lab]) => `<button type="button" class="chip ${id === feedCat ? 'is-active' : ''}" data-cat="${id}">${em} ${esc(lab)}</button>`)
      .join('');
    const rows = [
      ['📍 Near you', 'Closest to you now', E.nearYou(feedCat)],
      ['🏆 Top Heroes', 'Biggest rewards', E.topHeroes(feedCat)],
      ['🌱 New Heroes', 'Just joined', E.newHeroes(feedCat)],
    ];
    $('#feed').innerHTML = rows.map(([title, sub, list]) => `
      <section class="row">
        <div class="row-head"><h3>${title}</h3><span>${sub}</span></div>
        ${list.length ? `<div class="row-scroll">${list.map(shopCard).join('')}</div>` : '<div class="row-empty">Nothing here for this card yet.</div>'}
      </section>`).join('');
  }
  function bindFeed() {
    $('#category-chips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      feedCat = b.dataset.cat;
      renderFeed();
    });
    $('#feed').addEventListener('click', (e) => {
      const b = e.target.closest('[data-shop]');
      if (b) openOffer(b.dataset.shop);
    });
  }

  /* ======================= 7b. Goal search (AI) ======================= */
  let goalSeq = 0;
  function clearGoal() {
    goalSeq += 1;
    $('#goal-result').innerHTML = '';
    highlightShops([]);
    renderIdeas(true);
  }
  // Example goals under the search box (from data.js). Hidden while results are showing.
  function renderIdeas(show) {
    const box = $('#goal-ideas');
    if (!box) return;
    box.innerHTML = !show ? '' : `
      <div class="ideas">
        <div class="ideas-head">Try a goal</div>
        ${TM.GOAL_IDEAS.map((g) => `
          <div class="idea-group">
            <div class="idea-title">${esc(g.title)}</div>
            <div class="idea-row">${g.ideas.map((t) => `<button type="button" class="chip idea" data-idea="${esc(t)}">${esc(t)}</button>`).join('')}</div>
          </div>`).join('')}
      </div>`;
  }
  async function runGoalSearch(text) {
    if (!text) return clearGoal();
    const seq = ++goalSeq;
    renderIdeas(false);
    $('#goal-result').innerHTML = '<div class="card goal-card"><div class="ai-tag">AI · goal search</div><p class="muted small">Reading your goal…</p></div>';
    const res = await window.AI.goalSearch(text);
    if (seq !== goalSeq) return; // a newer search replaced this one
    highlightShops(res.ranked.map((r) => r.id));
    const tag = res.source === 'ai' ? 'AI · goal search' : 'Smart match · offline fallback';
    $('#goal-result').innerHTML = `
      <div class="card goal-card">
        <div class="ai-tag">${tag}</div>
        <div class="intent-row">
          ${res.intents.map((i) => `<span class="intent">${esc(i)}</span>`).join('')}
          ${res.month ? `<span class="intent when">📅 ${esc(res.month)}</span>` : ''}
        </div>
        ${res.ranked.length ? `<ul class="goal-list">${res.ranked.map((r) => {
          const s = E.shopById(r.id);
          return `<li><button type="button" data-shop="${s.id}"><span class="gl-main"><b>${esc(s.name)}</b><small>${esc(r.why)}</small></span><span class="gl-match">${r.score}%</span></button></li>`;
        }).join('')}</ul>
        <button type="button" class="link-btn" id="goal-on-map">Show on map →</button>` : '<p class="muted small">No offers match this goal with your current card.</p>'}
      </div>`;
    const onMap = $('#goal-on-map');
    if (onMap) onMap.addEventListener('click', () => { showTab('map'); goArea('all'); });
  }
  function bindGoalSearch() {
    const input = $('#goal-search');
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') runGoalSearch(input.value.trim()); });
    input.addEventListener('input', () => { if (!input.value.trim()) clearGoal(); });
    $('#goal-result').addEventListener('click', (e) => {
      const b = e.target.closest('[data-shop]');
      if (b) openOffer(b.dataset.shop);
    });
    $('#goal-ideas').addEventListener('click', (e) => {
      const b = e.target.closest('[data-idea]');
      if (!b) return;
      input.value = b.dataset.idea;
      runGoalSearch(b.dataset.idea);
      $('#screen-discover').scrollTo({ top: 0, behavior: 'smooth' });
    });
    renderIdeas(true);
  }

  /* ======================= 8. Pot (multiple goals) ======================= */
  let lastPot = null;
  const potUI = { adding: false, editing: false, error: '', emoji: '💻' };
  const GOAL_EMOJI_LABELS = { '✈️': 'Travel', '💻': 'Tech', '🚗': 'Car', '🏠': 'Home', '🎁': 'Gift', '🎓': 'Study', '💪': 'Fitness', '🎟️': 'Event', '🛟': 'Safety net' };

  function goalStrip() {
    return `
      <div class="goal-strip" role="list">
        ${E.goals().map((g) => `
          <button type="button" role="listitem" class="goal-chip ${g.active ? 'is-active' : ''}" data-goal="${g.id}" aria-pressed="${g.active}">
            <span class="gc-top"><span class="gc-emoji">${g.emoji}</span>${g.active ? '<span class="gc-badge">Saving</span>' : ''}</span>
            <span class="gc-name">${esc(g.name)}</span>
            <span class="gc-bar"><i style="width:${(g.progress * 100).toFixed(1)}%"></i></span>
            <span class="gc-amt">${fmt0(g.saved)} <small>of ${fmt0(g.target)}</small></span>
          </button>`).join('')}
        <button type="button" class="goal-chip add" id="goal-add" aria-expanded="${potUI.adding}">
          <span class="gc-plus">＋</span><span class="gc-name">New goal</span>
        </button>
      </div>`;
  }

  function addGoalForm() {
    if (!potUI.adding) return '';
    return `
      <form class="card goal-form" id="goal-form" novalidate>
        <b>New goal</b>
        <label class="field"><span>What are you saving for?</span>
          <input name="name" maxlength="30" placeholder="e.g. New laptop" required autocomplete="off"></label>
        <div class="field"><span>Pick an icon</span>
          <div class="emoji-row" role="radiogroup" aria-label="Goal icon">
            ${Object.keys(E.GOAL_EMOJIS).map((e) => `<button type="button" class="emoji-opt ${e === potUI.emoji ? 'is-active' : ''}" data-emoji="${e}" role="radio" aria-checked="${e === potUI.emoji}" title="${GOAL_EMOJI_LABELS[e]}">${e}</button>`).join('')}
          </div>
        </div>
        <div class="field-row">
          <label class="field"><span>Price ($)</span>
            <input name="target" type="number" inputmode="decimal" min="1" max="${E.MAX_GOAL_PRICE}" step="1" placeholder="1800" required></label>
          <label class="field"><span>By when? <small>(optional)</small></span>
            <input name="deadline" type="date" min="${TM.util.addDays(TM.TODAY, 1)}"></label>
        </div>
        ${potUI.error ? `<p class="form-error" role="alert">${esc(potUI.error)}</p>` : ''}
        <div class="form-btns">
          <button type="submit" class="btn-yes">Create goal</button>
          <button type="button" class="btn-no" data-action="cancel-add">Cancel</button>
        </div>
      </form>`;
  }

  function priceEditor(g) {
    if (!potUI.editing) {
      return `<div class="goal-actions">
        <button type="button" class="link-btn" data-action="edit-price">✏️ Set price</button>
        ${g.custom && g.balance === 0 ? '<button type="button" class="link-btn danger" data-action="remove-goal">Remove goal</button>' : ''}
      </div>`;
    }
    return `
      <form class="price-form" id="price-form" novalidate>
        <label class="field"><span>New price for ${esc(g.name)} ($)</span>
          <input name="target" type="number" inputmode="decimal" min="1" max="${E.MAX_GOAL_PRICE}" step="1" value="${Math.round(g.target)}" required></label>
        ${potUI.error ? `<p class="form-error" role="alert">${esc(potUI.error)}</p>` : ''}
        <div class="form-btns">
          <button type="submit" class="btn-yes">Save price</button>
          <button type="button" class="btn-no" data-action="cancel-price">Cancel</button>
        </div>
      </form>`;
  }

  function renderPot(clearFresh) {
    const g = E.goalStats();
    const R = 72, C = 2 * Math.PI * R;
    const hist = E.potHistory();
    const recent = E.potBreakdown().filter((b) => b.type !== 'earlier');
    const recentSum = recent.reduce((s, b) => s + b.amount, 0);
    const earlier = E.potBreakdown().find((b) => b.type === 'earlier');
    const prev = lastPot && lastPot.id === g.id ? lastPot : g; // only animate within the same goal

    $('#pot').innerHTML = `
      ${goalStrip()}
      ${addGoalForm()}
      <p class="goal-note">🎯 New rewards go to <b>${g.emoji} ${esc(g.name)}</b>. Tap a goal to switch.</p>

      <div class="pot-hero">
        <div class="ring">
          <svg viewBox="0 0 180 180">
            <defs><linearGradient id="g-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs>
            <circle cx="90" cy="90" r="${R}" class="ring-bg"/>
            <circle cx="90" cy="90" r="${R}" class="ring-fg" id="ring-fg" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - prev.progress)).toFixed(2)}"/>
          </svg>
          <div class="ring-center">
            <div class="ring-emoji">${g.emoji}</div>
            <div class="ring-amt" id="pot-amt">${fmt(prev.balance)}</div>
            <div class="ring-sub">of ${fmt0(g.target)}</div>
          </div>
        </div>
        <h2>${esc(g.name)}</h2>
        ${priceEditor(g)}
        <div class="pot-stats">
          <div><b>${Math.round(g.progress * 100)}%</b><small>done</small></div>
          <div><b>${g.weeksLeft}</b><small>weeks left</small></div>
          <div><b>${fmt0(g.perWeek)}</b><small>needed / week</small></div>
        </div>
      </div>

      ${recent.length ? `
      <h3 class="pot-h">Where it came from <span>last 60 days</span></h3>
      <div class="stack">${recent.map((b) => `<span class="stack-seg t-${b.type}" style="width:${((b.amount / recentSum) * 100).toFixed(2)}%" title="${esc(b.label)}"></span>`).join('')}</div>` : ''}
      <div class="stack-legend">
        ${recent.map((b) => `<span><i class="dot t-${b.type}"></i>${b.icon} ${esc(b.label)}<b>${fmt(b.amount)}</b></span>`).join('')}
        ${earlier ? `<span class="muted"><i class="dot t-earlier"></i>${earlier.icon} ${esc(earlier.label)}<b>${fmt(earlier.amount)}</b></span>` : ''}
      </div>

      <h3 class="pot-h">History</h3>
      ${hist.length ? `<ul class="history">
        ${hist.map((h) => `
          <li class="${h.fresh ? 'is-fresh' : ''}">
            <span class="h-ico t-${h.type}">${E.POT_TYPES[h.type].icon}</span>
            <span class="h-main"><b>${esc(h.label)}</b><small>${dateLabel(h.date)}${h.time ? ' · ' + h.time : ''}${h.coins ? ' · ' + h.coins + ' coins' : ''}</small></span>
            <span class="h-amt">+${fmt(h.amount)}</span>
          </li>`).join('')}
      </ul>` : '<p class="muted small">Nothing saved here yet. Use an offer on the Map or hit a Mission, and the coins land in this goal.</p>'}`;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const fg = $('#ring-fg');
      if (fg) fg.setAttribute('stroke-dashoffset', (C * (1 - g.progress)).toFixed(2));
    }));
    countMoney($('#pot-amt'), prev.balance, g.balance);
    const strip = $('.goal-strip'), chip = $('.goal-chip.is-active');
    if (strip && chip && (chip.offsetLeft < strip.scrollLeft || chip.offsetLeft + chip.offsetWidth > strip.scrollLeft + strip.clientWidth)) {
      strip.scrollTo({ left: chip.offsetLeft - 16, behavior: 'smooth' }); // keep the active goal in view
    }
    lastPot = g;
    if (clearFresh) setTimeout(() => hist.forEach((h) => { h.fresh = false; }), 2500);
  }

  // One set of listeners on #pot (its content is re-drawn, the container is not)
  function bindPot() {
    const pot = $('#pot');
    const done = (msg) => { potUI.adding = false; potUI.editing = false; potUI.error = ''; renderPot(); renderFeed(); refreshSheet(); if (msg) toast(msg); };
    pot.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-goal]');
      if (chip) {
        if (E.setActiveGoal(chip.dataset.goal)) { const g = E.activeGoal(); potUI.editing = false; done(`🎯 Now saving for ${g.emoji} ${g.name}`); }
        return;
      }
      if (e.target.closest('#goal-add')) { potUI.adding = !potUI.adding; potUI.editing = false; potUI.error = ''; renderPot(); if (potUI.adding) { const i = $('#goal-form input[name="name"]'); if (i) i.focus(); } return; }
      const em = e.target.closest('[data-emoji]');
      if (em) {
        potUI.emoji = em.dataset.emoji;
        $$('#goal-form .emoji-opt').forEach((b) => { const on = b.dataset.emoji === potUI.emoji; b.classList.toggle('is-active', on); b.setAttribute('aria-checked', on); });
        return;
      }
      const act = e.target.closest('[data-action]');
      if (!act) return;
      const a = act.dataset.action;
      if (a === 'cancel-add' || a === 'cancel-price') { potUI.adding = false; potUI.editing = false; potUI.error = ''; renderPot(); }
      if (a === 'edit-price') { potUI.editing = true; potUI.adding = false; potUI.error = ''; renderPot(); const i = $('#price-form input'); if (i) { i.focus(); i.select(); } }
      if (a === 'remove-goal') {
        const g = E.activeGoal(), r = E.removeGoal(g.id);
        if (r.ok) done(`Removed ${g.emoji} ${g.name}`); else toast(r.error);
      }
    });
    pot.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.id === 'goal-form') {
        const r = E.addGoal({ name: f.name.value, emoji: potUI.emoji, target: f.target.value, deadline: f.deadline.value });
        if (!r.ok) { potUI.error = r.error; const keep = { name: f.name.value, target: f.target.value, deadline: f.deadline.value }; renderPot(); const nf = $('#goal-form'); nf.name.value = keep.name; nf.target.value = keep.target; nf.deadline.value = keep.deadline; return; }
        done(`New goal: ${r.goal.emoji} ${r.goal.name} (${fmt0(r.goal.target)})`);
      }
      if (f.id === 'price-form') {
        const g = E.activeGoal(), r = E.setGoalTarget(g.id, f.target.value);
        if (!r.ok) { potUI.error = r.error; renderPot(); return; }
        done(`Price set: ${g.emoji} ${g.name} is now ${fmt0(r.goal.target)}`);
      }
    });
  }
  function countMoney(el, from, to) {
    if (!el || from === to) return;
    const t0 = performance.now(), ms = 1000;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1 && document.body.contains(el)) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ======================= 9. tabs, demo, init ======================= */
  function showTab(id) {
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === id));
    $$('.screen').forEach((s) => s.classList.toggle('is-active', s.dataset.screen === id));
    closeSheet();
    if (id === 'map') renderMap();
    if (id === 'pot') { $('#pot-dot').classList.remove('is-on'); renderPot(true); }
  }

  function renderScenarioNote() {
    const sc = TM.getState().scenario;
    $('#scenario-note').innerHTML = `<b>${esc(sc.label)}:</b> ${esc(sc.description)}`;
  }

  function renderAll() {
    renderPowerup();
    updateMarkers();
    renderFeed();
    renderPot();
    refreshSheet();
    renderScenarioNote();
  }

  function init() {
    $$('[data-icon]').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon] || ''; });
    buildMapSvg();
    buildLabels();
    buildMarkers();
    buildChips();
    bindPan();
    bindPowerup();
    bindFeed();
    bindGoalSearch();
    bindPot();

    $$('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
    $('#coin-counter').addEventListener('click', () => showTab('pot'));
    $('#sheet-backdrop').addEventListener('click', closeSheet);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

    TM.mountScenarioSwitcher($('#scenario-switcher'));
    TM.onChange(renderAll);
    $('#reset-demo').addEventListener('click', () => {
      E.reset();
      closeSheet();
      lastPot = null;
      potUI.adding = false; potUI.editing = false; potUI.error = '';
      renderAll();
      animateCount(E.coins());
      $('#pot-dot').classList.remove('is-on');
      toast('Demo reset ↺');
    });

    renderAll();
    animateCount(E.coins());
    if (window.ResizeObserver) new ResizeObserver(renderMap).observe($('#map'));
    window.addEventListener('resize', renderMap);
  }

  // Hooks for other tabs (goal search, AI picks, Missions)
  // Coins fly from an element to the Pot tab, then the Pot refreshes (used by Me vs Me)
  function sendToPot(fromEl) {
    coinBurst(fromEl, $('[data-tab="pot"]'), () => {
      const tab = $('[data-tab="pot"]');
      tab.classList.remove('bump'); void tab.offsetWidth; tab.classList.add('bump');
    });
    $('#pot-dot').classList.add('is-on');
    renderPot();
  }

  window.App = { openOffer, closeSheet, flyTo, goArea, highlightShops, showTab, toast, renderAll, sendToPot, fmt };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
