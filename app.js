// Tabs, Pot, Skip & Save prompt, demo panel.
const $ = s => document.querySelector(s);
const fmt = n => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  tab: 'map', scenario: 'normal',
  saved: DATA.goal.saved, history: [...DATA.potHistory],
  promptedOn: null   // guardrail: one prompt per day
};

function showTab(name) {
  state.tab = name;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
}

/* ---------- Pot ---------- */
const SOURCE = { coins: 'Coins', skip: 'Skipped spend', mission: 'Mission' };
function renderPot(fromValue) {
  const { target, name } = DATA.goal, C = 2 * Math.PI * 56;
  const draw = v => {
    $('#pot-amount').textContent = fmt(Math.round(v * 100) / 100);
    $('#pot-ring').setAttribute('stroke-dashoffset', C * (1 - Math.min(v / target, 1)));
    $('#pot-pct').textContent = Math.round((v / target) * 100) + '%';
  };
  $('#pot-goal').textContent = `of ${fmt(target)} · ${name}`;
  $('#pot-history').innerHTML = state.history.map(h => `
    <div class="history-row">
      <div><div class="body-semi">${h.label}</div>
      <div class="caption-reg"><span class="src src-${h.source}">${SOURCE[h.source]}</span> ${h.when}</div></div>
      <div class="body-semi money-in">+${fmt(h.amount)}</div>
    </div>`).join('');
  if (fromValue === undefined || reduceMotion()) return draw(state.saved);
  const t0 = performance.now();
  (function step(t) {
    const p = Math.min((t - t0) / 700, 1);
    draw(fromValue + (state.saved - fromValue) * p);
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

/* ---------- Skip & Save ---------- */
function log(html) { $('#decision-log').innerHTML = html; }

function runSixPmCheck() {
  const sc = DATA.scenarioFor(state.scenario);
  const habits = Engine.habits(DATA.transactions, DATA.demoToday);
  const d = Engine.evaluate({ habits, todayTxns: sc.todayTxns, balance: sc.balance, bills: sc.bills, today: DATA.demoToday });
  const verdict = d.ask ? `<b>Ask ${fmt(d.amount)}</b> (${d.mode})` : '<b>Stay silent</b>';
  const skipped = d.skipped ? `Skipped spend: ${fmt(d.skipped)}. ` : '';
  const todayKey = DATA.demoToday.toDateString();
  if (d.ask && state.promptedOn === todayKey) {
    return log(`${skipped}${d.reason}<br>Guardrail: already prompted today, so no second prompt.`);
  }
  log(`${verdict}<br>${skipped}${d.reason}`);
  if (d.ask) { state.promptedOn = todayKey; showPrompt(d); }
}

function whyPanel(d) {
  const rows = d.table.map(r => `
    <tr><td>${r.band}</td><td>${r.usual}</td><td>${r.today}</td><td>${fmt(Math.round(r.ticket * 100) / 100)}</td></tr>`).join('');
  const due = d.billsDue.length ? d.billsDue.map(b => `${b.name} ${fmt(b.amount)}`).join(', ') : 'none';
  return `
    <div class="why-panel">
      <div class="ai-tag">How the AI decided</div>
      <p class="caption-reg">Your usual ${d.weekday} ${d.skip.category}, from the last 8 weeks:</p>
      <table class="habit-table">
        <thead><tr><th>Time of day</th><th>Usual</th><th>Today</th><th>Avg price</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="caption-reg"><b>Skipped:</b> (${d.skip.median} − ${d.skip.actual}) × ${fmt(Math.round(d.skip.avgTicket * 100) / 100)} ≈ ${fmt(d.skipped)}</p>
      <p class="caption-reg"><b>Cash flow:</b> ${fmt(d.balance)} balance − bills due in 7 days (${due}) = ${fmt(d.buffer)} buffer.
        ${d.mode === 'reduced' ? 'Tight, so the amount is reduced.' : 'Healthy, so the full amount is suggested.'}</p>
      <p class="caption-reg">Nothing moves unless you tap Yes.</p>
    </div>`;
}

function showPrompt(d) {
  const layer = $('#prompt-layer');
  layer.innerHTML = `
    <div class="prompt-card" role="dialog" aria-live="polite" aria-label="Skip and Save">
      <div class="ai-tag">Skip &amp; Save</div>
      <p class="body-reg prompt-msg">${d.message}</p>
      <div class="prompt-actions">
        <button class="btn-secondary" id="p-no">No</button>
        <button class="btn-primary" id="p-yes">Yes, send ${fmt(d.amount)}</button>
      </div>
      <button class="link-btn" id="p-why" aria-expanded="false">Why am I seeing this?</button>
      <div id="p-why-body" hidden>${whyPanel(d)}</div>
    </div>`;
  const card = layer.firstElementChild;
  requestAnimationFrame(() => card.classList.add('in'));
  $('#p-why').onclick = e => {
    const body = $('#p-why-body'); body.hidden = !body.hidden;
    e.target.setAttribute('aria-expanded', String(!body.hidden));
  };
  $('#p-no').onclick = () => closePrompt();             // dismissed for the day (promptedOn stays set)
  $('#p-yes').onclick = () => acceptPrompt(d, card);
}

function closePrompt() {
  const card = $('#prompt-layer .prompt-card');
  if (!card) return;
  card.classList.remove('in');
  setTimeout(() => { $('#prompt-layer').innerHTML = ''; }, 300);
}

function flyCoin(fromEl, toEl, done) {
  const f = $('#app').getBoundingClientRect(), a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const sx = a.left + a.width / 2 - f.left - 14, sy = a.top + a.height / 2 - f.top - 14;
  const dx = b.left + b.width / 2 - f.left - 14 - sx, dy = b.top + b.height / 2 - f.top - 14 - sy;
  const coin = document.createElement('div');
  coin.className = 'coin-fly'; coin.textContent = '$';
  coin.style.left = sx + 'px'; coin.style.top = sy + 'px';
  $('#app').appendChild(coin);
  const anim = coin.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: `translate(${dx / 2}px, ${dy / 2 - 60}px) scale(1.25)`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(.6)` }
  ], { duration: reduceMotion() ? 1 : 750, easing: 'ease-in-out' });
  anim.onfinish = () => { coin.remove(); done(); };
}

function acceptPrompt(d, card) {
  card.querySelector('#p-yes').disabled = true;
  card.querySelector('#p-no').disabled = true;
  flyCoin($('#p-yes'), $('[data-tab="pot"]'), () => {
    const before = state.saved;
    state.saved += d.amount;
    state.history.unshift({ source: 'skip', label: `Skipped ${d.skip.category}`, amount: d.amount, when: 'Today 6:02pm' });
    renderPot(before);
    const nav = $('[data-tab="pot"]'); nav.classList.add('pulse');
    setTimeout(() => nav.classList.remove('pulse'), 900);
    card.innerHTML = `<p class="body-semi confirm">${fmt(d.amount)} sent to your Japan pot ✓</p>`;
    setTimeout(closePrompt, 1400);
  });
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  renderPot();

  document.querySelectorAll('input[name="scenario"]').forEach(r => r.addEventListener('change', () => {
    state.scenario = r.value;
    state.promptedOn = null;          // demo only: a new scenario is a new day
    $('#prompt-layer').innerHTML = '';
    runSixPmCheck();
  }));
  $('#btn-run').addEventListener('click', runSixPmCheck);
  $('#btn-reset').addEventListener('click', () => location.reload());
  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'd') $('#demo-panel').hidden = !$('#demo-panel').hidden;
  });

  $('#scaffold-status').textContent = 'Press D for demo controls, then pick a scenario to trigger the 6pm Skip & Save check.';
  runSixPmCheck();
});
