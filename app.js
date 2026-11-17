'use strict';
/* =====================================================================
   app.js — khởi động, đăng nhập, khung giao diện, thành phần dùng chung
   (các màn hình nằm trong views-ops.js, views-field.js, views-admin.js)
   ===================================================================== */
const START_TIMES = (() => { const a = []; for (let m = 5 * 60; m <= 14 * 60; m += 15) a.push(hhmm(m)); return a; })();
const STATE = { tab: null, f: {}, range: { preset: 'today', from: today(), to: today() }, calMonth: today().slice(0, 7), catTab: 'customers', plan: null, pending: [], pg: {}, mapSel: {} };
const ACT = {}, CHG = {};
let installEvt = null, MIGRATION = null;

/* ---------- Biểu tượng ---------- */
const ICONS = {
  kho: 'M3 8l9-5 9 5v9l-9 4-9-4V8z|M3 8l9 4 9-4|M12 12v9',
  dash: 'M4 4h7v7H4z|M13 4h7v4h-7z|M13 10h7v10h-7z|M4 13h7v7H4z',
  mine: 'M3 7h11v9H3z|M14 10h4l3 3v3h-7z|M7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z|M17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  orders: 'M4 7l8-4 8 4v10l-8 4-8-4V7z|M4 7l8 4 8-4|M12 11v10',
  assign: 'M12 3v18|M5 7h14|M5 7l-2 6a3 3 0 006 0L7 7|M19 7l-2 6a3 3 0 006 0l-2-6',
  trips: 'M6 19a2 2 0 100-4 2 2 0 000 4z|M18 9a2 2 0 100-4 2 2 0 000 4z|M8 17h6a3 3 0 000-6h-4a3 3 0 010-6h6',
  map: 'M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z|M12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  cal: 'M4 6h16v14H4z|M4 10h16|M8 3v5M16 3v5',
  review: 'M12 21a9 9 0 100-18 9 9 0 000 18z|M8.5 12l2.5 2.5 4.5-5',
  photos: 'M4 8h4l2-3h4l2 3h4v11H4z|M12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  settle: 'M7 4h10v17H7z|M10 4V3h4v1|M10 10h4M10 14h4',
  report: 'M5 20V10M12 20V4M19 20v-8',
  history: 'M12 7v5l3 2|M4 12a8 8 0 108-8 8 8 0 00-6 2.7L4 9|M4 4v5h5',
  catalog: 'M4 5h16v4H4z|M4 11h16v4H4z|M4 17h16v3H4z',
  data: 'M7 4v14|M3.5 14.5L7 18l3.5-3.5|M17 20V6|M13.5 9.5L17 6l3.5 3.5',
  logs: 'M6 3h9l4 4v14H6z|M14 3v5h5|M9 13h7M9 17h7',
  admin: 'M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z|M9.5 12l2 2 3.5-4',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z|M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  plus: 'M12 5v14M5 12h14', up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M19 12l-7 7-7-7', save: 'M5 4h12l3 3v13H5z|M8 4v5h7V4|M8 20v-6h8v6',
  pass: 'M5 12.5l4.5 4.5L19 7.5', fail: 'M6 6l12 12M18 6L6 18', warn: 'M12 4l9 16H3l9-16z|M12 10v4|M12 17v.5', info: 'M12 11v6|M12 7.5v.5|M12 21a9 9 0 100-18 9 9 0 000 18z',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z|M12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z', user: 'M12 12a4 4 0 100-8 4 4 0 000 8z|M4 21a8 8 0 0116 0',
  cloud: 'M7 18a4 4 0 010-8 5 5 0 019.6-1A4.5 4.5 0 0117 18z', hold: 'M12 7v5l3 2|M12 21a9 9 0 100-18 9 9 0 000 18z',
};
const ico = (k, s = 18) => svgIcon(ICONS[k] || '', s);

