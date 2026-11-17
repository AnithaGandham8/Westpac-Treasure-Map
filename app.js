// Tabs, demo panel and scenario state. Features plug in from Phase 2 onward.
const state = { tab: 'map', scenario: 'normal' };

function showTab(name) {
  state.tab = name;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  document.querySelectorAll('input[name="scenario"]').forEach(r =>
    r.addEventListener('change', () => { state.scenario = r.value; console.log('scenario:', state.scenario); }));

  document.getElementById('btn-reset').addEventListener('click', () => location.reload());

  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'd') {
      const p = document.getElementById('demo-panel');
      p.hidden = !p.hidden;
    }
  });

  document.getElementById('scaffold-status').textContent =
    `Scaffold OK. Card: ${DATA.cardTiers[DATA.persona.card].label}, goal: ${DATA.goal.name}.`;
  console.log('DATA', DATA);
});
