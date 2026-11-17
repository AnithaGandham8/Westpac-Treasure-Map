// Me vs Me: Missions tab. Logic lives in engine.js, this file only draws it.
state.mission = Engine.newMission(DATA.transactions, DATA.demoToday);
state.autoSend = false;
state.lastWeek = null;
state.spentSoFar = 0;   // mock: spend so far this week
const resetSoFar = () => { state.spentSoFar = Math.round(state.mission.target * 0.4); };
resetSoFar();

const mName = c => (LABELS[c] || { name: c }).name;
const RESULT = { win: 'Hit', levelup: 'Level up', fail: 'Missed', flagged: 'Flagged', shifted: 'Shifted' };
const currentBuffer = () => {
  const sc = DATA.scenarioFor(state.scenario);
  return Engine.cashFlowBuffer(sc.balance, sc.bills, DATA.demoToday);
};

function rewardText(rw) {
  if (rw.mode === 'full') return `Hit it and ${fmt(rw.amount)} goes to your Japan pot.`;
  if (rw.mode === 'reduced') return `Hit it and ${fmt(rw.amount)} goes to your Japan pot. Reduced, because cash flow is tight.`;
  return 'Cash flow is very tight this week, so no money moves even if you hit it.';
}

function renderMissions() {
  const m = state.mission, name = mName(m.category), rw = Engine.missionReward(m.level, currentBuffer());
  const pct = Math.min(state.spentSoFar / m.target, 1) * 100, over = state.spentSoFar > m.target;
  const floor = Math.round(m.anchor * MISSION.floorShare);
  const pips = Array.from({ length: Engine.maxLevel(m.anchor) }, (_, i) => i + 1).map(i => `<span class="pip ${i < m.level ? 'done' : ''} ${i === m.level ? 'now' : ''}">${i}</span>`)
    .join('<span class="pip-line"></span>');
  const rows = m.history.slice(-5).reverse().map(h => `
    <div class="week-row"><span class="res res-${h.result}">${RESULT[h.result]}</span>
    <span class="caption-reg">${fmt(h.actual)} spent, target ${fmt(h.target)}</span></div>`).join('')
    || '<p class="caption-reg">No weeks played yet. Use the demo panel (press D) to simulate one.</p>';
  const lw = state.lastWeek;

  $('#missions-view').innerHTML = `
    <h1 class="h2-text">Me vs Me</h1>
    <p class="caption-reg">Your only rival is last week's you.</p>
    ${lw ? `<div class="banner res-${lw.result}" id="m-banner" role="status">${lw.note}${lw.extra ? '<br>' + lw.extra : ''}</div>` : ''}

    <div class="card">
      <div class="ai-tag">Made from your spending</div>
      <h2 class="h2-text">Spend less than ${fmt(m.target)} on ${name} this week</h2>
      <p class="caption-reg">Your usual is ${fmt(m.anchor)} a week (median of the last 4 weeks). Target: ${Math.round(m.target / m.anchor * 100)}% of that.</p>
      <div class="bar" role="progressbar" aria-valuenow="${state.spentSoFar}" aria-valuemax="${m.target}">
        <div class="bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div></div>
      <p class="caption-semi">${fmt(state.spentSoFar)} of ${fmt(m.target)} spent so far</p>
    </div>

    <div class="card">
      <div class="level-head"><span class="body-semi">Level ${m.level}</span>
        <span class="caption-reg">${m.target <= floor ? 'Healthy floor reached' : `Beat the target by 20% to reach Level ${m.level + 1}`}</span></div>
      <div class="pips">${pips}</div>
      <p class="caption-reg">Two misses in a row and the target eases by about 10%. Targets never go below ${fmt(floor)}, so you are never pushed into unsafe cuts.</p>
    </div>

    <div class="card">
      <span class="body-semi">Reward</span>
      <p class="body-reg">${rewardText(rw)}</p>
      <p class="caption-reg">Amount = lowest of your level tier (${fmt(rw.tier)}) and 3% of your cash-flow buffer (${fmt(rw.cap)}), then the same cash-flow check as Skip &amp; Save.</p>
      <div class="switch-row">
        <div><div class="body-semi">${state.autoSend ? 'Send rewards automatically' : 'Ask me first'}</div>
        <div class="caption-reg">${state.autoSend ? 'Money moves when you hit a target.' : 'Nothing moves until you tap Yes.'}</div></div>
        <button class="switch" role="switch" aria-checked="${state.autoSend}" aria-label="Send rewards automatically" id="m-auto"><span></span></button>
      </div>
    </div>

    <div class="card"><span class="body-semi">Recent weeks</span>${rows}</div>

    <div class="card"><span class="body-semi">Fair play checks</span>
      <p class="caption-reg">Spend that only moves to another category earns nothing. Four or more tiny purchases at one merchant in a day are flagged. Spending on another bank's card needs open banking data, which is a next step.</p>
    </div>`;
  $('#m-auto').onclick = () => { state.autoSend = !state.autoSend; renderMissions(); };
}

