'use strict';
/* =====================================================================
   App quản lý công việc giao hàng của tài xế nhà Bình Chiểu
   core.js — hằng số, lưu trữ (IndexedDB + đồng bộ đám mây Supabase),
   phân quyền, nhật ký, thuật toán tối ưu tuyến & chia đều thời gian, Excel
   ===================================================================== */

const APP_NAME = 'App quản lý công việc giao hàng của tài xế nhà Bình Chiểu';

const ROLES = { admin: 'Quản trị (Admin)', dieuphoi: 'Điều phối', taixe: 'Tài xế', ketoan: 'Kế toán / Đối soát' };

// Trạng thái đơn giao: [nhãn, màu badge]
const OST = {
  cho_phan_cong:   ['Chờ phân công', 'gray'],
  da_phan_cong:    ['Đã phân công', 'blue'],
  da_nhan:         ['Tài xế đã nhận', 'vio'],
  dang_giao:       ['Đang giao', 'org'],
  da_den:          ['Đã đến điểm', 'blue'],
  giao_thanh_cong: ['Giao TC – chờ Admin duyệt', 'yel'],
  giao_that_bai:   ['Không giao được', 'red'],
  hoan_tat:        ['Hoàn tất (Admin đã duyệt)', 'grn'],
};
// Trạng thái chuyến giao
const TST = {
  moi:            ['Mới tạo', 'gray'],
  da_nhan:        ['Tài xế đã nhận', 'vio'],
  dang_len_hang:  ['Đang lên hàng', 'yel'],
  dang_di_chuyen: ['Đang di chuyển', 'org'],
  hoan_thanh:     ['Đã về kho', 'grn'],
  huy:            ['Đã hủy', 'red'],
};
const DONE_ST = ['giao_thanh_cong', 'giao_that_bai', 'hoan_tat'];
const OK_ST = ['giao_thanh_cong', 'hoan_tat'];
const FAIL_REASONS = ['Khách vắng / không liên lạc được', 'Khách hẹn giao lại', 'Khách từ chối nhận', 'Sai địa chỉ', 'Hàng hư hỏng / thiếu', 'Không kịp thời gian', 'Xe hỏng / sự cố', 'Khác'];
const PHOTO_KINDS = ['Lên hàng', 'Giao thành công', 'Không giao được', 'Chứng từ / hóa đơn', 'Khác'];
const TIME_WINDOWS = ['Cả ngày', '07:00-09:00', '08:00-10:00', '09:00-11:00', '10:00-12:00', '13:00-15:00', '14:00-16:00', '15:00-17:00', '16:00-18:00'];
const VEHICLE_TYPES = ['Xe máy', 'Xe ba gác', 'Xe tải 500kg', 'Xe tải 1.25 tấn', 'Xe tải 2.5 tấn', 'Xe tải 5 tấn'];

// Quyền theo vai trò
const PERMS = {
  admin:    ['*'],
  dieuphoi: ['order.edit', 'trip.edit', 'assign', 'catalog.edit', 'import', 'export', 'photo', 'report', 'view.all'],
  taixe:    ['driver', 'photo'],
  ketoan:   ['settle', 'export', 'report', 'view.all'],
};
const can = p => !!ME && (PERMS[ME.role].includes('*') || PERMS[ME.role].includes(p));
const isAdmin = () => ME && ME.role === 'admin';

/* ---------- Tiện ích ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nowISO = () => new Date().toISOString();
const z2 = n => String(n).padStart(2, '0');
function localDate(d) { return `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`; }
const today = () => localDate(new Date());
function hhmm(min) { min = Math.round(min); return `${z2(Math.floor(min / 60) % 24)}:${z2(min % 60)}`; }
const toMin = s => { if (!s) return null; const [h, m] = String(s).split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
const fmtT = iso => iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—';
const fmtHM = iso => iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
const fmtDT = iso => iso ? `${fmtD(localDate(new Date(iso)))} ${fmtT(iso)}` : '';
const fmtD = ymd => ymd ? String(ymd).split('-').reverse().join('/') : '';
const money = n => (Math.round(Number(n) || 0)).toLocaleString('vi-VN') + ' đ';
const num = n => (Number(n) || 0).toLocaleString('vi-VN');
const durTxt = min => min == null || isNaN(min) ? '—' : `${Math.floor(min / 60)}h${z2(Math.round(min % 60))}`;
const minsBetween = (a, b) => a && b ? (new Date(b) - new Date(a)) / 60000 : null;
const isoMinOfDay = iso => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
const winStart = o => { const m = /^(\d{1,2}:\d{2})/.exec(o.timeWindow || ''); return m ? toMin(m[1]) : null; };
const winEnd = o => { const m = /-(\d{1,2}:\d{2})$/.exec(o.timeWindow || ''); return m ? toMin(m[1]) : null; };
const isDone = o => DONE_ST.includes(o.status);
const badge = (map, k) => { const v = map[k] || [k, 'gray']; return `<span class="bd ${v[1]}">${esc(v[0])}</span>`; };
const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(v) === String(cur ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
function selectHTML(name, items, cur, { empty, attrs = '' } = {}) {
  return `<select name="${name}" ${attrs}>${empty != null ? opt('', empty, cur) : ''}${items.map(([v, l]) => opt(v, l, cur)).join('')}</select>`;
}
function formData(root) {
  const o = {};
  root.querySelectorAll('[name]').forEach(el => {
    if (el.type === 'file') return;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else o[el.name] = el.value.trim();
  });
  return o;
}
function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}

/* ---------- IndexedDB ---------- */
const IDB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('giaohang-binhchieu', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('photos'); };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  req(store, mode, fn) {
    return new Promise((res, rej) => {
      const q = fn(this.db.transaction(store, mode).objectStore(store));
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  },
  get(store, key) { return this.req(store, 'readonly', s => s.get(key)); },
  put(store, key, val) { return this.req(store, 'readwrite', s => s.put(val, key)); },
  clear(store) { return this.req(store, 'readwrite', s => s.clear()); },
  del(store, key) { return this.req(store, 'readwrite', s => s.delete(key)); },
};

/* ---------- Kho dữ liệu ---------- */
const COLLS = ['users', 'customers', 'routes', 'vehicles', 'orders', 'trips', 'logs', 'settlements', 'settings'];
let DB = {};
let ME = null;
const dirty = new Set(); let saveTimer = null;

function persist(coll) { dirty.add(coll); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 150); }
async function flush() { const cs = [...dirty]; dirty.clear(); for (const c of cs) await IDB.put('kv', c, DB[c]); }
const byId = (coll, id) => DB[coll].find(r => r.id === id);
function upsert(coll, rec) {
  rec._u = nowISO();
  const i = DB[coll].findIndex(r => r.id === rec.id);
  if (i >= 0) DB[coll][i] = rec; else DB[coll].push(rec);
  persist(coll); Cloud.queue(coll, rec);
  return rec;
}
function removeRec(coll, id) {
  DB[coll] = DB[coll].filter(r => r.id !== id);
  persist(coll); Cloud.queue(coll, { id, _deleted: true, _u: nowISO() });
}
const S = () => DB.settings[0];
const userName = id => byId('users', id)?.name || (id ? id : '—');
const drivers = (all = false) => DB.users.filter(u => u.role === 'taixe' && (all || u.active !== false));
const admins = () => DB.users.filter(u => u.role === 'admin' && u.active !== false);
const custOf = code => byId('customers', code);
const tripOrders = t => DB.orders.filter(o => o.tripCode === t.code).sort((a, b) => (a.seq || 999) - (b.seq || 999));

