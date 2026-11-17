// Mock data. Phase 3 needs: Ana's 8 weeks of transactions, bills, balance, scenarios.
// Phase 1 will add the ~25 shops. Seeded RNG, so every reload gives the same history.
const DATA = (() => {
  const DEMO_TODAY = new Date(2026, 10, 17); // Tuesday 17 Nov 2026
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const at = (d, h, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);

  let seed = 2026;
  const rand = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const tx = (date, category, merchant, amount) => ({ date, category, merchant, amount });

  // 56 days of history: coffee x2 on weekdays, lunch, Uber on Fridays, delivery, rent
  const transactions = [];
  for (let i = 56; i >= 1; i--) {
    const d = addDays(DEMO_TODAY, -i);
    const wd = d.getDay();
    const weekday = wd >= 1 && wd <= 5;
    if (weekday) {
      transactions.push(tx(at(d, 8, 10), 'coffee', 'Coastal Coffee', pick([4.5, 5, 5, 5, 5.5])));
      if (rand() < 0.93) transactions.push(tx(at(d, 14, 0), 'coffee', 'Coastal Coffee', pick([4.5, 5, 5, 5, 5.5])));
      if (rand() < 0.9) transactions.push(tx(at(d, 12, 30), 'lunch', 'Surfers Deli', 13 + Math.round(rand() * 6)));
    } else if (rand() < 0.7) {
      transactions.push(tx(at(d, 9, 30), 'coffee', 'Coastal Coffee', 5));
    }
    if (wd === 5) transactions.push(tx(at(d, 19, 30), 'uber', 'Uber', 22 + Math.round(rand() * 4)));
    if ((wd === 3 || wd === 6) && rand() < 0.8) transactions.push(tx(at(d, 19, 0), 'delivery', 'Menulog', 28 + Math.round(rand() * 8)));
    if (d.getDate() === 1) transactions.push(tx(at(d, 7, 0), 'rent', 'Rent', 1800));
  }

  const scenarios = {
    normal:  { label: 'Normal day',                  balance: 2400, rentInDays: 12, skipSecondCoffee: false },
    skipped: { label: 'Skipped coffee',              balance: 2400, rentInDays: 12, skipSecondCoffee: true  },
    rent:    { label: 'Rent due tomorrow',           balance: 2100, rentInDays: 1,  skipSecondCoffee: true  },
    broke:   { label: 'Very tight (stays silent)',   balance: 1850, rentInDays: 1,  skipSecondCoffee: true  }
  };

  function scenarioFor(key) {
    const s = scenarios[key];
    const todayTxns = [
      tx(at(DEMO_TODAY, 8, 15), 'coffee', 'Coastal Coffee', 5),
      tx(at(DEMO_TODAY, 12, 40), 'lunch', 'Surfers Deli', 15)
    ];
    if (!s.skipSecondCoffee) todayTxns.push(tx(at(DEMO_TODAY, 14, 5), 'coffee', 'Coastal Coffee', 5));
    return {
      ...s, todayTxns,
      bills: [
        { name: 'Rent', amount: 1800, due: addDays(DEMO_TODAY, s.rentInDays) },
        { name: 'Card payment', amount: 350, due: addDays(DEMO_TODAY, 20) }
      ]
    };
  }

  return {
    demoToday: DEMO_TODAY,
    persona: { name: 'Ana', card: 'platinum' },
    cardTiers: {
      black:    { label: 'Altitude Black', multiplier: 3, sources: ['extras', 'shopback', 'altitude'] },
      platinum: { label: 'Platinum',       multiplier: 2, sources: ['extras', 'shopback'] },
      debit:    { label: 'Debit',          multiplier: 1, sources: ['shopback'] }
    },
    goal: { name: 'Japan in June', target: 4000, saved: 1250 },
    potHistory: [
      { source: 'coins',   label: 'Coastal Coffee 10% back', amount: 3.6,  when: 'Mon' },
      { source: 'coins',   label: 'Flight Centre rewards',   amount: 24,   when: 'Sat' },
      { source: 'mission', label: 'Food delivery under $40', amount: 10,   when: 'Last week' }
    ],
    shops: [],
    transactions, scenarios, scenarioFor
  };
})();
if (typeof module !== 'undefined') module.exports = DATA;
