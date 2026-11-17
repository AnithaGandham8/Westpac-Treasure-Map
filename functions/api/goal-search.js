// POST {goal, merchants:[{id,name,category,tags,suburb}]} -> {ok, intents[], month, matches:[{id, why}]}
// The model only reads the goal and writes prose. Scores and ordering are computed in the browser (ai.js).
import { askJson, json, failure, clip } from './_ai.js';

const SYSTEM = `You help a bank customer find shops whose rewards fit a savings goal.
Reply with JSON only, no markdown:
{"intents":["travel","flights"],"month":"June" or null,"matches":[{"id":"s13","why":"one short friendly sentence"}]}
Rules: intents are 2 to 5 lowercase single words. Use only merchant ids from the list. At most 6 matches, best first.
"why" is under 18 words and must not contain any dollar amounts, percentages or numbers.`;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const goal = clip(body.goal, 200);
    const merchants = (Array.isArray(body.merchants) ? body.merchants : []).slice(0, 40).map((m) => ({
      id: clip(m.id, 8), name: clip(m.name, 40), category: clip(m.category, 20), suburb: clip(m.suburb, 24),
      tags: (m.tags || []).slice(0, 6).map((t) => clip(t, 20)),
    }));
    if (!goal || !merchants.length) return json({ ok: false, reason: 'bad-request' }, 400);

    const out = await askJson(env, 'big', SYSTEM, `Goal: ${goal}\nMerchants: ${JSON.stringify(merchants)}`, 500);
    const ids = new Set(merchants.map((m) => m.id));
    return json({
      ok: true,
      intents: (out.intents || []).slice(0, 5).map((s) => clip(s, 24)),
      month: out.month ? clip(out.month, 16) : null,
      matches: (out.matches || []).filter((m) => ids.has(m.id)).slice(0, 6).map((m) => ({ id: m.id, why: clip(m.why, 140) })),
    });
  } catch (e) {
    return failure(e);
  }
}
