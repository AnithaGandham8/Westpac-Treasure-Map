// POST {merchant, spendSummary} -> {ok, why}
// spendSummary is already worked out in the browser (e.g. weekly average, distance). The model only phrases it.
import { askJson, json, failure, clip } from './_ai.js';

const SYSTEM = `You write the "why this is for you" line on a bank rewards app.
Reply with JSON only: {"why":"..."}
One friendly sentence under 25 words. Use only the facts given; copy any numbers exactly as given and never invent new ones.`;

export async function onRequestPost({ request, env }) {
  try {
    const { merchant, spendSummary } = await request.json();
    if (!merchant || !merchant.name) return json({ ok: false, reason: 'bad-request' }, 400);
    const facts = {
      merchant: { name: clip(merchant.name, 40), category: clip(merchant.category, 20), offer: clip(merchant.offer, 40), distance: clip(merchant.distance, 16) },
      spendSummary: clip(JSON.stringify(spendSummary || {}), 400),
    };
    const out = await askJson(env, 'small', SYSTEM, JSON.stringify(facts), 120);
    return json({ ok: true, why: clip(out.why, 180) });
  } catch (e) {
    return failure(e);
  }
}
