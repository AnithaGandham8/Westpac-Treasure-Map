// Deterministic habit engine. No LLM: every number here can be shown in the "Why?" panel.
const BANDS = [
  { id: 'morning',   from: 5,  to: 11 },
  { id: 'midday',    from: 11, to: 15 },
  { id: 'afternoon', from: 15, to: 18 },
  { id: 'evening',   from: 18, to: 24 }
];
const THRESHOLDS = {
  healthy: 500,      // buffer at or above: suggest the full skipped amount
  tight: 100,        // buffer from here up to healthy: suggest a reduced amount
  reducedShare: 0.4, // reduced = 40% of skipped (so $5 becomes $2)
  minSkip: 2         // ignore skips smaller than this
};
const LABELS = {
  coffee: { name: 'coffee', emoji: '☕' }, lunch: { name: 'lunch', emoji: '🥪' },
  delivery: { name: 'food delivery', emoji: '🛵' }, uber: { name: 'Uber ride', emoji: '🚗' }
};
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const bandOf = hour => BANDS.find(b => hour >= b.from && hour < b.to);
const median = arr => {
  const s = [...arr].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const money = n => '$' + Math.round(n).toLocaleString('en-AU');

const Engine = {
  // 1. Habits: median count and average ticket per category x weekday x time band
  habits(transactions, today, weeks = 8) {
    const end = startOfDay(today), start = addDays(end, -7 * weeks);
    const byDay = new Map(), cats = new Set();
    for (const t of transactions) {
      if (t.date < start || t.date >= end) continue;
      cats.add(t.category);
      const k = `${dayKey(t.date)}|${t.category}|${bandOf(t.date.getHours()).id}`;
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(t.amount);
    }
    const out = {};
    for (let i = 1; i <= 7 * weeks; i++) {
      const d = addDays(end, -i), wd = d.getDay();
      for (const c of cats) for (const b of BANDS) {
        const key = `${c}|${wd}|${b.id}`;
        const h = out[key] || (out[key] = { category: c, weekday: wd, band: b.id, counts: [], tickets: [] });
        const spent = byDay.get(`${dayKey(d)}|${c}|${b.id}`) || [];
        h.counts.push(spent.length);
        h.tickets.push(...spent);
      }
    }
    for (const h of Object.values(out)) {
      h.median = median(h.counts);
      h.avgTicket = h.tickets.length ? h.tickets.reduce((a, b) => a + b, 0) / h.tickets.length : 0;
    }
    return out;
  },

  // 2. Skip detection at 6pm: skipped = (median - actual) x avg ticket, for bands already over
  skippedSpend(habits, todayTxns, today, hour = 18) {
    const res = [];
    for (const h of Object.values(habits)) {
      if (h.weekday !== today.getDay() || h.median < 1) continue;
      if (BANDS.find(b => b.id === h.band).to > hour) continue;
      const actual = todayTxns.filter(t => t.category === h.category && bandOf(t.date.getHours()).id === h.band).length;
      if (actual >= h.median) continue;
      const amount = Math.round((h.median - actual) * h.avgTicket);
      if (amount >= THRESHOLDS.minSkip) res.push({ ...h, actual, amount });
    }
    return res.sort((a, b) => b.amount - a.amount);
  },

  // 3. Cash-flow check: buffer = balance - bills due in the next 7 days
  billsDue(bills, today, days = 7) {
    const from = startOfDay(today), to = addDays(from, days);
    return bills.filter(b => b.due >= from && b.due <= to);
  },
  cashFlowBuffer(balance, bills, today, days = 7) {
    return balance - Engine.billsDue(bills, today, days).reduce((s, b) => s + b.amount, 0);
  },
  suggestAmount(skipped, buffer) {
    if (buffer >= THRESHOLDS.healthy) return { amount: skipped, mode: 'full' };
    if (buffer >= THRESHOLDS.tight) return { amount: Math.max(1, Math.round(skipped * THRESHOLDS.reducedShare)), mode: 'reduced' };
    return { amount: 0, mode: 'silent' };
  },

  describe(skip) {
    const l = LABELS[skip.category] || { name: skip.category, emoji: '' };
    return skip.category === 'coffee' && skip.band !== 'morning'
      ? `your second coffee ${l.emoji}` : `your usual ${skip.band} ${l.name} ${l.emoji}`.trim();
  },

  // Rows for the "Why am I seeing this?" habit table
  table(habits, skip, todayTxns, today) {
    return Object.values(habits)
      .filter(h => h.category === skip.category && h.weekday === today.getDay() && h.median >= 1)
      .map(h => ({
        band: h.band, usual: h.median, ticket: h.avgTicket,
        today: todayTxns.filter(t => t.category === h.category && bandOf(t.date.getHours()).id === h.band).length
      }));
  },

  // Full decision, with the numbers behind it
  evaluate({ habits, todayTxns, balance, bills, today, hour = 18, goal = 'Japan' }) {
    const skips = Engine.skippedSpend(habits, todayTxns, today, hour);
    const due = Engine.billsDue(bills, today);
    const buffer = Engine.cashFlowBuffer(balance, bills, today);
    const base = { balance, buffer, billsDue: due, weekday: WEEKDAYS[today.getDay()] };
    if (!skips.length) return { ...base, ask: false, mode: 'none', reason: 'Today matches your normal pattern. Nothing skipped.' };

    const skip = skips[0], s = Engine.suggestAmount(skip.amount, buffer);
    const dueText = due.length ? due.map(b => `${b.name} ${money(b.amount)}`).join(', ') : 'none';
    const reasons = {
      full: `Buffer is ${money(buffer)} (bills due in 7 days: ${dueText}). That is healthy, so the full amount is suggested.`,
      reduced: `Buffer is ${money(buffer)} (bills due in 7 days: ${dueText}). That is tight, so a smaller amount is suggested.`,
      silent: `Buffer is only ${money(buffer)} (bills due in 7 days: ${dueText}). Too tight, so the app stays silent.`
    };
    const ask = s.amount > 0;
    return {
      ...base, ask, mode: s.mode, amount: s.amount, skipped: skip.amount, skip,
      reason: reasons[s.mode], table: Engine.table(habits, skip, todayTxns, today),
      message: ask ? `You skipped ${Engine.describe(skip)}. Send ${money(s.amount)} to your ${goal} savings?` : ''
    };
  }
};
if (typeof module !== 'undefined') module.exports = Engine;
