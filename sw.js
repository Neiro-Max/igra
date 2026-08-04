// Service Worker для Neiro-Max: Секретный штаб
// Стратегия: "сеть в приоритете, кэш как запасной вариант" — так приложение
// всегда старается показать самую свежую версию, но не остаётся совсем
// пустым экраном, если в моменте нет связи.

const CACHE_NAME = 'neiro-max-shq-v8';
// Иконки перечислены по обоим возможным путям — в подпапке и в корне.
// Установка не атомарна (см. ниже), поэтому лишние промахи безвредны:
// закэшируется то, что реально есть.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Намеренно НЕ cache.addAll(): он атомарен, и один недостающий файл
      // отклоняет установку целиком — воркер тогда не ставится вообще, молча.
      // Кладём каждый ресурс отдельно: чего-то не хватило — остальное живёт.
      Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] не удалось закэшировать', url, err);
          })
        )
      )
    )
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

  // Кэшируем только свой домен и шрифты — чужие ответы (в т.ч. непрозрачные)
  // раздували бы хранилище без пользы.
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  const isFont = req.url.includes('fonts.gstatic.com') || req.url.includes('fonts.googleapis.com');
  if (!sameOrigin && !isFont) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type !== 'opaque') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
