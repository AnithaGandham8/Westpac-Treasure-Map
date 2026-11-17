// Deterministic logic, no LLM. Phase 3 = Skip & Save, Phase 4 = Me vs Me.
const Engine = {
  habits(transactions) { /* median count + avg ticket by category, weekday, time band */ },
  skippedSpend(habits, today) { /* (median - actual) * avg ticket */ },
  cashFlowBuffer(balance, bills, days = 7) { /* balance minus bills due in the next `days` */ },
  suggestAmount(skipped, buffer) { /* full, reduced, or null (don't ask) */ },
  nextTarget(history) { /* baseline * 0.9, ease after 2 fails, level up on >20% beat */ }
};