// Nhật ký thao tác — ghi mọi thay đổi quan trọng
function log(action, entity = '', detail = '', gps = null) {
  const rec = { id: uid(), t: nowISO(), userId: ME?.id || 'system', userName: ME?.name || 'Hệ thống', role: ME?.role || '', action, entity, detail };
  if (gps) rec.gps = gps;
  upsert('logs', rec);
}

// Mã duy nhất: DH250130-001 (đơn), CH250130-01 (chuyến)
function nextCode(prefix, date, coll, pad = 3) {
  const pre = `${prefix}${date.replace(/-/g, '').slice(2)}-`;
  const n = DB[coll].filter(r => r.id.startsWith(pre)).map(r => parseInt(r.id.slice(pre.length), 10) || 0).reduce((a, b) => Math.max(a, b), 0);
  return pre + String(n + 1).padStart(pad, '0');
}

async function hashPin(id, pin) {
  const txt = `bc-giaohang:${id}:${pin}`;
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return 'plain:' + txt;
}

/* ---------- Dữ liệu mẫu ---------- */
const defaultSettings = () => ({ id: 'main', depot: { name: 'Kho nhà Bình Chiểu', address: 'P. Bình Chiểu, TP. Thủ Đức, TP.HCM', lat: 10.8822, lng: 106.7287 },
  speedKmh: 22, roadFactor: 1.35, loadMin: 30, defaultServiceMin: 10, startTime: '07:30', requirePhoto: true, missingCoordMin: 12, retentionMonths: 3 });
