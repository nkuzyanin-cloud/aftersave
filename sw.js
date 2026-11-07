// Bump this version whenever a file in the precache changes.
const CACHE_VERSION = 7;
const scope = new URL(self.registration.scope);
const cachePrefix = `aftersave::${scope.href}::v`;
const cacheName = `${cachePrefix}${CACHE_VERSION}`;
const indexURL = new URL('./index.html', scope).href;
const coverIds = [
  'elden-ring', 'days-gone', 'deadpool', 'ets2', 'cyberpunk-2077', 'hollow-knight',
  'hades', 'disco-elysium', 'red-dead-redemption-2', 'control', 'witcher-3', 'baldur-gate-3',
];
const precache = new Set([
  './index.html', './styles.css', './app.js', './data.js', './icons.js', './steam.js', './cloud.js', './elden-ring.js', './manifest.webmanifest',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
  './assets/apple-touch-icon.png', './assets/elden-ring-hero.jpg', './assets/witcher-3-achievements.json',
  './assets/fonts/manrope-latin.woff2', './assets/fonts/manrope-cyrillic.woff2',
  ...coverIds.map(id => `./assets/covers/${id}.jpg`),
].map(path => new URL(path, scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll([...precache].map(url => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const oldNames = (await caches.keys()).filter(name =>
      name.startsWith(cachePrefix) && name !== cacheName
    );
    await Promise.all(oldNames.map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin) return;
  url.search = '';
  url.hash = '';

  // Hash routing shares the same entry point on GitHub Pages and offline.
  const path = request.mode === 'navigate' && url.href === scope.href
    ? indexURL
    : url.href;
  const bossMap = request.destination === 'image' &&
    path.startsWith(new URL('./assets/elden-ring/maps/', scope).href) && url.pathname.endsWith('.webp');
  if (!precache.has(path) && !bossMap) return;
  event.respondWith(caches.open(cacheName).then(async cache => {
    const cached = await cache.match(path);
    if (cached) return cached;
    const response = await fetch(request);
    if (bossMap && response.ok) {
      await cache.put(path, response.clone()).catch(() => {});
    }
    return response;
  }));
});
