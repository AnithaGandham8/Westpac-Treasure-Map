/* =====================================================================
 * engine.js: game logic for Treasure Map (no DOM in this file)
 * Needs data.js loaded first (window.TM). Exposes window.Engine.
 *
 *   Engine.coinMath(shop)    -> { base, multiplier, cardLabel, coins, dollars }
 *   Engine.useOffer(shopId)  -> entry added to the Pot (or null if not allowed)
 *   Engine.isUsed(shopId)
 *   Engine.coins()           -> total coins in the counter
 *   Engine.nearYou(cat) / topHeroes(cat) / newHeroes(cat) / categories()
 *   Engine.reasonFor(shop)   -> short "why this?" line (rule-based for now)
 *   Engine.potBalance() / potHistory() / potBreakdown() / goalStats()
 *   Engine.onChange(fn)      -> fn({ type }) after useOffer / reset
 *   Engine.reset()
 * ===================================================================== */
(function (root) {
  'use strict';
  const TM = root.TM;
  if (!TM) throw new Error('engine.js needs data.js loaded first');

  const COIN_VALUE = 0.01;   // 1 coin = 1 cent
  const START_COINS = 860;   // coins Ana already has when the demo starts
  const r2 = TM.util.round2;

  // Pot entries from before today (besides the monthly auto-transfers in data.js)
  const POT_SEED = [
    { date: '2026-10-04', time: '18:20', type: 'mission', label: 'Mission: 3 local cafés',      amount: 5.0 },
    { date: '2026-10-19', time: '19:05', type: 'coins',   label: 'Coins: Sushi Tide',           amount: 4.5 },
    { date: '2026-10-30', time: '22:10', type: 'skip',    label: 'Skipped spend: Uber ride',    amount: 28.4 },
    { date: '2026-11-08', time: '10:40', type: 'coins',   label: 'Coins: Harbour Fresh Market', amount: 2.1 },
    { date: '2026-11-13', time: '17:30', type: 'mission', label: 'Mission: 2 new Heroes',       amount: 3.0 },
  ];

  const POT_TYPES = {
    coins:   { label: 'Coins',          icon: '🪙' },
    skip:    { label: 'Skipped spend',  icon: '⏭️' },
    mission: { label: 'Mission rewards', icon: '🎯' },
    auto:    { label: 'Auto-transfers', icon: '🔁' },
    earlier: { label: 'Earlier savings', icon: '🫙' },
  };

  const store = { used: {}, session: [], coins: START_COINS };
  const listeners = [];
  const emit = (evt) => listeners.forEach((fn) => fn(evt));

  const state = () => TM.getState();
  const tier = () => state().user.cardTier;
  const shopById = (id) => TM.SHOPS.find((s) => s.id === id);

  /* ---------- distance ---------- */
  const distanceFromUser = (shop) => TM.distanceKm(TM.USER.work, shop);
  function formatDistance(km) {
    return km < 1 ? Math.round((km * 1000) / 10) * 10 + ' m' : km.toFixed(1) + ' km';
  }

  /* ---------- coins ---------- */
  const coinsFor = (shop, t) => TM.coinsFor(shop, t || tier());
  const dollarsFor = (coins) => r2(coins * COIN_VALUE);
  function coinMath(shop) {
    const card = TM.CARD_TIERS[tier()];
    const coins = coinsFor(shop);
    return { base: shop.baseCoins, multiplier: card.multiplier, cardLabel: card.label, coins, dollars: dollarsFor(coins) };
  }

  const isUsed = (id) => !!store.used[id];

  function nowTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function useOffer(id) {
    const shop = shopById(id);
    if (!shop || isUsed(id)) return null;
    const coins = coinsFor(shop);
    if (!coins) return null; // card can't see this offer
    store.used[id] = true;
    store.coins += coins;
    const entry = {
      date: TM.TODAY, time: nowTime(), type: 'coins', label: 'Coins: ' + shop.name,
      amount: dollarsFor(coins), coins, shopId: id, fresh: true,
    };
    store.session.push(entry);
    emit({ type: 'offer-used', entry, shop });
    return entry;
  }

  /* ---------- feed lists ---------- */
  const visible = () => TM.visibleShops(tier());
  const byCat = (list, cat) => (cat && cat !== 'all' ? list.filter((s) => s.category === cat) : list);

  const nearYou = (cat, n) =>
    byCat(visible(), cat).slice().sort((a, b) => distanceFromUser(a) - distanceFromUser(b)).slice(0, n || 8);
  const topHeroes = (cat) => byCat(visible(), cat).filter((s) => s.hero).sort((a, b) => b.baseCoins - a.baseCoins);
  const newHeroes = (cat) => byCat(visible(), cat).filter((s) => s.isNew);
  const categories = () => [...new Set(visible().map((s) => s.category))];

  /* ---------- "why this?" (rule-based now; the AI version replaces this in Phase 3) ---------- */
  function reasonFor(shop) {
    const d = formatDistance(distanceFromUser(shop));
    if (shop.tags.some((t) => TM.GOAL.tags.includes(t))) {
      return `Matches your goal: ${TM.GOAL.name} ${TM.GOAL.emoji}. ${d} from work.`;
    }
    if (['coffee', 'meals', 'groceries'].includes(shop.category)) {
      const weekly = TM.weeklyAverage(shop.category);
      if (weekly > 0) {
        const what = TM.CATEGORIES[shop.category].label.toLowerCase();
        return `You spend about $${Math.round(weekly)} a week on ${what}. This one is ${d} from work.`;
      }
    }
    if (shop.isNew) return `New Hero, ${d} from work.`;
    if (shop.hero) return `Top Hero: one of the best offers near you.`;
    return `${d} from work.`;
  }

  /* ---------- Pot ---------- */
  function autoTransfers() {
    return state().transactions
      .filter((t) => t.recurringId === 'japanAuto')
      .map((t) => ({ date: t.date, time: t.time, type: 'auto', label: 'Monthly auto-transfer', amount: Math.abs(t.amount) }));
  }
  function todaySkips() {
    return state().todayTransactions
      .filter((t) => t.category === 'savings')
      .map((t) => {
        const what = t.merchant.replace(/^Japan jar:\s*/i, '');
        return { date: t.date, time: t.time, type: 'skip', label: what.charAt(0).toUpperCase() + what.slice(1), amount: Math.abs(t.amount) };
      });
  }

  function potHistory() {
    const base = autoTransfers().concat(POT_SEED);
    const opening = r2(TM.GOAL.saved - base.reduce((s, e) => s + e.amount, 0));
    const list = base.concat(todaySkips(), store.session)
      .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
    const firstDay = TM.util.addDays(TM.TODAY, -60);
    list.push({ date: firstDay, type: 'earlier', label: 'Saved before this period', amount: opening });
    return list;
  }

  const potBalance = () => r2(state().goal.saved + store.session.reduce((s, e) => s + e.amount, 0));

  function potBreakdown() {
    const totals = {};
    potHistory().forEach((e) => { totals[e.type] = r2((totals[e.type] || 0) + e.amount); });
    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
    return Object.keys(POT_TYPES)
      .filter((k) => totals[k])
      .map((k) => ({ type: k, label: POT_TYPES[k].label, icon: POT_TYPES[k].icon, amount: totals[k], share: totals[k] / sum }));
  }

  function goalStats() {
    const g = state().goal;
    const balance = potBalance();
    const daysLeft = TM.util.daysBetween(TM.TODAY, g.deadline);
    const weeksLeft = Math.max(1, Math.round(daysLeft / 7));
    const remaining = Math.max(0, g.target - balance);
    return {
      name: g.name, emoji: g.emoji, target: g.target, deadline: g.deadline, balance,
      progress: Math.min(1, balance / g.target), remaining: r2(remaining), weeksLeft,
      perWeek: r2(remaining / weeksLeft),
    };
  }

  /* ---------- misc ---------- */
  function reset() {
    store.used = {};
    store.session = [];
    store.coins = START_COINS;
    emit({ type: 'reset' });
  }
  function onChange(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); }

  root.Engine = {
    COIN_VALUE, POT_TYPES,
    shopById, coinsFor, coinMath, dollarsFor, isUsed, useOffer, coins: () => store.coins,
    distanceFromUser, formatDistance,
    nearYou, topHeroes, newHeroes, categories, reasonFor,
    potBalance, potHistory, potBreakdown, goalStats,
    onChange, reset,
  };
})(typeof window !== 'undefined' ? window : globalThis);
