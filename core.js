'use strict';
/* =====================================================================
   App quản lý công việc giao hàng của tài xế nhà Bình Chiểu
   core.js — hằng số, lưu trữ (IndexedDB + đồng bộ Google Sheet/Supabase),
   nâng cấp dữ liệu, phân quyền, nhật ký, hành trình GPS, thuật toán tuyến,
   chuẩn Excel và nhập đơn từ file mẫu.
   ===================================================================== */

const APP_NAME = 'App quản lý công việc giao hàng của tài xế nhà Bình Chiểu';
const APP_VERSION = '2.0.1';   // đổi cùng version.json mỗi lần phát hành
const SCHEMA_VERSION = 2;      // tăng khi đổi cấu trúc dữ liệu → tự chạy migrate()

const ROLES = { admin: 'Quản trị (Admin)', dieuphoi: 'Điều phối', taixe: 'Tài xế', ketoan: 'Kế toán / Đối soát' };

// Trạng thái đơn giao: [nhãn, tông màu]
const OST = {
  cho_phan_cong:   ['Chờ phân công', 'info'],
  da_phan_cong:    ['Đã phân công', 'info'],
  da_nhan:         ['Tài xế đã nhận', 'info'],
  dang_giao:       ['Đang giao', 'warning'],
  da_den:          ['Đã đến điểm', 'warning'],
  giao_thanh_cong: ['Giao TC – chờ Admin duyệt', 'warning'],
  giao_that_bai:   ['Không giao được', 'danger'],
  hoan_tat:        ['Hoàn tất (Admin đã duyệt)', 'success'],
};
const TST = {
  moi:            ['Mới tạo', 'info'],
  da_nhan:        ['Tài xế đã nhận', 'info'],
  dang_len_hang:  ['Đang lên hàng', 'warning'],
  dang_di_chuyen: ['Đang di chuyển', 'warning'],
  hoan_thanh:     ['Đã về kho', 'success'],
  huy:            ['Đã hủy', 'danger'],
};
const DONE_ST = ['giao_thanh_cong', 'giao_that_bai', 'hoan_tat'];
const OK_ST = ['giao_thanh_cong', 'hoan_tat'];
const ACTIVE_TRIP = ['dang_len_hang', 'dang_di_chuyen'];
const FAIL_REASONS = ['Khách vắng / không liên lạc được', 'Khách hẹn giao lại', 'Khách từ chối nhận', 'Sai địa chỉ', 'Hàng hư hỏng / thiếu', 'Không kịp thời gian', 'Xe hỏng / sự cố', 'Khác'];
const PHOTO_KINDS = ['Lên hàng', 'Giao thành công', 'Không giao được', 'Chứng từ / hóa đơn', 'Khác'];
// Khách nhận hàng trong giờ hành chính; mỗi đơn có thể một khung giờ khác nhau (không cố định theo khách)
const OFFICE = 'Giờ hành chính';
const TIME_WINDOWS = [OFFICE, '08:00-10:00', '10:00-12:00', '08:00-12:00', '13:00-15:00', '15:00-17:00', '13:00-17:00'];
const VEHICLE_TYPES = ['Xe máy', 'Xe ba gác', 'Xe tải 500kg', 'Xe tải 1.25 tấn', 'Xe tải 2.5 tấn', 'Xe tải 5 tấn', 'Xe tải 8 tấn', 'Xe container'];
const DEFAULT_PLANT = 'Nhà máy Bình Chiểu', DEFAULT_DEPT = 'Kho vận';