/* ---------- Thành phần giao diện dùng chung ---------- */
const btn = (label, act, id = '', kind = 'secondary', size = 'md', extra = '') => `<button type="button" class="nn-btn nn-btn-${kind} nn-btn-${size}" data-act="${act}" data-id="${esc(id)}" ${extra}>${label}</button>`;
const abtn = (label, href, kind = 'secondary', size = 'md', extra = '') => `<a class="nn-btn nn-btn-${kind} nn-btn-${size}" href="${href}" target="_blank" rel="noopener" ${extra}>${label}</a>`;
// Ô nhập: o = { type, ph, unit, cls, attrs, size, readonly, list, fmt (số có dấu chấm), msg, required }
function fld(label, name, value = '', o = {}) {
  const t = o.fmt ? 'text' : (o.type || 'text');
  return `<label class="nn-field ${o.cls || 'grow'}"><span class="nn-label">${label}${o.required ? ' *' : ''}</span>
    <span class="nn-input-wrap nn-input-${o.size || 'md'}"><input class="nn-input" name="${name}" type="${t}" value="${esc(o.fmt && value !== '' && value != null ? num(value, 3) : value ?? '')}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}
      ${o.fmt ? 'inputmode="decimal" data-numfmt="1"' : ''} ${o.list ? `list="${o.list}"` : ''} ${o.readonly ? 'readonly' : ''} ${o.attrs || ''}>${o.unit ? `<span class="nn-input-unit">${o.unit}</span>` : ''}</span>
    ${o.msg ? `<span class="nn-field-msg">${o.msg}</span>` : ''}</label>`;
}
function fsel(label, name, items, cur, o = {}) {
  return `<label class="nn-field ${o.cls || 'grow'}"><span class="nn-label">${label}</span><span class="nn-input-wrap nn-input-${o.size || 'md'}">${selectHTML(name, items, cur, { empty: o.empty, attrs: o.attrs || '' })}</span>${o.msg ? `<span class="nn-field-msg">${o.msg}</span>` : ''}</label>`;
}
const ftxt = (label, name, value = '', o = {}) => `<label class="nn-field ${o.cls || 'full'}"><span class="nn-label">${label}</span><span class="nn-input-wrap tall"><textarea class="nn-textarea" name="${name}" ${o.attrs || ''}>${esc(value)}</textarea></span></label>`;
const pinFld = (label, name, o = {}) => `<label class="nn-field ${o.cls || 'grow'}"><span class="nn-label">${label}</span><span class="nn-input-wrap nn-input-${o.size || 'lg'} pw"><input class="nn-input" name="${name}" type="password" inputmode="numeric" maxlength="8" autocomplete="${o.auto || 'new-password'}" placeholder="4–8 chữ số"><button type="button" class="eye" data-act="togglePw">Hiện</button></span></label>`;
ACT.togglePw = (id, el) => { const i = el.closest('.pw').querySelector('input'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? 'Ẩn' : 'Hiện'; };
const alertBox = (tone, title, text, extra = '') => `<div class="nn-alert nn-alert-${tone} alert-gap" role="${tone === 'danger' ? 'alert' : 'status'}"><span class="nn-alert-icon nn-tone-${tone}">${svgIcon(TONE_ICON[tone], 20)}</span><div class="nn-alert-body">${title ? `<div class="nn-alert-title">${title}</div>` : ''}<div class="nn-alert-text">${text}</div></div>${extra}</div>`;
const kpi = (label, value, unit = '', foot = '', tone) => `<div class="nn-kpi"><div class="nn-kpi-top"><span class="nn-label">${label}</span>${tone ? statusTag(tone[1], tone[0]) : ''}</div><div class="nn-kpi-value">${value}${unit ? `<span class="nn-kpi-unit">${unit}</span>` : ''}</div>${foot ? `<div class="nn-kpi-foot">${foot}</div>` : ''}</div>`;
const tbl = (head, rows, o = {}) => `<div class="nn-table-wrap"><table class="nn-table"><thead><tr>${head.map(h => typeof h === 'string' ? `<th>${h}</th>` : `<th class="${h[1] || ''}">${h[0]}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}" class="empty">${o.empty || 'Chưa có dữ liệu'}</td></tr>`}</tbody></table></div>`;
const pageTitle = (t, right = '') => `<div class="sec-title"><h1>${t}</h1><div class="rw center">${right}</div></div>`;