async function seedDemo() {
  const t = today();
  const st = defaultSettings();
  const users = [
    ['AD01', 'Admin Bình Chiểu', 'admin', '', ''],
    ['DP01', 'Điều phối Lan', 'dieuphoi', '', ''],
    ['KT01', 'Kế toán Hoa', 'ketoan', '', ''],
    ['TX01', 'Tài xế Hùng', 'taixe', '0901000001', '51C-123.45'],
    ['TX02', 'Tài xế Nam', 'taixe', '0901000002', '51C-234.56'],
    ['TX03', 'Tài xế Phúc', 'taixe', '0901000003', '51D-345.67'],
    ['TX04', 'Tài xế Tâm', 'taixe', '0901000004', '59-X1 456.78'],
  ];
  DB.users = [];
  for (const [id, name, role, phone, vehicle] of users)
    DB.users.push({ id, name, role, phone, vehicle, active: true, pinHash: await hashPin(id, '1234'), _u: nowISO() });
  DB.routes = [
    { id: 'T1', code: 'T1', name: 'Bình Chiểu – Tam Bình – Tam Phú', area: 'TP. Thủ Đức' },
    { id: 'T2', code: 'T2', name: 'Linh Xuân – Linh Trung – Linh Tây', area: 'TP. Thủ Đức' },
    { id: 'T3', code: 'T3', name: 'Dĩ An – Đông Hòa – Tân Đông Hiệp', area: 'Bình Dương' },
    { id: 'T4', code: 'T4', name: 'Hiệp Bình – Thủ Đức trung tâm', area: 'TP. Thủ Đức' },
  ];
  DB.vehicles = [
    { id: '51C-123.45', plate: '51C-123.45', type: 'Xe tải 1.25 tấn', capacityKg: 1250 },
    { id: '51C-234.56', plate: '51C-234.56', type: 'Xe tải 1.25 tấn', capacityKg: 1250 },
    { id: '51D-345.67', plate: '51D-345.67', type: 'Xe tải 500kg', capacityKg: 500 },
    { id: '59-X1 456.78', plate: '59-X1 456.78', type: 'Xe ba gác', capacityKg: 300 },
  ];
  const cs = [
    ['KH001', 'Tạp hóa Minh Châu', 'T1', '08:00-10:00', 10.8665, 106.7340, 'Đường Tam Bình, P. Tam Bình'],
    ['KH002', 'Cửa hàng Hoa Mai', 'T1', 'Cả ngày', 10.8580, 106.7420, 'Đường Tam Phú, P. Tam Phú'],
    ['KH003', 'Đại lý Thành Công', 'T1', '13:00-15:00', 10.8900, 106.7300, 'KCN Bình Chiểu'],
    ['KH004', 'Siêu thị mini An Phát', 'T2', '08:00-10:00', 10.8770, 106.7720, 'QL1K, P. Linh Xuân'],
    ['KH005', 'Quán ăn Bếp Nhà', 'T2', '09:00-11:00', 10.8600, 106.7780, 'Đường Linh Trung'],
    ['KH006', 'Nhà thuốc Phúc Khang', 'T2', 'Cả ngày', 10.8560, 106.7590, 'Đường Linh Tây'],
    ['KH007', 'Cửa hàng Tiện Lợi 24h', 'T3', '07:00-09:00', 10.9050, 106.7690, 'TP. Dĩ An'],
    ['KH008', 'Đại lý Hưng Thịnh', 'T3', '14:00-16:00', 10.8930, 106.7880, 'P. Đông Hòa, Dĩ An'],
    ['KH009', 'Tạp hóa Kim Ngân', 'T3', 'Cả ngày', 10.9200, 106.7600, 'P. Tân Đông Hiệp, Dĩ An'],
    ['KH010', 'Nhà hàng Sông Sài Gòn', 'T4', '10:00-12:00', 10.8330, 106.7270, 'P. Hiệp Bình Chánh'],
    ['KH011', 'Cửa hàng Bảo Ngọc', 'T4', '15:00-17:00', 10.8450, 106.7150, 'P. Hiệp Bình Phước'],
    ['KH012', 'Chợ Thủ Đức – sạp 25', 'T4', '07:00-09:00', 10.8500, 106.7550, 'Chợ Thủ Đức'],
  ];
  DB.customers = cs.map(([code, name, route, tw, lat, lng, address], i) => ({ id: code, code, name, route, timeWindow: tw, lat, lng, address, phone: '0908' + String(100000 + i * 1371).slice(0, 6), serviceMin: 10, note: '' }));
  DB.orders = []; DB.trips = []; DB.logs = []; DB.settlements = [];
  DB.settings = [st];
  const items = ['Gạo 10 bao', 'Nước suối 20 thùng', 'Dầu ăn 12 can', 'Mì gói 15 thùng', 'Đường 8 bao', 'Bia 10 két', 'Nước ngọt 25 thùng', 'Sữa 6 thùng'];
  DB.customers.forEach((c, i) => {
    const code = nextCode('DH', t, 'orders');
    DB.orders.push(orderFromCustomer({ id: code, code, date: t, items: items[i % items.length], weightKg: 50 + (i * 37) % 200, cod: (i % 3 === 0 ? 0 : (1 + i % 5) * 850000) }, c));
  });
  DB.orders.forEach(o => { o.status = 'cho_phan_cong'; o.createdAt = nowISO(); o.createdBy = 'system'; });
  for (const c of COLLS) DB[c].forEach(r => { r._u = r._u || nowISO(); });
  for (const c of COLLS) persist(c);
  await flush();
}

function orderFromCustomer(o, c) {
  return Object.assign(o, { customerCode: c.code, customerName: c.name, phone: c.phone, address: c.address, route: c.route, timeWindow: c.timeWindow, serviceMin: Number(c.serviceMin) || S()?.defaultServiceMin || 10, lat: c.lat ?? null, lng: c.lng ?? null });
}

async function loadAll() {
  await IDB.open();
  for (const c of COLLS) DB[c] = (await IDB.get('kv', c)) || [];
  // Đã kết nối đám mây thì không nạp dữ liệu mẫu – sẽ tải dữ liệu thật của công ty
  if (!DB.users.length && !Cloud.enabled()) await seedDemo();
  if (!DB.settings.length) DB.settings = [defaultSettings()];
}
// Máy mới tham gia dữ liệu công ty: xóa dữ liệu mẫu trên máy rồi tải toàn bộ từ đám mây
async function wipeLocalData() {
  for (const c of COLLS) { DB[c] = []; persist(c); }
  DB.settings = [defaultSettings()]; persist('settings');
  Cloud.q.clear(); await IDB.put('kv', '_queue', []); await IDB.clear('photos'); await flush();
}

/* ---------- Ảnh (nén + đóng dấu thời gian) ---------- */
function compressImage(file, stamp, max = 1280, q = 0.72) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width, h = img.height; const s = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * s); h = Math.round(h * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
      const fs = Math.max(14, Math.round(w / 45));
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, h - fs * 2, w, fs * 2);
      ctx.fillStyle = '#fff'; ctx.font = `bold ${fs}px sans-serif`; ctx.fillText(stamp, 10, h - fs * 0.65);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Không đọc được ảnh')); };
    img.src = url;
  });
}
async function savePhotos(order, dataURLs, kind) {
  order.photos = order.photos || [];
  for (const data of dataURLs) {
    const id = 'P' + uid();
    await IDB.put('photos', id, data);
    Cloud.queue('photos', { id, data, order: order.code, date: order.date, kind, _u: nowISO() });
    order.photos.push({ id, kind, t: nowISO(), by: ME.id });
  }
}
async function getPhoto(id) {
  let d = await IDB.get('photos', id);
  if (!d && Cloud.enabled()) { d = await Cloud.fetchPhoto(id); if (d) await IDB.put('photos', id, d); }
  return d;
}
async function hydratePhotos(root) {
  for (const img of root.querySelectorAll('img[data-photo]')) {
    if (img.dataset.loaded) continue; img.dataset.loaded = 1;
    getPhoto(img.dataset.photo).then(d => { if (d) img.src = d; else img.alt = 'Chưa tải'; });
  }
}