const PERMS = {
  admin:    ['*'],
  dieuphoi: ['order.edit', 'trip.edit', 'assign', 'catalog.edit', 'import', 'export', 'photo', 'report', 'view.all', 'map'],
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
const dt0 = s => new Date(s + 'T00:00:00');
const addDays = (s, n) => { const d = dt0(s); d.setDate(d.getDate() + n); return localDate(d); };
const diffDays = (a, b) => Math.round((dt0(b) - dt0(a)) / 864e5);           // b - a (ngày)
const WDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const wday = s => WDAY[dt0(s).getDay()];
function hhmm(min) { min = Math.round(min); return `${z2(Math.floor(min / 60) % 24)}:${z2(min % 60)}`; }
const toMin = s => { if (!s) return null; const [h, m] = String(s).split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
const fmtT = iso => iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—';
const fmtHM = iso => iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
const fmtD = ymd => ymd ? String(ymd).split('-').reverse().join('/') : '';
const fmtDT = iso => iso ? `${fmtD(localDate(new Date(iso)))} ${fmtT(iso)}` : '';
// Quy ước số: dấu chấm ngăn phần nghìn/triệu, dấu phẩy là phần thập phân (12.450 kg · 98,6%)
const num = (n, d = 1) => (Number(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: d });
const kgTxt = n => num(n, 1) + ' kg';
const durTxt = min => min == null || isNaN(min) ? '—' : `${Math.floor(min / 60)}h${z2(Math.round(min % 60))}`;
function bytesTxt(b) { b = Number(b) || 0; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return num(b, i ? 1 : 0) + ' ' + u[i]; }
// Số người dùng gõ: "1.250,5" → 1250.5 ; "126.5" → 126.5 ; "1.250" → 1250
function parseVN(s) {
  s = String(s ?? '').trim().replace(/\s/g, ''); if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (!/^-?\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s); return isNaN(n) ? null : n;
}
// Tọa độ gõ tay: dấu chấm hoặc phẩy đều là thập phân (10.8822)
const parseGeo = s => { s = String(s ?? '').trim().replace(',', '.'); const n = Number(s); return s === '' || isNaN(n) ? null : n; };
// Số đọc từ Excel (dấu chấm là thập phân như file mẫu: 126.945 kg)
const xlNum = v => {
  if (v === '' || v == null) return null; if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/[^\d.,-]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s); return isNaN(n) ? null : n;
};
const minsBetween = (a, b) => a && b ? (new Date(b) - new Date(a)) / 60000 : null;
const isoMinOfDay = iso => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
const winOf = o => { const w = o.timeWindow || OFFICE; if (w === OFFICE || w === 'Cả ngày') return [480, 1020]; const m = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(w); return m ? [toMin(m[1]), toMin(m[2])] : null; };
const winStart = o => (winOf(o) || [null])[0];
const winEnd = o => (winOf(o) || [null, null])[1];
const isFlex = o => { const w = winOf(o); return !w || w[1] - w[0] >= 420; };   // khung ≥ 7 giờ coi như cả ngày làm việc
const isDone = o => DONE_ST.includes(o.status);
const kgOf = o => Number(o.weightKg) || 0;
const cartonsOf = o => Number(o.cartons) || 0;
const TONE_ICON = { success: 'M5 12.5l4.5 4.5L19 7.5', warning: 'M12 7v5l3 2|M12 21a9 9 0 100-18 9 9 0 000 18z', danger: 'M6 6l12 12M18 6L6 18', info: 'M12 11v6|M12 7.5v.5|M12 21a9 9 0 100-18 9 9 0 000 18z' };
const svgIcon = (paths, s = 14) => `<svg class="nn-icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.split('|').map(d => `<path d="${d}"/>`).join('')}</svg>`;
// Trạng thái luôn có icon + chữ (không chỉ bằng màu)
const statusTag = (label, tone) => `<span class="nn-status nn-tone-${tone}">${svgIcon(TONE_ICON[tone])}${esc(label)}</span>`;
const badge = (map, k) => { const v = map[k] || [k, 'info']; return statusTag(v[0], v[1]); };
const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(v) === String(cur ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
function selectHTML(name, items, cur, { empty, attrs = '', cls = '' } = {}) {
  return `<select name="${name}" class="nn-select ${cls}" ${attrs}>${empty != null ? opt('', empty, cur) : ''}${items.map(([v, l]) => opt(v, l, cur)).join('')}</select>`;
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
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}

/* ---------- Khoảng thời gian lọc nhanh (hôm qua / hôm nay / tuần này / tháng này / tùy chỉnh) ---------- */
const PRESETS = [['yesterday', 'Hôm qua'], ['today', 'Hôm nay'], ['week', 'Tuần này'], ['month', 'Tháng này'], ['custom', 'Tùy chỉnh']];
function presetRange(p) {
  const t = today(), d = dt0(t);
  if (p === 'yesterday') { const y = addDays(t, -1); return [y, y]; }
  if (p === 'week') { const mon = addDays(t, -((d.getDay() + 6) % 7)); return [mon, addDays(mon, 6)]; }
  if (p === 'month') { const a = t.slice(0, 8) + '01', e = new Date(d.getFullYear(), d.getMonth() + 1, 0); return [a, localDate(e)]; }
  return [t, t];
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
  del(store, key) { return this.req(store, 'readwrite', s => s.delete(key)); },
  clear(store) { return this.req(store, 'readwrite', s => s.clear()); },
  // Đếm số mục và tổng dung lượng chuỗi (ảnh dạng data URL)
  sizeOf(store) {
    return new Promise((res, rej) => {
      let n = 0, bytes = 0; const q = this.db.transaction(store, 'readonly').objectStore(store).openCursor();
      q.onsuccess = () => { const c = q.result; if (!c) return res({ n, bytes }); n++; bytes += typeof c.value === 'string' ? c.value.length : JSON.stringify(c.value).length; c.continue(); };
      q.onerror = () => rej(q.error);
    });
  },
};

/* ---------- Kho dữ liệu ---------- */
const COLLS = ['users', 'customers', 'routes', 'vehicles', 'orders', 'trips', 'logs', 'settlements', 'settings', 'tracks'];
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
function nextNewCustomerCode() {
  const n = DB.customers.filter(c => /^KM\d+$/.test(c.code)).map(c => +c.code.slice(2)).reduce((a, b) => Math.max(a, b), 0);
  return 'KM' + String(n + 1).padStart(4, '0');
}

async function hashPin(id, pin) {
  const txt = `bc-giaohang:${id}:${pin}`;
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return 'plain:' + txt;
}

/* ---------- Dữ liệu danh mục từ file mẫu (data/seed.json) ---------- */
const defaultSettings = () => ({
  id: 'main', depot: { name: 'Nhà máy Bình Chiểu', address: 'P. Bình Chiểu, TP. Thủ Đức, TP.HCM', lat: 10.8822, lng: 106.7287 },
  speedKmh: 22, highwayKmh: 45, roadFactor: 1.35, loadMin: 30, defaultServiceMin: 10, startTime: '07:30', requirePhoto: true,
  missingCoordMin: 12, retentionMonths: 3, keepRoute: true, useCapacity: true, defaultSlaDays: 3, earlyDays: 3, trackSyncSec: 180, maxDayKm: 250,
  schemaVersion: SCHEMA_VERSION,
});
function buildCustomer(c, addrs, prev) {
  const g = guessGeo(c.ad, provinceOfRoute(c.rt) || undefined);
  const r = Object.assign({}, prev, {
    id: c.c, code: c.c, name: c.n, alias: c.al || '', channel: c.ch || '', chain: c.chain || '', address: c.ad || '',
    addresses: (addrs || []).map(a => ({ code: a[1], address: a[2] })), area: c.ar || '', region: c.rg || '',
    slaDays: c.sla ?? null, province: g?.province || provinceOfRoute(c.rt) || '', district: g?.district || '',
  });
  // chỉ gán tọa độ ước lượng nếu chưa có tọa độ chính xác (GPS / nhập tay)
  if (!(prev && ['gps', 'manual'].includes(prev.geoSrc))) { if (g) { r.lat = g.lat; r.lng = g.lng; r.geoSrc = g.src; } else { r.lat = null; r.lng = null; r.geoSrc = ''; } }
  return r;
}
async function seedCatalog() {
  const seed = await fetch('data/seed.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('Không tải được data/seed.json'); return r.json(); });
  const byCust = {}; seed.addresses.forEach(a => (byCust[a[0]] = byCust[a[0]] || []).push(a));
  seed.customers.forEach(c => upsert('customers', buildCustomer(c, byCust[c.c], byId('customers', c.c))));
  return { customers: seed.customers.length };
}
const DEMO = { users: ['DP01', 'KT01', 'TX01', 'TX02', 'TX03', 'TX04'], routes: ['T1', 'T2', 'T3', 'T4'], vehicles: ['51C-123.45', '51C-234.56', '51D-345.67', '59-X1 456.78'] };
function dropDemoData() {
  let n = 0;
  const demoUsers = DB.users.filter(u => DEMO.users.includes(u.id) && /^(Tài xế|Điều phối Lan|Kế toán Hoa)/.test(u.name)).map(u => u.id);
  DB.orders.filter(o => o.createdBy === 'system' || demoUsers.includes(o.driverId)).forEach(o => { removeRec('orders', o.id); n++; });
  DB.trips.filter(t => demoUsers.includes(t.driverId)).forEach(t => { removeRec('trips', t.id); n++; });
  DB.tracks.filter(t => demoUsers.includes(t.driverId)).forEach(t => removeRec('tracks', t.id));
  demoUsers.forEach(id => { removeRec('users', id); n++; });
  DB.customers.filter(c => /^KH0(0[1-9]|1[0-2])$/.test(c.code) && /Tam Bình|Tam Phú|KCN Bình Chiểu|QL1K|Linh Trung|Linh Tây|Dĩ An|Đông Hòa|Hiệp Bình|Chợ Thủ Đức/.test(c.address || '')).forEach(c => { removeRec('customers', c.id); n++; });
  DB.routes.filter(r => DEMO.routes.includes(r.id) && /–/.test(r.name || '')).forEach(r => { removeRec('routes', r.id); n++; });
  DB.vehicles.filter(v => DEMO.vehicles.includes(v.id) && !DB.users.some(u => u.vehicle === v.id)).forEach(v => { removeRec('vehicles', v.id); n++; });
  return n;
}
async function createAdmin() {
  const id = 'ADMIN';
  DB.users.push({ id, name: 'Quản trị viên', role: 'admin', plant: DEFAULT_PLANT, dept: DEFAULT_DEPT, phone: '', vehicle: '', active: true, pinHash: await hashPin(id, '1234'), _u: nowISO() });
  persist('users');
}
// Nâng cấp cấu trúc dữ liệu khi lên phiên bản mới — không làm mất dữ liệu đã nhập
async function migrate() {
  const st = S(), from = st.schemaVersion || 1;
  if (from >= SCHEMA_VERSION) return null;
  const info = { from, to: SCHEMA_VERSION, demo: 0, orders: 0 };
  if (from < 2) {
    info.demo = dropDemoData();
    DB.orders.forEach(o => {
      let ch = false;
      if ('cod' in o || 'codCollected' in o || 'items' in o) { delete o.cod; delete o.codCollected; delete o.items; ch = true; }
      if (!o.orderDate) { o.orderDate = (o.createdAt ? localDate(new Date(o.createdAt)) : o.date); ch = true; }
      if (!o.dueDate) { o.dueDate = o.date; ch = true; }
      if (o.cartons == null) { o.cartons = 0; ch = true; }
      const w = o.timeWindow, m = /^(\d{1,2}):\d{2}-(\d{1,2}):\d{2}$/.exec(w || '');
      let nw = (!w || w === 'Cả ngày') ? OFFICE : (m && (+m[1] < 8 || +m[2] > 17) ? (+m[1] < 8 ? '08:00-10:00' : '15:00-17:00') : w);
      if (nw !== w) { o.timeWindow = nw; ch = true; }
      if (!o.province && o.address) { const g = guessGeo(o.address); if (g) { o.province = g.province; o.district = g.district; ch = true; } }
      if (ch) { upsert('orders', o); info.orders++; }
    });
    DB.customers.forEach(c => {
      if ('timeWindow' in c || !c.province) { delete c.timeWindow; const g = guessGeo(c.address || ''); c.province = c.province || g?.province || ''; c.district = c.district || g?.district || ''; if (g && c.lat == null) { c.lat = g.lat; c.lng = g.lng; c.geoSrc = g.src; } else if (c.lat != null && !c.geoSrc) c.geoSrc = 'manual'; upsert('customers', c); }
    });
    DB.users.forEach(u => { if (!u.plant || !u.dept) { u.plant = u.plant || DEFAULT_PLANT; u.dept = u.dept || DEFAULT_DEPT; upsert('users', u); } });
    DB.settlements.forEach(x => { if ('codExpected' in x) removeRec('settlements', x.id); });
    if (!DB.users.some(u => u.role === 'admin')) await createAdmin();
    // nạp danh mục khách hàng / địa chỉ / tuyến mới từ file mẫu (gộp theo mã, giữ nguyên khách và tuyến người dùng tự thêm)
    try { const r = await seedCatalog(); info.customers = r.customers; } catch (e) { info.seedErr = e.message; }
  }
  DB.settings[0] = Object.assign(defaultSettings(), st, { schemaVersion: SCHEMA_VERSION }); upsert('settings', DB.settings[0]);
  await flush(); return info;
}

async function loadAll() {
  await IDB.open();
  for (const c of COLLS) DB[c] = (await IDB.get('kv', c)) || [];
  const fresh = !DB.users.length && !DB.settings.length;
  if (!DB.settings.length) { DB.settings = [Object.assign(defaultSettings(), fresh ? {} : { schemaVersion: 1 })]; persist('settings'); }
  // Máy mới tinh: tạo Admin + nạp danh mục từ file mẫu. Nếu đã nối đám mây thì chờ tải dữ liệu thật về.
  if (fresh) {
    if (!Cloud.enabled()) { await createAdmin(); try { await seedCatalog(); } catch (e) { console.warn(e); } }
    S().schemaVersion = SCHEMA_VERSION;
  } else if (DB.users.length || DB.orders.length) {
    return await migrate();
  }
  await flush(); return null;
}
// Máy tham gia dữ liệu công ty: xóa dữ liệu cục bộ rồi tải toàn bộ từ đám mây
async function wipeLocalData() {
  for (const c of COLLS) { DB[c] = []; persist(c); }
  DB.settings = [defaultSettings()]; persist('settings');
  Cloud.q.clear(); await IDB.put('kv', '_queue', []); await IDB.clear('photos'); await flush();
}

// Đổi mã (khóa) của bản ghi và cập nhật mọi nơi tham chiếu
function renameKey(coll, oldId, newId) {
  if (oldId === newId) return;
  const rec = byId(coll, oldId); if (!rec) return;
  const next = Object.assign({}, rec, { id: newId });
  if (coll === 'users') {
    next.pinHash = ''; // PIN gắn với mã NV nên phải cấp lại
    DB.orders.forEach(o => { if (o.driverId === oldId) { o.driverId = newId; upsert('orders', o); } if (o.adminConfirmBy === oldId) { o.adminConfirmBy = newId; upsert('orders', o); } });
    DB.trips.forEach(t => { if (t.driverId === oldId) { t.driverId = newId; upsert('trips', t); } });
    DB.settlements.forEach(x => { if (x.driverId === oldId) { x.driverId = newId; upsert('settlements', x); } });
    DB.tracks.forEach(x => { if (x.driverId === oldId) { x.driverId = newId; upsert('tracks', x); } });
  } else if (coll === 'customers') {
    next.code = newId; DB.orders.forEach(o => { if (o.customerCode === oldId) { o.customerCode = newId; upsert('orders', o); } });
  } else if (coll === 'routes') {
    next.code = newId; DB.orders.forEach(o => { if (o.route === oldId) { o.route = newId; upsert('orders', o); } });
    DB.customers.forEach(c => { if (c.route === oldId) { c.route = newId; upsert('customers', c); } });
  } else if (coll === 'vehicles') {
    next.plate = newId;
    DB.users.forEach(u => { if (u.vehicle === oldId) { u.vehicle = newId; upsert('users', u); } });
    DB.trips.forEach(t => { if (t.vehicle === oldId) { t.vehicle = newId; upsert('trips', t); } });
  }
  removeRec(coll, oldId); upsert(coll, next);
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

/* ---------- GPS ---------- */
function getGPS() {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) }),
      () => res(null), { enableHighAccuracy: true, timeout: 7000, maximumAge: 20000 });
  });
}
const gpsLink = g => g ? `<a href="https://www.google.com/maps?q=${g.lat},${g.lng}" target="_blank" rel="noopener" class="small">GPS ±${g.acc}m</a>` : '';

