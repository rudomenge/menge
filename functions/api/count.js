// Visitor counter for the version label (top left). Each browser counts once:
// the page remembers it was counted in localStorage, no cookies, nothing personal is stored.
// Needs a KV namespace bound as COUNTER (Pages project > Settings > Bindings).
export async function onRequest({ request, env }) {
  const headers = { 'cache-control': 'no-store' };
  if (!env.COUNTER) return Response.json({ n: null }, { headers });
  let n = parseInt(await env.COUNTER.get('visitors') || '0', 10);
  if (request.method === 'POST') { n += 1; await env.COUNTER.put('visitors', String(n)); }
  return Response.json({ n }, { headers });
}
