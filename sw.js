// CryptoPriceTicker service worker: makes the site installable and usable offline.
// Strategy is network-first for everything, so visitors always get the latest deploy;
// the cache is only a fallback when the network is unavailable. Exchange APIs are never cached.
const CACHE = "cpt-v3";
const CORE = ["/", "/assets/app.css?v=58a01e2072", "/assets/app.js?v=c7ab6fc09a", "/assets/coins.js?v=88eae95f59", "/favicon.svg", "/brand/mark.svg", "/site.webmanifest"];

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

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/embed/")) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || (req.mode === "navigate" ? caches.match("/") : Response.error())))
  );
});
