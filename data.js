/* =====================================================================
 * data.js: Westpac Treasure Map mock data (single source of truth)
 * ---------------------------------------------------------------------
 * Browser:  <script src="data.js"></script>   ->  window.TM
 * Node:     const TM = require('./data.js')
 *
 * Everything here is FAKE demo data. Shops are invented names placed in
 * real Gold Coast suburbs. Dates are anchored to TODAY so the demo looks
 * the same every time you record it.
 *
 * Quick API
 *   TM.getState()                -> everything the UI needs for the current scenario
 *   TM.setScenario('normal' | 'skippedCoffee' | 'rentDueTomorrow')
 *   TM.onChange(fn)              -> fn(state) runs on every scenario change
 *   TM.mountScenarioSwitcher(el) -> drops 3 pill buttons into el
 *   TM.visibleShops(tierId)      -> shops this card can see on the map
 *   TM.coinsFor(shop, tierId)    -> coin value of a shop for this card
 *   TM.spendByCategory(days)     -> { coffee: 81.2, delivery: 140, ... }
 *   TM.weeklyAverage(category)   -> average $ per week (last 28 days)
 *   TM.distanceKm(a, b)          -> haversine distance between {lat,lng}
 *   You can also open the page with ?scenario=rentDueTomorrow (handy for recording)
 * ===================================================================== */
