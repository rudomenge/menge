// Visitor counter. No cookies and nothing personal is stored: the browser only remembers
// (in localStorage) on which day, week and month it was last counted, and sends yes/no flags.
// Needs a KV namespace bound as COUNTER (Pages project > Settings > Bindings).
//
// Keys:  visitors          = unique browsers ever (since 24 Oct 2026), shown in the version label
//        d:YYYY-MM-DD      = that day:   v = page visits, u = unique visitors  (counts in KV metadata)
//        w:YYYY-Www        = that week:  v, u
//        m:YYYY-MM         = that month: v, u
// Dates are Amsterdam time.

export function keys(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).map(x => [x.type, x.value]));
  const day = `${p.year}-${p.month}-${p.day}`;
  const t = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
  const dow = (t.getUTCDay() + 6) % 7;            // Monday = 0
  t.setUTCDate(t.getUTCDate() - dow + 3);         // Thursday of this ISO week
  const y = t.getUTCFullYear();
  const wk = 1 + Math.floor((t - Date.UTC(y, 0, 1)) / 864e5 / 7);
  return { day, week: `${y}-W${String(wk).padStart(2, '0')}`, month: `${p.year}-${p.month}` };
}

async function bump(kv, key, unique) {
  const { metadata } = await kv.getWithMetadata(key);
  const m = { v: (metadata?.v || 0) + 1, u: (metadata?.u || 0) + (unique ? 1 : 0) };
  await kv.put(key, '', { metadata: m });
}

export async function onRequest({ request, env }) {
  const headers = { 'cache-control': 'no-store' };
  if (!env.COUNTER) return Response.json({ n: null }, { headers });
  let n = parseInt(await env.COUNTER.get('visitors') || '0', 10);
  if (request.method === 'POST') {
    let f = {};
    try { f = await request.json(); } catch (e) { f = { n: 1, d: 1, w: 1, m: 1 }; }   // old page: first visit
    const k = keys();
    await Promise.all([
      bump(env.COUNTER, 'd:' + k.day, f.d),
      bump(env.COUNTER, 'w:' + k.week, f.w),
      bump(env.COUNTER, 'm:' + k.month, f.m),
      f.n ? env.COUNTER.put('visitors', String(++n)) : null,
    ]);
  }
  return Response.json({ n, ...keys() }, { headers });
}