// Bộ lọc ngày nhanh: hôm qua / hôm nay / tuần này / tháng này / tùy chỉnh (chọn trong lịch)
const rangeOn = () => { const r = STATE.range; return r.preset === 'custom' ? [r.from <= r.to ? r.from : r.to, r.from <= r.to ? r.to : r.from] : presetRange(r.preset); };
const inRange = d => { const [a, b] = rangeOn(); return !!d && d >= a && d <= b; };
const rangeLabel = () => { const [a, b] = rangeOn(); return a === b ? `${wday(a)} ${fmtD(a)}` : `${fmtD(a)} – ${fmtD(b)}`; };
function rangeBar(label = 'Khoảng ngày') {
  const r = STATE.range, [a, b] = rangeOn();
  return `<div class="rw center mb"><div><div class="nn-label" style="margin-bottom:4px">${label}</div><div class="seg lg">${PRESETS.map(([p, l]) => `<button type="button" data-act="rangePreset" data-id="${p}" class="${r.preset === p ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    ${r.preset === 'custom' ? fld('Từ ngày', 'rfrom', r.from, { type: 'date', cls: 'narrow', attrs: 'data-chg="rangeFrom"' }) + fld('Đến ngày', 'rto', r.to, { type: 'date', cls: 'narrow', attrs: 'data-chg="rangeTo"' }) : `<span class="small muted" style="align-self:flex-end;padding-bottom:10px">${fmtD(a)}${a === b ? '' : ' – ' + fmtD(b)}</span>`}</div>`;
}
ACT.rangePreset = p => { if (p === 'custom') { const [a, b] = rangeOn(); STATE.range = { preset: 'custom', from: a, to: b }; } else STATE.range = { preset: p, from: STATE.range.from, to: STATE.range.to }; STATE.plan = null; renderView(); };
CHG.rangeFrom = el => { STATE.range.from = el.value || today(); renderView(); };
CHG.rangeTo = el => { STATE.range.to = el.value || today(); renderView(); };
function pager(total, key, size = 50) {
  const pages = Math.max(1, Math.ceil(total / size)), p = Math.min(STATE.pg[key] || 0, pages - 1); STATE.pg[key] = p;
  return { from: p * size, to: p * size + size, html: total > size ? `<div class="pager"><span class="small muted">Hiển thị ${num(p * size + 1, 0)}–${num(Math.min(total, p * size + size), 0)} / ${num(total, 0)}</span><div class="rw center">${btn('‹ Trước', 'pg', key + '|-1', 'secondary', 'sm', p === 0 ? 'disabled' : '')}<span class="small">Trang ${p + 1}/${pages}</span>${btn('Sau ›', 'pg', key + '|1', 'secondary', 'sm', p >= pages - 1 ? 'disabled' : '')}</div></div>` : '' };
}
ACT.pg = v => { const [k, d] = v.split('|'); STATE.pg[k] = Math.max(0, (STATE.pg[k] || 0) + Number(d)); renderView(); };

// Chọn khách hàng có tìm kiếm (danh mục hàng nghìn khách)
function custPicker(code, name) {
  return `<div class="nn-field full"><span class="nn-label">Khách hàng – gõ mã hoặc tên để tìm, chọn là tự điền địa chỉ, tỉnh, hạn giao</span>
    <span class="nn-input-wrap nn-input-md"><input class="nn-input" data-custsearch="1" autocomplete="off" placeholder="Tìm khách hàng…" value="${esc(code ? `${code} – ${name || ''}` : '')}"></span>
    <div id="cp-list" class="picklist" hidden></div><input type="hidden" name="customerCode" value="${esc(code || '')}"></div>`;
}
function custSearch(q, limit = 30) {
  const n = vnorm(q); if (!n) return DB.customers.slice(0, limit);
  const parts = n.split(' ');
  return DB.customers.filter(c => { const h = vnorm(`${c.code} ${c.name} ${c.alias || ''} ${c.address || ''}`); return parts.every(p => h.includes(p)); }).slice(0, limit);
}
document.addEventListener('input', e => {
  const el = e.target.closest('[data-custsearch]'); if (!el) return;
  const list = $('#cp-list'); const rs = custSearch(el.value.replace(/^\S+ – /, ''));
  list.hidden = false; list.innerHTML = rs.map(c => `<div data-act="pickCust" data-id="${esc(c.code)}"><b class="nn-mono">${esc(c.code)}</b> · ${esc(c.name)}<div class="small muted">${esc([c.province, c.address].filter(Boolean).join(' · '))}</div></div>`).join('') || '<div class="muted">Không thấy khách phù hợp</div>';
});