(function (root) {
  'use strict';

  const TODAY = '2026-11-17'; // Tuesday, hackathon day
  const HISTORY_DAYS = 60;

  /* ---------- date + random helpers ---------- */
  const DAY = 86400000;
  const toTime = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const toISO = (t) => new Date(t).toISOString().slice(0, 10);
  const addDays = (iso, n) => toISO(toTime(iso) + n * DAY);
  const daysBetween = (a, b) => Math.round((toTime(b) - toTime(a)) / DAY);
  const dayOfWeek = (iso) => new Date(toTime(iso)).getUTCDay(); // 0 = Sun
  const round2 = (n) => Math.round(n * 100) / 100;

  // Seeded RNG so the numbers never change between runs
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(42);
  const between = (min, max) => round2(min + rand() * (max - min));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  /* =====================================================================
   * 1. CATEGORIES + REWARD SOURCES
   * =================================================================== */
  const CATEGORIES = {
    // Map / Discover categories (shops)
    coffee:      { label: 'Coffee',          emoji: '☕' },
    meals:       { label: 'Meals',           emoji: '🍜' },
    groceries:   { label: 'Groceries',       emoji: '🛒' },
    baked:       { label: 'Baked goods',     emoji: '🥐' },
    treats:      { label: 'Treats',          emoji: '🍦' },
    travel:      { label: 'Travel',          emoji: '✈️' },
    fuel:        { label: 'Fuel',            emoji: '⛽' },
    fashion:     { label: 'Fashion',         emoji: '👟' },
    department:  { label: 'Department store', emoji: '🏬' },
    fitness:     { label: 'Fitness',         emoji: '💪' },
    transport:   { label: 'Transport',       emoji: '🛴' },
    experiences: { label: 'Experiences',     emoji: '🏄' },
    // Transaction-only categories
    delivery:    { label: 'Food delivery',   emoji: '🛵' },
    rideshare:   { label: 'Rideshare',       emoji: '🚗' },
    rent:        { label: 'Rent',            emoji: '🏠' },
    bills:       { label: 'Bills',           emoji: '🧾' },
    income:      { label: 'Income',          emoji: '💰' },
    savings:     { label: 'Savings',         emoji: '🫙' },
  };

  const SOURCES = {
    Extras:   { label: 'Westpac Extras',  icon: 'chest', unit: 'cashback', creditOnly: true },
    ShopBack: { label: 'ShopBack',        icon: 'bag',   unit: 'cashback', creditOnly: false },
    Altitude: { label: 'Altitude Points', icon: 'gem',   unit: 'points',   creditOnly: true },
  };

  /* =====================================================================
   * 2. CARD TIERS (the "power-up")
   * =================================================================== */
  const CARD_TIERS = {
    black: {
      id: 'black', label: 'Altitude Black', type: 'credit', multiplier: 3,
      sources: ['Extras', 'ShopBack', 'Altitude'], badge: 'x3 coins',
    },
    platinum: {
      id: 'platinum', label: 'Altitude Platinum', type: 'credit', multiplier: 2,
      sources: ['Extras', 'ShopBack', 'Altitude'], badge: 'x2 coins',
    },
    debit: {
      id: 'debit', label: 'Westpac Debit', type: 'debit', multiplier: 1,
      sources: ['ShopBack'], badge: 'ShopBack chests only',
    },
  };

  /* =====================================================================
   * 3. SHOPS (25, Gold Coast)
   *    offer.type 'cashback' -> value is %;  'points' -> value is pts per $1
   *    hero  = shows in "Top Heroes";  isNew = shows in "New Heroes"
   *    tags  = words the goal search matches against
   * =================================================================== */
  function shop(id, name, category, suburb, lat, lng, source, offerType, value, hero, isNew, tags) {
    const text = offerType === 'cashback' ? `${value}% cashback` : `${value} pts per $1`;
    const baseCoins = offerType === 'cashback' ? value * 10 : value * 15;
    return {
      id, name, category, suburb, lat, lng, source,
      offer: { type: offerType, value, text },
      baseCoins, hero, isNew, tags,
    };
  }

  const SHOPS = [
    shop('s01', 'Bean Republic',          'coffee',      'Surfers Paradise', -27.9980, 153.4296, 'Extras',   'cashback', 10, true,  false, ['coffee', 'cafe', 'breakfast', 'latte']),
    shop('s02', 'Saltwater Espresso',     'coffee',      'Broadbeach',       -28.0283, 153.4325, 'ShopBack', 'cashback', 8,  false, true,  ['coffee', 'cafe', 'beach']),
    shop('s03', 'Little Wave Bakery',     'baked',       'Burleigh Heads',   -28.0885, 153.4520, 'ShopBack', 'cashback', 6,  true,  false, ['bakery', 'bread', 'pastry', 'breakfast']),
    shop('s04', 'Crumb & Co',             'baked',       'Southport',        -27.9690, 153.4010, 'Extras',   'cashback', 12, false, true,  ['bakery', 'cakes', 'pastry']),
    shop('s05', 'Harbour Fresh Market',   'groceries',   'Southport',        -27.9650, 153.4060, 'Extras',   'cashback', 5,  true,  false, ['groceries', 'fresh', 'fruit', 'vegetables']),
    shop('s06', 'Green Basket Grocer',    'groceries',   'Robina',           -28.0775, 153.3840, 'ShopBack', 'cashback', 4,  false, false, ['groceries', 'organic', 'healthy']),
    shop('s07', 'Tide Supermarket',       'groceries',   'Mermaid Beach',    -28.0460, 153.4360, 'Altitude', 'points',   3,  true,  false, ['groceries', 'supermarket', 'weekly shop']),
    shop('s08', 'Pho Corner',             'meals',       'Southport',        -27.9680, 153.3990, 'ShopBack', 'cashback', 10, false, true,  ['vietnamese', 'noodles', 'dinner', 'lunch']),
    shop('s09', 'Sushi Tide',             'meals',       'Broadbeach',       -28.0300, 153.4300, 'Extras',   'cashback', 15, true,  false, ['sushi', 'japanese', 'dinner']),
    shop('s10', 'Burleigh Taco Shack',    'meals',       'Burleigh Heads',   -28.0870, 153.4505, 'ShopBack', 'cashback', 7,  false, true,  ['mexican', 'tacos', 'beach', 'dinner']),
    shop('s11', 'Lunch Box Kitchen',      'meals',       'Surfers Paradise', -28.0035, 153.4300, 'Extras',   'cashback', 10, false, false, ['lunch', 'healthy', 'salad', 'work']),
    shop('s12', 'Coastline Fuel',         'fuel',        'Southport',        -27.9720, 153.4080, 'Extras',   'cashback', 3,  false, false, ['fuel', 'petrol', 'car', 'road trip']),
    shop('s13', 'Horizon Travel Centre',  'travel',      'Surfers Paradise', -28.0010, 153.4285, 'Altitude', 'points',   6,  true,  false, ['travel', 'holiday', 'flights', 'japan', 'tours', 'trip']),
    shop('s14', 'Packed Luggage Co',      'travel',      'Robina',           -28.0790, 153.3860, 'ShopBack', 'cashback', 9,  false, false, ['luggage', 'suitcase', 'travel', 'backpack']),
    shop('s15', 'SkyGate Flights',        'travel',      'Coolangatta',      -28.1660, 153.5070, 'Altitude', 'points',   5,  true,  false, ['flights', 'airline', 'airport', 'japan', 'tokyo', 'overseas']),
    shop('s16', 'Yen & Euro Exchange',    'travel',      'Surfers Paradise', -28.0025, 153.4315, 'Altitude', 'points',   4,  false, true,  ['currency', 'yen', 'japan', 'money exchange', 'overseas']),
    shop('s17', 'Bento House',            'meals',       'Southport',        -27.9660, 153.4020, 'Extras',   'cashback', 10, false, true,  ['japanese', 'ramen', 'bento', 'lunch', 'japan']),
    shop('s18', 'Surf & Sole',            'fashion',     'Broadbeach',       -28.0275, 153.4290, 'ShopBack', 'cashback', 12, false, false, ['clothes', 'shoes', 'surfwear']),
    shop('s19', 'Pacific Department Store','department', 'Robina',           -28.0770, 153.3870, 'Extras',   'cashback', 6,  true,  false, ['department store', 'clothes', 'home', 'electronics', 'gifts']),
    shop('s20', 'Peak Fitness',           'fitness',     'Southport',        -27.9640, 153.3980, 'ShopBack', 'cashback', 15, false, false, ['gym', 'fitness', 'health', 'workout']),
    shop('s21', 'Runners Lab',            'fitness',     'Burleigh Heads',   -28.0890, 153.4490, 'Extras',   'cashback', 10, false, true,  ['running', 'shoes', 'walking', 'steps', 'health']),
    shop('s22', 'Glide eScooters',        'transport',   'Surfers Paradise', -28.0040, 153.4320, 'ShopBack', 'cashback', 20, false, true,  ['scooter', 'transport', 'commute', 'green']),
    shop('s23', 'Palm Beach Gelato',      'treats',      'Palm Beach',       -28.1150, 153.4660, 'ShopBack', 'cashback', 5,  false, false, ['gelato', 'ice cream', 'dessert', 'beach']),
    shop('s24', 'Coolangatta Surf School','experiences', 'Coolangatta',      -28.1680, 153.5370, 'Altitude', 'points',   3,  false, false, ['surf', 'lessons', 'experience', 'weekend']),
    shop('s25', 'Miami Night Market',     'meals',       'Miami',            -28.0710, 153.4410, 'Extras',   'cashback', 8,  false, true,  ['street food', 'market', 'dinner', 'weekend']),
  ];

  /* =====================================================================
   * 4. ANA (the demo user) + GOAL
   * =================================================================== */
  const USER = {
    id: 'ana',
    name: 'Ana',
    cardTier: 'platinum', // UI can switch this: black | platinum | debit
    home: { suburb: 'Southport',        lat: -27.9675, lng: 153.4005 },
    work: { suburb: 'Surfers Paradise', lat: -28.0015, lng: 153.4300 },
  };

  const GOAL = {
    id: 'japan',
    name: 'Japan trip',
    emoji: '🗾',
    query: 'I want to go to Japan in June', // example text for the goal search demo
    target: 4500,
    saved: 1240,
    deadline: '2027-06-01',
    tags: ['travel', 'japan', 'flights', 'yen', 'luggage', 'holiday', 'tokyo'],
  };

  /* =====================================================================
   * 5. INCOME + BILLS (recurring)
   *    every: 'fortnight' | 'month' | 'quarter'
   *    fortnight / quarter use `anchor` (one known date); month uses `day`
   * =================================================================== */
  const RECURRING = [
    { id: 'salary',   name: 'Salary: Coastline Digital', category: 'income',  amount: 2150,   every: 'fortnight', anchor: '2026-11-12' }, // Thursdays
    { id: 'rent',     name: 'Rent: Southport unit',      category: 'rent',    amount: -900,   every: 'fortnight', anchor: '2026-11-11' }, // Wednesdays
    { id: 'gym',      name: 'Peak Fitness membership',   category: 'bills',   amount: -25.9,  every: 'fortnight', anchor: '2026-11-06', shopId: 's20' },
    { id: 'phone',    name: 'Mobile plan',               category: 'bills',   amount: -45,    every: 'month',     day: 3 },
    { id: 'internet', name: 'Home internet',             category: 'bills',   amount: -75,    every: 'month',     day: 10 },
    { id: 'spotify',  name: 'Spotify',                   category: 'bills',   amount: -13.99, every: 'month',     day: 21 },
    { id: 'power',    name: 'Electricity (quarterly)',   category: 'bills',   amount: -186.4, every: 'quarter',   anchor: '2026-10-28' },
    { id: 'japanAuto',name: 'Auto-transfer to Japan jar',category: 'savings', amount: -100,   every: 'month',     day: 1 },
  ];

  function occursOn(rec, iso) {
    if (rec.every === 'fortnight') return ((daysBetween(rec.anchor, iso) % 14) + 14) % 14 === 0;
    if (rec.every === 'quarter')   return ((daysBetween(rec.anchor, iso) % 91) + 91) % 91 === 0;
    if (rec.every === 'month')     return +iso.slice(8, 10) === rec.day;
    return false;
  }
  function nextOccurrence(rec, afterISO) {
    for (let i = 1; i <= 120; i++) {
      const d = addDays(afterISO, i);
      if (occursOn(rec, d)) return d;
    }
    return null;
  }

  /* =====================================================================
   * 6. ANA'S 60 DAYS OF TRANSACTIONS (generated, deterministic)
   *    Habits: weekday coffee, weekday lunch, Uber on Fridays,
   *    food delivery Tue/Thu/Sun, groceries Sunday, plus the bills above.
   * =================================================================== */
  // Ana spends ~$60/week on coffee (matches the pitch line). Her usual café is
  // NOT a partner, so the AI can suggest Bean Republic (10% Extras, ~400 m from work).
  const USUAL_CAFE = 'Daily Grind Cavill Ave';
  const LUNCH_SPOTS = ['Cavill Food Court', 'Chevron Sushi Bar', 'Subs & Co', 'Lunch Box Kitchen'];
  const DELIVERY_APPS = ['Uber Eats', 'Menulog'];

  let txSeq = 0;
  function tx(date, time, merchant, category, amount, extra) {
    txSeq += 1;
    return Object.assign(
      { id: 't' + String(txSeq).padStart(4, '0'), date, time, merchant, category, amount: round2(amount) },
      extra || {}
    );
  }
  const shopIdByName = Object.fromEntries(SHOPS.map((s) => [s.name, s.id]));

  function buildHistory() {
    const out = [];
    const start = addDays(TODAY, -HISTORY_DAYS);
    for (let i = 0; i < HISTORY_DAYS; i++) {
      const d = addDays(start, i); // up to and including yesterday
      const dow = dayOfWeek(d);
      const weekday = dow >= 1 && dow <= 5;

      if (weekday) {
        out.push(tx(d, '07:50', USUAL_CAFE, 'coffee', -between(5.5, 6.2)));
        const lunch = pick(LUNCH_SPOTS);
        out.push(tx(d, '12:30', lunch, 'meals', -between(13.5, 19.5), shopIdByName[lunch] ? { shopId: shopIdByName[lunch] } : {}));
        out.push(tx(d, '15:10', USUAL_CAFE, 'coffee', -between(4.8, 5.5))); // afternoon coffee -> ~$60/week total
      }
      if (dow === 6) out.push(tx(d, '09:30', 'Esplanade Kiosk', 'coffee', -between(5.2, 6.0)));
      if (dow === 5) out.push(tx(d, '22:40', 'Uber', 'rideshare', -between(24, 36)));
      if ((dow === 2 || dow === 4 || dow === 0) && rand() < 0.8) {
        out.push(tx(d, '19:30', pick(DELIVERY_APPS), 'delivery', -between(27, 44)));
      }
      if (dow === 0) out.push(tx(d, '10:15', 'Coles Southport', 'groceries', -between(72, 118)));

      for (const rec of RECURRING) {
        if (occursOn(rec, d)) {
          out.push(tx(d, rec.category === 'income' ? '06:00' : '09:00', rec.name, rec.category, rec.amount,
            Object.assign({ recurringId: rec.id }, rec.shopId ? { shopId: rec.shopId } : {})));
        }
      }
    }
    return out;
  }

  const OPENING_BALANCE = 1800; // everyday account, 60 days ago (keeps Ana above $0 the whole history)
  const HISTORY = buildHistory();
  const COFFEE_PRICE = 5.8;

  /* =====================================================================
   * 7. SCENARIOS (switcher for the demo)
   *    Each scenario says what happened TODAY and can override numbers.
   * =================================================================== */
  const todayCoffee = () => tx(TODAY, '07:52', USUAL_CAFE, 'coffee', -COFFEE_PRICE);

  const SCENARIOS = {
    normal: {
      id: 'normal',
      label: 'Normal day',
      description: 'Ana buys her usual coffee. Rent is a week away, so there is room to save.',
      today: () => [todayCoffee()],
      apply: (s) => s,
      aiHint: 'Ana is on track. Suggest Bean Republic (10% Extras, ~400 m from work) for her daily coffee.',
    },
    skippedCoffee: {
      id: 'skippedCoffee',
      label: 'Skipped coffee',
      description: 'Ana skipped her coffee. The $5.80 she did not spend moves to the Japan jar.',
      today: () => [tx(TODAY, '08:05', 'Japan jar: skipped coffee', 'savings', -COFFEE_PRICE, { auto: true })],
      apply: (s) => {
        s.goal.saved = round2(s.goal.saved + COFFEE_PRICE);
        s.streaks.noCoffeeDays = 1;
        return s;
      },
      aiHint: 'Celebrate: $5.80 went to Japan. Show progress and a tiny streak.',
    },
    rentDueTomorrow: {
      id: 'rentDueTomorrow',
      label: 'Rent due tomorrow',
      description: 'Rent ($900) is due tomorrow and money is tight. The AI pauses savings moves.',
      today: () => [todayCoffee()],
      apply: (s) => {
        s.accounts.everyday.balance = 1012.4;
        s.upcoming = s.upcoming.map((b) => (b.recurringId === 'rent' ? Object.assign({}, b, { date: addDays(TODAY, 1) }) : b));
        s.upcoming.sort((a, b) => a.date.localeCompare(b.date));
        return s;
      },
      aiHint: 'Do NOT move money today. Warn Ana kindly that rent is due tomorrow and she will have very little left.',
    },
  };

  /* =====================================================================
   * 8. STATE BUILDER: one object for the whole UI
   * =================================================================== */
  function cashflow(state) {
    const salary = RECURRING.find((r) => r.id === 'salary');
    const nextPayday = nextOccurrence(salary, TODAY);
    const billsBeforePayday = state.upcoming
      .filter((b) => b.amount < 0 && b.date <= nextPayday)
      .reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const safeToSpend = round2(state.accounts.everyday.balance - billsBeforePayday);
    return {
      nextPayday,
      daysToPayday: daysBetween(TODAY, nextPayday),
      billsBeforePayday: round2(billsBeforePayday),
      safeToSpend,
      safePerDay: round2(safeToSpend / Math.max(1, daysBetween(TODAY, nextPayday))),
    };
  }

  function buildState(scenarioId) {
    const sc = SCENARIOS[scenarioId] || SCENARIOS.normal;
    const todayTx = sc.today();
    const transactions = HISTORY.concat(todayTx).sort((a, b) =>
      (b.date + b.time).localeCompare(a.date + a.time)
    );
    const balance = round2(OPENING_BALANCE + transactions.reduce((s, t) => s + t.amount, 0));

    const upcoming = RECURRING.map((r) => ({
      recurringId: r.id, name: r.name, category: r.category, amount: r.amount, date: nextOccurrence(r, TODAY),
    })).sort((a, b) => a.date.localeCompare(b.date));

    let state = {
      today: TODAY,
      scenario: { id: sc.id, label: sc.label, description: sc.description, aiHint: sc.aiHint },
      user: Object.assign({}, USER),
      card: CARD_TIERS[USER.cardTier],
      goal: Object.assign({}, GOAL),
      accounts: {
        everyday: { name: 'Everyday account', balance },
        japanJar: { name: 'Japan jar', balance: GOAL.saved },
      },
      transactions,
      todayTransactions: todayTx,
      upcoming,
      streaks: { noCoffeeDays: 0 },
    };
    state = sc.apply(state);
    state.accounts.japanJar.balance = state.goal.saved;
    state.goal.progress = round2(state.goal.saved / state.goal.target);
    state.cashflow = cashflow(state);
    return state;
  }

  /* =====================================================================
   * 9. HELPERS FOR THE FEATURES (map, search, recommendations)
   * =================================================================== */
  function visibleShops(tierId) {
    const tier = CARD_TIERS[tierId || current.user.cardTier];
    return SHOPS.filter((s) => tier.sources.includes(s.source));
  }

  function coinsFor(shopOrId, tierId) {
    const s = typeof shopOrId === 'string' ? SHOPS.find((x) => x.id === shopOrId) : shopOrId;
    const tier = CARD_TIERS[tierId || current.user.cardTier];
    if (!s || !tier.sources.includes(s.source)) return 0;
    return s.baseCoins * tier.multiplier;
  }

  function distanceKm(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return round2(2 * R * Math.asin(Math.sqrt(h)));
  }

  const NON_SPEND = ['income', 'rent', 'savings'];
  function spendByCategory(days, txs) {
    const list = txs || current.transactions;
    const from = addDays(TODAY, -(days || 28));
    const out = {};
    for (const t of list) {
      if (t.amount >= 0 || t.date <= from || NON_SPEND.includes(t.category)) continue;
      out[t.category] = round2((out[t.category] || 0) + Math.abs(t.amount));
    }
    return out;
  }

  function weeklyAverage(category, days) {
    const d = days || 28;
    return round2((spendByCategory(d)[category] || 0) / (d / 7));
  }

  /* =====================================================================
   * 10. SCENARIO SWITCHER (state + listeners + optional UI)
   * =================================================================== */
  const listeners = [];
  let current = buildState('normal');

  function setScenario(id) {
    if (!SCENARIOS[id]) throw new Error('Unknown scenario: ' + id);
    const tier = current.user.cardTier; // keep the card the user picked
    txSeq = HISTORY.length;
    current = buildState(id);
    current.user.cardTier = tier;
    current.card = CARD_TIERS[tier];
    listeners.forEach((fn) => fn(current));
    if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
      root.dispatchEvent(new root.CustomEvent('tm:change', { detail: current }));
    }
    return current;
  }

  function setCardTier(tierId) {
    if (!CARD_TIERS[tierId]) throw new Error('Unknown card tier: ' + tierId);
    current.user.cardTier = tierId;
    current.card = CARD_TIERS[tierId];
    listeners.forEach((fn) => fn(current));
    return current;
  }

  function onChange(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); }

  function mountScenarioSwitcher(el) {
    if (!el || typeof document === 'undefined') return;
    el.innerHTML = '';
    el.classList.add('tm-scenarios');
    Object.values(SCENARIOS).forEach((sc) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = sc.label;
      b.dataset.scenario = sc.id;
      b.className = 'tm-scenario-btn' + (sc.id === current.scenario.id ? ' is-active' : '');
      b.onclick = () => setScenario(sc.id);
      el.appendChild(b);
    });
    onChange((s) => el.querySelectorAll('button').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.scenario === s.scenario.id)));
  }

  // ?scenario=rentDueTomorrow in the URL picks the scenario on load
  if (root.location && root.location.search) {
    const q = new URLSearchParams(root.location.search).get('scenario');
    if (q && SCENARIOS[q]) current = buildState(q);
  }

  /* ---------- export ---------- */
  const TM = {
    TODAY, CATEGORIES, SOURCES, CARD_TIERS, SHOPS, USER, GOAL, RECURRING, SCENARIOS,
    getState: () => current,
    setScenario, setCardTier, onChange, mountScenarioSwitcher,
    visibleShops, coinsFor, distanceKm, spendByCategory, weeklyAverage,
    util: { addDays, daysBetween, dayOfWeek, round2 },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TM;
  root.TM = TM;
})(typeof window !== 'undefined' ? window : globalThis);
