// Visitor numbers for the cockpit: totals plus every day, week and month that was counted.
// Read only, only counts (nothing personal), so anyone may read it.
async function all(kv, prefix) {
  const out = {}; let cursor;
  do {
    const r = await kv.list({ prefix, cursor });
    for (const k of r.keys) out[k.name.slice(prefix.length)] = { v: k.metadata?.v || 0, u: k.metadata?.u || 0 };
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return out;
}
export async function onRequest({ env }) {
  const headers = { 'cache-control': 'no-store', 'access-control-allow-origin': '*' };
  if (!env.COUNTER) return Response.json({ error: 'no COUNTER binding' }, { status: 503, headers });
  const [visitors, days, weeks, months] = await Promise.all([
    env.COUNTER.get('visitors'), all(env.COUNTER, 'd:'), all(env.COUNTER, 'w:'), all(env.COUNTER, 'm:')]);
  return Response.json({ visitors: parseInt(visitors || '0', 10), since: '2026-10-24', days, weeks, months, at: new Date().toISOString() }, { headers });
}