/* ---------- Khởi động ---------- */
async function boot() {
  try { MIGRATION = await loadAll(); } catch (e) { document.getElementById('app').innerHTML = `<div class="empty">Không mở được bộ nhớ trình duyệt: ${esc(e.message)}</div>`; return; }
  await Cloud.init();
  if (Cloud.enabled() && !DB.users.length) await Cloud.pull();
  if (S().purgeCutoff) await pruneLocal(S().purgeCutoff);
  ME = restoreSession();
  ME ? afterLogin(true) : renderLogin();
  registerSW(); checkAppUpdate(); setInterval(checkAppUpdate, 30 * 60 * 1000);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  setInterval(() => { if (ME && ['dash', 'mine'].includes(STATE.tab) && !$('.ov') && !isTyping()) refreshView(); }, 30000);
}
const isTyping = () => { const a = document.activeElement; return a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) && a.closest('#view'); };
function onRemoteChange(colls) {
  if (!ME) return;
  if (colls.has('users')) { const u = byId('users', ME.id); if (!u || u.active === false || (u.pinHash !== ME.pinHash)) { if (!u || u.active === false) return ACT.logout(); } ME = u || ME; }
  if (!$('.ov') && !isTyping()) refreshView();
}
function refreshView() { if (STATE.tab === 'map' && typeof mapUpdate === 'function' && window.__map) mapUpdate(); else renderView(); }

/* ---------- Cập nhật phiên bản (không ảnh hưởng dữ liệu) ---------- */
function registerSW() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) showUpdateBar('Đã có phiên bản mới của app.'); });
}
async function checkAppUpdate(manual) {
  try {
    const j = await fetch('version.json?' + Date.now(), { cache: 'no-store' }).then(r => r.json());
    STATE.latest = j;
    if (j.version && j.version !== APP_VERSION) { showUpdateBar(`Có phiên bản mới ${j.version} (đang dùng ${APP_VERSION}).`); return j; }
    if (manual) toast('Bạn đang dùng phiên bản mới nhất');
    return j;
  } catch { if (manual) toast('Không kiểm tra được phiên bản – kiểm tra mạng'); }
}
function showUpdateBar(msg) {
  if ($('#updbar')) return;
  // Đã bấm cập nhật mà vẫn đang ở bản cũ → nói rõ nguyên nhân thường gặp
  let tried = ''; try { tried = sessionStorage.getItem('bc_upd_try') === APP_VERSION ? ' Đã thử cập nhật nhưng vẫn là bản cũ: kiểm tra tab Actions của GitHub đã xong (dấu ✓ xanh) và file core.js trên GitHub đã có APP_VERSION mới, rồi đợi vài phút.' : ''; } catch {}
  const d = document.createElement('div'); d.id = 'updbar'; d.className = 'updbar';
  d.innerHTML = `<span>${esc(msg)} Dữ liệu của bạn được giữ nguyên.${esc(tried)}</span>${btn('Cập nhật ngay', 'applyUpdate', '', 'secondary', 'sm')}`;
  const top = $('.app-top'); top ? top.after(d) : document.body.prepend(d);
}
ACT.applyUpdate = async () => {
  toast('Đang cập nhật…', 4000);
  try { sessionStorage.setItem('bc_upd_try', APP_VERSION); } catch {}
  try { await flush(); } catch {}
  try { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } catch {}
  try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); } catch {}
  try { localStorage.removeItem('bc_ver'); } catch {}
  location.replace(location.pathname + '?u=' + Date.now());   // địa chỉ mới → bỏ qua trang cũ trong bộ nhớ đệm
};

