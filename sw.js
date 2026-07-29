/**
 * Pocketbook's service worker.
 *
 * Two caches, on purpose:
 *
 *  - the shell (a few hundred KB) is precached on install, so the app opens
 *    instantly and works with no connection at all;
 *  - the OCR engine and PDF reader under /vendor (~17 MB) are cached on first
 *    use instead, so installing the app doesn't mean waiting on a download the
 *    user may never need. Settings can warm this deliberately.
 *
 * Neither cache ever holds a document. Documents live in IndexedDB and are
 * never sent anywhere.
 */

const VERSION = 'v1';
const SHELL = `pocketbook-shell-${VERSION}`;
const VENDOR = `pocketbook-vendor-${VERSION}`;
const KEEP = new Set([SHELL, VENDOR]);

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/app.css',
  './fonts/fonts.css',
  './fonts/BricolageGrotesque-var-latin.woff2',
  './fonts/BricolageGrotesque-var-latin-ext.woff2',
  './fonts/InstrumentSans-var-latin.woff2',
  './fonts/InstrumentSans-var-latin-ext.woff2',
  './fonts/DMMono-400-latin.woff2',
  './fonts/DMMono-400-latin-ext.woff2',
  './fonts/DMMono-500-latin.woff2',
  './fonts/DMMono-500-latin-ext.woff2',
  './assets/icon.svg',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/maskable-512.png',
  './src/main.js',
  './src/db.js',
  './src/store.js',
  './src/extract.js',
  './src/query.js',
  './src/images.js',
  './src/ocr.js',
  './src/pdf.js',
  './src/crypto.js',
  './src/backup.js',
  './src/samples.js',
  './src/ui/dom.js',
  './src/ui/sheets.js',
  './src/ui/rows.js',
  './src/ui/ask.js',
  './src/ui/documents.js',
  './src/ui/review.js',
  './src/ui/detail.js',
  './src/ui/capture.js',
  './src/ui/settings.js',
  './src/ui/lock.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // addAll is all-or-nothing; one 404 during development would leave the app
    // with no cache at all, so each asset is added on its own.
    await Promise.all(SHELL_ASSETS.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (err) {
        console.warn('[sw] could not precache', url, err);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !KEEP.has(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/** Serve from cache immediately, refresh in the background for next time. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return hit || (await network) || new Response('Offline', { status: 503, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html', { cacheName: SHELL });
      if (cached) {
        event.waitUntil((async () => {
          try {
            const fresh = await fetch('./index.html', { cache: 'reload' });
            if (fresh.ok) (await caches.open(SHELL)).put('./index.html', fresh);
          } catch { /* offline is the normal case here */ }
        })());
        return cached;
      }
      try {
        return await fetch(request);
      } catch {
        return new Response('Pocketbook is offline and has not been installed yet.', {
          status: 503, headers: { 'Content-Type': 'text/plain' },
        });
      }
    })());
    return;
  }

  // The engine never changes for a given release — take the cached copy.
  if (url.pathname.includes('/vendor/')) {
    event.respondWith(cacheFirst(request, VENDOR));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, SHELL));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