/* =====================================================================
   HÀNH TRÌNH TÀI XẾ — ghi vị trí trong lúc chuyến đang chạy (lên hàng → về kho)
   Điểm được gom theo từng chuyến (mỗi đoạn tối đa 150 điểm) và đồng bộ định kỳ.
   Lưu ý: trình duyệt chỉ ghi được khi app đang mở (nên để màn hình sáng).
   ===================================================================== */
const Track = {
  watchId: null, trip: null, rec: null, timer: null, wake: null, lastPt: null, dirtyRec: false,
  activeTrip() { return ME && ME.role === 'taixe' ? DB.trips.find(t => t.driverId === ME.id && ACTIVE_TRIP.includes(t.status)) : null; },
  ensure() {
    const t = this.activeTrip();
    if (!t) return this.stop();
    if (this.trip === t.code) return;
    this.stop(); if (!navigator.geolocation) return;
    this.trip = t.code; this.lastPt = null;
    const chunks = DB.tracks.filter(x => x.trip === t.code).sort((a, b) => a.k - b.k);
    this.rec = chunks[chunks.length - 1] || null;
    this.watchId = navigator.geolocation.watchPosition(p => this.onPos(p, t), () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
    this.timer = setInterval(() => this.flush(), Math.max(30, S().trackSyncSec || 180) * 1000);
    this.lockScreen();
  },
  onPos(p, t) {
    const c = p.coords; if (c.accuracy > 250) return;
    const pt = [Math.round(Date.now() / 1000), +c.latitude.toFixed(5), +c.longitude.toFixed(5), Math.round(c.accuracy)];
    if (this.lastPt) { const d = km({ lat: this.lastPt[1], lng: this.lastPt[2] }, { lat: pt[1], lng: pt[2] }) / (S().roadFactor || 1.35); if (d < 0.03 && pt[0] - this.lastPt[0] < 120) return; }
    this.add(pt, t);
  },
  add(pt, t) {
    if (!this.rec || this.rec.pts.length >= 150) {
      const k = this.rec ? this.rec.k + 1 : 0;
      this.rec = { id: `${t.code}#${k}`, trip: t.code, driverId: t.driverId, date: t.date, k, pts: [] }; DB.tracks.push(this.rec);
    }
    this.rec.pts.push(pt); this.lastPt = pt; this.dirtyRec = true; persist('tracks');
  },
  // Ghi 1 điểm ngay (khi check-in) rồi đẩy lên
  async mark(gps) { const t = this.activeTrip(); if (!t || !gps) return; this.ensure(); this.add([Math.round(Date.now() / 1000), gps.lat, gps.lng, gps.acc], t); await this.flush(); },
  async flush() { if (this.rec && this.dirtyRec) { this.dirtyRec = false; upsert('tracks', this.rec); } },
  stop() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    clearInterval(this.timer); this.flush(); this.watchId = null; this.trip = null; this.rec = null; this.timer = null;
    try { this.wake?.release(); } catch {} this.wake = null;
  },
  async lockScreen() { try { if ('wakeLock' in navigator) this.wake = await navigator.wakeLock.request('screen'); } catch {} },
};
document.addEventListener('visibilitychange', () => { if (!document.hidden && Track.watchId != null && !Track.wake) Track.lockScreen(); });
const tripTrack = code => DB.tracks.filter(x => x.trip === code).sort((a, b) => a.k - b.k).flatMap(x => x.pts);

