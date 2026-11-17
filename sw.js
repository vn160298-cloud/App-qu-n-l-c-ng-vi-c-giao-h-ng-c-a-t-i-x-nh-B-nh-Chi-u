// Service worker: cache vỏ ứng dụng để mở được khi mất mạng (dữ liệu nằm trong IndexedDB, không bị ảnh hưởng khi nâng cấp)
const CACHE = 'giaohang-bc-v5';
const SHELL = [
  './', './index.html', './geo.js', './core.js', './app.js', './views-ops.js', './views-field.js', './views-admin.js', './manifest.webmanifest', './version.json',
  './data/seed.json', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/nutrinest-logo.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  // Chỉ xử lý file của app, thư viện cdnjs và font; API đám mây (Apps Script, Supabase) và ô bản đồ đi thẳng
  const own = u.origin === self.location.origin, lib = u.hostname === 'cdnjs.cloudflare.com' || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (!own && !lib) return;
  if (own && u.pathname.endsWith('version.json')) return;           // luôn hỏi mạng để biết có bản mới
  // Network-first: luôn lấy bản mới nhất, mất mạng thì dùng bản đã lưu
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
