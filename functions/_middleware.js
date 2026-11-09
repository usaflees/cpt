// Keeps the repository's working files (build scripts, notes, tests, content data, tooling config) off the
// public site. The repo root is the deploy folder, so without this every file in it is downloadable.
//
// Cloudflare runs this only for the paths listed in /_routes.json ("include"), so normal page, asset and
// image requests never invoke it and cost nothing. The same list is checked here as a safety net: if
// _routes.json were ever missing or wrong, every other path is passed straight through to the static site.
// It returns the site's own 404 page. It never reads cookies, queries or any visitor data.
//
// Keep the lists below and "include" in /_routes.json identical: scripts/seo-lint.mjs checks that they match,
// and scripts/check-live.mjs requests each blocked path on the deployed site.
const FOLDERS = ["/scripts", "/docs", "/content", "/tests", "/.claude", "/.github", "/functions"];
const FILES = ["/claude.md", "/readme.md", "/security.md", "/.gitignore"];

function isPrivate(rawPath) {
  let p = rawPath;
  try { p = decodeURIComponent(p); } catch (e) { /* keep the raw path */ }
  p = ("/" + p.replace(/\\/g, "/")).replace(/\/{2,}/g, "/").toLowerCase();
  return FILES.includes(p) || FOLDERS.some(f => p === f || p.startsWith(f + "/"));
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (!isPrivate(url.pathname)) return context.next();
  let body = "Not found", headers = { "content-type": "text/plain; charset=utf-8" };
  try {
    // Asking the static layer for a path that cannot exist returns the site's own 404.html (status 404).
    const page = await context.env.ASSETS.fetch(new URL("/__not-found__", url));
    if (page.status === 404 && /text\/html/.test(page.headers.get("content-type") || "")) {
      body = await page.text();
      headers = { "content-type": "text/html; charset=utf-8" };
    }
  } catch (e) { /* plain text fallback */ }
  return new Response(body, { status: 404, headers: { ...headers, "x-robots-tag": "noindex", "cache-control": "no-store" } });
}
