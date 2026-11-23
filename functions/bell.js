// GET /bell: the newest Bell Brief edition as JSON, from the Workers KV namespace bound to this Pages project as
// BELL (written by the cron Worker in scripts/bell-worker/). assets/bell.js asks for it only after a bell has
// passed that the static home page doesn't show yet, and swaps in the section's HTML when the edition is newer.
// Without the binding or before the first edition it answers 404, and the page keeps its static edition.
// Cached 30 s at the edge so a busy minute costs a handful of KV reads. No cookies, queries or visitor data.
const NOT_FOUND = () => new Response('{"error":"no edition"}', { status: 404, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });

export async function onRequest({ request, env, waitUntil }) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  if (!env.BELL) return NOT_FOUND();
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const key = new Request(new URL("/bell", request.url).toString());
  const hit = cache && (await cache.match(key));
  if (hit) return hit;
  const body = await env.BELL.get("bell");
  if (!body) return NOT_FOUND();
  const res = new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30", "x-robots-tag": "noindex", "x-content-type-options": "nosniff" } });
  if (cache) waitUntil(cache.put(key, res.clone()));
  return request.method === "HEAD" ? new Response(null, res) : res;
}
