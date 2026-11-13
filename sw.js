// Bump this version whenever a file in the precache changes.
const CACHE_VERSION = 55;
const scope = new URL(self.registration.scope);
const cachePrefix = `aftersave::${scope.href}::v`;
const cacheName = `${cachePrefix}${CACHE_VERSION}`;
const mapCacheName = `aftersave::${scope.href}::boss-maps`;
const mapPath = new URL('./assets/elden-ring/maps/', scope).href;
const portraitPath = new URL('./assets/elden-ring/bosses/', scope).href;
const indexURL = new URL('./index.html', scope).href;
const coverIds = [
  'elden-ring', 'days-gone', 'deadpool', 'ets2', 'cyberpunk-2077', 'hollow-knight',
  'hades', 'disco-elysium', 'red-dead-redemption-2', 'control', 'witcher-3', 'baldur-gate-3',
];
const precache = new Set([
  './index.html', './styles.css', './app.js', './data.js', './icons.js', './steam.js', './cloud.js', './activity-view.js', './elden-ring.js', './elden-ring-art.js', './manifest.webmanifest',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
  './assets/profile-header.webp', './assets/achievements-hero.webp',
  './assets/apple-touch-icon.png', './assets/elden-ring-hero.jpg', './assets/witcher-3-achievements.json', './assets/elden-ring-achievements.json',
  './assets/fonts/manrope-latin.woff2', './assets/fonts/manrope-cyrillic.woff2',
  ...coverIds.map(id => `./assets/covers/${id}.jpg`),
].map(path => new URL(path, scope).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...precache].map(url => new Request(url, { cache: 'reload' })));
    // A waiting worker cannot replace a cache-first worker while PWA tabs remain open.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const oldNames = (await caches.keys()).filter(name =>
      name.startsWith(cachePrefix) && name !== cacheName
    );
    const previousName = cachePrefix + '7';
    if (oldNames.includes(previousName)) {
      const previous = await caches.open(previousName);
      const maps = await caches.open(mapCacheName);
      await Promise.all((await previous.keys()).filter(request => request.url.startsWith(mapPath)).map(async request => {
        const image = await previous.match(request);
        if (image) await maps.put(request, image).catch(() => {});
      }));
    }
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
  const bossMap = ['image', 'document'].includes(request.destination) && path.startsWith(mapPath) && url.pathname.endsWith('.webp');
  const bossPortrait = request.destination === 'image' && path.startsWith(portraitPath) && url.pathname.endsWith('.jpg');
  if (!precache.has(path) && !bossMap && !bossPortrait) return;
  const shellAsset = precache.has(path) && (
    request.mode === 'navigate' || ['script', 'style'].includes(request.destination)
  );
  event.respondWith(caches.open(bossMap ? mapCacheName : cacheName).then(async cache => {
    if (shellAsset) {
      // Prefer the latest deployed application code, but keep offline fallback.
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (!response.ok) throw new Error('App update unavailable');
        await cache.put(path, response.clone()).catch(() => {});
        return response;
      } catch {
        return await cache.match(path) || Response.error();
      }
    }
    const cached = await cache.match(path);
    if (cached) return cached;
    const response = await fetch(request);
    if ((bossMap || bossPortrait) && response.ok) {
      await cache.put(path, response.clone()).catch(() => {});
    }
    return response;
  }));
});
