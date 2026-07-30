// Service Worker для Neiro-Max: Секретный штаб
// Стратегия: "сеть в приоритете, кэш как запасной вариант" — так приложение
// всегда старается показать самую свежую версию, но не остаётся совсем
// пустым экраном, если в моменте нет связи.

const CACHE_NAME = 'neiro-max-shq-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Данные штаба идут напрямую в Firebase — их никогда не кэшируем,
  // чтобы случайно не показать устаревшее состояние миссий/чата.
  if (req.url.includes('firebaseio.com') || req.url.includes('googleapis.com')) {
    return;
  }

  // Только GET-запросы имеет смысл кэшировать.
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
