// CryptoPriceTicker service worker: makes the site installable and usable offline.
// Strategy is network-first for everything, so visitors always get the latest deploy;
// the cache is only a fallback when the network is unavailable. Exchange APIs are never cached.
const CACHE = "cpt-v1";
const CORE = ["/", "/assets/app.css", "/assets/app.js", "/assets/coins.js", "/assets/theme-init.js", "/favicon.svg", "/site.webmanifest"];

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
