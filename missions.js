/* =====================================================================
 * missions.js: "Me vs Me" tab (Phase 4). Logic lives in engine.js,
 * this file only draws it. Needs data.js, engine.js and app.js first.
 *
 *   Target   = top discretionary category, baseline (median of 4 weeks) x 0.9
 *   Level up = beat the target by more than 20%  -> target 10% harder
 *   Ease     = two misses in a row               -> target ~10% easier
 *   Floor    = never below 60% of the baseline
 *   Reward   = min(level tier, 3% of cash-flow buffer), then the cash-flow check
 * ===================================================================== */
(function () {
  'use strict';
  const TM = window.TM;
  const E = window.Engine;
  const App = window.App;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + Number(n).toFixed(2);
  const money0 = (n) => '$' + Math.round(n);

  const RESULT = {
    win:     { label: 'Hit',      icon: '✅' },
    levelup: { label: 'Level up', icon: '⬆️' },
    fail:    { label: 'Missed',   icon: '❌' },
    eased:   { label: 'Eased',    icon: '🫶' },
    shifted: { label: 'Shifted',  icon: '↔️' },
    flagged: { label: 'Flagged',  icon: '🚩' },
  };
  const WEEKS = [
    ['strong', '💪 Strong week'],
    ['ok', '👍 Just hit it'],
    ['fail', '😬 Missed'],
    ['shifted', '↔️ Shifted spend'],
    ['cheat', '🚩 Tiny-purchase cheat'],
  ];

  let shownTarget = null;

  function rewardText(rw) {
    if (rw.mode === 'full') return `Hit it and <b>${money(rw.amount)}</b> goes to your Japan Pot.`;
    if (rw.mode === 'reduced') return `Hit it and <b>${money(rw.amount)}</b> goes to your Japan Pot. Reduced, because cash flow is tight.`;
    return 'Cash flow is very tight right now, so no money moves even if you hit it.';
  }

  function render() {
    const view = $('#missions-view');
    if (!view) return;
    const m = E.mission();
    const cat = TM.CATEGORIES[m.category];
    const name = cat.label.toLowerCase();
    const rw = E.missionReward(m.level);
    const spent = E.spentThisWeek();
    const pct = Math.min(spent / m.target, 1) * 100;
    const floor = E.floorFor(m.anchor);
    const atFloor = m.target <= floor;
    const maxL = E.MISSION.maxLevel;
    const last = m.last;
    const changed = shownTarget !== null && shownTarget !== m.target;
    const silent = rw.mode === 'none';

    const pips = Array.from({ length: maxL }, (_, i) => i + 1).map((i) =>
      `<span class="pip ${i < m.level ? 'done' : ''} ${i === m.level ? 'now' : ''}">${i}</span>`).join('<span class="pip-line"></span>');

    const rows = m.history.slice(-5).reverse().map((h) => `
      <div class="week-row">
        <span class="res res-${h.result}">${RESULT[h.result].icon} ${RESULT[h.result].label}</span>
        <span class="muted">Week ${h.week}: ${money(h.actual)} vs ${money0(h.target)}</span>
      </div>`).join('') || '<p class="muted small">No weeks played yet. Use the demo buttons below to fast-forward one.</p>';

    const p = m.pending;
    view.innerHTML = `
      <div class="m-head">
        <div>
          <h2>Me vs Me</h2>
          <p class="muted">Your only rival is last week's you.</p>
        </div>
        <div class="m-level-badge">LVL <b>${m.level}</b></div>
      </div>

      ${last ? `<div class="banner res-${last.result}" id="m-banner" role="status">
        <b>${RESULT[last.result].icon} ${RESULT[last.result].label}.</b> ${esc(last.note)}${last.extra ? '<br>' + esc(last.extra) : ''}
      </div>` : ''}

      ${p ? `<div class="card prompt" id="m-prompt">
        <div class="ai-tag">✨ Ask first</div>
        <p class="prompt-q">You hit your ${esc(name)} target. Send <b>${money(p.amount)}</b> to your Japan Pot?</p>
        <div class="prompt-btns">
          <button type="button" class="btn-yes" id="m-yes">Yes, send ${money(p.amount)}</button>
          <button type="button" class="btn-no" id="m-no">Not now</button>
        </div>
        <details class="why-ai">
          <summary>How the AI decided</summary>
          <p><b>Target:</b> you spent ${money(p.actual)} against ${money0(p.target)}.</p>
          <p><b>Amount:</b> lowest of the level tier (${money(p.tier)}) and 3% of your ${money(p.buffer)} buffer (${money(p.cap)}) = ${money(p.base)}${p.mode === 'reduced' ? ', halved because cash flow is tight' : ''}.</p>
          <p>Nothing moves unless you tap Yes.</p>
        </details>
      </div>` : ''}

      <div class="card mission-card">
        <div class="ai-tag">✨ Made from your spending</div>
        <h3 class="m-target">Spend less than <span class="m-target-num ${changed ? 'flash' : ''}" id="m-target">${money0(m.target)}</span> on ${esc(name)} this week</h3>
        <p class="muted small">Your usual is ${money(m.anchor)} a week (median of your last 4 weeks), your top non-essential spend. Target now: ${Math.round((m.target / m.anchor) * 100)}% of that.</p>
        <div class="bar" role="progressbar" aria-valuenow="${spent}" aria-valuemin="0" aria-valuemax="${m.target}">
          <div class="bar-fill ${spent > m.target ? 'over' : ''}" style="width:${pct}%"></div>
          <div class="bar-goal"></div>
        </div>
        <p class="bar-caption"><b>${money(spent)}</b> of ${money0(m.target)} spent so far <span class="muted">${m.week === 0 ? '· this week' : '· new week'}</span></p>
      </div>

      <div class="card">
        <div class="level-head">
          <b>Level ${m.level}</b>
          <span class="muted small">${atFloor || m.level >= maxL ? 'Healthy floor reached 🛟' : `Beat the target by 20% to reach Level ${m.level + 1}`}</span>
        </div>
        <div class="pips">${pips}</div>
        <p class="muted small">Two misses in a row and the target eases by about 10%${m.fails === 1 ? ' <b class="warn">(1 miss so far)</b>' : ''}. Targets never go below ${money0(floor)}, so you are never pushed into unsafe cuts.</p>
      </div>

      <div class="card">
        <b>Reward</b>
        <p class="reward-line ${silent ? 'is-silent' : ''}">${rewardText(rw)}</p>
        <p class="muted small">Amount = lowest of your level tier (${money(rw.tier)}) and 3% of your cash-flow buffer (${money(rw.cap)}), then the same cash-flow check as Skip &amp; Save.</p>
        <div class="switch-row">
          <div>
            <b>${m.autoSend ? 'Send rewards automatically' : 'Ask me first'}</b>
            <div class="muted small">${m.autoSend ? 'Money moves when you hit a target.' : 'Nothing moves until you tap Yes.'}</div>
          </div>
          <button type="button" class="switch" role="switch" aria-checked="${m.autoSend}" aria-label="Send rewards automatically" id="m-auto"><span></span></button>
        </div>
      </div>

      <div class="card"><b>Recent weeks</b>${rows}</div>

      <div class="card">
        <b>🛡️ Fair play checks</b>
        <ul class="fair">
          <li><b>Healthy floor:</b> the target never goes below ${money0(floor)} (60% of your usual).</li>
          <li><b>Shifted spend:</b> if the saving just moves to another category, it earns nothing.</li>
          <li><b>Tiny-purchase flag:</b> 4+ purchases under $3 at one shop in a day are flagged.</li>
          <li class="muted">Spend on another bank's card needs open banking data: a next step.</li>
        </ul>
      </div>

      <div class="card demo-weeks">
        <div class="ai-tag demo">Demo · fast-forward a week</div>
        <div class="week-btns">${WEEKS.map(([k, l]) => `<button type="button" class="chip" data-week="${k}">${l}</button>`).join('')}</div>
      </div>`;

    shownTarget = m.target;

    $('#m-auto').onclick = () => E.setAutoSend(!m.autoSend);
    if (p) {
      $('#m-yes').onclick = (e) => {
        const btn = e.currentTarget;
        E.acceptReward();
        App.sendToPot(btn);
        App.toast(`🎯 ${money(p.amount)} sent to your Japan Pot`);
        render();
      };
      $('#m-no').onclick = () => E.declineReward();
    }
    view.querySelectorAll('[data-week]').forEach((b) => b.addEventListener('click', () => playWeek(b.dataset.week)));
  }

  function playWeek(kind) {
    const out = E.simulateWeek(kind); // emits -> render()
    const view = $('#screen-missions');
    if (view) view.scrollTo({ top: 0, behavior: 'smooth' });
    if (out.reward && out.reward.amount > 0 && E.mission().autoSend) {
      const banner = $('#m-banner');
      if (banner) App.sendToPot(banner);
      App.toast(`🎯 ${money(out.reward.amount)} sent to your Japan Pot`);
    } else if (out.result === 'levelup') {
      App.toast(`⬆️ Level ${E.mission().level}! New target ${money0(E.mission().target)}`);
    } else if (out.result === 'eased') {
      App.toast(`🫶 Target eased to ${money0(E.mission().target)}`);
    }
  }

  function init() {
    render();
    E.onChange((evt) => { if (/^mission|reset/.test(evt.type)) render(); });
    TM.onChange(render); // scenario changes the cash-flow buffer -> reward
    window.Missions = { render, playWeek };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