/* ---------- Sự kiện chung (event delegation) ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(el.dataset.id, el, e);
});
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el, e); });
let inpT; document.addEventListener('input', e => {
  const el = e.target.closest('[data-inp]'); if (!el) return;
  clearTimeout(inpT); inpT = setTimeout(() => { STATE.f[el.name] = el.value; STATE.pg = {}; renderView(); const n = document.querySelector(`#view [name="${el.name}"]`); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 300);
});
// Số hiển thị có dấu chấm ngăn nghìn khi rời ô nhập
document.addEventListener('focusout', e => { const el = e.target.closest('[data-numfmt]'); if (!el) return; const n = parseVN(el.value); el.value = n == null ? '' : num(n, 3); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('.ov')) ACT.closeModal(); });
CHG.f = el => { STATE.f[el.name] = el.value; STATE.pg = {}; renderView(); };

/* ---------- Đăng nhập (ghi nhớ phiên, xem được PIN) ---------- */
const SESSION_KEY = 'bc_session';
function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY); if (!raw) return null;
    let s; try { s = JSON.parse(raw); } catch { s = { id: raw }; }
    const u = byId('users', s.id);
    if (!u || u.active === false) return null;
    if (s.h && u.pinHash && s.h !== u.pinHash) return null;       // PIN đã bị đổi → đăng nhập lại
    return u;
  } catch { return null; }
}
const saveSession = u => localStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, h: u.pinHash }));
async function usingDefaultPin() { return !!(ME && ME.pinHash && ME.pinHash === await hashPin(ME.id, '1234')); }
function logoHTML() { return `<div class="nn-header-logo"><img src="icons/nutrinest-logo.png" alt="NutriNest" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'NutriNest'}))"></div>`; }
function renderLogin() {
  const first = DB.users.length === 1 && DB.users[0].id === 'ADMIN';
  document.getElementById('app').innerHTML = `
  <div class="login">
    <header class="nn-header">${logoHTML()}<div class="nn-header-title"><span class="nn-header-dept">${ico('kho', 16)}<span>KV</span></span><span class="nn-header-app">Giao hàng Bình Chiểu</span></div></header>
    <div class="box"><div class="card">
      <h1>${APP_NAME}</h1>
      <p class="small muted" style="margin:0 0 var(--space-4)">Đăng nhập bằng mã nhân viên và PIN. App tự ghi nhớ phiên đăng nhập trên máy này, chỉ hỏi lại khi bạn bấm “Đăng xuất”.</p>
      <div class="nn-stack" style="padding:0">
        ${fld('Mã nhân viên', 'uid', localStorage.getItem('bc_lastUser') || '', { size: 'lg', cls: 'full', attrs: 'autocomplete="username" autocapitalize="characters" id="lg-uid"' })}
        <label class="nn-field full"><span class="nn-label">Mã PIN</span><span class="nn-input-wrap nn-input-lg pw"><input class="nn-input" id="lg-pin" type="password" inputmode="numeric" autocomplete="current-password" onkeydown="if(event.key==='Enter')ACT.login()"><button type="button" class="eye" data-act="togglePw">Hiện</button></span></label>
        ${btn('Đăng nhập', 'login', '', 'primary', 'lg', 'style="width:100%"')}
        ${first ? alertBox('info', 'Lần đầu sử dụng', 'Đăng nhập bằng mã <b>ADMIN</b>, PIN <b>1234</b>, sau đó đổi PIN và thêm nhân sự trong Danh mục.') : ''}
        ${Cloud.enabled() ? (DB.users.length ? '' : alertBox('warning', 'Chưa tải được danh sách người dùng', `${esc(Cloud.lastErr || 'Đang tải dữ liệu công ty…')} ${btn('Thử lại', 'reload', '', 'secondary', 'sm')}`)) : btn(`${ico('cloud')} Kết nối dữ liệu công ty (dán mã kết nối)`, 'connectLogin', '', 'secondary', 'md', 'style="width:100%"')}
      </div>
      <p class="small muted" style="margin:var(--space-4) 0 0">${Cloud.enabled() ? 'Đang kết nối dữ liệu công ty' : 'Đang lưu dữ liệu trên máy này'} · Phiên bản ${APP_VERSION}</p>
    </div></div>
  </div>`;
}
ACT.login = async () => {
  const id = ($('#lg-uid').value || '').trim(), pin = $('#lg-pin').value;
  if (!id || !pin) return toast('Nhập mã nhân viên và PIN');
  const u = DB.users.find(x => x.id.toLowerCase() === id.toLowerCase());
  if (!u) return toast('Không tìm thấy mã nhân viên');
  if (u.active === false) return toast('Tài khoản đã bị khóa – liên hệ Admin');
  if (!u.pinHash) return toast('Tài khoản chưa được cấp PIN – liên hệ Admin');
  if (u.pinHash !== await hashPin(u.id, pin)) return toast('Sai mã PIN');
  ME = u; saveSession(u); localStorage.setItem('bc_lastUser', u.id);
  STATE.tab = null; log('Đăng nhập', u.id, ROLES[u.role]); afterLogin();
};
async function afterLogin(restored) {
  STATE.defPin = await usingDefaultPin();
  renderShell(); Track.ensure();
}
ACT.logout = () => { Track.stop(); log('Đăng xuất', ME.id); ME = null; localStorage.removeItem(SESSION_KEY); closeModal(); renderLogin(); };
ACT.reload = () => location.reload();
ACT.connectLogin = () => openModal('Kết nối dữ liệu công ty', `<p class="small muted">Dán “mã kết nối” do Admin gửi (bắt đầu bằng BC1:).</p>
  <label class="nn-field full"><span class="nn-input-wrap tall"><textarea class="nn-textarea" id="cc-in" placeholder="BC1:…" style="min-height:110px"></textarea></span></label><div class="mt">${btn('Kết nối', 'applyCode', '', 'primary', 'lg', 'style="width:100%"')}</div>`);