function simulateWeek(kind) {
  const m = state.mission, cat = m.category, today = DATA.demoToday;
  const cats = ['delivery', 'coffee', 'uber', 'lunch'];
  const baselines = Object.fromEntries(cats.map(c => [c, Engine.baseline(DATA.transactions, c, today)]));
  const actuals = { ...baselines };
  actuals[cat] = Math.round(m.target * { strong: 0.7, ok: 0.95, fail: 1.2, shifted: 0.5, cheat: 0.9 }[kind]);
  if (kind === 'shifted') {
    const other = cat === 'delivery' ? 'coffee' : 'delivery';
    actuals[other] = Math.round(baselines[other] + (baselines[cat] - actuals[cat]) * 0.8);
  }
  const tiny = kind === 'cheat'
    ? Array.from({ length: 6 }, (_, i) => ({ date: new Date(2026, 10, 17, 9, i * 20), category: 'coffee', merchant: 'Coastal Coffee', amount: 1.5 }))
    : [];
  const flagged = Engine.tinyPurchaseFlag(tiny).flagged;
  const shifted = Engine.isShifted({ category: cat, baselines, actuals });
  const out = Engine.settleWeek(m, { actual: actuals[cat], shifted, flagged });

  state.mission = out.mission;
  state.lastWeek = { result: out.result, note: out.note };
  resetSoFar();
  showTab('missions');

  if (out.rewardLevel !== null) {
    const rw = Engine.missionReward(out.rewardLevel, currentBuffer());
    const entry = { source: 'mission', label: `Hit target: ${mName(cat)}`, when: 'This week' };
    if (rw.amount > 0 && state.autoSend) {
      state.lastWeek.extra = 'Sending your reward automatically.';
      renderMissions();
      flyCoin($('#m-banner'), $('[data-tab="pot"]'), () => {
        creditPot(rw.amount, entry);
        state.lastWeek.extra = `${fmt(rw.amount)} sent to your Japan pot.`;
        renderMissions();
      });
      return;
    }
    if (rw.amount > 0) {
      renderMissions();
      setTimeout(() => showPrompt({
        tag: 'Me vs Me', amount: rw.amount, entry,
        message: `You hit your ${mName(cat)} target. Send ${fmt(rw.amount)} to your Japan savings?`,
        whyHtml: `<div class="why-panel"><div class="ai-tag">How the AI decided</div>
          <p class="caption-reg"><b>Target:</b> you spent ${fmt(actuals[cat])} against ${fmt(out.mission.history.at(-1).target)}.</p>
          <p class="caption-reg"><b>Amount:</b> lowest of tier ${fmt(rw.tier)} and 3% of your ${fmt(rw.buffer)} buffer (${fmt(rw.cap)}) = ${fmt(rw.base)}${rw.mode === 'reduced' ? ', reduced because cash flow is tight' : ''}.</p>
          <p class="caption-reg">Nothing moves unless you tap Yes.</p></div>`
      }), 450);
      return;
    }
    state.lastWeek.extra = 'No money moved this week because your cash flow is very tight.';
  }
  renderMissions();
}

document.addEventListener('DOMContentLoaded', () => {
  renderMissions();
  document.querySelectorAll('[data-week]').forEach(b => b.addEventListener('click', () => simulateWeek(b.dataset.week)));
  document.querySelectorAll('input[name="scenario"]').forEach(r => r.addEventListener('change', renderMissions));
});
