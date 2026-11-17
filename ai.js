/* =====================================================================
 * ai.js: client for the 3 AI endpoints (window.AI). Load after engine.js.
 *
 * Rule: every number is computed here in JS (match %, ordering, spend figures).
 * The model only returns intents and prose. If a call is slow, rate-limited or
 * fails, each function still returns something usable (source: 'local'), so
 * the demo never breaks. ?ai=off in the URL forces local mode (handy offline).
 *
 *   AI.goalSearch(text) -> { intents, month, ranked:[{id,score,why,ai}], source }
 *   AI.why(shop)        -> { text, source }
 *   AI.insight(payload) -> { headline, detail, nextTarget, source }
 * ===================================================================== */
(function (root) {
  'use strict';
  const TM = root.TM, E = root.Engine;
  const OFF = /[?&]ai=off\b/.test(root.location ? root.location.search : '');
  const TIMEOUT_MS = 6000;
  // On Cloudflare the functions share the site's origin. On GitHub Pages (static) they live on the Cloudflare copy.
  const CLOUDFLARE_URL = 'https://westpac-treasure-map.pages.dev';
  const API_BASE = root.location && /\.github\.io$/.test(root.location.hostname) ? CLOUDFLARE_URL : '';

  async function post(path, body) {
    if (OFF) throw new Error('ai off');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_BASE + '/api/' + path, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.reason || 'http ' + res.status); // 429 / 503 land here
      return data;
    } finally { clearTimeout(timer); }
  }

  /* ---------- 1. goal search ---------- */
  // Local intent map: used as the fallback and to compute scores either way
  const SYNONYMS = {
    // travel
    japan: ['travel', 'flights', 'currency', 'luggage', 'holiday', 'overseas'],
    tokyo: ['travel', 'flights', 'currency', 'overseas'],
    trip: ['travel', 'flights', 'holiday', 'luggage'], holiday: ['travel', 'flights', 'luggage', 'tours'],
    overseas: ['travel', 'flights', 'currency', 'luggage'],
    travel: ['flights', 'holiday', 'luggage', 'currency'], flight: ['flights', 'airline', 'airport'], flights: ['airline', 'airport', 'travel'],
    suitcase: ['luggage', 'suitcase', 'travel', 'backpack'], luggage: ['suitcase', 'travel'],
    yen: ['currency', 'money exchange', 'overseas'], exchange: ['currency', 'money exchange'], currency: ['money exchange', 'overseas'],
    road: ['fuel', 'petrol', 'road trip', 'car'],
    // food + coffee
    coffee: ['cafe', 'latte', 'breakfast'], cafe: ['coffee', 'breakfast'],
    brunch: ['cafe', 'coffee', 'bakery', 'breakfast', 'pastry'], pastries: ['bakery', 'pastry', 'breakfast'], pastry: ['bakery', 'breakfast'],
    food: ['meals', 'lunch', 'dinner'], lunch: ['meals', 'salad'], dinner: ['meals'],
    ramen: ['japanese', 'noodles'], sushi: ['japanese'], japanese: ['sushi', 'ramen', 'bento'],
    market: ['street food', 'market'], markets: ['street food', 'market'],
    gelato: ['ice cream', 'dessert', 'treats'], dessert: ['gelato', 'ice cream', 'treats'],
    // everyday shopping
    grocery: ['groceries', 'supermarket', 'fresh', 'weekly shop'], groceries: ['supermarket', 'fresh', 'weekly shop'],
    fruit: ['fresh', 'vegetables', 'groceries'], vegetables: ['fresh', 'fruit', 'groceries'],
    shoes: ['running', 'clothes'], running: ['shoes', 'fitness', 'health'],
    wardrobe: ['clothes', 'shoes', 'surfwear', 'fashion'], clothes: ['fashion', 'shoes', 'surfwear'], fashion: ['clothes', 'shoes'],
    gift: ['gifts', 'department store'], gifts: ['department store'], electronics: ['department store', 'gifts'], home: ['department store'],
    // health + activities
    healthy: ['fitness', 'gym', 'salad', 'organic'], gym: ['fitness', 'workout'], fit: ['fitness', 'gym', 'running', 'health'],
    surf: ['surf', 'lessons', 'experience', 'beach'], beach: ['surf', 'experience'],
    commute: ['transport', 'scooter', 'commute', 'green'], car: ['fuel', 'petrol'],
  };
  // Filler words that are never a shopping intent ("I *want* to go...", "*cheap* flights")
  const STOP = new Set(['want', 'wanna', 'would', 'like', 'love', 'need', 'going', 'next', 'this', 'that', 'with', 'from',
    'have', 'some', 'save', 'saving', 'money', 'just', 'really', 'please', 'help', 'find', 'when', 'what', 'where', 'year',
    'month', 'week', 'better', 'best', 'good', 'near', 'cheap', 'cheaper', 'book', 'before', 'after', 'update', 'join',
    'learn', 'myself', 'treat', 'less', 'more', 'buy', 'summer', 'winter', 'every', 'around', 'coast', 'night', 'work', 'weekly', 'shop', 'new', 'try']);
  const NEGATE = new Set(['without', 'no', 'avoid', 'skip', 'stop']); // "without the car" -> ignore "car"
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  function localIntents(text) {
    const words = text.toLowerCase().match(/[a-z]+/g) || [];
    const set = new Set();
    let skipNext = 0;
    words.forEach((w) => {
      if (NEGATE.has(w)) { skipNext = 2; return; }         // skip the next word or two ("without the car")
      if (skipNext > 0) { skipNext -= 1; if (w !== 'the' && w !== 'a' && w !== 'my') skipNext = 0; return; }
      if (w === 'trip' && words.includes('road')) { set.add('road trip'); return; } // a road trip is about fuel, not flights
      if (SYNONYMS[w]) { set.add(w); SYNONYMS[w].forEach((s) => set.add(s)); }
      else if (w.length > 3 && !STOP.has(w) && !MONTHS.includes(w)) set.add(w.replace(/ies$/, 'y').replace(/s$/, ''));
    });
    const m = MONTHS.find((x) => words.includes(x) || words.includes(x.slice(0, 3)));
    return { intents: [...set], month: m ? m[0].toUpperCase() + m.slice(1) : null };
  }

  const visible = () => TM.visibleShops(TM.getState().user.cardTier);
  const slim = (s) => ({ id: s.id, name: s.name, category: s.category, suburb: s.suburb, tags: s.tags });

  // Match % is JS: shared terms between the intents and the shop's tags/category
  function score(shop, intents, modelHit) {
    const terms = new Set(shop.tags.concat([shop.category]).map((t) => t.toLowerCase()));
    let hits = 0;
    intents.forEach((i) => { if (terms.has(i) || [...terms].some((t) => t.includes(i) && i.length > 3)) hits += 1; });
    if (!hits && !modelHit) return 0;
    return Math.min(98, 28 + hits * 20 + (modelHit ? 14 : 0) + (shop.hero ? 4 : 0));
  }

  async function goalSearch(text) {
    const local = localIntents(text);
    let intents = local.intents, month = local.month, hits = {}, source = 'local';
    try {
      const out = await post('goal-search', { goal: text, merchants: visible().map(slim) });
      intents = [...new Set(out.intents.map((s) => s.toLowerCase()).concat(local.intents))];
      month = out.month || month;
      out.matches.forEach((m) => { hits[m.id] = m.why; });
      source = 'ai';
    } catch (e) { /* rate limit, timeout or offline: keep the local result */ }

    const ranked = visible()
      .map((s) => ({ id: s.id, score: score(s, intents, !!hits[s.id]), why: hits[s.id] || null, ai: !!hits[s.id] }))
      // With live AI, show only the shops the model picked (a keyword-only match like "trip" -> "road trip" is too weak).
      // Offline, keyword matches are all we have, so keep them.
      .filter((r) => r.score > 0 && (source !== 'ai' || !Object.keys(hits).length || r.ai))
      .sort((a, b) => b.score - a.score || E.distanceFromUser(E.shopById(a.id)) - E.distanceFromUser(E.shopById(b.id)))
      .slice(0, 6);
    ranked.forEach((r) => { if (!r.why) r.why = E.reasonFor(E.shopById(r.id)); });
    return { intents: intents.slice(0, 6), month, ranked, source };
  }

  /* ---------- 2. why this? ---------- */
  const whyCache = new Map();
  async function why(shop) {
    const tier = TM.getState().user.cardTier;
    const goal = E.activeGoal();
    const key = shop.id + '|' + tier + '|' + goal.id;
    if (whyCache.has(key)) return whyCache.get(key);
    const spendSummary = {
      weeklyAverageInCategory: Math.round(TM.weeklyAverage(shop.category)) || null, // null, not 0, so the AI never says "you spend $0 a week"
      matchesGoal: shop.tags.some((t) => goal.tags.includes(t)) ? goal.name : null,
      isNewHero: shop.isNew, isTopHero: shop.hero,
    };
    const merchant = { name: shop.name, category: shop.category, offer: shop.offer.text, distance: E.formatDistance(E.distanceFromUser(shop)) };
    let res;
    try {
      const out = await post('why', { merchant, spendSummary });
      res = { text: out.why, source: 'ai' };
      whyCache.set(key, res);
    } catch (e) { res = { text: E.reasonFor(shop), source: 'local' }; }
    return res;
  }

  /* ---------- 3. Me vs Me insight ---------- */
  const insightCache = new Map();
  async function insight(payload) {
    const key = JSON.stringify(payload);
    if (insightCache.has(key)) return insightCache.get(key);
    let res;
    try {
      const out = await post('challenge-insight', payload);
      res = { headline: out.headline, detail: out.detail, nextTarget: out.nextTarget, source: 'ai' };
      insightCache.set(key, res);
    } catch (e) { res = null; insightCache.set(key, null); } // remember the failure so redraws don't call again; missions.js already shows the numbers
    return res;
  }

  root.AI = { goalSearch, why, insight, enabled: !OFF };
})(window);