/* ---------- GPS (ghi kèm mỗi lần check-in) ---------- */
function getGPS() {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) }),
      () => res(null), { enableHighAccuracy: true, timeout: 7000, maximumAge: 20000 });
  });
}
const gpsLink = g => g ? `<a href="https://www.google.com/maps?q=${g.lat},${g.lng}" target="_blank" rel="noopener" class="small">📍±${g.acc}m</a>` : '';

/* =====================================================================
   TỐI ƯU TUYẾN & CHIA ĐỀU THỜI GIAN
   - Khoảng cách: đường chim bay (Haversine) × hệ số đường phố
   - Tuyến: ưu tiên khách hẹn buổi sáng trước, buổi chiều sau; trong mỗi
     buổi dùng Nearest-Neighbor + 2-opt để ra đường ngắn nhất; khách "Cả ngày"
     được chèn vào vị trí ít tốn đường nhất.
   - Chia việc: tham lam LPT + tìm kiếm cục bộ, giảm thời gian của người
     nhiều việc nhất cho tới khi các tài xế gần bằng nhau.
   ===================================================================== */
const depotPt = () => S().depot;
const hasXY = p => p && p.lat != null && p.lng != null && p.lat !== '' && p.lng !== '';
function km(a, b) {
  if (!hasXY(a) || !hasXY(b)) return null;
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * (S().roadFactor || 1.35);
}
function travelMin(a, b) {
  if (a === b) return 0;
  const d = km(a, b);
  return d == null ? (S().missingCoordMin || 12) : d / (S().speedKmh || 22) * 60;
}
const svcMin = o => Number(o.serviceMin) || S().defaultServiceMin || 10;
function pathCost(start, pts) { let c = 0, p = start; for (const q of pts) { c += travelMin(p, q); p = q; } return c; }
function nearestNeighbor(start, list) {
  const rest = [...list], out = []; let p = start;
  while (rest.length) {
    let bi = 0, bd = Infinity;
    rest.forEach((q, i) => { const d = travelMin(p, q); if (d < bd) { bd = d; bi = i; } });
    p = rest.splice(bi, 1)[0]; out.push(p);
  }
  return out;
}
function twoOpt(start, arr) {
  let best = arr.slice(), bestC = pathCost(start, best), improved = true, it = 0;
  while (improved && it++ < 40) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) for (let k = i + 1; k < best.length; k++) {
      const cand = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
      const c = pathCost(start, cand);
      if (c + 1e-6 < bestC) { best = cand; bestC = c; improved = true; }
    }
  }
  return best;
}
function optimizeRoute(list, start = depotPt(), fast = false) {
  const flex = list.filter(o => winStart(o) == null);
  const am = list.filter(o => winStart(o) != null && winStart(o) < 720);
  const pm = list.filter(o => winStart(o) != null && winStart(o) >= 720);
  const seq = []; let p = start;
  for (const part of [am, pm]) {
    if (!part.length) continue;
    let s = nearestNeighbor(p, part); if (!fast) s = twoOpt(p, s);
    seq.push(...s); p = s[s.length - 1];
  }
  for (const o of (fast ? flex : nearestNeighbor(start, flex))) {
    let bi = seq.length, bc = Infinity;
    for (let i = 0; i <= seq.length; i++) {
      const a = i === 0 ? start : seq[i - 1], b = seq[i];
      const c = travelMin(a, o) + (b ? travelMin(o, b) - travelMin(a, b) : 0);
      if (c < bc) { bc = c; bi = i; }
    }
    seq.splice(bi, 0, o);
  }
  if (!fast && !am.length && !pm.length) return twoOpt(start, seq);
  return seq;
}
// Tổng thời gian 1 chuyến (lên hàng + chạy + giao + về kho), dùng để cân bằng
function tourMinutes(orders, fast = true) {
  if (!orders.length) return 0;
  const seq = optimizeRoute(orders, depotPt(), fast);
  return (S().loadMin || 0) + pathCost(depotPt(), seq) + travelMin(seq[seq.length - 1], depotPt()) + seq.reduce((s, o) => s + svcMin(o), 0);
}
// Lập lịch chi tiết: thứ tự, giờ đến dự kiến, km, giờ về kho
function scheduleSeq(seq, plannedStart) {
  let t = toMin(plannedStart || S().startTime) + (S().loadMin || 0), p = depotPt(), dist = 0, wait = 0;
  const rows = seq.map((o, i) => {
    const tr = travelMin(p, o); dist += km(p, o) || 0;
    let arr = t + tr; const ws = winStart(o);
    if (ws != null && arr < ws) { wait += ws - arr; arr = ws; }
    t = arr + svcMin(o); p = o;
    return { o, seq: i + 1, eta: hhmm(arr), late: winEnd(o) != null && arr > winEnd(o) };
  });
  if (seq.length) { t += travelMin(p, depotPt()); dist += km(p, depotPt()) || 0; }
  const start = toMin(plannedStart || S().startTime);
  // work = thời gian làm việc thực (không tính chờ khung giờ khách) → dùng để so sánh/cân bằng
  return { rows, end: hhmm(t), totalMin: t - start, work: Math.round(t - start - wait), km: Math.round(dist * 10) / 10, wait: Math.round(wait) };
}
// Chia đơn cho tài xế sao cho tổng thời gian mỗi người gần bằng nhau
function balanceOrders(orders, driverIds, baseline = {}) {
  const g = driverIds.map(id => ({ id, os: [], base: baseline[id] || 0, t: baseline[id] || 0 }));
  if (!g.length) return g;
  const solo = o => svcMin(o) + 2 * travelMin(depotPt(), o);
  const calc = x => x.base + tourMinutes(x.os);
  [...orders].sort((a, b) => solo(b) - solo(a)).forEach(o => {
    let best = null, bestT = Infinity;
    for (const x of g) { const t = x.base + tourMinutes([...x.os, o]); if (t < bestT) { bestT = t; best = x; } }
    // Chọn người hiện ít việc nhất nếu chênh lệch lớn; ngược lại chọn người ghép tuyến hiệu quả nhất
    const minG = g.reduce((a, b) => a.t <= b.t ? a : b);
    const target = (best.t - minG.t > 25) ? minG : best;
    target.os.push(o); target.t = calc(target);
  });
  for (let it = 0; it < 400; it++) {
    g.sort((a, b) => b.t - a.t);
    const hi = g[0]; let moved = false;
    for (let j = g.length - 1; j > 0 && !moved; j--) {
      const lo = g[j]; let bestO = null, bestMax = hi.t;
      for (const o of hi.os) {
        const hT = hi.base + tourMinutes(hi.os.filter(x => x !== o)), lT = lo.base + tourMinutes([...lo.os, o]);
        const m = Math.max(hT, lT); if (m < bestMax - 0.5) { bestMax = m; bestO = o; }
      }
      if (bestO) { hi.os = hi.os.filter(x => x !== bestO); lo.os.push(bestO); hi.t = calc(hi); lo.t = calc(lo); moved = true; }
    }
    if (!moved) break;
  }
  return g;
}
// Lập lại thứ tự & ETA cho một chuyến đã tạo
function planTrip(t, reorder = true) {
  const os = tripOrders(t);
  let seq = os;
  if (reorder) {
    const done = os.filter(o => isDone(o) || o.status === 'da_den');
    const rest = os.filter(o => !done.includes(o));
    const start = done.length ? done[done.length - 1] : depotPt();
    seq = [...done, ...optimizeRoute(rest, hasXY(start) ? start : depotPt())];
  }
  const sch = scheduleSeq(seq, t.plannedStart);
  sch.rows.forEach(r => { if (r.o.seq !== r.seq || r.o.eta !== r.eta) { r.o.seq = r.seq; r.o.eta = r.eta; upsert('orders', r.o); } });
  t.planEnd = sch.end; t.planMin = sch.work; t.planWait = sch.wait; t.planKm = sch.km;
  upsert('trips', t);
  return sch;
}
// Link Google Maps chỉ đường (tối đa 9 điểm dừng mỗi link)
function mapsLinks(seq) {
  const d = depotPt(), pt = o => hasXY(o) ? `${o.lat},${o.lng}` : encodeURIComponent(o.address || '');
  const links = []; let origin = hasXY(d) ? `${d.lat},${d.lng}` : encodeURIComponent(d.address);
  for (let i = 0; i < seq.length; i += 10) {
    const chunk = seq.slice(i, i + 10), dest = chunk[chunk.length - 1];
    const wps = chunk.slice(0, -1).map(pt).join('|');
    links.push(`https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${origin}&destination=${pt(dest)}${wps ? '&waypoints=' + wps : ''}`);
    origin = pt(dest);
  }
  return links;
}

