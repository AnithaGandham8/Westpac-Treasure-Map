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
 *   Engine.cashFlowCheck(amount) -> { mode: full|reduced|none, amount }  (shared with Skip & Save)
 *   Engine.mission() / simulateWeek(kind) / acceptReward() / setAutoSend(on)   (Me vs Me)
 *   Engine.onChange(fn)      -> fn({ type }) after useOffer / mission events / reset
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
  // goal is optional: the goal typed in Discover ({ name, emoji, tags }); default is the saved goal
  function reasonFor(shop, goal) {
    const g = goal || TM.GOAL;
    const d = formatDistance(distanceFromUser(shop));
    if (shop.tags.some((t) => g.tags.includes(t))) {
      return `Matches your goal: ${g.name} ${g.emoji}. ${d} from work.`;
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

  /* =====================================================================
   * CASH-FLOW CHECK (shared by Skip & Save and Me vs Me)
   *   buffer = everyday balance minus bills due before next payday
   *   full    -> buffer >= $300   (move the whole amount)
   *   reduced -> buffer >= $50    (move half)
   *   none    -> below $50        (move nothing, stay quiet)
   * =================================================================== */
  const CASH = { full: 300, min: 50, reducedShare: 0.5 };
  const cashBuffer = () => state().cashflow.safeToSpend;
  function cashFlowCheck(amount, buffer) {
    const b = buffer === undefined ? cashBuffer() : buffer;
    const mode = b >= CASH.full ? 'full' : b >= CASH.min ? 'reduced' : 'none';
    const out = mode === 'full' ? amount : mode === 'reduced' ? r2(amount * CASH.reducedShare) : 0;
    return { mode, buffer: r2(b), amount: out };
  }

  /* =====================================================================
   * ME VS ME (Phase 4): weekly missions against your own baseline
   * =================================================================== */
  const MISSION = {
    categories: ['delivery', 'coffee', 'rideshare', 'meals'], // discretionary only
    startFactor: 0.9,   // first target = baseline x 0.9
    levelUpBeat: 0.2,   // beat the target by more than 20% -> level up
    levelUpFactor: 0.9, // each level up makes the target 10% harder
    easeFactor: 1.1,    // two misses in a row -> target eases ~10%
    floorShare: 0.6,    // healthy floor: never below 60% of the baseline
    maxLevel: 5,
    tiers: [0, 3, 5, 8, 12, 15], // reward cap per level ($)
    bufferShare: 0.03,  // and never more than 3% of the cash-flow buffer
    shiftShare: 0.7,    // if 70%+ of the saving reappears elsewhere -> "shifted"
    tinyAmount: 3, tinyCount: 4, // 4+ purchases under $3 at one merchant in a day -> flagged
  };
  const WEEK_START = TM.util.addDays(TM.TODAY, -((TM.util.dayOfWeek(TM.TODAY) + 6) % 7)); // this Monday

  function weeklySpend(category, weekStartISO, txs) {
    const end = TM.util.addDays(weekStartISO, 7);
    return r2((txs || state().transactions)
      .filter((t) => t.category === category && t.amount < 0 && t.date >= weekStartISO && t.date < end)
      .reduce((s, t) => s - t.amount, 0));
  }
  // Median of the last 4 full weeks (median, so one big week does not skew it)
  function baseline(category) {
    const weeks = [4, 3, 2, 1].map((k) => weeklySpend(category, TM.util.addDays(WEEK_START, -7 * k)));
    const s = weeks.slice().sort((a, b) => a - b);
    return { median: r2((s[1] + s[2]) / 2), weeks };
  }
  function topDiscretionary() {
    return MISSION.categories
      .map((c) => ({ category: c, baseline: baseline(c).median }))
      .sort((a, b) => b.baseline - a.baseline)[0];
  }
  const floorFor = (anchor) => Math.round(anchor * MISSION.floorShare);

  function newMission() {
    const top = topDiscretionary();
    return {
      category: top.category,
      anchor: top.baseline,
      target: Math.round(top.baseline * MISSION.startFactor),
      level: 1,
      fails: 0,
      week: 0,
      history: [],
      autoSend: false,
      pending: null,
      last: null,
    };
  }

  function missionReward(level, buffer) {
    const b = buffer === undefined ? cashBuffer() : buffer;
    const tier = MISSION.tiers[level];
    const cap = r2(Math.max(0, b) * MISSION.bufferShare);
    const base = r2(Math.min(tier, cap));
    const check = cashFlowCheck(base, b);
    return { tier, cap, base, amount: check.amount, mode: check.mode, buffer: check.buffer };
  }

  // Anti-gaming 1: did the saving just move to another category?
  function isShifted(category, baselines, actuals) {
    const drop = baselines[category] - actuals[category];
    if (drop <= 0) return false;
    const rise = MISSION.categories
      .filter((c) => c !== category)
      .reduce((s, c) => s + Math.max(0, actuals[c] - baselines[c]), 0);
    return rise >= drop * MISSION.shiftShare;
  }
  // Anti-gaming 2: lots of tiny purchases at one merchant in one day
  function tinyPurchaseFlag(txs) {
    const groups = {};
    txs.filter((t) => Math.abs(t.amount) < MISSION.tinyAmount).forEach((t) => {
      const k = t.merchant + '|' + t.date;
      groups[k] = (groups[k] || 0) + 1;
    });
    const hit = Object.entries(groups).find(([, n]) => n >= MISSION.tinyCount);
    return hit ? { flagged: true, merchant: hit[0].split('|')[0], count: hit[1] } : { flagged: false };
  }

  // Fake a week for the demo: strong | ok | fail | shifted | cheat
  function simulateWeek(kind) {
    const m = store.mission;
    const cat = m.category;
    const baselines = Object.fromEntries(MISSION.categories.map((c) => [c, baseline(c).median]));
    const actuals = Object.assign({}, baselines);
    actuals[cat] = r2(m.target * { strong: 0.7, ok: 0.95, fail: 1.2, shifted: 0.5, cheat: 0.9 }[kind]);
    if (kind === 'shifted') {
      const other = cat === 'meals' ? 'delivery' : 'meals';
      actuals[other] = r2(baselines[other] + (baselines[cat] - actuals[cat]) * 0.8);
    }
    const weekDay = TM.util.addDays(TM.TODAY, 7 * m.week);
    const tiny = kind === 'cheat'
      ? Array.from({ length: 6 }, () => ({ merchant: 'Daily Grind Cavill Ave', date: weekDay, amount: -1.5 }))
      : [];
    return settleWeek({ actual: actuals[cat], shifted: isShifted(cat, baselines, actuals), flag: tinyPurchaseFlag(tiny) });
  }

  function settleWeek({ actual, shifted, flag }) {
    const m = store.mission;
    const label = TM.CATEGORIES[m.category].label.toLowerCase();
    const before = { target: m.target, level: m.level };
    const floor = floorFor(m.anchor);
    let result, note, rewardLevel = null;

    if (flag.flagged) {
      result = 'flagged';
      note = `${flag.count} tiny purchases at ${flag.merchant} in one day. This week does not count.`;
    } else if (shifted) {
      result = 'shifted';
      note = `Spending on ${label} dropped, but almost the same amount moved to another category. No reward, no penalty.`;
    } else if (actual > m.target) {
      m.fails += 1;
      if (m.fails >= 2) {
        m.target = Math.min(Math.round(m.anchor), Math.round(m.target * MISSION.easeFactor));
        m.fails = 0;
        result = 'eased';
        note = `Two misses in a row, so the AI eases your target to $${m.target}.`;
      } else {
        result = 'fail';
        note = `$${actual.toFixed(2)} spent, over your $${m.target} target. One more miss and the target gets easier.`;
      }
    } else {
      m.fails = 0;
      const beat = (m.target - actual) / m.target;
      if (beat > MISSION.levelUpBeat && m.level < MISSION.maxLevel && m.target > floor) {
        m.level += 1;
        m.target = Math.max(floor, Math.round(m.target * MISSION.levelUpFactor));
        result = 'levelup';
        note = `You beat the target by ${Math.round(beat * 100)}%. Level ${m.level}! New target: $${m.target}.`;
      } else {
        result = 'win';
        note = `Target hit: $${actual.toFixed(2)} of $${before.target}.`;
      }
      rewardLevel = m.level;
    }

    m.history.push({ week: m.week + 1, result, actual, target: before.target, level: before.level });
    m.week += 1;
    m.last = { result, note, before, after: { target: m.target, level: m.level } };
    m.pending = null;

    let reward = null;
    if (rewardLevel !== null) {
      reward = missionReward(rewardLevel);
      reward.label = `Mission: ${TM.CATEGORIES[m.category].label} under $${before.target}`;
      reward.actual = actual;
      reward.target = before.target;
      if (reward.amount <= 0) m.last.extra = 'Cash flow is very tight, so no money moves this week.';
      else if (m.autoSend) { creditMission(reward.amount, reward.label); m.last.extra = `$${reward.amount.toFixed(2)} sent to your Japan Pot.`; }
      else m.pending = reward;
    }
    emit({ type: 'mission-week', mission: m, reward });
    return { result, reward, mission: m };
  }

  function creditMission(amount, label) {
    const entry = { date: TM.TODAY, time: nowTime(), type: 'mission', label, amount: r2(amount), fresh: true };
    store.session.push(entry);
    emit({ type: 'mission-credit', entry });
    return entry;
  }
  function acceptReward() {
    const m = store.mission;
    if (!m.pending) return null;
    const entry = creditMission(m.pending.amount, m.pending.label);
    m.last.extra = `$${entry.amount.toFixed(2)} sent to your Japan Pot.`;
    m.pending = null;
    return entry;
  }
  function declineReward() {
    const m = store.mission;
    if (!m.pending) return;
    m.last.extra = 'No problem. Nothing moved.';
    m.pending = null;
    emit({ type: 'mission-declined' });
  }
  function setAutoSend(on) { store.mission.autoSend = !!on; emit({ type: 'mission-auto' }); }

  // Spend so far in the current mission week (real data for this week, then fresh weeks start at $0)
  const spentThisWeek = () => (store.mission.week === 0 ? weeklySpend(store.mission.category, WEEK_START) : 0);

  store.mission = newMission();

  /* ---------- misc ---------- */
  function reset() {
    store.used = {};
    store.session = [];
    store.coins = START_COINS;
    store.mission = newMission();
    emit({ type: 'reset' });
  }
  function onChange(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); }

  root.Engine = {
    COIN_VALUE, POT_TYPES,
    shopById, coinsFor, coinMath, dollarsFor, isUsed, useOffer, coins: () => store.coins,
    distanceFromUser, formatDistance,
    nearYou, topHeroes, newHeroes, categories, reasonFor,
    potBalance, potHistory, potBreakdown, goalStats,
    // cash-flow check (Skip & Save should call this too)
    CASH, cashBuffer, cashFlowCheck,
    // Me vs Me
    MISSION, mission: () => store.mission, baseline, topDiscretionary, floorFor, missionReward,
    isShifted, tinyPurchaseFlag, simulateWeek, settleWeek, acceptReward, declineReward, setAutoSend, spentThisWeek,
    onChange, reset,
  };
})(typeof window !== 'undefined' ? window : globalThis);
