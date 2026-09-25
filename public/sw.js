/* Service worker do site (PWA).
   Regra de ouro: o site sempre vem da internet (assim toda atualização aparece na hora).
   Só guardamos no aparelho arquivos que não mudam (scripts com hash, fontes, ícones) e uma tela "sem conexão".
   Nunca guardamos: páginas, dados do aluno, chamadas /api, Supabase, vídeos. */
const VERSION = "v1";
const CACHE = `ha-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/assets/logo-ha.png"];

// arquivos gerados pelo build têm o hash no nome (index-AbC123xy.js): nunca mudam, então podem ficar guardados
const HASHED = /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?)$/;
const STATIC_IMAGES = /\.(?:png|webp|jpe?g|svg|ico)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("ha-static-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

// mostra o que já está guardado e, em paralelo, busca a versão nova para a próxima vez
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, Mux, InfinitePay e afins passam direto
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) return;

  // páginas: sempre da internet; sem conexão, mostra a tela "sem conexão"
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (HASHED.test(url.pathname) || url.pathname.startsWith("/fonts/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (STATIC_IMAGES.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