/* =====================================================================
   ĐỒNG BỘ ĐÁM MÂY — 2 lựa chọn:
   • Google Sheet (Apps Script, file google-apps-script/Code.gs): mỗi bảng 1 sheet
     với cột chuẩn hóa + DATA_JSON; ảnh lưu Google Drive, link ở sheet ANH.
   • Supabase (bảng bc_records, file supabase-schema.sql).
   Đẩy thay đổi theo hàng đợi (chạy được khi mất mạng), kéo về định kỳ.
   ===================================================================== */
const sheetName = coll => (XL[coll] && XL[coll].sheet) || { settings: 'CAI_DAT', photos: 'ANH' }[coll] || coll.toUpperCase();
function sheetView(coll, rec) {
  if (rec._deleted) return {};
  if (coll === 'photos') return {};
  if (!XL[coll]) return {};
  const v = toXlRows(coll, [rec])[0];
  if (coll === 'orders') v.SO_ANH = (rec.photos || []).length;
  return v;
}

const GSheetAPI = {
  async call(body) {
    let r;
    try {
      r = await fetch(Cloud.cfg.gsUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token: Cloud.cfg.gsToken }, body)), redirect: 'follow' });
    } catch (e) { throw new Error('Không gọi được Google Apps Script (kiểm tra URL / mạng)'); }
    if (!r.ok) throw new Error(`Google Sheet lỗi ${r.status}`);
    let j; try { j = await r.json(); } catch { throw new Error('Apps Script trả về không phải JSON – kiểm tra đã triển khai “Bất kỳ ai” có quyền truy cập'); }
    if (!j.ok) throw new Error(j.error || 'Lỗi Apps Script');
    return j;
  },
  push(rows) { return this.call({ action: 'push', rows: rows.map(r => Object.assign({}, r, { sheet: sheetName(r.coll), view: sheetView(r.coll, r.data) })) }); },
  pull(since) { return this.call({ action: 'pull', since, limit: 1000 }); },
  async photo(id) { return (await this.call({ action: 'photo', id })).data || null; },
  test() { return this.call({ action: 'ping' }); },
};

