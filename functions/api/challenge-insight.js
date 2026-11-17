// POST {baseline, thisWeek, cashflow} -> {ok, headline, detail, nextTarget}
// All numbers (baseline, result, next target, reward) come from engine.js. The model only writes the words.
import { askJson, json, failure, clip } from './_ai.js';

const SYSTEM = `You write the weekly coaching note for "Me vs Me", a savings challenge in a bank app.
Reply with JSON only: {"headline":"...","detail":"...","nextTarget":"..."}
headline: under 8 words. detail: one or two warm sentences. nextTarget: one short sentence about next week.
Meaning of the fields: the challenge is to SPEND LESS than a weekly limit in one category.
baseline.usualWeekly = what the user normally spends per week there. thisWeek.spent = what they spent. thisWeek.target = the spending limit they had.
thisWeek.nextTarget = next week's spending limit (not a savings amount). thisWeek.level = their level after this week.
result is one of: win, levelup, fail, eased, shifted, flagged. cashflow.reward = dollars moved to their savings pot (0 means none).
Use only the numbers given and copy them exactly. Never invent numbers, never pressure the user, never suggest skipping essentials.
If cashflow.mode is "none" or "reduced", say gently that saving is paused or smaller because cash is tight.`;

export async function onRequestPost({ request, env }) {
  try {
    const { baseline, thisWeek, cashflow } = await request.json();
    if (!thisWeek) return json({ ok: false, reason: 'bad-request' }, 400);
    const facts = { baseline, thisWeek, cashflow };
    const out = await askJson(env, 'small', SYSTEM, clip(JSON.stringify(facts), 1200), 220);
    return json({ ok: true, headline: clip(out.headline, 70), detail: clip(out.detail, 260), nextTarget: clip(out.nextTarget, 160) });
  } catch (e) {
    return failure(e);
  }
}