ACT.applyCode = async () => {
  const v = ($('#cc-in').value || '').trim(); let c;
  try { if (!v.startsWith('BC1:')) throw 0; c = JSON.parse(decodeURIComponent(escape(atob(v.slice(4))))); } catch { return toast('Mã kết nối không hợp lệ'); }
  if (!confirm('Dữ liệu trên máy này sẽ được thay bằng dữ liệu của công ty trên đám mây. Tiếp tục?')) return;
  const old = Cloud.cfg; Cloud.cfg = Object.assign({}, c, { enabled: true });
  try { await Cloud.test(); } catch (e) { Cloud.cfg = old; return toast('Không kết nối được: ' + e.message, 6000); }
  closeModal(); toast('Đang tải dữ liệu công ty…', 4000);
  await wipeLocalData(); Cloud.saveCfg(Cloud.cfg); Cloud.lastPull = '1970-01-01T00:00:00Z';
  await Cloud.pull(); Cloud.start();
  if (Cloud.status === 'err') toast(Cloud.lastErr, 6000); else toast(`Đã kết nối · ${num(DB.users.length, 0)} nhân sự, ${num(DB.customers.length, 0)} khách hàng, ${num(DB.orders.length, 0)} đơn`);
  ME = ME && byId('users', ME.id);
  if (!ME) { localStorage.removeItem(SESSION_KEY); renderLogin(); } else { log('Kết nối đám mây', 'cloud', 'Bằng mã kết nối'); afterLogin(); }
};

