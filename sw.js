// ============================================================
// Service worker: rete prima di tutto, cache solo come riserva offline.
// Le chiamate a Supabase e agli altri domini non vengono mai toccate.
// ============================================================
// Cambiare il numero ad ogni modifica dei file: forza il download dei nuovi.
const CACHE_NAME = "kurashi-v3";
const APP_SHELL = [
  "./", "./index.html", "./css/style.css", "./manifest.json",
  "./js/config.js", "./js/util.js", "./js/demo.js", "./js/store.js", "./js/calc.js", "./js/charts.js",
  "./js/auth.js", "./js/ui.js", "./js/game.js", "./js/habits.js", "./js/goals.js", "./js/today.js", "./js/focus.js", "./js/dojo.js",
  "./js/body.js", "./js/reading.js", "./js/recall.js", "./js/insights.js", "./js/export.js", "./js/settings.js", "./js/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