const SupaAPI = {
  base() { return Cloud.cfg.url.replace(/\/+$/, '') + '/rest/v1/bc_records'; },
  headers(extra = {}) { return Object.assign({ apikey: Cloud.cfg.key, Authorization: 'Bearer ' + Cloud.cfg.key, 'Content-Type': 'application/json' }, extra); },
  async push(rows) {
    const r = await fetch(this.base() + '?on_conflict=coll,id', { method: 'POST', headers: this.headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(rows) });
    if (!r.ok) throw new Error(`Đẩy dữ liệu lỗi ${r.status}: ${(await r.text()).slice(0, 160)}`);
  },
  async pull(since) {
    const r = await fetch(`${this.base()}?select=coll,id,data,deleted,updated_at&coll=neq.photos&updated_at=gt.${encodeURIComponent(since)}&order=updated_at.asc&limit=500`, { headers: this.headers() });
    if (!r.ok) throw new Error(`Kéo dữ liệu lỗi ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const rows = await r.json();
    return { rows, cursor: rows.length ? rows[rows.length - 1].updated_at : since, more: rows.length === 500 };
  },
  async photo(id) {
    const r = await fetch(`${this.base()}?select=data&coll=eq.photos&id=eq.${encodeURIComponent(id)}`, { headers: this.headers() });
    const rows = await r.json(); return rows[0]?.data?.data || null;
  },
  async test() {
    const r = await fetch(`${this.base()}?select=id&limit=1`, { headers: this.headers() });
    if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  },
};

// Bản ghi có ngày cũ hơn mốc đã được Admin xác nhận dọn khỏi các máy (đám mây vẫn giữ) → không tải về nữa
function recDate(coll, rec) {
  if (!rec) return '';
  if (coll === 'logs') return rec.t ? localDate(new Date(rec.t)) : '';
  if (['orders', 'trips', 'settlements', 'photos'].includes(coll)) return rec.date || '';
  return '';
}
const tooOld = (coll, rec) => { const cut = S()?.purgeCutoff, d = recDate(coll, rec); return !!(cut && d && d < cut); };

const Cloud = {
  cfg: (() => { try { return JSON.parse(localStorage.getItem('bc_cloud') || '{}'); } catch { return {}; } })(),
  q: new Map(), status: 'off', lastErr: '', timer: null, pushTimer: null, busy: false,
  get lastPull() { return localStorage.getItem('bc_lastPull') || '1970-01-01T00:00:00Z'; },
  set lastPull(v) { localStorage.setItem('bc_lastPull', v); },
  provider() { return this.cfg.provider || (this.cfg.url ? 'supabase' : 'gsheet'); },
  get P() { return this.provider() === 'supabase' ? SupaAPI : GSheetAPI; },
  enabled() { const c = this.cfg; return !!(c.enabled && (this.provider() === 'supabase' ? c.url && c.key : c.gsUrl && c.gsToken)); },
  saveCfg(c) { this.cfg = c; localStorage.setItem('bc_cloud', JSON.stringify(c)); },
  async init() {
    const saved = await IDB.get('kv', '_queue'); (saved || []).forEach(r => this.q.set(r.coll + '|' + r.id, r));
    this.start();
    window.addEventListener('online', () => this.sync());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.sync(); });
  },
  start() {
    clearInterval(this.timer);
    if (!this.enabled()) { this.setStatus('off'); return; }
    // Google Sheet chậm hơn và có hạn mức → kéo dữ liệu thưa hơn
    const every = this.provider() === 'gsheet' ? 20000 : 8000;
    this.sync(); this.timer = setInterval(() => { if (!document.hidden) this.sync(); }, every);
  },
  queue(coll, rec) {
    if (!this.enabled()) return;
    this.q.set(coll + '|' + rec.id, { coll, id: rec.id, data: rec, deleted: !!rec._deleted });
    IDB.put('kv', '_queue', [...this.q.values()]);
    clearTimeout(this.pushTimer); this.pushTimer = setTimeout(() => this.push(), 800);
  },
  setStatus(s, err = '') { this.status = s; this.lastErr = err; if (typeof updateSync === 'function') updateSync(); },
  async push() {
    if (!this.enabled() || !this.q.size || !navigator.onLine || this.pushing) return;
    this.pushing = true;
    try {
      const rows = [...this.q.values()];
      // Chia lô theo số dòng và dung lượng (ảnh base64 khá nặng)
      const batches = []; let cur = [], size = 0;
      for (const r of rows) {
        const s = JSON.stringify(r.data).length;
        if (cur.length && (cur.length >= 40 || size + s > 3e6)) { batches.push(cur); cur = []; size = 0; }
        cur.push(r); size += s;
      }
      if (cur.length) batches.push(cur);
      for (const batch of batches) {
        await this.P.push(batch.map(({ coll, id, data, deleted }) => ({ coll, id, data, deleted })));
        batch.forEach(b => { const k = b.coll + '|' + b.id; if (this.q.get(k) === b) this.q.delete(k); });
        await IDB.put('kv', '_queue', [...this.q.values()]);
        updateSync();
      }
      this.setStatus('on');
    } catch (e) { this.setStatus('err', e.message); }
    finally { this.pushing = false; }
  },
  async pull() {
    if (!this.enabled() || !navigator.onLine || this.pulling) return;
    this.pulling = true;
    try {
      const changed = new Set(); let cursor = this.lastPull, more = true;
      const oldCut = S()?.purgeCutoff;
      while (more) {
        const res = await this.P.pull(cursor);
        for (const row of res.rows) {
          if (!DB[row.coll] || !row.data && !row.deleted) continue;
          if (this.q.has(row.coll + '|' + row.id)) continue; // bản cục bộ chưa đẩy lên – ưu tiên bản cục bộ
          const local = byId(row.coll, row.id);
          if (row.deleted) { if (local) { DB[row.coll] = DB[row.coll].filter(x => x.id !== row.id); changed.add(row.coll); } continue; }
          if (tooOld(row.coll, row.data)) continue;
          if (!local || !local._u || (row.data._u || '') > local._u) {
            const i = DB[row.coll].findIndex(x => x.id === row.id);
            if (i >= 0) DB[row.coll][i] = row.data; else DB[row.coll].push(row.data);
            changed.add(row.coll);
          }
        }
        cursor = res.cursor; more = res.more;
      }
      this.lastPull = cursor;
      changed.forEach(c => persist(c));
      // Admin ở máy khác vừa xác nhận dọn dữ liệu cũ → dọn luôn trên máy này
      if (S()?.purgeCutoff && S().purgeCutoff !== oldCut) await pruneLocal(S().purgeCutoff);
      if (changed.size && typeof onRemoteChange === 'function') onRemoteChange(changed);
      this.setStatus('on');
    } catch (e) { this.setStatus('err', e.message); }
    finally { this.pulling = false; }
  },
  async sync() { await this.push(); await this.pull(); },
  async fetchPhoto(id) { try { return await this.P.photo(id); } catch { return null; } },
  test() { return this.P.test(); },
  // Đẩy toàn bộ dữ liệu máy này lên đám mây (lần đầu cấu hình), kể cả ảnh
  async pushAll() {
    for (const c of COLLS) for (const rec of DB[c]) this.q.set(c + '|' + rec.id, { coll: c, id: rec.id, data: rec, deleted: false });
    for (const o of DB.orders) for (const p of (o.photos || [])) {
      const data = await IDB.get('photos', p.id);
      if (data) this.q.set('photos|' + p.id, { coll: 'photos', id: p.id, data: { id: p.id, data, order: o.code, date: o.date, kind: p.kind, _u: p.t }, deleted: false });
    }
    await IDB.put('kv', '_queue', [...this.q.values()]);
    await this.push();
  },
  // Số bản ghi cũ hơn mốc còn nằm trong hàng đợi (chưa lên Google Sheet)
  pendingOld(cutoff) { return [...this.q.values()].filter(r => { const d = recDate(r.coll, r.data); return d && d < cutoff; }).length; },
};

/* ---------- Lưu trữ có thời hạn (mặc định 3 tháng) ---------- */
function retentionCutoff(months = S().retentionMonths || 3) {
  const d = new Date(); d.setMonth(d.getMonth() - months); return localDate(d);
}
function oldDataStats(cutoff) {
  const old = (coll) => DB[coll].filter(r => { const d = recDate(coll, r); return d && d < cutoff; });
  const orders = old('orders');
  return { orders: orders.length, trips: old('trips').length, settlements: old('settlements').length, logs: old('logs').length,
    photos: orders.reduce((s, o) => s + (o.photos || []).length, 0), oldest: DB.orders.map(o => o.date).sort()[0] || '' };
}
// Xóa dữ liệu cũ trên máy này (Google Sheet / Drive vẫn giữ nguyên làm kho lưu trữ)
async function pruneLocal(cutoff) {
  const photoIds = [];
  for (const coll of ['orders', 'trips', 'settlements', 'logs']) {
    const before = DB[coll].length;
    DB[coll] = DB[coll].filter(r => {
      const d = recDate(coll, r), old = d && d < cutoff;
      if (old && coll === 'orders') (r.photos || []).forEach(p => photoIds.push(p.id));
      return !old;
    });
    if (DB[coll].length !== before) persist(coll);
  }
  for (const id of photoIds) await IDB.del('photos', id);
  // Hàng đợi đồng bộ giữ nguyên: bản ghi cũ chưa kịp gửi vẫn được đẩy lên Google Sheet để lưu trữ
  await flush();
}

/* =====================================================================
   CHUẨN HÓA EXCEL IN/OUT — tên sheet & tên cột cố định (không dấu, IN HOA)
   để kết nối hệ thống bán hàng / kế toán / kho ở giai đoạn sau.
   ===================================================================== */
const XL = {
  orders: { sheet: 'DON_HANG', cols: [
    ['code', 'MA_DON', 'Mã đơn duy nhất (để trống khi nhập → tự sinh)'], ['date', 'NGAY_GIAO', 'yyyy-mm-dd'],
    ['customerCode', 'MA_KH', 'Mã khách hàng – nhập mã sẽ tự điền tên, địa chỉ, tuyến, khung giờ'], ['customerName', 'TEN_KH', ''],
    ['phone', 'SDT', ''], ['address', 'DIA_CHI', ''], ['route', 'MA_TUYEN', ''], ['timeWindow', 'KHUNG_GIO', 'VD 08:00-10:00 hoặc Cả ngày'],
    ['items', 'HANG_HOA', ''], ['weightKg', 'KHOI_LUONG_KG', 'Số'], ['cod', 'TIEN_THU_HO', 'Số tiền phải thu (đ)'],
    ['codCollected', 'DA_THU', 'Số tiền tài xế đã thu (đ)'], ['status', 'TRANG_THAI', Object.keys(OST).join(' | ')],
    ['driverId', 'MA_TAI_XE', ''], ['tripCode', 'MA_CHUYEN', ''], ['seq', 'THU_TU', ''], ['eta', 'GIO_DU_KIEN', ''],
    ['tArrive', 'GIO_DEN_DIEM', ''], ['tDelivered', 'GIO_GIAO_TC', ''], ['tFailed', 'GIO_THAT_BAI', ''], ['failReason', 'LY_DO_THAT_BAI', ''],
    ['receiver', 'NGUOI_NHAN', ''], ['note', 'GHI_CHU', ''], ['adminConfirmBy', 'ADMIN_DUYET', ''], ['adminConfirmAt', 'GIO_DUYET', ''],
    ['lat', 'VI_DO', ''], ['lng', 'KINH_DO', ''] ] },
  trips: { sheet: 'CHUYEN_GIAO', cols: [
    ['code', 'MA_CHUYEN', ''], ['date', 'NGAY_XUAT_PHAT', ''], ['driverId', 'MA_TAI_XE', ''], ['vehicle', 'BIEN_SO_XE', ''],
    ['status', 'TRANG_THAI', Object.keys(TST).join(' | ')], ['plannedStart', 'GIO_XUAT_PHAT_DK', ''], ['planEnd', 'GIO_VE_DK', ''],
    ['planMin', 'TONG_PHUT_DK', ''], ['planKm', 'TONG_KM_DK', ''], ['tAccept', 'GIO_NHAN_CHUYEN', ''], ['tLoadStart', 'GIO_BAT_DAU_LEN_HANG', ''],
    ['tDepart', 'GIO_BAT_DAU_DI_CHUYEN', ''], ['tReturn', 'GIO_VE_KHO', ''] ] },
  customers: { sheet: 'KHACH_HANG', cols: [
    ['code', 'MA_KH', 'Bắt buộc, duy nhất'], ['name', 'TEN_KH', ''], ['phone', 'SDT', ''], ['address', 'DIA_CHI', ''], ['route', 'MA_TUYEN', ''],
    ['timeWindow', 'KHUNG_GIO', ''], ['serviceMin', 'PHUT_GIAO_TAI_DIEM', ''], ['lat', 'VI_DO', ''], ['lng', 'KINH_DO', ''], ['note', 'GHI_CHU', ''] ] },
  routes: { sheet: 'TUYEN', cols: [['code', 'MA_TUYEN', ''], ['name', 'TEN_TUYEN', ''], ['area', 'KHU_VUC', '']] },
  vehicles: { sheet: 'XE', cols: [['plate', 'BIEN_SO', ''], ['type', 'LOAI_XE', ''], ['capacityKg', 'TAI_TRONG_KG', '']] },
  users: { sheet: 'NHAN_SU', cols: [['id', 'MA_NV', ''], ['name', 'HO_TEN', ''], ['role', 'VAI_TRO', Object.keys(ROLES).join(' | ')], ['phone', 'SDT', ''], ['vehicle', 'XE_MAC_DINH', ''], ['active', 'HOAT_DONG', '']] },
  settlements: { sheet: 'DOI_SOAT', cols: [['date', 'NGAY', ''], ['driverId', 'MA_TAI_XE', ''], ['codExpected', 'PHAI_THU', ''], ['codCollected', 'THUC_THU', ''], ['cashSubmitted', 'DA_NOP', ''], ['diff', 'CHENH_LECH', ''], ['by', 'NGUOI_XAC_NHAN', ''], ['at', 'GIO_XAC_NHAN', ''], ['note', 'GHI_CHU', '']] },
  logs: { sheet: 'NHAT_KY', cols: [['t', 'THOI_GIAN', ''], ['userId', 'MA_NV', ''], ['userName', 'HO_TEN', ''], ['role', 'VAI_TRO', ''], ['action', 'THAO_TAC', ''], ['entity', 'DOI_TUONG', ''], ['detail', 'CHI_TIET', '']] },
};
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const xlCell = v => v == null ? '' : (typeof v === 'string' && ISO_RE.test(v)) ? fmtDT(v) : (typeof v === 'boolean' ? (v ? 'Có' : 'Không') : v);
const toXlRows = (coll, recs) => recs.map(r => Object.fromEntries(XL[coll].cols.map(([k, h]) => [h, xlCell(r[k])])));
function needXLSX() { if (!window.XLSX) { toast('Chưa tải được thư viện Excel – kiểm tra kết nối mạng.'); return false; } return true; }
function writeWorkbook(sheets, filename) {
  if (!needXLSX()) return;
  const wb = XLSX.utils.book_new();
  for (const [name, rows, header] of sheets) {
    const ws = rows.length ? XLSX.utils.json_to_sheet(rows, header ? { header } : undefined) : XLSX.utils.aoa_to_sheet([header || []]);
    if (rows.length || header) ws['!cols'] = Object.keys(rows[0] || Object.fromEntries((header || []).map(h => [h, 1]))).map(h => ({ wch: Math.max(10, Math.min(40, h.length + 4)) }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
  log('Xuất Excel', filename, sheets.map(s => `${s[0]}:${s[1].length}`).join(', '));
}
function xlDate(v) {
  if (v instanceof Date) return localDate(v);
  if (typeof v === 'number') return localDate(new Date(Math.round((v - 25569) * 864e5)));
  const s = String(v || '').trim(); let m;
  if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s))) return `${m[3]}-${z2(m[2])}-${z2(m[1])}`;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return `${m[1]}-${z2(m[2])}-${z2(m[3])}`;
  return '';
}
const xlNum = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/[^\d.-]/g, '')); return isNaN(n) ? null : n; };