/* =====================================================================
   TỐI ƯU TUYẾN & CHIA ĐỀU THỜI GIAN
   - Khoảng cách: đường chim bay × hệ số đường phố; 15 km đầu tính tốc độ nội thành,
     đoạn còn lại tính tốc độ liên tỉnh.
   - Tuyến: khách hẹn sáng trước, chiều sau; trong mỗi buổi dùng gần nhất + 2-opt;
     khách nhận cả ngày chèn vào chỗ ít tốn đường nhất.
   - Chia việc: gom đơn cùng khu vực (quận/huyện, tỉnh) / tiện đường thành cụm, giao nguyên cụm cho 1 tài xế,
     tìm kiếm cục bộ để tổng thời gian cả ngày của các tài xế gần bằng nhau.
   - Tải trọng: xe đầy thì tách thành nhiều chuyến (về kho lấy hàng rồi đi tiếp).
   - Nhiều ngày: đơn sắp hết hạn giao thì giao trước; đơn khác hạn có thể giao sớm
     nếu cùng khu vực / tiện đường.
   ===================================================================== */
const depotPt = () => S().depot;
const hasXY = p => p && p.lat != null && p.lng != null && p.lat !== '' && p.lng !== '';
const precise = p => hasXY(p) && ['gps', 'manual'].includes(p.geoSrc);
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
  if (d == null) return S().missingCoordMin || 12;
  const urban = Math.min(d, 15), far = Math.max(0, d - 15);
  return urban / (S().speedKmh || 22) * 60 + far / (S().highwayKmh || 45) * 60;
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
  const flex = list.filter(isFlex);
  const am = list.filter(o => !isFlex(o) && winStart(o) < 720);
  const pm = list.filter(o => !isFlex(o) && winStart(o) >= 720);
  const seq = []; let p = start;
  for (const part of [am, pm]) {
    if (!part.length) continue;
    let s = nearestNeighbor(p, part); if (!fast && s.length <= 60) s = twoOpt(p, s);
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
  if (!fast && !am.length && !pm.length && seq.length <= 60) return twoOpt(start, seq);
  return seq;
}
function tourMinutes(orders, fast = true) {
  if (!orders.length) return 0;
  const seq = optimizeRoute(orders, depotPt(), fast);
  return (S().loadMin || 0) + pathCost(depotPt(), seq) + travelMin(seq[seq.length - 1], depotPt()) + seq.reduce((s, o) => s + svcMin(o), 0);
}
function scheduleSeq(seq, plannedStart) {
  let t = toMin(plannedStart || S().startTime) + (S().loadMin || 0), p = depotPt(), dist = 0, wait = 0;
  const rows = seq.map((o, i) => {
    const tr = travelMin(p, o); dist += km(p, o) || 0;
    let arr = t + tr; const ws = winStart(o);
    if (!isFlex(o) && ws != null && arr < ws) { wait += ws - arr; arr = ws; }
    t = arr + svcMin(o); p = o;
    return { o, seq: i + 1, eta: hhmm(arr), late: winEnd(o) != null && arr > winEnd(o) };
  });
  if (seq.length) { t += travelMin(p, depotPt()); dist += km(p, depotPt()) || 0; }
  const start = toMin(plannedStart || S().startTime);
  return { rows, end: hhmm(t), totalMin: t - start, work: Math.round(t - start - wait), km: Math.round(dist * 10) / 10, wait: Math.round(wait) };
}

/* ---------- Tải trọng xe → nhiều chuyến trong ngày ---------- */
const capOfVeh = plate => Number(byId('vehicles', plate)?.capacityKg) || 0;      // 0 = không giới hạn
const capOf = driverId => capOfVeh(byId('users', driverId)?.vehicle);
const capOn = () => S().useCapacity !== false;
const tripLoad = t => tripOrders(t).reduce((s, o) => s + kgOf(o), 0);
function splitByCapacity(orders, cap, fast = true) {
  if (!orders.length) return [];
  if (!capOn() || !cap) return [orders];
  const trips = []; let cur = [], load = 0;
  for (const o of optimizeRoute(orders, depotPt(), fast)) {
    if (cur.length && load + kgOf(o) > cap) { trips.push(cur); cur = []; load = 0; }
    cur.push(o); load += kgOf(o);
  }
  if (cur.length) trips.push(cur);
  return trips;
}
const dayMinutes = (orders, cap) => splitByCapacity(orders, cap).reduce((s, ch) => s + tourMinutes(ch), 0);

/* ---------- Cụm cùng khu vực (quận/huyện, tỉnh) / tiện đường ---------- */
// Khóa cụm: quận/huyện → tỉnh. Đơn không rõ thì nhập vào cụm gần nhất (≤ 3 km, tọa độ chính xác)
const clusterKey = o => o.province ? (o.district ? `${o.province}/${o.district}` : o.province) : '';
function buildClusters(orders) {
  if (S().keepRoute === false) return orders.map(o => [o]);
  const by = {}, loose = [];
  orders.forEach(o => { const k = clusterKey(o); k ? (by[k] = by[k] || []).push(o) : loose.push(o); });
  const groups = Object.values(by);
  loose.forEach(o => {
    let best = null, bd = 3;
    for (const g of groups) for (const x of g) { if (!precise(o) || !precise(x)) continue; const d = km(o, x); if (d != null && d < bd) { bd = d; best = g; } }
    best ? best.push(o) : groups.push([o]);
  });
  return groups;
}
function balanceOrders(orders, driverIds, baseline = {}) {
  const g = driverIds.map(id => ({ id, os: [], base: baseline[id] || 0, cap: capOf(id), t: baseline[id] || 0 }));
  if (!g.length) return g;
  const calc = x => x.base + dayMinutes(x.os, x.cap);
  const clusters = buildClusters(orders);
  const weight = c => c.reduce((s, o) => s + svcMin(o), 0) + 2 * Math.min(...c.map(o => travelMin(depotPt(), o)));
  clusters.sort((a, b) => weight(b) - weight(a)).forEach(c => {
    let best = g[0], bestT = Infinity;
    for (const x of g) { const t = x.base + dayMinutes([...x.os, ...c], x.cap); if (t < bestT) { bestT = t; best = x; } }
    best.os.push(...c); best.t = calc(best);
  });
  const t0 = Date.now();   // giới hạn thời gian tính để không treo máy khi có hàng trăm đơn
  const improve = unitsOf => {
    for (let it = 0; it < 200 && Date.now() - t0 < 5000; it++) {
      g.sort((a, b) => b.t - a.t);
      const hi = g[0]; let moved = false;
      for (let j = g.length - 1; j > 0 && !moved; j--) {
        const lo = g[j]; let best = null, bestMax = hi.t;
        for (const u of unitsOf(hi)) {
          const hT = hi.base + dayMinutes(hi.os.filter(o => !u.includes(o)), hi.cap), lT = lo.base + dayMinutes([...lo.os, ...u], lo.cap);
          const m = Math.max(hT, lT); if (m < bestMax - 0.5) { bestMax = m; best = u; }
        }
        if (best) { hi.os = hi.os.filter(o => !best.includes(o)); lo.os.push(...best); hi.t = calc(hi); lo.t = calc(lo); moved = true; }
      }
      if (!moved) break;
    }
  };
  improve(x => clusters.filter(c => c.every(o => x.os.includes(o))));
  const spread = () => Math.max(...g.map(x => x.t)) - Math.min(...g.map(x => x.t));
  if (S().keepRoute === false || spread() > 30) improve(x => x.os.map(o => [o]));
  return g;
}

