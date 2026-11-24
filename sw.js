// CryptoPriceTicker service worker: makes the site installable and usable offline.
// Strategy is network-first for everything, so visitors always get the latest deploy;
// the cache is only a fallback when the network is unavailable. Exchange APIs are never cached.
const CACHE = "cpt-v3";
const CORE = ["/", "/assets/app.css?v=ddd49c57b9", "/assets/app.js?v=cbc39dfd69", "/assets/coins.js?v=2f6f199ef4", "/favicon.svg", "/brand/mark.svg", "/site.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Site assets carry a content hash (?v=…), so every release caches new copies. Once a new version
// of a file is stored, drop its older copies: the cache stays one release deep instead of growing.
const isAsset = url => url.pathname.startsWith("/assets/") && url.search;
// Pages (not the home page, assets or images, which are a fixed set): keep the newest MAX_PAGES (cache.keys()
// lists entries oldest first) so the cache can't grow with every page a visitor opens. Addresses with a query (?utm=…, ?c=…) are not stored: they would be duplicate copies.
const MAX_PAGES = 30;
const trimPages = cache => cache.keys().then(keys => {
  const pages = keys.map(k => [k, new URL(k.url).pathname]).filter(([, p]) => p !== "/" && (p.endsWith("/") || !/\.\w+$/.test(p))).map(([k]) => k);
  return Promise.all(pages.slice(0, Math.max(0, pages.length - MAX_PAGES)).map(k => cache.delete(k)));
});
const pruneOld = (cache, url) => cache.keys().then(keys => Promise.all(
  keys.filter(k => { const u = new URL(k.url); return u.pathname === url.pathname && u.search !== url.search; }).map(k => cache.delete(k))
));

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/embed/")) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && res.type === "basic" && (isAsset(url) || !url.search || req.mode !== "navigate")) {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(req, copy).then(() => (isAsset(url) ? pruneOld(cache, url) : trimPages(cache)))).catch(() => {}));
        }
        return res;
      })
      // Offline: the cached copy; for assets any cached version (an older cached page may ask for
      // a pruned one); for pages the same page without its query, else the cached home page.
      .catch(() => caches.match(req)
        .then(hit => hit || (isAsset(url) || req.mode === "navigate" ? caches.match(req, { ignoreSearch: true }) : undefined))
        .then(hit => hit || (req.mode === "navigate" ? caches.match("/") : Response.error())))
  );
});
