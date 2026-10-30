// Service worker: cache vỏ ứng dụng để mở được khi mất mạng
const CACHE = 'giaohang-bc-v2';
const SHELL = [
  './', './index.html', './core.js', './app.js', './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Chỉ xử lý file của app và thư viện Excel; API đám mây (Google Apps Script, Supabase) đi thẳng
  if (!req.url.startsWith(self.location.origin) && !req.url.includes('cdnjs.cloudflare.com')) return;
  if (req.url.includes('/rest/v1/')) return;
  // Network-first cho file của app để luôn có bản mới, fallback cache khi offline
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && (req.url.startsWith(self.location.origin) || req.url.includes('cdnjs'))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