/* ---------- Giao việc nhiều ngày + giao sớm ---------- */
// Đơn "phải giao hôm nay" = nếu để sang ngày được chọn kế tiếp sẽ trễ hạn giao.
// Đơn có hạn giao muộn hơn có thể giao sớm (tối đa earlyDays ngày) nếu cùng khu vực / tiện đường.
function planDays(orders, days, driverIds, opts = {}) {
  const early = opts.earlyDays ?? S().earlyDays ?? 0;
  days = [...days].sort(); const out = [];
  // Đơn ở quá xa kho (> maxKm đường bộ một chiều) không giao kịp trong ngày → để lại cho điều phối xử lý riêng
  const far = opts.maxKm ? orders.filter(o => { const d = km(depotPt(), o); return d != null && d > opts.maxKm; }) : [];
  let left = orders.filter(o => !far.includes(o));
  const due = o => o.dueDate || o.date;
  days.forEach((d, i) => {
    const next = days[i + 1];
    const urgent = left.filter(o => next ? due(o) < next : due(o) <= d);
    let pulled = [];
    if (early > 0) {
      const rest = left.filter(o => !urgent.includes(o)), keys = new Set(urgent.map(clusterKey).filter(Boolean));
      pulled = rest.filter(o => !o.noEarly && diffDays(d, due(o)) <= early && (opts.earlyAny || (clusterKey(o) && keys.has(clusterKey(o))) ||
        urgent.some(u => precise(o) && precise(u) && km(o, u) != null && km(o, u) < 3)));
    }
    const todays = [...urgent, ...pulled]; left = left.filter(o => !todays.includes(o));
    const base = {}; driverIds.forEach(id => base[id] = DB.trips.filter(t => t.driverId === id && t.date === d && t.status !== 'huy').reduce((s, t) => s + (t.planMin || 0), 0));
    const groups = todays.length ? balanceOrders(todays, driverIds, base) : driverIds.map(id => ({ id, os: [], base: base[id] }));
    out.push({ date: d, early: pulled.map(o => o.code), groups: groups.map(g => ({ id: g.id, base: g.base, codes: g.os.map(o => o.code), vehicle: byId('users', g.id)?.vehicle || '' })) });
  });
  return { days: out, leftover: left.map(o => o.code), far: far.map(o => o.code) };
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
function mapsLinks(seq) {
  const d = depotPt(), pt = o => hasXY(o) && precise(o) ? `${o.lat},${o.lng}` : encodeURIComponent(o.address || `${o.lat},${o.lng}`);
  const links = []; let origin = hasXY(d) ? `${d.lat},${d.lng}` : encodeURIComponent(d.address);
  for (let i = 0; i < seq.length; i += 10) {
    const chunk = seq.slice(i, i + 10), dest = chunk[chunk.length - 1];
    const wps = chunk.slice(0, -1).map(pt).join('|');
    links.push(`https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${origin}&destination=${pt(dest)}${wps ? '&waypoints=' + wps : ''}`);
    origin = pt(dest);
  }
  return links;
}

/* ---------- Đơn giao: hạn giao, ghép đơn tiện đường ---------- */
// Tình trạng so với hạn giao: quá hạn / hạn hôm nay / còn N ngày — hoặc đúng hạn / trễ khi đã giao
function dueInfo(o) {
  const due = o.dueDate; if (!due) return { tone: 'info', txt: '—', late: false };
  if (isDone(o)) {
    const d = o.tDelivered || o.tFailed; if (!d) return { tone: 'info', txt: '—', late: false };
    const n = diffDays(due, localDate(new Date(d)));
    return n > 0 ? { tone: 'danger', txt: `Trễ ${n} ngày`, late: true } : { tone: 'success', txt: 'Đúng hạn', late: false };
  }
  const n = diffDays(today(), due);
  if (n < 0) return { tone: 'danger', txt: `Quá hạn ${-n} ngày`, late: true };
  if (n === 0) return { tone: 'warning', txt: 'Hạn hôm nay', late: false };
  return { tone: 'info', txt: `Còn ${n} ngày`, late: false };
}
const dueTag = o => { const i = dueInfo(o); return statusTag(i.txt, i.tone); };

function insertionOptions(o) {
  const res = [];
  for (const t of DB.trips.filter(x => x.date === o.date && !['hoan_thanh', 'huy'].includes(x.status) && x.code !== o.tripCode)) {
    const os = tripOrders(t), done = os.filter(x => isDone(x) || x.status === 'da_den'), rest = os.filter(x => !done.includes(x));
    const moving = t.status === 'dang_di_chuyen';
    const last = done[done.length - 1], start = moving && last && hasXY(last) ? last : depotPt();
    let add = Infinity, addKm = 0;
    for (let i = 0; i <= rest.length; i++) {
      const a = i === 0 ? start : rest[i - 1], b = i < rest.length ? rest[i] : depotPt();
      const m = travelMin(a, o) + travelMin(o, b) - travelMin(a, b);
      if (m < add) { add = m; addKm = (km(a, o) || 0) + (km(o, b) || 0) - (km(a, b) || 0); }
    }
    const cap = capOfVeh(t.vehicle), load = tripLoad(t) + kgOf(o);
    res.push({ t, add: Math.max(0, Math.round(add)) + svcMin(o), km: Math.max(0, Math.round(addKm * 10) / 10), cap, load, over: capOn() && cap > 0 && load > cap, moving, sameRoute: !!clusterKey(o) && os.some(x => clusterKey(x) === clusterKey(o)) });
  }
  return res.sort((a, b) => (a.over - b.over) || (a.add - b.add));
}

/* =====================================================================
   ĐỒNG BỘ ĐÁM MÂY — 2 lựa chọn:
   • Google Sheet (Apps Script, file google-apps-script/Code.gs): mỗi bảng 1 sheet
     với cột chuẩn hóa + DATA_JSON; ảnh lưu Google Drive, link ở sheet ANH.
   • Supabase (bảng bc_records, file supabase-schema.sql).
   ===================================================================== */
const SHEET_NAMES = { settings: 'CAI_DAT', photos: 'ANH', tracks: 'HANH_TRINH', routes: 'TUYEN' };
const sheetName = coll => (XL[coll] && XL[coll].sheet) || SHEET_NAMES[coll] || coll.toUpperCase();
function sheetView(coll, rec) {
  if (rec._deleted || coll === 'photos') return {};
  if (coll === 'tracks') { const l = rec.pts[rec.pts.length - 1] || []; return { MA_CHUYEN: rec.trip, MA_TAI_XE: rec.driverId, NGAY: rec.date, SO_DIEM: rec.pts.length, GIO_CUOI: l[0] ? fmtDT(new Date(l[0] * 1000).toISOString()) : '', VI_DO_CUOI: l[1] ?? '', KINH_DO_CUOI: l[2] ?? '' }; }
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
  stats() { return this.call({ action: 'stats' }); },
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
  async stats() { throw new Error('Supabase: xem dung lượng trong trang quản trị Supabase (Settings → Usage)'); },
};
function recDate(coll, rec) {
  if (!rec) return '';
  if (coll === 'logs') return rec.t ? localDate(new Date(rec.t)) : '';
  if (['orders', 'trips', 'settlements', 'photos', 'tracks'].includes(coll)) return rec.date || '';
  return '';
}
const tooOld = (coll, rec) => { const cut = S()?.purgeCutoff, d = recDate(coll, rec); return !!(cut && d && d < cut); };

const Cloud = {
  cfg: (() => { try { return JSON.parse(localStorage.getItem('bc_cloud') || '{}'); } catch { return {}; } })(),
  q: new Map(), status: 'off', lastErr: '', timer: null, pushTimer: null, qTimer: null,
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
    const every = this.provider() === 'gsheet' ? 20000 : 8000;
    this.sync(); this.timer = setInterval(() => { if (!document.hidden) this.sync(); }, every);
  },
  persistQueue() { clearTimeout(this.qTimer); this.qTimer = setTimeout(() => IDB.put('kv', '_queue', [...this.q.values()]), 400); },
  queue(coll, rec) {
    if (!this.enabled()) return;
    this.q.set(coll + '|' + rec.id, { coll, id: rec.id, data: rec, deleted: !!rec._deleted });
    this.persistQueue();
    clearTimeout(this.pushTimer); this.pushTimer = setTimeout(() => this.push(), 800);
  },
  setStatus(s, err = '') { this.status = s; this.lastErr = err; if (typeof updateSync === 'function') updateSync(); },
  async push() {
    if (!this.enabled() || !this.q.size || !navigator.onLine || this.pushing) return;
    this.pushing = true;
    try {
      const rows = [...this.q.values()];
      const batches = []; let cur = [], size = 0;
      for (const r of rows) {
        const s = JSON.stringify(r.data).length, lim = r.coll === 'photos' ? 8 : 150;
        if (cur.length && (cur.length >= lim || size + s > 3e6)) { batches.push(cur); cur = []; size = 0; }
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
          if (this.q.has(row.coll + '|' + row.id)) continue;
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
      if (S()?.purgeCutoff && S().purgeCutoff !== oldCut) await pruneLocal(S().purgeCutoff);
      if (changed.size && typeof onRemoteChange === 'function') onRemoteChange(changed);
      this.setStatus('on');
    } catch (e) { this.setStatus('err', e.message); }
    finally { this.pulling = false; }
  },
  async sync() { await this.push(); await this.pull(); },
  async fetchPhoto(id) { try { return await this.P.photo(id); } catch { return null; } },
  test() { return this.P.test(); },
  stats() { return this.P.stats(); },
  async pushAll() {
    for (const c of COLLS) for (const rec of DB[c]) this.q.set(c + '|' + rec.id, { coll: c, id: rec.id, data: rec, deleted: false });
    for (const o of DB.orders) for (const p of (o.photos || [])) {
      const data = await IDB.get('photos', p.id);
      if (data) this.q.set('photos|' + p.id, { coll: 'photos', id: p.id, data: { id: p.id, data, order: o.code, date: o.date, kind: p.kind, _u: p.t }, deleted: false });
    }
    await IDB.put('kv', '_queue', [...this.q.values()]);
    await this.push();
  },
  pendingOld(cutoff) { return [...this.q.values()].filter(r => { const d = recDate(r.coll, r.data); return d && d < cutoff; }).length; },
};

/* ---------- Lưu trữ có thời hạn (Google Sheet / Drive vẫn giữ đủ) ---------- */
function retentionCutoff(months = S().retentionMonths || 3) {
  const d = new Date(); d.setMonth(d.getMonth() - months); return localDate(d);
}
function oldDataStats(cutoff) {
  const old = coll => DB[coll].filter(r => { const d = recDate(coll, r); return d && d < cutoff; });
  const orders = old('orders');
  return { orders: orders.length, trips: old('trips').length, settlements: old('settlements').length, logs: old('logs').length, tracks: old('tracks').length,
    photos: orders.reduce((s, o) => s + (o.photos || []).length, 0), oldest: DB.orders.map(o => o.date).sort()[0] || '' };
}
async function pruneLocal(cutoff) {
  const photoIds = [];
  for (const coll of ['orders', 'trips', 'settlements', 'logs', 'tracks']) {
    const before = DB[coll].length;
    DB[coll] = DB[coll].filter(r => {
      const d = recDate(coll, r), old = d && d < cutoff;
      if (old && coll === 'orders') (r.photos || []).forEach(p => photoIds.push(p.id));
      return !old;
    });
    if (DB[coll].length !== before) persist(coll);
  }
  for (const id of photoIds) await IDB.del('photos', id);
  await flush();
}

/* ---------- Dung lượng đang dùng ---------- */
async function storageStats() {
  const est = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => null) : null;
  const colls = {}; for (const c of COLLS) colls[c] = { n: DB[c].length, bytes: JSON.stringify(DB[c]).length };
  const photos = await IDB.sizeOf('photos');
  return { usage: est?.usage ?? null, quota: est?.quota ?? null, colls, photos };
}