/* ---------- Khung app ---------- */
const TABS = [
  { id: 'dash',     label: 'Tổng quan',    roles: ['admin', 'dieuphoi', 'ketoan'], fn: () => vDash() },
  { id: 'mine',     label: 'Việc của tôi', roles: ['taixe'], fn: () => vMine() },
  { id: 'orders',   label: 'Đơn giao',     roles: ['admin', 'dieuphoi', 'ketoan'], fn: () => vOrders() },
  { id: 'assign',   label: 'Giao việc',    roles: ['admin', 'dieuphoi'], fn: () => vAssign() },
  { id: 'trips',    label: 'Chuyến giao',  roles: ['admin', 'dieuphoi'], fn: () => vTrips() },
  { id: 'map',      label: 'Bản đồ',       roles: ['admin', 'dieuphoi'], fn: () => vMap() },
  { id: 'cal',      label: 'Lịch',         roles: ['admin', 'dieuphoi', 'taixe'], fn: () => vCal() },
  { id: 'review',   label: 'Duyệt',        roles: ['admin', 'dieuphoi'], fn: () => vReview() },
  { id: 'photos',   label: 'Ảnh giao',     roles: ['admin', 'dieuphoi'], fn: () => vPhotos() },
  { id: 'settle',   label: 'Đối soát',     roles: ['admin', 'ketoan'], fn: () => vSettle() },
  { id: 'report',   label: 'Báo cáo',      roles: ['admin', 'dieuphoi', 'ketoan'], fn: () => vReport() },
  { id: 'history',  label: 'Lịch sử',      roles: ['taixe'], fn: () => vHistory() },
  { id: 'catalog',  label: 'Danh mục',     roles: ['admin', 'dieuphoi'], fn: () => vCatalog() },
  { id: 'data',     label: 'Excel In/Out', roles: ['admin', 'dieuphoi', 'ketoan'], fn: () => vData() },
  { id: 'logs',     label: 'Nhật ký',      roles: ['admin'], fn: () => vLogs() },
  { id: 'admin',    label: 'Quản trị',     roles: ['admin'], fn: () => vAdmin() },
  { id: 'settings', label: 'Cài đặt',      roles: ['admin', 'dieuphoi', 'taixe', 'ketoan'], fn: () => vSettings() },
];
const myTabs = () => TABS.filter(t => t.roles.includes(ME.role));
function renderShell() {
  if (!STATE.tab || !myTabs().some(t => t.id === STATE.tab)) STATE.tab = myTabs()[0].id;
  document.getElementById('app').innerHTML = `
  <div class="app-top">
    <header class="nn-header" data-dept="kho">
      ${logoHTML()}
      <div class="nn-header-title"><span class="nn-header-dept">${ico('kho', 16)}<span class="t">KV</span></span><span class="nn-header-app">${APP_NAME}</span></div>
      <div class="nn-header-end"><span id="sync" class="sync"></span><button class="userchip" data-act="userMenu" aria-label="Tài khoản">${ico('user', 16)}<span class="nn-header-user" style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ME.name)}</span></button></div>
    </header>
    <nav class="tabs" id="tabs"></nav>
  </div>
  <main id="view"></main>
  <nav class="bnav" id="bnav"></nav>`;
  renderNav(); renderView(); updateSync();
  if (STATE.latest && STATE.latest.version !== APP_VERSION) showUpdateBar(`Có phiên bản mới ${STATE.latest.version} (đang dùng ${APP_VERSION}).`);
}
function renderNav() {
  $('#tabs').innerHTML = myTabs().map(t => `<button data-act="tab" data-id="${t.id}" class="${t.id === STATE.tab ? 'act' : ''}">${ico(t.id, 18)}${t.label}</button>`).join('');
  $('#bnav').innerHTML = myTabs().map(t => `<button data-act="tab" data-id="${t.id}" class="${t.id === STATE.tab ? 'act' : ''}">${ico(t.id, 22)}${t.label}</button>`).join('');
}
ACT.tab = id => { if (STATE.tab === 'map') mapStop(); STATE.tab = id; STATE.f = {}; STATE.pg = {}; renderNav(); renderView(); window.scrollTo(0, 0); };
function renderView() {
  const t = TABS.find(x => x.id === STATE.tab), v = $('#view'); if (!v || !t) return;
  if (STATE.tab !== 'map' && window.__map) mapStop();
  v.innerHTML = t.fn(); hydratePhotos(v);
  if (typeof afterRender === 'function') afterRender(STATE.tab);
}
function updateSync() {
  const el = $('#sync'); if (!el) return;
  const q = Cloud.q.size;
  if (!Cloud.enabled()) { el.innerHTML = `${ico('hold', 14)}<span class="t">Máy này</span>`; el.title = 'Dữ liệu chỉ lưu trên thiết bị này'; }
  else if (Cloud.status === 'err') { el.innerHTML = `${ico('warn', 14)}<span class="t">Lỗi đồng bộ${q ? ' · ' + q : ''}</span>`; el.title = Cloud.lastErr; }
  else { el.innerHTML = `${ico(q ? 'up' : 'pass', 14)}<span class="t">${q ? `Chờ gửi ${q}` : 'Đã đồng bộ'}</span>`; el.title = 'Đồng bộ đám mây'; }
}
ACT.userMenu = () => {
  openModal('Tài khoản', `
    <ul class="list-mini"><li><span>Họ tên</span><b>${esc(ME.name)}</b></li><li><span>Mã NV</span><b class="nn-mono">${esc(ME.id)}</b></li><li><span>Vai trò</span><b>${ROLES[ME.role]}</b></li><li><span>Nhà máy · Bộ phận</span><b>${esc(ME.plant || '')} · ${esc(ME.dept || '')}</b></li></ul>
    <h3 class="mt2">Đổi PIN</h3>
    <div class="rw mt" id="pinf">${pinFld('PIN mới', 'p1')}${pinFld('Nhập lại PIN mới', 'p2')}</div>
    <div class="rw mt">${btn('Đổi PIN', 'changePin', '', 'primary')}<span class="grow"></span>${installEvt ? btn('Cài app lên máy', 'install') : ''}${btn('Đăng xuất', 'logout', '', 'danger')}</div>
    <div class="mt">${alertBox('info', 'Cài app lên màn hình chính', installGuide())}</div>`);
};
ACT.changePin = async () => {
  const f = formData($('#pinf'));
  if (!/^\d{4,8}$/.test(f.p1)) return toast('PIN gồm 4–8 chữ số'); if (f.p1 !== f.p2) return toast('Hai lần nhập PIN không khớp');
  ME.pinHash = await hashPin(ME.id, f.p1); upsert('users', ME); saveSession(ME); STATE.defPin = false; log('Đổi PIN', ME.id); toast('Đã đổi PIN'); closeModal(); renderView();
};
ACT.install = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; closeModal(); };
const installGuide = () => `<b>iPhone (Safari):</b> bấm nút Chia sẻ ⬆ → <b>Thêm vào MH chính</b>.<br><b>Android (Chrome):</b> bấm ⋮ → <b>Thêm vào màn hình chính / Cài đặt ứng dụng</b>.<br>App mở toàn màn hình, không có thanh địa chỉ.`;

