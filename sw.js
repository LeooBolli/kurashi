// ============================================================
// Service worker: rete prima di tutto, cache solo come riserva offline.
// Le chiamate a Supabase e agli altri domini non vengono mai toccate.
// ============================================================
// Cambiare il numero ad ogni modifica dei file: forza il download dei nuovi.
const CACHE_NAME = "kurashi-v18";
const APP_SHELL = [
  "./", "./index.html", "./css/style.css", "./css/dashboard.css", "./css/views.css", "./manifest.json",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
  "./js/config.js", "./js/util.js", "./js/demo.js", "./js/store.js", "./js/calc.js", "./js/charts.js",
  "./js/auth.js", "./js/ui.js", "./js/shell.js", "./js/habits.js", "./js/goals.js", "./js/today.js", "./js/focus.js",
  "./js/body.js", "./js/food.js", "./js/plan-keto.js", "./js/reading.js", "./js/recall.js", "./js/insights.js", "./js/export.js", "./js/settings.js", "./js/app.js"
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
  const isPage = event.request.mode === "navigate";
  // "no-cache": chiede sempre al server se il file è cambiato (GitHub Pages altrimenti
  // lascerebbe usare per 10 minuti la copia vecchia nella cache del browser)
  event.respondWith(
    fetch(event.request.url, { cache: "no-cache", credentials: "same-origin" })
      .then((res) => {
        // in cache solo le risposte buone (mai pagine di errore)
        if (res.ok && !isPage) {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)));
        }
        return res.ok || !isPage ? res : caches.match("./index.html").then((r) => r || res);
      })
      .catch(async () => (await caches.match(event.request, { ignoreSearch: isPage })) || (isPage ? caches.match("./index.html") : Response.error()))
  );
});