/* =====================================================================
   CHUẨN HÓA EXCEL IN/OUT — tên sheet & tên cột cố định (không dấu, IN HOA)
   ===================================================================== */
const XL = {
  orders: { sheet: 'DON_HANG', cols: [
    ['code', 'MA_DON', 'Mã đơn duy nhất (MÃ ĐƠN HÀNG XUẤT)'], ['refNo', 'SO_DON_XUAT', 'Số đơn hàng xuất'], ['orderDate', 'NGAY_TAO_DON', 'Ngày đặt hàng (yyyy-mm-dd)'],
    ['dueDate', 'HAN_GIAO', 'Hạn giao = ngày đặt + hạn mức giao của khách'], ['date', 'NGAY_GIAO', 'Ngày giao theo kế hoạch'], ['shipDate', 'NGAY_XUAT_HANG', 'Ngày xuất hàng thực tế'],
    ['customerCode', 'MA_KH', 'Mã khách hàng'], ['customerName', 'TEN_KH', ''], ['phone', 'SDT', ''], ['address', 'DIA_CHI', ''], ['province', 'TINH', ''], ['district', 'QUAN_HUYEN', ''],
    ['timeWindow', 'KHUNG_GIO', 'Trong giờ hành chính'], ['cartons', 'SO_THUNG', 'Số lượng thùng'], ['weightKg', 'KHOI_LUONG_KG', 'Số, dấu chấm là thập phân khi nhập'],
    ['noEarly', 'KHONG_GIAO_SOM', 'Có = không giao trước hạn'], ['status', 'TRANG_THAI', Object.keys(OST).join(' | ')],
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
    ['code', 'MA_KH', 'Bắt buộc, duy nhất'], ['name', 'TEN_KH', ''], ['channel', 'KENH', 'Kênh bán hàng'], ['chain', 'CHUOI', ''], ['phone', 'SDT', ''], ['address', 'DIA_CHI', ''],
    ['province', 'TINH', ''], ['district', 'QUAN_HUYEN', ''], ['area', 'KHU_VUC', ''], ['region', 'VUNG_MIEN', ''],
    ['slaDays', 'HAN_MUC_NGAY', 'Hạn mức giao hàng (ngày)'], ['serviceMin', 'PHUT_GIAO_TAI_DIEM', ''], ['lat', 'VI_DO', ''], ['lng', 'KINH_DO', ''], ['geoSrc', 'NGUON_TOA_DO', 'gps | manual | quan | tinh'], ['note', 'GHI_CHU', '']] },
  addresses: { sheet: 'DIA_CHI_GIAO', cols: [['code', 'MA_DIA_CHI', ''], ['customerCode', 'MA_KH', ''], ['customerName', 'TEN_KH', ''], ['address', 'DIA_CHI_GIAO_HANG', '']] },
  vehicles: { sheet: 'XE', cols: [['plate', 'BIEN_SO', ''], ['type', 'LOAI_XE', ''], ['capacityKg', 'TAI_TRONG_KG', '']] },
  users: { sheet: 'NHAN_SU', cols: [['id', 'MA_NV', ''], ['name', 'HO_TEN', ''], ['role', 'VAI_TRO', Object.keys(ROLES).join(' | ')], ['plant', 'NHA_MAY', ''], ['dept', 'BO_PHAN', ''], ['phone', 'SDT', ''], ['vehicle', 'XE_MAC_DINH', ''], ['active', 'HOAT_DONG', '']] },
  settlements: { sheet: 'DOI_SOAT', cols: [['date', 'NGAY', ''], ['driverId', 'MA_TAI_XE', ''], ['orders', 'SO_DON', ''], ['ok', 'GIAO_TC', ''], ['fail', 'KHONG_GIAO', ''], ['cartons', 'SO_THUNG_GIAO', ''], ['kg', 'KG_GIAO', ''], ['onTimePct', 'DUNG_HAN_PCT', ''], ['by', 'NGUOI_XAC_NHAN', ''], ['at', 'GIO_XAC_NHAN', ''], ['note', 'GHI_CHU', '']] },
  logs: { sheet: 'NHAT_KY', cols: [['t', 'THOI_GIAN', ''], ['userId', 'MA_NV', ''], ['userName', 'HO_TEN', ''], ['role', 'VAI_TRO', ''], ['action', 'THAO_TAC', ''], ['entity', 'DOI_TUONG', ''], ['detail', 'CHI_TIET', '']] },
};
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const xlCell = v => v == null ? '' : (typeof v === 'string' && ISO_RE.test(v)) ? fmtDT(v) : (typeof v === 'boolean' ? (v ? 'Có' : 'Không') : v);
const toXlRows = (coll, recs) => recs.map(r => Object.fromEntries(XL[coll].cols.map(([k, h]) => [h, xlCell(r[k])])));
const addressRows = custs => custs.flatMap(c => (c.addresses || []).map(a => ({ MA_DIA_CHI: a.code, MA_KH: c.code, TEN_KH: c.name, DIA_CHI_GIAO_HANG: a.address })));
function needXLSX() { if (!window.XLSX) { toast('Chưa tải được thư viện Excel – kiểm tra kết nối mạng.'); return false; } return true; }
function writeWorkbook(sheets, filename, quiet) {
  if (!needXLSX()) return;
  const wb = XLSX.utils.book_new();
  for (const [name, rows, header] of sheets) {
    const ws = rows.length ? XLSX.utils.json_to_sheet(rows, header ? { header } : undefined) : XLSX.utils.aoa_to_sheet([header || []]);
    if (rows.length || header) ws['!cols'] = Object.keys(rows[0] || Object.fromEntries((header || []).map(h => [h, 1]))).map(h => ({ wch: Math.max(10, Math.min(40, h.length + 4)) }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
  if (!quiet) log('Xuất Excel', filename, sheets.map(s => `${s[0]}:${s[1].length}`).join(', '));
}
function xlDate(v) {
  if (v instanceof Date) return isNaN(v) ? '' : localDate(new Date(v.getTime() + 12 * 36e5));   // cellDates lệch múi giờ → bù 12 giờ
  if (typeof v === 'number') return localDate(new Date(Math.round((v - 25569) * 864e5) + 12 * 36e5));
  const s = String(v || '').trim(); let m;
  if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s))) return `${m[3]}-${z2(m[2])}-${z2(m[1])}`;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return `${m[1]}-${z2(m[2])}-${z2(m[3])}`;
  return '';
}

