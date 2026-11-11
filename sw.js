// CryptoPriceTicker service worker: makes the site installable and usable offline.
// Strategy is network-first for everything, so visitors always get the latest deploy;
// the cache is only a fallback when the network is unavailable. Exchange APIs are never cached.
const CACHE = "cpt-v3";
const CORE = ["/", "/assets/app.css?v=ba9e7f8467", "/assets/app.js?v=b892403d65", "/assets/coins.js?v=9e9cb3737b", "/favicon.svg", "/brand/mark.svg", "/site.webmanifest"];

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
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(req, copy).then(() => (isAsset(url) ? pruneOld(cache, url) : null))).catch(() => {}));
        }
        return res;
      })
      // Offline: the cached copy; for assets any cached version (an older cached page may ask for
      // a pruned one); for pages the cached home page.
      .catch(() => caches.match(req)
        .then(hit => hit || (isAsset(url) ? caches.match(req, { ignoreSearch: true }) : undefined))
        .then(hit => hit || (req.mode === "navigate" ? caches.match("/") : Response.error())))
  );
});
