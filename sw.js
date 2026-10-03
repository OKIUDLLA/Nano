/* Service worker: hra funguje offline (PWA). Při změně verze se cache obnoví. */
const CACHE = "veky-valky-remake-v1";
const FILES = [
  "./", "./index.html", "./css/style.css", "./manifest.webmanifest", "./icon.svg",
  "./js/data.js", "./js/engine.js", "./js/ai.js", "./js/sprites/common.js",
  "./js/sprites/age0.js", "./js/sprites/age1.js", "./js/sprites/age2.js", "./js/sprites/age3.js", "./js/sprites/age4.js",
  "./js/render.js", "./js/audio.js", "./js/ui.js", "./js/main.js",
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => hit))
  );
});