/* =====================================================================
   NHẬP ĐƠN TỪ FILE MẪU ĐƠN GIAO
   Cột nhận diện theo tên (không phân biệt hoa/thường/dấu): MÃ HÀNG, MÔ TẢ, TÊN KHÁCH HÀNG,
   SỐ ĐƠN HÀNG XUẤT, TÊN TÀI XẾ, MÃ ĐƠN HÀNG XUẤT, NGÀY XUẤT HÀNG THỰC TẾ, NGÀY ĐẶT HÀNG,
   SỐ LƯỢNG THÙNG, KG; tùy chọn: MÃ KH, MÃ ĐỊA CHỈ, ĐỊA CHỈ GIAO HÀNG, HẠN GIAO, KHUNG GIỜ, GHI CHÚ, KHÔNG GIAO SỚM.
   Mỗi dòng là 1 mặt hàng; các dòng cùng MÃ ĐƠN HÀNG XUẤT gộp thành 1 đơn (cộng thùng và kg).
   ===================================================================== */
const ORDER_HEADERS = {
  itemCode: ['ma hang'], itemDesc: ['mo ta'], customerName: ['ten khach hang', 'khach hang', 'ten kh'], customerCode: ['ma kh', 'ma khach hang'],
  refNo: ['so don hang xuat', 'so don xuat'], driverName: ['ten tai xe', 'tai xe'], code: ['ma don hang xuat', 'ma don giao', 'ma don'],
  shipDate: ['ngay xuat hang thuc te', 'ngay xuat hang'], orderDate: ['ngay dat hang', 'ngay tao don'], cartons: ['so luong thung', 'so thung', 'thung'],
  kg: ['kg', 'khoi luong kg', 'khoi luong'], dueDate: ['han giao', 'han giao hang'], address: ['dia chi giao hang', 'dia chi giao', 'dia chi'],
  addrCode: ['ma dia chi'], timeWindow: ['khung gio', 'khung gio giao'], note: ['ghi chu'], noEarly: ['khong giao som'],
};
function mapHeaders(keys, spec) {
  const map = {}; const norm = keys.map(k => [k, vnorm(k)]);
  for (const [field, names] of Object.entries(spec)) {
    const hit = norm.find(([, n]) => names.includes(n)) || norm.find(([, n]) => names.some(x => n === x + ' 1'));
    if (hit) map[field] = hit[0];
  }
  return map;
}
// Chỉ mục khách hàng theo tên (đã chuẩn hóa) để khớp tên khách trong file đơn với danh mục
function buildCustIndex() {
  const exact = new Map(), list = [];
  for (const c of DB.customers) for (const nm of [c.name, c.alias, c.code]) { const n = vnorm(nm); if (n) { if (!exact.has(n)) exact.set(n, c); if (nm !== c.code && n.length >= 6) list.push([n, c]); } }
  return { exact, list };
}
function matchCustomer(idx, name, code) {
  if (code && custOf(String(code))) return custOf(String(code));
  const n = vnorm(name); if (!n) return null;
  if (idx.exact.has(n)) return idx.exact.get(n);
  // khớp gần đúng: tên trong danh mục chứa tên trong đơn (hoặc ngược lại) — chỉ nhận khi duy nhất
  const hits = new Set(); for (const [k, c] of idx.list) if (n.length >= 6 && (k.includes(n) || (k.length >= 10 && n.includes(k)))) hits.add(c);
  return hits.size === 1 ? [...hits][0] : null;
}
// Đọc sheet → danh sách đơn đã gộp theo mã đơn
function parseOrderSheet(wb) {
  let best = null;
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: true, cellDates: true });
    if (!rows.length) continue; const map = mapHeaders(Object.keys(rows[0]), ORDER_HEADERS);
    const score = ['customerName', 'code', 'orderDate', 'cartons', 'kg'].filter(f => map[f]).length + (map.customerName ? 2 : 0);
    if (!best || score > best.score) best = { name, rows, map, score };
  }
  if (!best || !best.map.customerName) return { error: 'Không tìm thấy cột “TÊN KHÁCH HÀNG” – hãy dùng đúng file mẫu đơn giao.', orders: [], lines: 0 };
  const { rows, map } = best, g = f => r => map[f] ? r[map[f]] : '';
  const groups = new Map(), errs = []; let lines = 0, skipped = 0;
  rows.forEach((r, i) => {
    const cname = String(g('customerName')(r)).trim(), code = String(g('code')(r)).trim(), ref = String(g('refNo')(r)).trim();
    const kg = xlNum(g('kg')(r)), th = xlNum(g('cartons')(r));
    if (!cname && !code && !ref && kg == null && th == null) { skipped++; return; }
    if (!cname) { errs.push(`Dòng ${i + 2}: thiếu TÊN KHÁCH HÀNG`); return; }
    const od = xlDate(g('orderDate')(r));
    const key = code || ref || `${vnorm(cname)}|${od}`;
    lines++;
    let o = groups.get(key);
    if (!o) { o = { key, code, refNo: ref, customerName: cname, customerCode: String(g('customerCode')(r)).trim(), driverName: String(g('driverName')(r)).trim(),
      orderDate: od, shipDate: xlDate(g('shipDate')(r)), dueDate: xlDate(g('dueDate')(r)), address: String(g('address')(r)).trim(), addrCode: String(g('addrCode')(r)).trim(),
      timeWindow: String(g('timeWindow')(r)).trim(), note: String(g('note')(r)).trim(), noEarly: /^(co|x|1|true|y|yes)$/i.test(vnorm(g('noEarly')(r))), cartons: 0, kg: 0, lines: 0, row: i + 2 }; groups.set(key, o); }
    o.cartons += th || 0; o.kg += kg || 0; o.lines++;
    if (!o.orderDate && od) o.orderDate = od; if (!o.shipDate) o.shipDate = xlDate(g('shipDate')(r));
  });
  return { orders: [...groups.values()], lines, skipped, errors: errs, sheet: best.name, found: Object.keys(map) };
}
// Dựng đơn từ dòng đã đọc: khớp khách, tính hạn giao
function buildOrderFromRow(r, idx) {
  const c = matchCustomer(idx, r.customerName, r.customerCode);
  const orderDate = r.orderDate || today();
  const o = { id: r.code, code: r.code, refNo: r.refNo, status: 'cho_phan_cong', orderDate, cartons: Math.round(r.cartons * 100) / 100, weightKg: Math.round(r.kg * 1000) / 1000,
    noEarly: r.noEarly, note: r.note, photos: [], timeWindow: TIME_WINDOWS.includes(r.timeWindow) ? r.timeWindow : OFFICE };
  if (c) orderFromCustomer(o, c); else { o.customerName = r.customerName; o.customerCode = ''; o.serviceMin = S().defaultServiceMin || 10; }
  if (r.address) { o.address = r.address; o.addrCode = r.addrCode; const g = guessGeo(r.address); if (g && !(c && precise(c))) { o.lat = g.lat; o.lng = g.lng; o.geoSrc = g.src; o.province = g.province; o.district = g.district; } }
  if (!o.province) { const g = guessGeo(o.address || r.customerName); if (g) { o.province = g.province; o.district = g.district; if (o.lat == null) { o.lat = g.lat; o.lng = g.lng; o.geoSrc = g.src; } } }
  const sla = c?.slaDays ?? S().defaultSlaDays ?? 3;
  o.dueDate = r.dueDate || addDays(orderDate, sla); o.date = o.dueDate; o.shipDate = r.shipDate || '';
  return { order: o, customer: c };
}
function orderFromCustomer(o, c) {
  Object.assign(o, { customerCode: c.code, customerName: c.name, phone: c.phone || '', address: c.address, province: c.province || '', district: c.district || '',
    serviceMin: Number(c.serviceMin) || S()?.defaultServiceMin || 10, lat: c.lat ?? null, lng: c.lng ?? null, geoSrc: c.geoSrc || '' });
  o.timeWindow = o.timeWindow || OFFICE;
  if (!o.dueDate && o.orderDate) o.dueDate = addDays(o.orderDate, c.slaDays ?? S()?.defaultSlaDays ?? 3);
  if (!o.date) o.date = o.dueDate || today();
  return o;
}

