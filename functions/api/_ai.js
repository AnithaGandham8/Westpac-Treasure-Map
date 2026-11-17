// Shared helpers for the Pages Functions. Models are env vars so they can be swapped without code changes.
// Cloudflare Pages: Settings > Functions > AI binding named "AI". No API key needed.
const MODEL_BIG = '@cf/openai/gpt-oss-120b';
const MODEL_SMALL = '@cf/openai/gpt-oss-20b'; // llama-3.1-8b was deprecated on Workers AI

export const modelFor = (env, size) =>
  size === 'big' ? env.MODEL_BIG || MODEL_BIG : env.MODEL_SMALL || MODEL_SMALL;

// Different models answer in different shapes; pull the text out of any of them
function textOf(res) {
  if (!res) return '';
  if (typeof res === 'string') return res;
  if (typeof res.response === 'string') return res.response;
  if (res.response && typeof res.response === 'object') return JSON.stringify(res.response);
  const msg = res.choices && res.choices[0] && res.choices[0].message;
  if (msg && msg.content) return msg.content;
  if (Array.isArray(res.output)) {
    return res.output
      .filter((o) => o.type === 'message')
      .flatMap((o) => o.content || [])
      .map((c) => c.text || '')
      .join('');
  }
  return '';
}

function parseJson(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('no JSON in model output');
  return JSON.parse(text.slice(start, end + 1));
}

// Ask the model for JSON. Throws on any failure; the caller turns that into a clean error response.
export async function askJson(env, size, system, user, maxTokens = 400) {
  if (!env.AI) throw new Error('AI binding missing');
  const model = modelFor(env, size);
  const input = /gpt-oss/.test(model)
    ? { instructions: system, input: user, reasoning: { effort: 'low' }, max_output_tokens: maxTokens + 600 }
    : { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens };
  const res = await env.AI.run(model, input);
  return parseJson(textOf(res));
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// 429 / quota / anything else -> 503 with a flag, so the page falls back to numbers without prose
export function failure(e) {
  const msg = String((e && e.message) || e);
  return json({ ok: false, fallback: true, reason: /429|limit|quota|neuron/i.test(msg) ? 'rate-limit' : 'error', detail: msg.slice(0, 200) }, 503);
}

export const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