/* ---------- Hộp thoại ---------- */
function openModal(title, html, wide = false) {
  closeModal();
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="md" role="dialog" aria-modal="true" style="${wide ? 'max-width:1000px' : ''}"><div class="mh"><h2>${title}</h2><button class="x" data-act="closeModal" aria-label="Đóng">✕</button></div><div class="mb">${html}</div></div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ACT.closeModal(); });
  document.body.appendChild(ov); hydratePhotos(ov);
  return ov.querySelector('.mb');
}
function closeModal() { document.querySelectorAll('.ov').forEach(o => o.remove()); STATE.pending = []; }
ACT.closeModal = () => { closeModal(); renderView(); };
ACT.viewPhoto = async id => {
  const d = await getPhoto(id); if (!d) return toast('Ảnh chưa tải được');
  const ov = document.createElement('div'); ov.className = 'ov'; ov.style.zIndex = 60;
  ov.innerHTML = `<div class="md"><div class="mh"><h2>Ảnh xác nhận</h2><button class="x" aria-label="Đóng">✕</button></div><img class="photo-full" src="${d}" alt=""></div>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.classList.contains('x')) ov.remove(); });
  document.body.appendChild(ov);
};
const thumbs = o => (o.photos || []).length ? `<div class="thumbs">${o.photos.map(p => `<img data-photo="${esc(p.id)}" data-act="viewPhoto" data-id="${esc(p.id)}" title="${esc(p.kind)} · ${fmtDT(p.t)}" alt="${esc(p.kind)}">`).join('')}</div>` : '';

/* ---------- Ảnh giao ---------- */
function photoPicker() {
  return `<div class="rw center"><label class="nn-btn nn-btn-secondary nn-btn-lg">Chụp ảnh<input type="file" accept="image/*" capture="environment" hidden data-chg="pickPhoto"></label>
    <label class="nn-btn nn-btn-secondary nn-btn-lg">Chọn từ máy<input type="file" accept="image/*" multiple hidden data-chg="pickPhoto"></label><span class="small muted" id="pp-n"></span></div><div class="thumbs" id="pp"></div>`;
}
CHG.pickPhoto = async el => {
  const code = el.closest('.mb')?.querySelector('[data-order]')?.dataset.order || '';
  for (const f of el.files) { try { STATE.pending.push(await compressImage(f, `${code} · ${fmtDT(nowISO())} · ${ME.name}`)); } catch (e) { toast(e.message); } }
  el.value = '';
  $('#pp').innerHTML = STATE.pending.map(d => `<img src="${d}" alt="">`).join('');
  $('#pp-n').textContent = `${STATE.pending.length} ảnh đã chọn`;
};
ACT.addPhoto = id => {
  const o = byId('orders', id);
  openModal(`Thêm ảnh – ${esc(id)}`, `<div data-order="${esc(id)}"></div>
    <p class="small muted">${esc(o.customerName)} · ${badge(OST, o.status)}</p>
    ${fsel('Loại ảnh', 'kind', PHOTO_KINDS.map(k => [k, k]), OK_ST.includes(o.status) ? 'Giao thành công' : o.status === 'giao_that_bai' ? 'Không giao được' : 'Lên hàng', { cls: 'full', size: 'lg', attrs: 'id="ph-kind"' })}
    <div class="mt">${photoPicker()}</div><div class="mt">${btn('Lưu ảnh', 'savePhoto', id, 'primary', 'lg', 'style="width:100%"')}</div>`);
};
ACT.savePhoto = async id => {
  if (!STATE.pending.length) return toast('Chưa chọn ảnh');
  const o = byId('orders', id), kind = $('#ph-kind').value, n = STATE.pending.length;
  await savePhotos(o, STATE.pending, kind); upsert('orders', o); log('Tải ảnh', o.code, `${n} ảnh · ${kind}`);
  toast(`Đã lưu ${n} ảnh`); closeModal(); renderView();
};