/* ---------- Nhập danh mục khách hàng từ 2 file Excel (hạn mức giao hàng + địa chỉ giao hàng) ---------- */
const CUST_HEADERS = {
  code: ['ma kh', 'ma khach hang', 'bp code'], name: ['ten kh', 'ten khach hang', 'bp name'], channel: ['kenh ban hang', 'bp group'], chain: ['chuoi'], address: ['dia chi'],
  sla: ['han muc giao hang', 'han muc', 'han muc ngay'], route: ['c tinh thanh', 'ma tuyen', 'tuyen'], area: ['c khu vuc', 'khu vuc'], region: ['c vung mien', 'vung mien'],
  addrCode: ['ma dia chi'], addrText: ['dia chi giao hang'], phone: ['sdt', 'so dien thoai'],
};
function parseCustomerWorkbook(wb) {
  const found = new Map(); const addrs = []; let rowsRead = 0;
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: true }); if (!rows.length) continue;
    const m = mapHeaders(Object.keys(rows[0]), CUST_HEADERS); if (!m.code) continue;
    for (const r of rows) {
      const code = String(r[m.code] ?? '').trim(); if (!code) continue; rowsRead++;
      if (m.addrCode && m.addrText) { if (String(r[m.addrText]).trim()) addrs.push([code, String(r[m.addrCode]).trim(), String(r[m.addrText]).trim()]); }
      const c = found.get(code) || { c: code };
      const set = (k, f) => { if (m[f] && String(r[m[f]]).trim() !== '') c[k] = typeof r[m[f]] === 'string' ? r[m[f]].trim() : r[m[f]]; };
      set('n', 'name'); set('ch', 'channel'); set('chain', 'chain'); set('ad', 'address'); set('rt', 'route'); set('ar', 'area'); set('rg', 'region'); set('phone', 'phone');
      if (m.sla && r[m.sla] !== '') c.sla = xlNum(r[m.sla]);
      found.set(code, c);
    }
  }
  const customers = [...found.values()].filter(c => c.n);
  return { customers, addresses: addrs, rowsRead };
}
