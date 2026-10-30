'use strict';
/* =====================================================================
   app.js — giao diện & thao tác (phụ thuộc core.js)
   ===================================================================== */
const START_TIMES = (() => { const a = []; for (let m = 5 * 60; m <= 14 * 60; m += 15) a.push(hhmm(m)); return a; })();
const STATE = { tab: null, date: today(), f: {}, calMonth: today().slice(0, 7), catTab: 'customers', plan: null, pending: [] };
const ACT = {}, CHG = {};
let installEvt = null;

const TABS = [
  { id: 'dash',     icon: '📊', label: 'Tổng quan',    roles: ['admin', 'dieuphoi', 'ketoan'], fn: () => vDash() },
  { id: 'mine',     icon: '🚚', label: 'Việc của tôi', roles: ['taixe'], fn: () => vMine() },
  { id: 'orders',   icon: '📦', label: 'Đơn giao',     roles: ['admin', 'dieuphoi', 'ketoan'], fn: () => vOrders() },
  { id: 'assign',   icon: '⚖️', label: 'Giao việc',    roles: ['admin', 'dieuphoi'], fn: () => vAssign() },
  { id: 'trips',    icon: '🛣️', label: 'Chuyến giao',  roles: ['admin', 'dieuphoi'], fn: () => vTrips() },
  { id: 'cal',      icon: '📅', label: 'Lịch',         roles: ['admin', 'dieuphoi', 'taixe'], fn: () => vCal() },
  { id: 'review',   icon: '✅', label: 'Duyệt',        roles: ['admin', 'dieuphoi'], fn: () => vReview() },
  { id: 'photos',   icon: '📷', label: 'Ảnh giao',     roles: ['admin', 'dieuphoi'], fn: () => vPhotos() },
  { id: 'settle',   icon: '💰', label: 'Đối soát',     roles: ['admin', 'ketoan'], fn: () => vSettle() },
  { id: 'report',   icon: '📈', label: 'Báo cáo',      roles: ['admin', 'dieuphoi', 'ketoan'], fn: () => vReport() },
  { id: 'history',  icon: '🧾', label: 'Lịch sử',      roles: ['taixe'], fn: () => vHistory() },
  { id: 'catalog',  icon: '🗂️', label: 'Danh mục',     roles: ['admin', 'dieuphoi'], fn: () => vCatalog() },
  { id: 'data',     icon: '⇅',  label: 'Excel In/Out', roles: ['admin', 'dieuphoi', 'ketoan'], fn: () => vData() },
  { id: 'logs',     icon: '📝', label: 'Nhật ký',      roles: ['admin'], fn: () => vLogs() },
  { id: 'settings', icon: '⚙️', label: 'Cài đặt',      roles: ['admin', 'dieuphoi', 'taixe', 'ketoan'], fn: () => vSettings() },
];
const myTabs = () => TABS.filter(t => t.roles.includes(ME.role));

/* ---------------- Khởi động ---------------- */
(async function boot() {
  try { await loadAll(); } catch (e) { document.getElementById('app').innerHTML = `<div class="empty">Không mở được bộ nhớ trình duyệt: ${esc(e.message)}</div>`; return; }
  await Cloud.init();
  if (Cloud.enabled() && !DB.users.length) await Cloud.pull();
  if (S().purgeCutoff) await pruneLocal(S().purgeCutoff);
  const sid = localStorage.getItem('bc_session');
  ME = sid ? byId('users', sid) : null;
  if (ME && ME.active === false) ME = null;
  ME ? renderShell() : renderLogin();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  setInterval(() => { if (ME && ['dash', 'mine'].includes(STATE.tab) && !$('.ov') && !isTyping()) renderView(); }, 30000);
})();

const isTyping = () => { const a = document.activeElement; return a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) && a.closest('#view'); };
function onRemoteChange(colls) {
  if (!ME) return;
  if (colls.has('users')) { ME = byId('users', ME.id) || ME; }
  if (!$('.ov') && !isTyping()) renderView();
}

/* ---------------- Sự kiện chung (event delegation) ---------------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(el.dataset.id, el, e);
});
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el, e); });
let inpT; document.addEventListener('input', e => {
  const el = e.target.closest('[data-inp]'); if (!el) return;
  clearTimeout(inpT); inpT = setTimeout(() => { STATE.f[el.name] = el.value; renderView(); const n = document.querySelector(`#view [name="${el.name}"]`); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 300);
});
CHG.f = el => { STATE.f[el.name] = el.value; renderView(); };
CHG.date = el => { STATE.date = el.value || today(); STATE.plan = null; renderView(); };

/* ---------------- Đăng nhập ---------------- */
function renderLogin() {
  const us = DB.users.filter(u => u.active !== false);
  document.getElementById('app').innerHTML = `
  <div class="login"><div class="card">
    <img src="icons/icon-192.png" alt="">
    <h1>${APP_NAME}</h1>
    <p class="muted small">Đăng nhập theo vai trò để làm việc</p>
    <div class="row mt">
      <label class="f full">Người dùng
        <select name="uid" id="lg-uid">${Object.keys(ROLES).map(r => `<optgroup label="${ROLES[r]}">${us.filter(u => u.role === r).map(u => opt(u.id, `${u.name} (${u.id})`, localStorage.getItem('bc_lastUser'))).join('')}</optgroup>`).join('')}</select>
      </label>
      <label class="f full">Mã PIN
        <input id="lg-pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="••••" onkeydown="if(event.key==='Enter')ACT.login()">
      </label>
    </div>
    <button class="btn p big mt" data-act="login">Đăng nhập</button>
    <p class="small muted mt">Tài khoản mẫu có PIN mặc định <b>1234</b> — Admin hãy đổi PIN trong <i>Danh mục → Người dùng</i>.</p>
    ${!us.length ? `<div class="hint mt">Chưa tải được danh sách người dùng từ đám mây${Cloud.lastErr ? ': ' + esc(Cloud.lastErr) : ''}. Kiểm tra mạng rồi <a href="#" data-act="reload">thử lại</a>.</div>` : ''}
    <p class="small muted">${Cloud.enabled() ? '☁️ Đang kết nối dữ liệu công ty' : '💾 Đang dùng dữ liệu mẫu trên máy này'}</p>
    <button class="btn mt" style="width:100%" data-act="connectLogin">☁️ Kết nối dữ liệu công ty (dán mã kết nối)</button>
  </div></div>`;
}
ACT.login = async () => {
  const id = $('#lg-uid').value, pin = $('#lg-pin').value, u = byId('users', id);
  if (!u || u.pinHash !== await hashPin(id, pin)) { toast('Sai mã PIN'); return; }
  ME = u; localStorage.setItem('bc_session', u.id); localStorage.setItem('bc_lastUser', u.id);
  STATE.tab = null; log('Đăng nhập', u.id, ROLES[u.role]); renderShell();
};
ACT.logout = () => { log('Đăng xuất', ME.id); ME = null; localStorage.removeItem('bc_session'); closeModal(); renderLogin(); };

/* ---------------- Khung app ---------------- */
function renderShell() {
  if (!STATE.tab || !myTabs().some(t => t.id === STATE.tab)) STATE.tab = myTabs()[0].id;
  document.getElementById('app').innerHTML = `
  <header class="top">
    <img src="icons/icon-192.png" alt="">
    <div class="ttl"><b>${APP_NAME}</b><span>${ROLES[ME.role]}</span></div>
    <span id="sync" class="sync"></span>
    <button class="userchip" data-act="userMenu">👤 ${esc(ME.name.split(' ').slice(-1)[0])}</button>
  </header>
  <nav class="tabs" id="tabs"></nav>
  <main id="view"></main>
  <nav class="bnav" id="bnav"></nav>`;
  renderNav(); renderView(); updateSync();
}
function renderNav() {
  const html = myTabs().map(t => `<button data-act="tab" data-id="${t.id}" class="${t.id === STATE.tab ? 'act' : ''}"><i>${t.icon}</i> ${t.label}</button>`).join('');
  $('#tabs').innerHTML = html; $('#bnav').innerHTML = html;
}
ACT.tab = id => { STATE.tab = id; STATE.f = {}; renderNav(); renderView(); window.scrollTo(0, 0); };
function renderView() {
  const t = TABS.find(x => x.id === STATE.tab), v = $('#view'); if (!v || !t) return;
  v.innerHTML = t.fn(); hydratePhotos(v);
}
function updateSync() {
  const el = $('#sync'); if (!el) return;
  const q = Cloud.q.size;
  if (!Cloud.enabled()) { el.className = 'sync'; el.textContent = '💾 Máy này'; el.title = 'Dữ liệu chỉ lưu trên thiết bị này'; }
  else if (Cloud.status === 'err') { el.className = 'sync err'; el.textContent = `⚠ Lỗi đồng bộ${q ? ' · ' + q : ''}`; el.title = Cloud.lastErr; }
  else { el.className = 'sync on'; el.textContent = q ? `☁ Chờ gửi ${q}` : '☁ Đã đồng bộ'; el.title = 'Đồng bộ đám mây theo thời gian thực'; }
}
ACT.userMenu = () => {
  openModal('Tài khoản', `
    <ul class="list-mini"><li><span>Họ tên</span><b>${esc(ME.name)}</b></li><li><span>Mã NV</span><b>${esc(ME.id)}</b></li><li><span>Vai trò</span><b>${ROLES[ME.role]}</b></li></ul>
    <div class="row mt"><label class="f">PIN mới<input id="np1" type="password" inputmode="numeric"></label><label class="f">Nhập lại PIN<input id="np2" type="password" inputmode="numeric"></label></div>
    <div class="row mt"><button class="btn" data-act="changePin">Đổi PIN</button>${installEvt ? '<button class="btn n" data-act="install">📲 Cài app lên máy</button>' : ''}<span class="grow"></span><button class="btn r" data-act="logout">Đăng xuất</button></div>
    <div class="hint b mt">${installGuide()}</div>`);
};
ACT.changePin = async () => {
  const a = $('#np1').value, b = $('#np2').value;
  if (!/^\d{4,8}$/.test(a)) return toast('PIN gồm 4–8 chữ số'); if (a !== b) return toast('Hai lần nhập PIN không khớp');
  ME.pinHash = await hashPin(ME.id, a); upsert('users', ME); log('Đổi PIN', ME.id); toast('Đã đổi PIN'); closeModal();
};
ACT.install = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; closeModal(); };
const installGuide = () => `<b>Cài app lên màn hình chính:</b><br>• <b>iPhone (Safari)</b>: bấm nút Chia sẻ <b>⬆</b> → <b>Thêm vào MH chính</b>.<br>• <b>Android (Chrome)</b>: bấm <b>⋮</b> → <b>Thêm vào màn hình chính / Cài đặt ứng dụng</b>.<br>App sẽ mở toàn màn hình, không có thanh địa chỉ.`;

/* ---------------- Modal ---------------- */
function openModal(title, html, wide = false) {
  closeModal();
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="md" style="${wide ? 'max-width:980px' : ''}"><div class="mh"><h2>${title}</h2><button class="x" data-act="closeModal">✕</button></div><div class="mb">${html}</div></div>`;
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
  document.body.appendChild(ov); hydratePhotos(ov);
  return ov.querySelector('.mb');
}
function closeModal() { document.querySelectorAll('.ov').forEach(o => o.remove()); STATE.pending = []; }
ACT.closeModal = () => { closeModal(); renderView(); };
ACT.viewPhoto = async id => {
  const d = await getPhoto(id); if (!d) return toast('Ảnh chưa tải được');
  const ov = document.createElement('div'); ov.className = 'ov'; ov.style.zIndex = 60;
  ov.innerHTML = `<div class="md"><div class="mh"><h2>Ảnh xác nhận</h2><button class="x">✕</button></div><img class="photo-full" src="${d}" alt=""></div>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.classList.contains('x')) ov.remove(); });
  document.body.appendChild(ov);
};
const thumbs = o => (o.photos || []).length ? `<div class="thumbs">${o.photos.map(p => `<img data-photo="${esc(p.id)}" data-act="viewPhoto" data-id="${esc(p.id)}" title="${esc(p.kind)} · ${fmtDT(p.t)}" alt="">`).join('')}</div>` : '';

/* ---------------- Bộ lọc dùng chung ---------------- */
const dateInput = (label = 'Ngày') => `<label class="f">${label}<input type="date" value="${STATE.date}" data-chg="date"></label>`;
const driverOpts = (all = false) => drivers(all).map(u => [u.id, `${u.name} (${u.id})`]);
const routeOpts = () => DB.routes.map(r => [r.code, `${r.code} – ${r.name}`]);
const vehicleOpts = () => DB.vehicles.map(v => [v.plate, `${v.plate} · ${v.type || ''}`]);
const custOpts = () => DB.customers.map(c => [c.code, `${c.code} – ${c.name}${c.route ? ' · ' + c.route : ''}`]);

/* =====================================================================
   TỔNG QUAN — theo dõi tiến độ theo thời gian thực
   ===================================================================== */
function vDash() {
  const d = STATE.date, os = DB.orders.filter(o => o.date === d), ts = DB.trips.filter(t => t.date === d && t.status !== 'huy');
  const c = st => os.filter(o => st.includes(o.status)).length;
  const okCod = os.filter(o => OK_ST.includes(o.status)).reduce((s, o) => s + (Number(o.codCollected) || 0), 0);
  const needCod = os.reduce((s, o) => s + (Number(o.cod) || 0), 0);
  const waitAdmin = DB.orders.filter(o => o.status === 'giao_thanh_cong' || (o.status === 'giao_that_bai' && !o.adminConfirmAt)).length;
  const byDriver = drivers(true).map(u => {
    const mo = os.filter(o => o.driverId === u.id); if (!mo.length) return '';
    const ok = mo.filter(o => OK_ST.includes(o.status)).length, fail = mo.filter(o => o.status === 'giao_that_bai').length;
    const mt = ts.filter(t => t.driverId === u.id);
    const cur = mt.find(t => !['hoan_thanh', 'huy'].includes(t.status)) || mt[mt.length - 1];
    const next = mo.filter(o => !isDone(o)).sort((a, b) => a.seq - b.seq)[0];
    const lastT = [...mt.flatMap(t => [t.tAccept, t.tLoadStart, t.tDepart, t.tReturn]), ...mo.flatMap(o => [o.tArrive, o.tDelivered, o.tFailed])].filter(Boolean).sort().pop();
    return `<div class="card"><div class="row sb"><div><b>${esc(u.name)}</b> ${cur ? badge(TST, cur.status) : ''}
      <div class="small muted">${mt.length} chuyến · ${ok}/${mo.length} giao TC${fail ? ` · <span style="color:var(--bad)">${fail} không giao được</span>` : ''} · Check-in gần nhất: ${fmtHM(lastT)}</div></div>
      <div class="small">${next ? `Điểm kế tiếp: <b>${esc(next.customerName)}</b> (dự kiến ${next.eta || '—'})` : (mo.length && ok + fail === mo.length ? '✔ Đã xong việc' : '')}</div></div>
      <div class="bar mt"><i style="width:${ok / mo.length * 100}%;background:var(--ok)"></i><i style="width:${fail / mo.length * 100}%;background:var(--bad)"></i></div></div>`;
  }).join('');
  const logs = [...DB.logs].sort((a, b) => b.t.localeCompare(a.t)).slice(0, 12);
  return `
  <div class="sec-title"><h2>Tổng quan giao hàng</h2><div class="row">${dateInput('')}</div></div>
  <div class="kpis">
    <div class="kpi"><b>${os.length}</b><span>Tổng đơn trong ngày</span></div>
    <div class="kpi"><b>${c(['cho_phan_cong'])}</b><span>Chờ phân công</span></div>
    <div class="kpi o"><b>${c(['da_phan_cong', 'da_nhan', 'dang_giao', 'da_den'])}</b><span>Đang xử lý / đang giao</span></div>
    <div class="kpi g"><b>${c(OK_ST)}</b><span>Giao thành công</span></div>
    <div class="kpi r"><b>${c(['giao_that_bai'])}</b><span>Không giao được</span></div>
    <div class="kpi b"><b>${waitAdmin}</b><span>Chờ Admin duyệt (tất cả ngày)</span></div>
    <div class="kpi"><b style="font-size:18px">${money(okCod)}</b><span>Thu hộ đã thu / ${money(needCod)}</span></div>
  </div>
  ${isAdmin() ? (() => { const m = S().retentionMonths || 3, st = oldDataStats(retentionCutoff(m)); return st.orders + st.logs + st.trips ? `<div class="hint mt">🗄️ Có dữ liệu cũ hơn <b>${m} tháng</b> (${st.orders} đơn, ${st.photos} ảnh, ${st.logs} nhật ký). <a href="#" data-act="tab" data-id="settings">Vào Cài đặt để xác nhận chỉ lưu ${m} tháng →</a></div>` : ''; })() : ''}
  ${waitAdmin && isAdmin() ? `<div class="hint mt">Có <b>${waitAdmin}</b> đơn đang chờ bạn xác nhận cuối cùng. <a href="#" data-act="tab" data-id="review">Mở trang Duyệt →</a></div>` : ''}
  <div class="split mt2">
    <div><h3 class="mt" style="margin-bottom:8px">Tiến độ theo tài xế</h3>${byDriver || '<div class="card empty">Chưa có đơn nào được giao trong ngày này.</div>'}</div>
    <div><h3 class="mt" style="margin-bottom:8px">Hoạt động mới nhất</h3><div class="card"><ul class="list-mini">${logs.map(l => `<li><span><b>${esc(l.userName)}</b> · ${esc(l.action)} <span class="muted">${esc(l.entity)}</span></span><span class="muted small">${fmtHM(l.t)}</span></li>`).join('') || '<li class="muted">Chưa có hoạt động</li>'}</ul></div></div>
  </div>`;
}

/* =====================================================================
   ĐƠN GIAO
   ===================================================================== */
function filteredOrders() {
  const f = STATE.f, q = (f.q || '').toLowerCase();
  return DB.orders.filter(o =>
    (f.allDates === '1' || o.date === STATE.date) &&
    (!f.status || o.status === f.status) && (!f.driver || o.driverId === f.driver) && (!f.route || o.route === f.route) &&
    (!q || [o.code, o.customerName, o.customerCode, o.address, o.phone, o.tripCode].join(' ').toLowerCase().includes(q))
  ).sort((a, b) => b.date.localeCompare(a.date) || (a.tripCode || '').localeCompare(b.tripCode || '') || (a.seq || 999) - (b.seq || 999) || a.code.localeCompare(b.code));
}
function vOrders() {
  const os = filteredOrders(), f = STATE.f;
  return `
  <div class="sec-title"><h2>Đơn giao (${os.length})</h2><div class="row">
    ${can('order.edit') ? '<button class="btn p" data-act="newOrder">＋ Tạo đơn</button>' : ''}
    <button class="btn" data-act="exportOrders">⬇ Xuất Excel</button></div></div>
  <div class="filters">
    ${dateInput()}
    <label class="f">Phạm vi${selectHTML('allDates', [['', 'Theo ngày đã chọn'], ['1', 'Tất cả các ngày']], f.allDates, { attrs: 'data-chg="f"' })}</label>
    <label class="f">Trạng thái${selectHTML('status', Object.entries(OST).map(([k, v]) => [k, v[0]]), f.status, { empty: 'Tất cả', attrs: 'data-chg="f"' })}</label>
    <label class="f">Tài xế${selectHTML('driver', driverOpts(true), f.driver, { empty: 'Tất cả', attrs: 'data-chg="f"' })}</label>
    <label class="f">Tuyến${selectHTML('route', routeOpts(), f.route, { empty: 'Tất cả', attrs: 'data-chg="f"' })}</label>
    <label class="f">Tìm kiếm<input name="q" value="${esc(f.q || '')}" placeholder="Mã đơn, khách, SĐT…" data-inp="1"></label>
  </div>
  ${os.length ? `<div class="tw"><table><thead><tr><th>Mã đơn</th><th>Ngày</th><th>Khách hàng</th><th>Tuyến</th><th>Khung giờ</th><th>Tài xế</th><th>Chuyến</th><th class="num">TT</th><th>Dự kiến</th><th>Trạng thái</th><th class="num">Thu hộ</th><th class="num">Ảnh</th></tr></thead><tbody>
  ${os.map(o => `<tr class="click" data-act="openOrder" data-id="${esc(o.code)}"><td><b>${esc(o.code)}</b></td><td>${fmtD(o.date)}</td><td>${esc(o.customerName)}<div class="small muted">${esc(o.customerCode || '')}</div></td><td>${esc(o.route || '')}</td><td>${esc(o.timeWindow || '')}</td><td>${esc(userName(o.driverId))}</td><td>${esc(o.tripCode || '—')}</td><td class="num">${o.seq || ''}</td><td>${o.eta || ''}</td><td>${badge(OST, o.status)}</td><td class="num">${o.cod ? money(o.cod) : ''}</td><td class="num">${(o.photos || []).length || ''}</td></tr>`).join('')}
  </tbody></table></div>` : '<div class="card empty">Không có đơn nào phù hợp bộ lọc.</div>'}`;
}
ACT.exportOrders = () => writeWorkbook([[XL.orders.sheet, toXlRows('orders', filteredOrders())]], `DonGiao_${STATE.date}.xlsx`);

function orderForm(o) {
  const isNew = !o; o = o || { date: STATE.date, timeWindow: 'Cả ngày', serviceMin: S().defaultServiceMin, cod: 0 };
  const code = o.code || nextCode('DH', o.date, 'orders');
  const tripsOfDay = DB.trips.filter(t => t.date === o.date && t.status !== 'huy' && t.status !== 'hoan_thanh' && (!o.driverId || t.driverId === o.driverId));
  return `<div class="row" id="of">
    <label class="f">Mã đơn (duy nhất)<input name="code" value="${esc(code)}" ${isNew ? '' : 'readonly'}></label>
    <label class="f">Ngày giao<input name="date" type="date" value="${esc(o.date)}" data-chg="ofDate"></label>
    <label class="f full">Chọn mã khách hàng → tự điền khách, tuyến, khung giờ
      ${selectHTML('customerCode', custOpts(), o.customerCode, { empty: '— Chọn khách hàng (gõ để tìm) —', attrs: 'data-chg="ofCust"' })}</label>
    <label class="f">Tên khách hàng<input name="customerName" value="${esc(o.customerName || '')}" required></label>
    <label class="f">SĐT<input name="phone" type="tel" value="${esc(o.phone || '')}"></label>
    <label class="f full">Địa chỉ giao<input name="address" value="${esc(o.address || '')}"></label>
    <label class="f">Tuyến${selectHTML('route', routeOpts(), o.route, { empty: '—' })}</label>
    <label class="f">Khung giờ khách nhận${selectHTML('timeWindow', TIME_WINDOWS.map(x => [x, x]), o.timeWindow)}</label>
    <label class="f">Thời gian giao tại điểm (phút)<input name="serviceMin" type="number" min="1" value="${esc(o.serviceMin ?? '')}"></label>
    <label class="f full">Hàng hóa<input name="items" value="${esc(o.items || '')}" list="dl-items"></label>
    <datalist id="dl-items">${[...new Set(DB.orders.map(x => x.items).filter(Boolean))].slice(0, 40).map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <label class="f">Khối lượng (kg)<input name="weightKg" type="number" min="0" value="${esc(o.weightKg ?? '')}"></label>
    <label class="f">Tiền thu hộ (đ)<input name="cod" type="number" min="0" step="1000" value="${esc(o.cod ?? 0)}"></label>
    <label class="f">Tài xế${selectHTML('driverId', driverOpts(), o.driverId, { empty: '— Chưa phân công —', attrs: 'data-chg="ofDriver"' })}</label>
    <label class="f">Chuyến giao<select name="tripCode" id="of-trip">${tripOptsHTML(tripsOfDay, o.tripCode)}</select></label>
    <label class="f full">Ghi chú<textarea name="note">${esc(o.note || '')}</textarea></label>
    <input type="hidden" name="lat" value="${esc(o.lat ?? '')}"><input type="hidden" name="lng" value="${esc(o.lng ?? '')}">
  </div>
  <div class="row mt"><span class="grow small muted">Mỗi đơn gắn với 1 tài xế và 1 chuyến. Chọn tài xế mà để trống chuyến → app tự gắn vào chuyến đang mở của tài xế trong ngày (hoặc tạo chuyến mới).</span>
  <button class="btn p" data-act="saveOrder" data-id="${isNew ? '' : esc(o.code)}">💾 Lưu đơn</button></div>`;
}
const tripOptsHTML = (trips, cur) => opt('', '— Tự động —', cur) + trips.map(t => opt(t.code, `${t.code} · ${userName(t.driverId)} · ${TST[t.status][0]}`, cur)).join('');
ACT.newOrder = () => openModal('Tạo đơn giao', orderForm(null));
ACT.editOrder = id => openModal(`Sửa đơn ${esc(id)}`, orderForm(byId('orders', id)));
CHG.ofCust = el => {
  const c = custOf(el.value), f = $('#of'); if (!c) return;
  const set = (n, v) => { const x = f.querySelector(`[name="${n}"]`); if (x) x.value = v ?? ''; };
  set('customerName', c.name); set('phone', c.phone); set('address', c.address); set('route', c.route);
  set('timeWindow', c.timeWindow || 'Cả ngày'); set('serviceMin', c.serviceMin || S().defaultServiceMin); set('lat', c.lat); set('lng', c.lng);
  toast(`Đã tự điền: ${c.name} · tuyến ${c.route || '—'} · ${c.timeWindow || 'Cả ngày'}`);
};
CHG.ofDriver = () => refreshTripSelect();
CHG.ofDate = el => { const f = $('#of'), c = f.querySelector('[name=code]'); if (!c.readOnly) c.value = nextCode('DH', el.value, 'orders'); refreshTripSelect(); };
function refreshTripSelect() {
  const f = $('#of'), d = f.querySelector('[name=date]').value, dr = f.querySelector('[name=driverId]').value;
  $('#of-trip').innerHTML = tripOptsHTML(DB.trips.filter(t => t.date === d && !['huy', 'hoan_thanh'].includes(t.status) && (!dr || t.driverId === dr)), '');
}
ACT.saveOrder = id => {
  const d = formData($('#of'));
  if (!d.code || !d.date || !d.customerName) return toast('Cần nhập mã đơn, ngày giao và tên khách');
  const isNew = !id;
  if (isNew && byId('orders', d.code)) return toast('Mã đơn đã tồn tại – mỗi đơn phải có mã duy nhất');
  const o = isNew ? { id: d.code, code: d.code, status: 'cho_phan_cong', createdAt: nowISO(), createdBy: ME.id, photos: [] } : byId('orders', id);
  const oldTrip = o.tripCode, oldDriver = o.driverId;
  Object.assign(o, { date: d.date, customerCode: d.customerCode, customerName: d.customerName, phone: d.phone, address: d.address, route: d.route,
    timeWindow: d.timeWindow, serviceMin: xlNum(d.serviceMin), items: d.items, weightKg: xlNum(d.weightKg), cod: xlNum(d.cod) || 0, note: d.note,
    lat: xlNum(d.lat), lng: xlNum(d.lng) });
  if (d.driverId) assignOrder(o, d.driverId, d.tripCode);
  else if (oldDriver) unassignOrder(o);
  upsert('orders', o);
  if (o.tripCode) planTrip(byId('trips', o.tripCode));
  if (oldTrip && oldTrip !== o.tripCode) { const t = byId('trips', oldTrip); if (t) planTrip(t); }
  log(isNew ? 'Tạo đơn' : 'Sửa đơn', o.code, `${o.customerName}${o.driverId ? ' → ' + userName(o.driverId) : ''}`);
  toast(isNew ? `Đã tạo đơn ${o.code}` : 'Đã lưu'); closeModal(); renderView();
};
// Gắn đơn vào 1 tài xế + 1 chuyến (tự tạo chuyến nếu cần)
function assignOrder(o, driverId, tripCode) {
  if (!tripCode && o.driverId === driverId && o.tripCode && byId('trips', o.tripCode)) return; // giữ chuyến hiện tại
  let t = tripCode ? byId('trips', tripCode) : DB.trips.find(x => x.driverId === driverId && x.date === o.date && ['moi', 'da_nhan', 'dang_len_hang'].includes(x.status));
  if (!t) t = createTrip(o.date, driverId, byId('users', driverId)?.vehicle || '', S().startTime);
  if (o.tripCode === t.code && o.driverId === driverId) return;
  o.driverId = driverId; o.tripCode = t.code; o.seq = 999; o.tAssigned = nowISO();
  o.status = t.status === 'dang_di_chuyen' ? 'dang_giao' : (t.status === 'moi' ? 'da_phan_cong' : 'da_nhan');
  upsert('orders', o); planTrip(t);
}
function unassignOrder(o) {
  const t = o.tripCode; Object.assign(o, { driverId: '', tripCode: '', seq: null, eta: '', status: 'cho_phan_cong' }); upsert('orders', o);
  const tr = t && byId('trips', t); if (tr) planTrip(tr);
}
function createTrip(date, driverId, vehicle, plannedStart) {
  const code = nextCode('CH', date, 'trips', 2);
  const t = { id: code, code, date, driverId, vehicle, plannedStart, status: 'moi', createdAt: nowISO(), createdBy: ME.id };
  upsert('trips', t); log('Tạo chuyến', code, `${userName(driverId)} · ${fmtD(date)} · xuất phát ${plannedStart}`);
  return t;
}

/* ---------- Chi tiết đơn ---------- */
ACT.openOrder = id => {
  const o = byId('orders', id); if (!o) return;
  const t = o.tripCode ? byId('trips', o.tripCode) : null;
  const tl = [['Tạo đơn', o.createdAt], ['Phân công', o.tAssigned], ['Tài xế nhận', t?.tAccept], ['Bắt đầu lên hàng', t?.tLoadStart, t?.gpsLoad], ['Bắt đầu di chuyển', t?.tDepart, t?.gpsDepart],
    ['Đến điểm giao', o.tArrive, o.gpsArrive], ['Giao thành công', o.tDelivered, o.gpsDone], ['Không giao được', o.tFailed, o.gpsDone], ['Admin xác nhận cuối', o.adminConfirmAt]]
    .filter(x => x[1]).map(([l, v, g]) => `<li><span>${l}</span><span><b>${fmtDT(v)}</b> ${gpsLink(g)}</span></li>`).join('');
  const logs = DB.logs.filter(l => l.entity === o.code).sort((a, b) => b.t.localeCompare(a.t));
  const editable = can('order.edit') && o.status !== 'hoan_tat';
  openModal(`Đơn ${esc(o.code)}`, `
    <div class="row sb">${badge(OST, o.status)}<span class="small muted">Chuyến ${esc(o.tripCode || '—')} · Tài xế ${esc(userName(o.driverId))} · Thứ tự ${o.seq || '—'} · Dự kiến ${o.eta || '—'}</span></div>
    <div class="split mt">
      <ul class="list-mini">
        <li><span>Khách hàng</span><b>${esc(o.customerName)} ${o.customerCode ? `(${esc(o.customerCode)})` : ''}</b></li>
        <li><span>SĐT</span><span>${o.phone ? `<a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : '—'}</span></li>
        <li><span>Địa chỉ</span><span style="text-align:right">${esc(o.address)}</span></li>
        <li><span>Tuyến · Khung giờ</span><span>${esc(o.route || '—')} · ${esc(o.timeWindow || '—')}</span></li>
        <li><span>Hàng hóa</span><span>${esc(o.items || '—')} ${o.weightKg ? `· ${num(o.weightKg)} kg` : ''}</span></li>
        <li><span>Thu hộ phải thu</span><b>${money(o.cod)}</b></li>
        <li><span>Đã thu</span><b>${o.codCollected != null ? money(o.codCollected) : '—'}</b></li>
        ${o.receiver ? `<li><span>Người nhận</span><span>${esc(o.receiver)}</span></li>` : ''}
        ${o.failReason ? `<li><span>Lý do không giao được</span><span style="color:var(--bad)">${esc(o.failReason)}</span></li>` : ''}
        ${o.note ? `<li><span>Ghi chú</span><span>${esc(o.note)}</span></li>` : ''}
        ${o.adminConfirmBy ? `<li><span>Người xác nhận cuối</span><b>${esc(userName(o.adminConfirmBy))}</b></li>` : ''}
      </ul>
      <div><b>Mốc thời gian check-in</b><ul class="list-mini">${tl}</ul></div>
    </div>
    <div class="mt"><b>Ảnh xác nhận (${(o.photos || []).length})</b>${thumbs(o) || '<div class="small muted">Chưa có ảnh</div>'}</div>
    <div class="row mt">
      ${can('photo') ? `<button class="btn" data-act="addPhoto" data-id="${esc(o.code)}">📷 Thêm ảnh</button>` : ''}
      ${editable ? `<button class="btn" data-act="editOrder" data-id="${esc(o.code)}">✏️ Sửa</button>` : ''}
      ${isAdmin() && ['giao_thanh_cong', 'giao_that_bai'].includes(o.status) && !o.adminConfirmAt ? `<button class="btn g" data-act="reviewOne" data-id="${esc(o.code)}">✅ Duyệt</button>` : ''}
      ${isAdmin() && ['cho_phan_cong', 'da_phan_cong'].includes(o.status) ? `<button class="btn r" data-act="delOrder" data-id="${esc(o.code)}">🗑 Xóa</button>` : ''}
    </div>
    ${logs.length ? `<details class="mt"><summary class="small">Nhật ký thao tác của đơn (${logs.length})</summary><ul class="list-mini">${logs.map(l => `<li><span>${esc(l.userName)} · ${esc(l.action)} <span class="muted">${esc(l.detail)}</span></span><span class="small muted">${fmtDT(l.t)}</span></li>`).join('')}</ul></details>` : ''}
  `);
};
ACT.delOrder = id => {
  const o = byId('orders', id); if (!o || !confirm(`Xóa đơn ${id}?`)) return;
  const t = o.tripCode && byId('trips', o.tripCode); removeRec('orders', id); if (t) planTrip(t);
  log('Xóa đơn', id, o.customerName); closeModal(); renderView();
};

/* ---------- Ảnh ---------- */
function photoPicker() {
  return `<div class="row"><label class="btn">📸 Chụp ảnh<input type="file" accept="image/*" capture="environment" hidden data-chg="pickPhoto"></label>
    <label class="btn">🖼 Chọn từ máy<input type="file" accept="image/*" multiple hidden data-chg="pickPhoto"></label><span class="small muted" id="pp-n"></span></div>
    <div class="thumbs" id="pp"></div>`;
}
CHG.pickPhoto = async el => {
  const code = el.closest('.mb')?.querySelector('[data-order]')?.dataset.order || '';
  for (const f of el.files) {
    try { STATE.pending.push(await compressImage(f, `${code} · ${fmtDT(nowISO())} · ${ME.name}`)); } catch (e) { toast(e.message); }
  }
  el.value = '';
  $('#pp').innerHTML = STATE.pending.map(d => `<img src="${d}" alt="">`).join('');
  $('#pp-n').textContent = `${STATE.pending.length} ảnh đã chọn`;
};
ACT.addPhoto = id => {
  const o = byId('orders', id);
  openModal(`Thêm ảnh – ${esc(id)}`, `<div data-order="${esc(id)}"></div>
    <p class="small muted">${esc(o.customerName)} · ${badge(OST, o.status)}</p>
    <label class="f full">Loại ảnh${selectHTML('kind', PHOTO_KINDS.map(k => [k, k]), OK_ST.includes(o.status) ? 'Giao thành công' : o.status === 'giao_that_bai' ? 'Không giao được' : 'Lên hàng', { attrs: 'id="ph-kind"' })}</label>
    <div class="mt">${photoPicker()}</div>
    <button class="btn p big mt" data-act="savePhoto" data-id="${esc(id)}">Lưu ảnh</button>`);
};
ACT.savePhoto = async id => {
  if (!STATE.pending.length) return toast('Chưa chọn ảnh');
  const o = byId('orders', id), kind = $('#ph-kind').value, n = STATE.pending.length;
  await savePhotos(o, STATE.pending, kind); upsert('orders', o); log('Tải ảnh', o.code, `${n} ảnh · ${kind}`);
  toast(`Đã lưu ${n} ảnh`); closeModal(); renderView();
};

/* =====================================================================
   GIAO VIỆC — chia đều thời gian & tối ưu tuyến
   ===================================================================== */
function vAssign() {
  const d = STATE.date, f = STATE.f;
  const pool = DB.orders.filter(o => o.date === d && o.status === 'cho_phan_cong');
  const sel = f.pick || (f.pick = Object.fromEntries(pool.map(o => [o.code, true])));
  const drs = f.drs || (f.drs = Object.fromEntries(drivers().map(u => [u.id, true])));
  const start = f.start || S().startTime;
  const plan = STATE.plan;
  return `
  <div class="sec-title"><h2>Giao việc & chia đều thời gian</h2></div>
  <div class="hint b">App ước tính thời gian mỗi chuyến = lên hàng (${S().loadMin}′) + di chuyển (${S().speedKmh} km/h) + giao tại điểm + quay về kho, sau đó <b>chia đơn sao cho tổng thời gian của các tài xế gần bằng nhau</b> và <b>sắp xếp cung đường tốt nhất</b> cho từng người (khách hẹn sáng trước – chiều sau, trong mỗi buổi chọn đường ngắn nhất).</div>
  <div class="filters mt">${dateInput('Ngày xuất phát')}
    <label class="f">Giờ xuất phát dự kiến${selectHTML('start', START_TIMES.map(x => [x, x]), start, { attrs: 'data-chg="f"' })}</label></div>
  <div class="split">
    <div class="card"><div class="row sb"><b>Đơn chờ phân công (${pool.length})</b><span><button class="btn sm" data-act="pickAll" data-id="1">Chọn hết</button> <button class="btn sm" data-act="pickAll" data-id="">Bỏ hết</button></span></div>
      ${pool.length ? pool.map(o => `<label class="check"><input type="checkbox" data-chg="pick" value="${esc(o.code)}" ${sel[o.code] !== false ? 'checked' : ''}><span><b>${esc(o.code)}</b> · ${esc(o.customerName)} <span class="small muted">· ${esc(o.route || '')} · ${esc(o.timeWindow || '')}${hasXY(o) ? '' : ' · ⚠ thiếu tọa độ'}</span></span></label>`).join('') : '<div class="empty">Không còn đơn chờ phân công trong ngày.</div>'}
    </div>
    <div class="card"><b>Tài xế tham gia</b>
      ${drivers().map(u => { const load = DB.trips.filter(t => t.driverId === u.id && t.date === d && t.status !== 'huy').reduce((s, t) => s + (t.planMin || 0), 0);
        return `<label class="check"><input type="checkbox" data-chg="drv" value="${u.id}" ${drs[u.id] !== false ? 'checked' : ''}><span>${esc(u.name)} <span class="small muted">· ${esc(u.vehicle || 'chưa gán xe')}${load ? ` · đã có ${durTxt(load)} việc` : ''}</span></span></label>`; }).join('')}
      <button class="btn p big mt" data-act="runBalance" ${pool.length ? '' : 'disabled'}>⚖️ Chia đều & tối ưu tuyến</button>
    </div>
  </div>
  ${plan ? planPreview(plan) : ''}`;
}
CHG.pick = el => { STATE.f.pick[el.value] = el.checked; STATE.plan = null; };
CHG.drv = el => { STATE.f.drs[el.value] = el.checked; STATE.plan = null; };
ACT.pickAll = v => { Object.keys(STATE.f.pick).forEach(k => STATE.f.pick[k] = !!v); STATE.plan = null; renderView(); };
ACT.runBalance = () => {
  const d = STATE.date, f = STATE.f;
  const orders = DB.orders.filter(o => o.date === d && o.status === 'cho_phan_cong' && f.pick[o.code] !== false);
  const ids = drivers().filter(u => f.drs[u.id] !== false).map(u => u.id);
  if (!orders.length || !ids.length) return toast('Chọn ít nhất 1 đơn và 1 tài xế');
  const base = {}; ids.forEach(id => base[id] = DB.trips.filter(t => t.driverId === id && t.date === d && t.status !== 'huy').reduce((s, t) => s + (t.planMin || 0), 0));
  const groups = balanceOrders(orders, ids, base);
  STATE.plan = { date: d, start: f.start || S().startTime, groups: groups.map(g => ({ id: g.id, base: g.base, codes: g.os.map(o => o.code), vehicle: byId('users', g.id)?.vehicle || '' })) };
  renderView(); setTimeout(() => $('#plan')?.scrollIntoView({ behavior: 'smooth' }), 50);
};
function groupStart(g, plan) {
  const prev = DB.trips.filter(t => t.driverId === g.id && t.date === plan.date && t.status !== 'huy').map(t => toMin(t.planEnd) || 0);
  return prev.length ? hhmm(Math.max(toMin(plan.start), Math.max(...prev) + 15)) : plan.start;
}
function planPreview(plan) {
  const cards = plan.groups.map(g => {
    const os = g.codes.map(c => byId('orders', c));
    const seq = optimizeRoute(os), sch = scheduleSeq(seq, groupStart(g, plan));
    g._tot = g.base + (os.length ? sch.work : 0);
    return { g, sch };
  });
  const tots = cards.map(c => c.g._tot), spread = Math.max(...tots) - Math.min(...tots);
  return `<div id="plan" class="mt2"><div class="sec-title"><h2>Phương án đề xuất</h2><span class="bd ${spread <= 30 ? 'grn' : 'yel'}">Chênh lệch thời gian làm việc giữa các tài xế: ${durTxt(spread)}</span></div>
    <div class="split">${cards.map(({ g, sch }) => `<div class="card">
      <div class="row sb"><b>${esc(userName(g.id))}</b><span class="small">Xe ${selectHTML('veh_' + g.id, vehicleOpts(), g.vehicle, { empty: '—', attrs: `data-chg="planVeh" data-id="${g.id}" style="min-height:32px;padding:4px 8px;width:auto"` })}</span></div>
      <div class="small muted">${g.codes.length} điểm · ~${sch.km} km · xuất phát ${groupStart(g, plan)} → về kho ~${g.codes.length ? sch.end : '—'} · <b>làm việc ${durTxt(g._tot)}</b>${sch.wait ? ` · chờ khung giờ khách ${durTxt(sch.wait)}` : ''}${g.base ? ` (gồm ${durTxt(g.base)} việc đã có)` : ''}</div>
      <ol style="padding-left:20px;margin:8px 0 0">${sch.rows.map(r => `<li style="margin:4px 0"><b>${r.eta}</b> · ${esc(r.o.customerName)} <span class="small muted">${esc(r.o.timeWindow || '')}${r.late ? ' · <span style="color:var(--bad)">trễ khung giờ</span>' : ''}</span>
        <select data-chg="planMove" data-id="${esc(r.o.code)}" style="min-height:28px;padding:2px 6px;width:auto;font-size:12px">${plan.groups.map(x => opt(x.id, x.id === g.id ? 'Giữ' : '→ ' + userName(x.id), g.id)).join('')}</select></li>`).join('')}</ol>
    </div>`).join('')}</div>
    <div class="row mt"><span class="grow small muted">Có thể chuyển đơn giữa các tài xế bằng ô chọn bên cạnh mỗi điểm, app sẽ tính lại tuyến và thời gian.</span><button class="btn" data-act="runBalance">↻ Tính lại</button><button class="btn p" data-act="commitPlan">✅ Xác nhận tạo chuyến & giao việc</button></div></div>`;
}
CHG.planMove = el => {
  const code = el.dataset.id, to = el.value, p = STATE.plan;
  p.groups.forEach(g => g.codes = g.codes.filter(c => c !== code)); p.groups.find(g => g.id === to).codes.push(code); renderView();
};
CHG.planVeh = el => { STATE.plan.groups.find(g => g.id === el.dataset.id).vehicle = el.value; };
ACT.commitPlan = () => {
  const p = STATE.plan; let n = 0;
  for (const g of p.groups) {
    if (!g.codes.length) continue;
    const t = createTrip(p.date, g.id, g.vehicle, groupStart(g, p));
    g.codes.forEach(c => { const o = byId('orders', c); Object.assign(o, { driverId: g.id, tripCode: t.code, status: 'da_phan_cong', tAssigned: nowISO() }); upsert('orders', o); n++; });
    planTrip(t);
    log('Phân công', t.code, `${userName(g.id)} nhận ${g.codes.length} đơn: ${g.codes.join(', ')}`);
  }
  STATE.plan = null; STATE.f = {}; toast(`Đã giao ${n} đơn cho tài xế`); ACT.tab('trips');
};

/* =====================================================================
   CHUYẾN GIAO
   ===================================================================== */
function vTrips() {
  const ts = DB.trips.filter(t => t.date === STATE.date && (STATE.f.showCancel === '1' || t.status !== 'huy')).sort((a, b) => a.code.localeCompare(b.code));
  return `<div class="sec-title"><h2>Chuyến giao (${ts.length})</h2><div class="row">${can('trip.edit') ? '<button class="btn p" data-act="newTrip">＋ Tạo chuyến trống</button>' : ''}<button class="btn" data-act="exportTrips">⬇ Xuất Excel</button></div></div>
  <div class="filters">${dateInput('Ngày xuất phát')}<label class="f">Hiển thị${selectHTML('showCancel', [['', 'Ẩn chuyến đã hủy'], ['1', 'Hiện cả chuyến đã hủy']], STATE.f.showCancel, { attrs: 'data-chg="f"' })}</label></div>
  ${ts.length ? ts.map(t => { const os = tripOrders(t), ok = os.filter(o => OK_ST.includes(o.status)).length, fail = os.filter(o => o.status === 'giao_that_bai').length;
    return `<div class="card click" data-act="openTrip" data-id="${esc(t.code)}" style="cursor:pointer">
      <div class="row sb"><div><b>${esc(t.code)}</b> ${badge(TST, t.status)}<div class="small muted">${esc(userName(t.driverId))} · Xe ${esc(t.vehicle || '—')} · ${os.length} điểm · ~${t.planKm || 0} km · dự kiến ${t.plannedStart}→${t.planEnd || '—'} (${durTxt(t.planMin)})</div></div>
      <div class="small">Lên hàng <b>${fmtHM(t.tLoadStart)}</b> · Đi <b>${fmtHM(t.tDepart)}</b> · Về <b>${fmtHM(t.tReturn)}</b></div></div>
      <div class="bar mt"><i style="width:${os.length ? ok / os.length * 100 : 0}%;background:var(--ok)"></i><i style="width:${os.length ? fail / os.length * 100 : 0}%;background:var(--bad)"></i></div></div>`; }).join('')
    : '<div class="card empty">Chưa có chuyến nào. Vào <b>Giao việc</b> để chia đơn tự động.</div>'}`;
}
ACT.exportTrips = () => {
  const ts = DB.trips.filter(t => t.date === STATE.date);
  writeWorkbook([[XL.trips.sheet, toXlRows('trips', ts)], [XL.orders.sheet, toXlRows('orders', ts.flatMap(tripOrders))]], `ChuyenGiao_${STATE.date}.xlsx`);
};
ACT.newTrip = () => openModal('Tạo chuyến trống', `<div class="row" id="nt">
  <label class="f">Ngày xuất phát<input type="date" name="date" value="${STATE.date}"></label>
  <label class="f">Tài xế${selectHTML('driverId', driverOpts(), '', { empty: '— Chọn —' })}</label>
  <label class="f">Xe${selectHTML('vehicle', vehicleOpts(), '', { empty: '— Theo tài xế —' })}</label>
  <label class="f">Giờ xuất phát${selectHTML('plannedStart', START_TIMES.map(x => [x, x]), S().startTime)}</label></div>
  <button class="btn p big mt" data-act="saveNewTrip">Tạo chuyến</button>`);
ACT.saveNewTrip = () => {
  const d = formData($('#nt')); if (!d.driverId) return toast('Chọn tài xế');
  const t = createTrip(d.date, d.driverId, d.vehicle || byId('users', d.driverId)?.vehicle || '', d.plannedStart); planTrip(t);
  closeModal(); ACT.openTrip(t.code);
};
ACT.openTrip = id => {
  const t = byId('trips', id); if (!t) return; const os = tripOrders(t), ed = can('trip.edit') && !['hoan_thanh', 'huy'].includes(t.status);
  const pool = DB.orders.filter(o => o.date === t.date && o.status === 'cho_phan_cong');
  const links = mapsLinks(os.filter(o => !isDone(o)).length ? os.filter(o => !isDone(o)) : os);
  openModal(`Chuyến ${esc(t.code)}`, `
    <div class="row sb">${badge(TST, t.status)}<span class="small muted">Ngày ${fmtD(t.date)} · ${os.length} điểm · ~${t.planKm || 0} km · dự kiến ${t.plannedStart} → ${t.planEnd || '—'} (${durTxt(t.planMin)})</span></div>
    <div class="row mt" id="tf">
      <label class="f">Tài xế${selectHTML('driverId', driverOpts(true), t.driverId, { attrs: ed ? '' : 'disabled' })}</label>
      <label class="f">Xe${selectHTML('vehicle', vehicleOpts(), t.vehicle, { empty: '—', attrs: ed ? '' : 'disabled' })}</label>
      <label class="f">Giờ xuất phát DK${selectHTML('plannedStart', START_TIMES.map(x => [x, x]), t.plannedStart, { attrs: ed ? '' : 'disabled' })}</label>
      ${ed ? '<button class="btn" data-act="saveTrip" data-id="' + esc(t.code) + '" style="align-self:flex-end">Lưu</button>' : ''}
    </div>
    <div class="steps mt">
      <div class="step ${t.tAccept ? 'done' : ''}">Nhận chuyến<b>${fmtT(t.tAccept)}</b></div>
      <div class="step ${t.tLoadStart ? 'done' : ''}">Bắt đầu lên hàng<b>${fmtT(t.tLoadStart)}</b>${gpsLink(t.gpsLoad)}</div>
      <div class="step ${t.tDepart ? 'done' : ''}">Bắt đầu di chuyển<b>${fmtT(t.tDepart)}</b>${gpsLink(t.gpsDepart)}</div>
      <div class="step ${t.tReturn ? 'done' : ''}">Về kho<b>${fmtT(t.tReturn)}</b>${gpsLink(t.gpsReturn)}</div>
    </div>
    <div class="tw"><table><thead><tr><th>TT</th><th>Mã đơn</th><th>Khách hàng</th><th>Khung giờ</th><th>Dự kiến</th><th>Đến điểm</th><th>Giao TC</th><th>Trạng thái</th>${ed ? '<th></th>' : ''}</tr></thead><tbody>
    ${os.map(o => `<tr><td>${o.seq || ''}</td><td><a href="#" data-act="openOrder" data-id="${esc(o.code)}">${esc(o.code)}</a></td><td>${esc(o.customerName)}</td><td>${esc(o.timeWindow || '')}</td><td>${o.eta || ''}</td><td>${fmtHM(o.tArrive)}</td><td>${fmtHM(o.tDelivered)}</td><td>${badge(OST, o.status)}</td>${ed ? `<td>${isDone(o) ? '' : `<button class="btn sm r" data-act="removeFromTrip" data-id="${esc(o.code)}">Gỡ</button>`}</td>` : ''}</tr>`).join('') || '<tr><td colspan="9" class="muted">Chuyến chưa có đơn</td></tr>'}
    </tbody></table></div>
    ${ed && pool.length ? `<div class="row mt"><label class="f">Thêm đơn chờ phân công vào chuyến${selectHTML('addOrder', pool.map(o => [o.code, `${o.code} – ${o.customerName} · ${o.route || ''} · ${o.timeWindow || ''}`]), '', { empty: '— Chọn đơn —', attrs: 'id="add-o"' })}</label><button class="btn" style="align-self:flex-end" data-act="addToTrip" data-id="${esc(t.code)}">＋ Thêm</button></div>` : ''}
    <div class="row mt">
      ${links.map((l, i) => `<a class="btn n" href="${l}" target="_blank" rel="noopener">🗺 Chỉ đường Google Maps${links.length > 1 ? ' – chặng ' + (i + 1) : ''}</a>`).join('')}
      ${ed ? `<button class="btn" data-act="reoptTrip" data-id="${esc(t.code)}">🧭 Tối ưu lại tuyến</button>` : ''}
      ${ed && t.status === 'moi' ? `<button class="btn r" data-act="cancelTrip" data-id="${esc(t.code)}">Hủy chuyến</button>` : ''}
    </div>`, true);
};
ACT.saveTrip = id => {
  const t = byId('trips', id), d = formData($('#tf'));
  const changed = d.driverId !== t.driverId;
  Object.assign(t, { driverId: d.driverId, vehicle: d.vehicle, plannedStart: d.plannedStart });
  if (changed) tripOrders(t).forEach(o => { o.driverId = d.driverId; upsert('orders', o); });
  planTrip(t, false); log('Sửa chuyến', id, `${userName(t.driverId)} · xe ${t.vehicle} · ${t.plannedStart}`); toast('Đã lưu chuyến'); ACT.openTrip(id);
};
ACT.addToTrip = id => { const c = $('#add-o').value; if (!c) return; const t = byId('trips', id); assignOrder(byId('orders', c), t.driverId, id); log('Phân công', id, `Thêm đơn ${c}`); ACT.openTrip(id); };
ACT.removeFromTrip = code => { const o = byId('orders', code), tc = o.tripCode; unassignOrder(o); log('Gỡ đơn khỏi chuyến', code, tc); ACT.openTrip(tc); };
ACT.reoptTrip = id => { const t = byId('trips', id); const s = planTrip(t, true); log('Tối ưu tuyến', id, `~${s.km} km · về ${s.end}`); toast(`Đã tối ưu: ~${s.km} km, về kho ${s.end}`); ACT.openTrip(id); };
ACT.cancelTrip = id => {
  if (!confirm('Hủy chuyến? Các đơn sẽ trở về "Chờ phân công".')) return;
  const t = byId('trips', id); tripOrders(t).forEach(o => { Object.assign(o, { driverId: '', tripCode: '', seq: null, eta: '', status: 'cho_phan_cong' }); upsert('orders', o); });
  t.status = 'huy'; upsert('trips', t); log('Hủy chuyến', id); closeModal(); renderView();
};

/* =====================================================================
   TÀI XẾ — VIỆC CỦA TÔI (check-in chính xác từng mốc)
   ===================================================================== */
function vMine() {
  const d = STATE.date;
  const ts = DB.trips.filter(t => t.driverId === ME.id && t.status !== 'huy' && (t.date === d || (t.date < d && !['hoan_thanh'].includes(t.status) && d === today()))).sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
  const os = ts.flatMap(tripOrders);
  const ok = os.filter(o => OK_ST.includes(o.status));
  return `
  <div class="sec-title"><h2>Việc của tôi</h2><div class="row">${dateInput('')}</div></div>
  <div class="kpis"><div class="kpi"><b>${os.length}</b><span>Điểm giao</span></div><div class="kpi g"><b>${ok.length}</b><span>Đã giao TC</span></div>
    <div class="kpi o"><b>${os.filter(o => !isDone(o)).length}</b><span>Còn lại</span></div><div class="kpi"><b style="font-size:17px">${money(ok.reduce((s, o) => s + (Number(o.codCollected) || 0), 0))}</b><span>Thu hộ đã thu</span></div></div>
  ${ts.length ? ts.map(tripCardDriver).join('') : '<div class="card empty mt">Chưa có chuyến nào được giao cho bạn trong ngày này.</div>'}`;
}
function tripCardDriver(t) {
  const os = tripOrders(t), allDone = os.length && os.every(isDone);
  const links = mapsLinks(os.filter(o => !isDone(o)));
  const btn = {
    moi: `<button class="btn p big" data-act="tripStep" data-id="${esc(t.code)}">✅ Nhận chuyến (${os.length} điểm)</button>`,
    da_nhan: `<button class="btn p big" data-act="tripStep" data-id="${esc(t.code)}">📦 Check-in: BẮT ĐẦU LÊN HÀNG</button>`,
    dang_len_hang: `<button class="btn p big" data-act="tripStep" data-id="${esc(t.code)}">🚚 Check-in: BẮT ĐẦU DI CHUYỂN</button>`,
    dang_di_chuyen: allDone ? `<button class="btn g big" data-act="tripStep" data-id="${esc(t.code)}">🏁 Về kho – kết thúc chuyến</button>` : '',
  }[t.status] || '';
  return `<div class="card mt">
    <div class="row sb"><div><b>Chuyến ${esc(t.code)}</b> ${badge(TST, t.status)}<div class="small muted">${t.date !== STATE.date ? `<b style="color:var(--bad)">Ngày ${fmtD(t.date)}</b> · ` : ''}Xe ${esc(t.vehicle || '—')} · Xuất phát DK ${t.plannedStart} · ${os.length} điểm · ~${t.planKm || 0} km · về DK ${t.planEnd || '—'}</div></div></div>
    <div class="steps">
      <div class="step ${t.tAccept ? 'done' : ''}">Nhận chuyến<b>${fmtHM(t.tAccept)}</b></div>
      <div class="step ${t.tLoadStart ? 'done' : ''}">Lên hàng<b>${fmtHM(t.tLoadStart)}</b></div>
      <div class="step ${t.tDepart ? 'done' : ''}">Di chuyển<b>${fmtHM(t.tDepart)}</b></div>
      <div class="step ${t.tReturn ? 'done' : ''}">Về kho<b>${fmtHM(t.tReturn)}</b></div>
    </div>
    ${btn}
    ${links.length && t.status !== 'hoan_thanh' ? `<div class="row mt">${links.map((l, i) => `<a class="btn n" style="flex:1" href="${l}" target="_blank" rel="noopener">🗺 Chỉ đường cả tuyến${links.length > 1 ? ' ' + (i + 1) : ''}</a>`).join('')}</div>` : ''}
    <div class="mt">${os.map(o => jobCard(o, t)).join('')}</div>
  </div>`;
}
function jobCard(o, t) {
  const moving = t.status === 'dang_di_chuyen';
  const nav = hasXY(o) ? `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${o.lat},${o.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.address || '')}`;
  let act = '';
  if (!isDone(o)) {
    if (!moving) act = `<div class="small muted mt">Bấm “Bắt đầu di chuyển” để check-in tại điểm.</div>`;
    else if (o.status !== 'da_den') act = `<button class="btn p big mt" data-act="arrive" data-id="${esc(o.code)}">📍 Check-in: ĐÃ ĐẾN ĐIỂM GIAO</button>`;
    else act = `<div class="row mt"><button class="btn g big" style="flex:1" data-act="deliverOk" data-id="${esc(o.code)}">✔ Giao thành công</button><button class="btn r big" style="flex:1" data-act="deliverFail" data-id="${esc(o.code)}">✖ Không giao được</button></div>`;
  }
  return `<div class="job s-${o.status}">
    <div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="seq">${o.seq || '•'}</span>
      <div class="grow"><h3>${esc(o.customerName)}</h3><div>${badge(OST, o.status)}</div><div class="small muted">${esc(o.code)} · ${esc(o.address || '')}</div>
      <div class="small">Khung giờ <b>${esc(o.timeWindow || '—')}</b> · Dự kiến <b>${o.eta || '—'}</b>${o.cod ? ` · Thu hộ <b style="color:var(--orange-d)">${money(o.cod)}</b>` : ''}</div>
      ${o.items ? `<div class="small muted">${esc(o.items)}</div>` : ''}${o.rejectNote && !isDone(o) ? `<div class="small" style="color:var(--bad)">Admin trả lại: ${esc(o.rejectNote)}</div>` : ''}</div></div>
    <div class="steps">
      <div class="step ${t.tLoadStart ? 'done' : ''}">Lên hàng<b>${fmtHM(t.tLoadStart)}</b></div>
      <div class="step ${t.tDepart ? 'done' : ''}">Di chuyển<b>${fmtHM(t.tDepart)}</b></div>
      <div class="step ${o.tArrive ? 'done' : ''}">Đến điểm<b>${fmtHM(o.tArrive)}</b></div>
      <div class="step ${o.tDelivered ? 'done' : o.tFailed ? 'fail' : ''}">${o.status === 'giao_that_bai' ? 'Không giao được' : 'Giao TC'}<b>${fmtHM(o.tDelivered || o.tFailed)}</b></div>
    </div>
    <div class="row">${o.phone ? `<a class="btn sm" href="tel:${esc(o.phone)}">📞 Gọi</a>` : ''}<a class="btn sm" href="${nav}" target="_blank" rel="noopener">🧭 Chỉ đường</a><button class="btn sm" data-act="addPhoto" data-id="${esc(o.code)}">📷 Ảnh (${(o.photos || []).length})</button><button class="btn sm" data-act="openOrder" data-id="${esc(o.code)}">Chi tiết</button></div>
    ${thumbs(o)}${act}</div>`;
}
// Mốc thời gian được ghi ngay lúc bấm (giờ thiết bị), GPS được bổ sung sau nếu có
ACT.tripStep = async id => {
  const t = byId('trips', id), now = nowISO(), os = tripOrders(t);
  const step = { moi: ['da_nhan', 'tAccept', null, 'Nhận chuyến'], da_nhan: ['dang_len_hang', 'tLoadStart', 'gpsLoad', 'Bắt đầu lên hàng'],
    dang_len_hang: ['dang_di_chuyen', 'tDepart', 'gpsDepart', 'Bắt đầu di chuyển'], dang_di_chuyen: ['hoan_thanh', 'tReturn', 'gpsReturn', 'Về kho'] }[t.status];
  if (!step) return;
  if (step[0] === 'hoan_thanh' && !os.every(isDone)) return toast('Còn điểm chưa xử lý');
  t.status = step[0]; t[step[1]] = now; upsert('trips', t);
  if (step[0] === 'da_nhan') os.forEach(o => { if (o.status === 'da_phan_cong') { o.status = 'da_nhan'; upsert('orders', o); } });
  if (step[0] === 'dang_di_chuyen') os.forEach(o => { if (['da_phan_cong', 'da_nhan'].includes(o.status)) { o.status = 'dang_giao'; upsert('orders', o); } });
  renderView(); toast(`${step[3]}: ${fmtT(now)}`);
  const gps = step[2] ? await getGPS() : null;
  if (gps) { t[step[2]] = gps; upsert('trips', t); }
  log(step[3], id, `Lúc ${fmtT(now)}`, gps);
};
ACT.arrive = async code => {
  const o = byId('orders', code), now = nowISO();
  o.status = 'da_den'; o.tArrive = now; upsert('orders', o); renderView(); toast(`Đã đến điểm: ${fmtT(now)}`);
  const gps = await getGPS(); if (gps) { o.gpsArrive = gps; upsert('orders', o); }
  log('Đến điểm giao', code, `${o.customerName} · ${fmtT(now)}`, gps);
};
ACT.deliverOk = code => {
  const o = byId('orders', code);
  openModal('Xác nhận giao thành công', `<div data-order="${esc(code)}"></div>
    <p><b>${esc(o.customerName)}</b><br><span class="small muted">${esc(o.code)} · ${esc(o.address || '')}</span></p>
    <div class="row" id="dv">
      <label class="f">Tiền thu hộ thực thu (đ)<input name="codCollected" type="number" inputmode="numeric" step="1000" min="0" value="${Number(o.cod) || 0}"></label>
      <label class="f">Người nhận hàng<input name="receiver" placeholder="Tên người nhận"></label>
      <label class="f full">Ghi chú<textarea name="note" placeholder="VD: giao đủ, khách ký nhận…"></textarea></label>
    </div>
    ${o.cod ? `<div class="hint mt">Phải thu: <b>${money(o.cod)}</b>. Nếu thu khác số này, ghi rõ lý do ở ghi chú.</div>` : ''}
    <div class="mt"><b>Ảnh xác nhận giao ${S().requirePhoto ? '<span style="color:var(--bad)">(bắt buộc)</span>' : ''}</b>${photoPicker()}</div>
    <button class="btn g big mt" data-act="confirmDeliver" data-id="${esc(code)}">✔ Check-in: GIAO HÀNG THÀNH CÔNG</button>`);
};
ACT.confirmDeliver = async code => {
  const o = byId('orders', code), d = formData($('#dv')), now = nowISO();
  if (S().requirePhoto && !STATE.pending.length && !(o.photos || []).some(p => p.kind === 'Giao thành công')) return toast('Cần chụp ít nhất 1 ảnh xác nhận giao');
  const cod = xlNum(d.codCollected) || 0;
  if (o.cod && cod !== Number(o.cod) && !d.note) return toast('Số tiền thu khác số phải thu – vui lòng ghi chú lý do');
  if (STATE.pending.length) await savePhotos(o, STATE.pending, 'Giao thành công');
  Object.assign(o, { status: 'giao_thanh_cong', tDelivered: now, codCollected: cod, receiver: d.receiver, deliverNote: d.note });
  if (!o.tArrive) o.tArrive = now;
  upsert('orders', o); closeModal(); renderView(); toast(`Giao thành công lúc ${fmtT(now)} – chờ Admin xác nhận`);
  const gps = await getGPS(); if (gps) { o.gpsDone = gps; upsert('orders', o); }
  log('Giao thành công', code, `${o.customerName} · thu ${money(cod)} · ${fmtT(now)}`, gps);
};
ACT.deliverFail = code => {
  const o = byId('orders', code);
  openModal('Báo không giao được', `<div data-order="${esc(code)}"></div>
    <p><b>${esc(o.customerName)}</b> <span class="small muted">${esc(o.code)}</span></p>
    <div class="row" id="fv">
      <label class="f full">Lý do${selectHTML('reason', FAIL_REASONS.map(x => [x, x]), FAIL_REASONS[0])}</label>
      <label class="f full">Ghi chú<textarea name="note"></textarea></label>
    </div>
    <div class="mt"><b>Ảnh hiện trường (nên có)</b>${photoPicker()}</div>
    <button class="btn r big mt" data-act="confirmFail" data-id="${esc(code)}">✖ Xác nhận không giao được</button>`);
};
ACT.confirmFail = async code => {
  const o = byId('orders', code), d = formData($('#fv')), now = nowISO();
  if (STATE.pending.length) await savePhotos(o, STATE.pending, 'Không giao được');
  Object.assign(o, { status: 'giao_that_bai', tFailed: now, failReason: d.reason + (d.note ? ' – ' + d.note : '') });
  if (!o.tArrive) o.tArrive = now;
  upsert('orders', o); closeModal(); renderView(); toast('Đã báo không giao được');
  const gps = await getGPS(); if (gps) { o.gpsDone = gps; upsert('orders', o); }
  log('Không giao được', code, o.failReason, gps);
};
function vHistory() {
  const os = DB.orders.filter(o => o.driverId === ME.id).sort((a, b) => b.date.localeCompare(a.date) || (a.seq || 0) - (b.seq || 0)).slice(0, 200);
  return `<div class="sec-title"><h2>Lịch sử giao hàng của tôi</h2></div>
  ${os.length ? `<div class="tw"><table><thead><tr><th>Ngày</th><th>Mã đơn</th><th>Khách</th><th>Đến điểm</th><th>Giao TC</th><th>Trạng thái</th><th class="num">Đã thu</th></tr></thead><tbody>
  ${os.map(o => `<tr class="click" data-act="openOrder" data-id="${esc(o.code)}"><td>${fmtD(o.date)}</td><td>${esc(o.code)}</td><td>${esc(o.customerName)}</td><td>${fmtHM(o.tArrive)}</td><td>${fmtHM(o.tDelivered)}</td><td>${badge(OST, o.status)}</td><td class="num">${o.codCollected != null ? money(o.codCollected) : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">Chưa có dữ liệu.</div>'}`;
}

/* =====================================================================
   LỊCH — bảng lịch theo ngày xuất phát
   ===================================================================== */
function vCal() {
  const [y, m] = STATE.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1), startDow = (first.getDay() + 6) % 7, days = new Date(y, m, 0).getDate();
  const mine = ME.role === 'taixe';
  const tsAll = DB.trips.filter(t => t.status !== 'huy' && (!mine || t.driverId === ME.id));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(y, m - 1, 1 - startDow + i), ds = localDate(dt), n = tsAll.filter(t => t.date === ds), no = DB.orders.filter(o => o.date === ds && (!mine || o.driverId === ME.id)).length;
    cells.push(`<div class="d ${dt.getMonth() !== m - 1 ? 'o' : ''} ${ds === STATE.date ? 'sel' : ''} ${ds === today() ? 'today' : ''}" data-act="calDay" data-id="${ds}"><b>${dt.getDate()}</b>${n.length ? `<div class="c">🚚 ${n.length} chuyến</div>` : ''}${no ? `<div class="small muted">${no} đơn</div>` : ''}</div>`);
  }
  const ts = tsAll.filter(t => t.date === STATE.date).sort((a, b) => (a.plannedStart || '').localeCompare(b.plannedStart || ''));
  const H0 = 6, H1 = 20, pos = min => Math.max(0, Math.min(100, (min - H0 * 60) / ((H1 - H0) * 60) * 100));
  const rows = [...new Set(ts.map(t => t.driverId))].map(did => {
    const mts = ts.filter(t => t.driverId === did);
    return `<div class="g-row"><div class="g-name">${esc(userName(did))}</div><div class="g-track">${mts.map(t => {
      const a = toMin(t.plannedStart), b = toMin(t.planEnd) || a + 60;
      const ra = t.tLoadStart ? isoMinOfDay(t.tLoadStart) : null, rb = t.tReturn ? isoMinOfDay(t.tReturn) : (ra != null && t.date === today() ? isoMinOfDay(nowISO()) : null);
      return `<div class="g-bar plan" style="left:${pos(a)}%;width:${pos(b) - pos(a)}%" title="Kế hoạch ${t.plannedStart}–${t.planEnd}">${esc(t.code)} · ${t.plannedStart}–${t.planEnd || ''}</div>${ra != null && rb != null ? `<div class="g-bar real" style="left:${pos(ra)}%;width:${Math.max(0.5, pos(rb) - pos(ra))}%" title="Thực tế"></div>` : ''}`;
    }).join('')}</div></div>`;
  }).join('');
  return `<div class="sec-title"><h2>Lịch giao hàng</h2><div class="row"><button class="btn sm" data-act="calNav" data-id="-1">‹</button><b>Tháng ${m}/${y}</b><button class="btn sm" data-act="calNav" data-id="1">›</button><button class="btn sm" data-act="calDay" data-id="${today()}">Hôm nay</button></div></div>
  <div class="cal">${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(x => `<div class="dh">${x}</div>`).join('')}${cells.join('')}</div>
  <div class="sec-title mt2"><h2>Bảng lịch ngày ${fmtD(STATE.date)}</h2><div class="row">${can('export') ? '<button class="btn" data-act="exportSchedule">⬇ Xuất Excel bảng lịch</button>' : ''}${can('assign') ? '<button class="btn p" data-act="tab" data-id="assign">⚖️ Giao việc ngày này</button>' : ''}</div></div>
  ${ts.length ? `<div class="tw"><table><thead><tr><th>Tài xế</th><th>Chuyến</th><th>Xe</th><th class="num">Số điểm</th><th>Xuất phát DK</th><th>Về kho DK</th><th class="num">TG làm việc DK</th><th class="num">Km DK</th><th>Lên hàng</th><th>Di chuyển</th><th>Về kho</th><th>Trạng thái</th></tr></thead><tbody>
    ${ts.map(t => `<tr class="click" data-act="${can('trip.edit') ? 'openTrip' : 'noop'}" data-id="${esc(t.code)}"><td>${esc(userName(t.driverId))}</td><td>${esc(t.code)}</td><td>${esc(t.vehicle || '')}</td><td class="num">${tripOrders(t).length}</td><td>${t.plannedStart}</td><td>${t.planEnd || ''}</td><td class="num">${durTxt(t.planMin)}</td><td class="num">${t.planKm || 0}</td><td>${fmtHM(t.tLoadStart)}</td><td>${fmtHM(t.tDepart)}</td><td>${fmtHM(t.tReturn)}</td><td>${badge(TST, t.status)}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="tw mt"><div class="gantt"><div class="g-hours"><div></div><div>${Array.from({ length: 14 }, (_, i) => `<div>${H0 + i}h</div>`).join('')}</div></div>${rows}</div></div>
  <p class="small muted">Thanh xám: kế hoạch · Thanh cam: thực tế (từ lúc bắt đầu lên hàng đến lúc về kho).</p>` : '<div class="card empty">Chưa có chuyến nào trong ngày này.</div>'}`;
}
ACT.noop = () => {};
ACT.calNav = dir => { const [y, m] = STATE.calMonth.split('-').map(Number); const d = new Date(y, m - 1 + Number(dir), 1); STATE.calMonth = localDate(d).slice(0, 7); renderView(); };
ACT.calDay = ds => { STATE.date = ds; STATE.calMonth = ds.slice(0, 7); renderView(); };
ACT.exportSchedule = () => {
  const ts = DB.trips.filter(t => t.date === STATE.date && t.status !== 'huy');
  const rows = ts.flatMap(t => tripOrders(t).map(o => ({ NGAY_XUAT_PHAT: t.date, MA_TAI_XE: t.driverId, TAI_XE: userName(t.driverId), MA_CHUYEN: t.code, BIEN_SO_XE: t.vehicle, GIO_XUAT_PHAT_DK: t.plannedStart,
    THU_TU: o.seq, MA_DON: o.code, MA_KH: o.customerCode, TEN_KH: o.customerName, DIA_CHI: o.address, KHUNG_GIO: o.timeWindow, GIO_DU_KIEN: o.eta, TIEN_THU_HO: o.cod, TRANG_THAI: OST[o.status][0] })));
  writeWorkbook([['BANG_LICH', rows], [XL.trips.sheet, toXlRows('trips', ts)]], `BangLich_${STATE.date}.xlsx`);
};

/* =====================================================================
   DUYỆT — Admin là người xác nhận cuối cùng
   ===================================================================== */
const awaiting = () => DB.orders.filter(o => o.status === 'giao_thanh_cong' || (o.status === 'giao_that_bai' && !o.adminConfirmAt));
function vReview() {
  const list = awaiting().filter(o => !STATE.f.onlyDay || o.date === STATE.date).sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
  const ad = admins();
  return `<div class="sec-title"><h2>Duyệt kết quả giao (${list.length})</h2></div>
  <div class="hint">🔒 <b>Người xác nhận cuối cùng là Admin.</b> App gợi ý người duyệt: <b>${esc(ad[0]?.name || 'Admin')}</b>. ${isAdmin() ? '' : 'Bạn chỉ xem được, không duyệt được.'}</div>
  <div class="filters mt">${dateInput()}<label class="f">Phạm vi${selectHTML('onlyDay', [['', 'Tất cả ngày'], ['1', 'Chỉ ngày đã chọn']], STATE.f.onlyDay, { attrs: 'data-chg="f"' })}</label>
    ${isAdmin() ? `<label class="f">Người xác nhận cuối (gợi ý Admin)${selectHTML('approver', ad.map(u => [u.id, u.name]), ME.id, { attrs: 'id="approver"' })}</label>` : ''}</div>
  ${list.length ? list.map(o => `<div class="job s-${o.status}"><div class="row sb">
      <label class="check" style="padding:0">${isAdmin() ? `<input type="checkbox" class="rv" value="${esc(o.code)}" ${o.status === 'giao_thanh_cong' ? 'checked' : ''}>` : ''}<span><b>${esc(o.code)}</b> · ${esc(o.customerName)} <span class="small muted">· ${fmtD(o.date)} · ${esc(userName(o.driverId))}</span></span></label>${badge(OST, o.status)}</div>
    <div class="small mt">${o.status === 'giao_thanh_cong' ? `Giao lúc <b>${fmtT(o.tDelivered)}</b> · Thu hộ ${money(o.codCollected)} / ${money(o.cod)}${Number(o.codCollected) !== Number(o.cod || 0) ? ' <span class="bd red">lệch</span>' : ''}${o.receiver ? ' · Người nhận: ' + esc(o.receiver) : ''}${o.deliverNote ? ' · ' + esc(o.deliverNote) : ''}` : `Báo lúc <b>${fmtT(o.tFailed)}</b> · Lý do: <b>${esc(o.failReason)}</b>`}
      ${(o.photos || []).length ? '' : ' · <span class="bd red">Chưa có ảnh</span>'}</div>
    ${thumbs(o)}
    ${isAdmin() ? `<div class="row mt">${o.status === 'giao_thanh_cong' ? `<button class="btn sm g" data-act="approve" data-id="${esc(o.code)}">✅ Duyệt hoàn tất</button><button class="btn sm" data-act="reject" data-id="${esc(o.code)}">↩ Trả lại tài xế</button>`
      : `<button class="btn sm" data-act="redeliver" data-id="${esc(o.code)}">📅 Giao lại (về chờ phân công)</button><button class="btn sm r" data-act="closeFail" data-id="${esc(o.code)}">Chốt không giao</button>`}<button class="btn sm" data-act="openOrder" data-id="${esc(o.code)}">Chi tiết</button></div>` : ''}
  </div>`).join('') + (isAdmin() ? '<button class="btn g big mt" data-act="approveSelected">✅ Duyệt hoàn tất các đơn đã chọn</button>' : '') : '<div class="card empty">Không có đơn nào chờ duyệt. 🎉</div>'}`;
}
const approverId = () => $('#approver')?.value || ME.id;
function doApprove(o) { Object.assign(o, { status: 'hoan_tat', adminConfirmBy: approverId(), adminConfirmAt: nowISO() }); upsert('orders', o); log('Admin duyệt hoàn tất', o.code, `Người xác nhận: ${userName(o.adminConfirmBy)}`); }
ACT.approve = code => { if (!isAdmin()) return; doApprove(byId('orders', code)); renderView(); };
ACT.reviewOne = code => { closeModal(); STATE.tab = 'review'; renderNav(); renderView(); };
ACT.approveSelected = () => {
  if (!isAdmin()) return; const codes = [...document.querySelectorAll('.rv:checked')].map(x => x.value).filter(c => byId('orders', c)?.status === 'giao_thanh_cong');
  if (!codes.length) return toast('Chọn đơn giao thành công để duyệt'); codes.forEach(c => doApprove(byId('orders', c))); toast(`Đã duyệt ${codes.length} đơn`); renderView();
};
ACT.reject = code => {
  const why = prompt('Lý do trả lại cho tài xế (VD: ảnh mờ, thiếu chữ ký):'); if (why == null) return;
  const o = byId('orders', code); Object.assign(o, { status: 'da_den', tDelivered: null, rejectNote: why }); upsert('orders', o); log('Admin trả lại', code, why); renderView();
};
ACT.redeliver = code => {
  const d = prompt('Ngày giao lại (yyyy-mm-dd):', localDate(new Date(Date.now() + 864e5))); if (!d) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return toast('Ngày không hợp lệ');
  const o = byId('orders', code), oldTrip = o.tripCode;
  Object.assign(o, { adminConfirmBy: approverId(), adminConfirmAt: nowISO() }); upsert('orders', o);
  // Tạo đơn mới để giữ lịch sử đơn cũ, mã mới liên kết mã cũ
  const nc = nextCode('DH', d, 'orders');
  const n = { ...o, id: nc, code: nc, date: d, status: 'cho_phan_cong', driverId: '', tripCode: '', seq: null, eta: '', tArrive: null, tDelivered: null, tFailed: null, failReason: '', photos: [], codCollected: null, adminConfirmAt: null, adminConfirmBy: '', gpsArrive: null, gpsDone: null, note: `Giao lại từ ${code}. ${o.note || ''}`.trim(), createdAt: nowISO(), createdBy: ME.id, tAssigned: null, receiver: '', deliverNote: '' };
  upsert('orders', n); log('Lên lịch giao lại', code, `Đơn mới ${nc} ngày ${fmtD(d)} (chuyến cũ ${oldTrip})`); toast(`Đã tạo đơn giao lại ${nc}`); renderView();
};
ACT.closeFail = code => { const o = byId('orders', code); Object.assign(o, { adminConfirmBy: approverId(), adminConfirmAt: nowISO() }); upsert('orders', o); log('Admin chốt không giao', code, o.failReason); renderView(); };

/* =====================================================================
   ẢNH GIAO — check-in file hình cho đơn đã giao / chưa giao
   ===================================================================== */
function vPhotos() {
  const g = STATE.f.pg || 'all';
  const os = DB.orders.filter(o => o.date === STATE.date).filter(o => ({ all: true, done: OK_ST.includes(o.status), notdone: !isDone(o), fail: o.status === 'giao_that_bai', missing: isDone(o) && !(o.photos || []).length })[g]);
  const opts = [['all', 'Tất cả'], ['done', 'Đã giao'], ['notdone', 'Chưa giao'], ['fail', 'Không giao được'], ['missing', 'Đã xử lý nhưng thiếu ảnh']];
  return `<div class="sec-title"><h2>Ảnh check-in giao hàng</h2></div>
  <div class="filters">${dateInput()}<label class="f">Nhóm đơn${selectHTML('pg', opts, g, { attrs: 'data-chg="f"' })}</label></div>
  ${os.length ? os.map(o => `<div class="job s-${o.status}"><div class="row sb"><span><b>${esc(o.code)}</b> · ${esc(o.customerName)} <span class="small muted">· ${esc(userName(o.driverId))}</span></span>${badge(OST, o.status)}</div>
    ${thumbs(o) || '<div class="small muted mt">Chưa có ảnh</div>'}
    <div class="row mt"><button class="btn sm" data-act="addPhoto" data-id="${esc(o.code)}">📷 Tải ảnh lên</button><button class="btn sm" data-act="openOrder" data-id="${esc(o.code)}">Chi tiết</button></div></div>`).join('') : '<div class="card empty">Không có đơn phù hợp.</div>'}`;
}

/* =====================================================================
   ĐỐI SOÁT THU HỘ
   ===================================================================== */
function settleRows(d) {
  return drivers(true).map(u => {
    const os = DB.orders.filter(o => o.date === d && o.driverId === u.id); if (!os.length) return null;
    const ok = os.filter(o => OK_ST.includes(o.status));
    const exp = ok.reduce((s, o) => s + (Number(o.cod) || 0), 0), col = ok.reduce((s, o) => s + (Number(o.codCollected) || 0), 0);
    const st = byId('settlements', `${d}_${u.id}`);
    return { u, os, ok, fail: os.filter(o => o.status === 'giao_that_bai'), pending: os.filter(o => !isDone(o)), exp, col, st };
  }).filter(Boolean);
}
function vSettle() {
  const d = STATE.date, rows = settleRows(d);
  const T = k => rows.reduce((s, r) => s + r[k], 0);
  return `<div class="sec-title"><h2>Đối soát thu hộ</h2><button class="btn" data-act="exportSettle">⬇ Xuất Excel đối soát</button></div>
  <div class="filters">${dateInput()}</div>
  <div class="kpis"><div class="kpi"><b style="font-size:18px">${money(T('exp'))}</b><span>Phải thu (đơn giao TC)</span></div><div class="kpi g"><b style="font-size:18px">${money(T('col'))}</b><span>Tài xế báo đã thu</span></div>
    <div class="kpi b"><b style="font-size:18px">${money(rows.reduce((s, r) => s + (r.st?.cashSubmitted || 0), 0))}</b><span>Đã nộp về</span></div><div class="kpi r"><b>${rows.filter(r => !r.st).length}</b><span>Tài xế chưa chốt</span></div></div>
  ${rows.length ? `<div class="tw mt"><table><thead><tr><th>Tài xế</th><th class="num">Đơn</th><th class="num">Giao TC</th><th class="num">Không giao</th><th class="num">Chưa xong</th><th class="num">Phải thu</th><th class="num">Đã thu</th><th class="num">Đã nộp</th><th class="num">Chênh lệch</th><th>Trạng thái</th><th></th></tr></thead><tbody>
  ${rows.map(r => { const diff = r.st ? r.st.cashSubmitted - r.exp : r.col - r.exp;
    return `<tr><td><b>${esc(r.u.name)}</b></td><td class="num">${r.os.length}</td><td class="num">${r.ok.length}</td><td class="num">${r.fail.length}</td><td class="num">${r.pending.length}</td><td class="num">${money(r.exp)}</td><td class="num">${money(r.col)}</td><td class="num">${r.st ? money(r.st.cashSubmitted) : '—'}</td>
    <td class="num" style="color:${diff ? 'var(--bad)' : 'var(--ok)'}">${money(diff)}</td><td>${r.st ? `<span class="bd grn">Đã chốt · ${esc(userName(r.st.by))}</span>` : '<span class="bd yel">Chưa chốt</span>'}</td>
    <td><button class="btn sm" data-act="settleOne" data-id="${r.u.id}">${r.st ? 'Xem / sửa' : 'Chốt nộp tiền'}</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="card empty mt">Không có đơn nào trong ngày.</div>'}`;
}
ACT.settleOne = did => {
  const d = STATE.date, r = settleRows(d).find(x => x.u.id === did), st = r.st;
  openModal(`Đối soát – ${esc(r.u.name)} – ${fmtD(d)}`, `
    <div class="tw"><table><thead><tr><th>Mã đơn</th><th>Khách</th><th>Trạng thái</th><th class="num">Phải thu</th><th class="num">Đã thu</th></tr></thead><tbody>
    ${r.os.map(o => `<tr><td>${esc(o.code)}</td><td>${esc(o.customerName)}</td><td>${badge(OST, o.status)}</td><td class="num">${OK_ST.includes(o.status) ? money(o.cod) : `<s class="muted">${money(o.cod)}</s>`}</td><td class="num" style="${OK_ST.includes(o.status) && Number(o.codCollected) !== Number(o.cod || 0) ? 'color:var(--bad);font-weight:700' : ''}">${o.codCollected != null ? money(o.codCollected) : '—'}</td></tr>`).join('')}
    </tbody></table></div>
    ${r.pending.length ? `<div class="hint mt">Còn ${r.pending.length} đơn chưa xử lý xong – nên chốt sau khi tài xế về kho.</div>` : ''}
    <div class="row mt" id="sf"><label class="f">Số tiền tài xế nộp về (đ)<input name="cash" type="number" step="1000" value="${st ? st.cashSubmitted : r.col}"></label><label class="f">Ghi chú<input name="note" value="${esc(st?.note || '')}"></label></div>
    <div class="row mt"><span class="grow small muted">Phải thu ${money(r.exp)} · Tài xế báo thu ${money(r.col)}</span>${can('settle') ? `<button class="btn p" data-act="saveSettle" data-id="${did}">💾 Xác nhận đã nộp</button>` : ''}</div>`, true);
};
ACT.saveSettle = did => {
  const d = STATE.date, r = settleRows(d).find(x => x.u.id === did), f = formData($('#sf')), cash = xlNum(f.cash) || 0;
  upsert('settlements', { id: `${d}_${did}`, date: d, driverId: did, codExpected: r.exp, codCollected: r.col, cashSubmitted: cash, diff: cash - r.exp, by: ME.id, at: nowISO(), note: f.note });
  log('Chốt đối soát', `${d}_${did}`, `${r.u.name}: phải thu ${money(r.exp)}, nộp ${money(cash)}, lệch ${money(cash - r.exp)}`); closeModal(); renderView();
};
ACT.exportSettle = () => {
  const rows = settleRows(STATE.date);
  writeWorkbook([[XL.settlements.sheet, rows.map(r => ({ NGAY: STATE.date, MA_TAI_XE: r.u.id, TAI_XE: r.u.name, SO_DON: r.os.length, GIAO_TC: r.ok.length, KHONG_GIAO: r.fail.length, PHAI_THU: r.exp, THUC_THU: r.col, DA_NOP: r.st?.cashSubmitted ?? '', CHENH_LECH: r.st ? r.st.cashSubmitted - r.exp : r.col - r.exp, NGUOI_XAC_NHAN: r.st ? userName(r.st.by) : '', GIO_XAC_NHAN: r.st ? fmtDT(r.st.at) : '', GHI_CHU: r.st?.note || '' }))],
    ['CHI_TIET', rows.flatMap(r => toXlRows('orders', r.os))]], `DoiSoat_${STATE.date}.xlsx`);
};

/* =====================================================================
   BÁO CÁO
   ===================================================================== */
function reportData() {
  const from = STATE.f.from || STATE.date.slice(0, 8) + '01', to = STATE.f.to || STATE.date;
  const os = DB.orders.filter(o => o.date >= from && o.date <= to), ts = DB.trips.filter(t => t.date >= from && t.date <= to && t.status !== 'huy');
  const ontime = o => o.tDelivered && (winEnd(o) == null || isoMinOfDay(o.tDelivered) <= winEnd(o));
  const agg = list => {
    const ok = list.filter(o => OK_ST.includes(o.status)), fail = list.filter(o => o.status === 'giao_that_bai');
    const dwell = ok.map(o => minsBetween(o.tArrive, o.tDelivered)).filter(x => x != null && x >= 0);
    return { n: list.length, ok: ok.length, fail: fail.length, rate: list.length ? ok.length / list.length * 100 : 0, ontime: ok.length ? ok.filter(ontime).length / ok.length * 100 : 0,
      dwell: dwell.length ? dwell.reduce((a, b) => a + b, 0) / dwell.length : null, cod: ok.reduce((s, o) => s + (Number(o.codCollected) || 0), 0), photo: list.filter(o => isDone(o) && !(o.photos || []).length).length };
  };
  const byDriver = drivers(true).map(u => { const l = os.filter(o => o.driverId === u.id), mt = ts.filter(t => t.driverId === u.id);
    const work = mt.map(t => minsBetween(t.tLoadStart, t.tReturn)).filter(x => x != null);
    const load = mt.map(t => minsBetween(t.tLoadStart, t.tDepart)).filter(x => x != null);
    return { u, a: agg(l), trips: mt.length, work: work.reduce((a, b) => a + b, 0), plan: mt.reduce((s, t) => s + (t.planMin || 0), 0), load: load.length ? load.reduce((a, b) => a + b, 0) / load.length : null }; }).filter(r => r.a.n || r.trips);
  const byRoute = DB.routes.map(r => ({ r, a: agg(os.filter(o => o.route === r.code)) })).filter(x => x.a.n);
  const reasons = {}; os.filter(o => o.status === 'giao_that_bai').forEach(o => { const k = (o.failReason || 'Khác').split(' – ')[0]; reasons[k] = (reasons[k] || 0) + 1; });
  return { from, to, all: agg(os), byDriver, byRoute, reasons };
}
function vReport() {
  const R = reportData(), pct = x => x.toFixed(1) + '%';
  return `<div class="sec-title"><h2>Báo cáo giao hàng</h2><button class="btn" data-act="exportReport">⬇ Xuất Excel báo cáo</button></div>
  <div class="filters"><label class="f">Từ ngày<input type="date" name="from" value="${R.from}" data-chg="f"></label><label class="f">Đến ngày<input type="date" name="to" value="${R.to}" data-chg="f"></label></div>
  <div class="kpis"><div class="kpi"><b>${R.all.n}</b><span>Tổng đơn</span></div><div class="kpi g"><b>${pct(R.all.rate)}</b><span>Tỷ lệ giao thành công</span></div><div class="kpi r"><b>${R.all.fail}</b><span>Không giao được</span></div>
    <div class="kpi b"><b>${pct(R.all.ontime)}</b><span>Giao đúng khung giờ</span></div><div class="kpi"><b>${R.all.dwell != null ? Math.round(R.all.dwell) + '′' : '—'}</b><span>TB thời gian tại điểm</span></div><div class="kpi o"><b style="font-size:18px">${money(R.all.cod)}</b><span>Thu hộ đã thu</span></div></div>
  <h3 class="mt2" style="margin-bottom:8px">Theo tài xế</h3>
  <div class="tw"><table><thead><tr><th>Tài xế</th><th class="num">Chuyến</th><th class="num">Đơn</th><th class="num">Giao TC</th><th class="num">Không giao</th><th class="num">Tỷ lệ TC</th><th class="num">Đúng giờ</th><th class="num">TG làm việc thực tế</th><th class="num">TG kế hoạch</th><th class="num">TB lên hàng</th><th class="num">Thu hộ</th><th class="num">Thiếu ảnh</th></tr></thead><tbody>
  ${R.byDriver.map(r => `<tr><td>${esc(r.u.name)}</td><td class="num">${r.trips}</td><td class="num">${r.a.n}</td><td class="num">${r.a.ok}</td><td class="num">${r.a.fail}</td><td class="num">${pct(r.a.rate)}</td><td class="num">${pct(r.a.ontime)}</td><td class="num">${durTxt(r.work)}</td><td class="num">${durTxt(r.plan)}</td><td class="num">${r.load != null ? Math.round(r.load) + '′' : '—'}</td><td class="num">${money(r.a.cod)}</td><td class="num">${r.a.photo || ''}</td></tr>`).join('') || '<tr><td colspan="12" class="muted">Không có dữ liệu</td></tr>'}</tbody></table></div>
  <div class="split mt2"><div><h3 style="margin-bottom:8px">Theo tuyến</h3><div class="tw"><table><thead><tr><th>Tuyến</th><th class="num">Đơn</th><th class="num">Tỷ lệ TC</th><th class="num">Đúng giờ</th></tr></thead><tbody>
    ${R.byRoute.map(x => `<tr><td>${esc(x.r.code)} – ${esc(x.r.name)}</td><td class="num">${x.a.n}</td><td class="num">${pct(x.a.rate)}</td><td class="num">${pct(x.a.ontime)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">—</td></tr>'}</tbody></table></div></div>
    <div><h3 style="margin-bottom:8px">Lý do không giao được</h3><div class="card"><ul class="list-mini">${Object.entries(R.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span>${esc(k)}</span><b>${v}</b></li>`).join('') || '<li class="muted">Không có</li>'}</ul></div></div></div>`;
}
ACT.exportReport = () => {
  const R = reportData();
  writeWorkbook([['TONG_HOP', [{ TU_NGAY: R.from, DEN_NGAY: R.to, TONG_DON: R.all.n, GIAO_TC: R.all.ok, KHONG_GIAO: R.all.fail, TY_LE_TC: +R.all.rate.toFixed(1), DUNG_GIO: +R.all.ontime.toFixed(1), TB_PHUT_TAI_DIEM: R.all.dwell != null ? Math.round(R.all.dwell) : '', THU_HO: R.all.cod }]],
    ['THEO_TAI_XE', R.byDriver.map(r => ({ MA_TAI_XE: r.u.id, TAI_XE: r.u.name, SO_CHUYEN: r.trips, SO_DON: r.a.n, GIAO_TC: r.a.ok, KHONG_GIAO: r.a.fail, TY_LE_TC: +r.a.rate.toFixed(1), DUNG_GIO: +r.a.ontime.toFixed(1), PHUT_LAM_VIEC_THUC_TE: Math.round(r.work), PHUT_KE_HOACH: r.plan, THU_HO: r.a.cod, THIEU_ANH: r.a.photo }))],
    ['THEO_TUYEN', R.byRoute.map(x => ({ MA_TUYEN: x.r.code, TEN_TUYEN: x.r.name, SO_DON: x.a.n, TY_LE_TC: +x.a.rate.toFixed(1), DUNG_GIO: +x.a.ontime.toFixed(1) }))],
    ['LY_DO_THAT_BAI', Object.entries(R.reasons).map(([k, v]) => ({ LY_DO: k, SO_DON: v }))],
    [XL.orders.sheet, toXlRows('orders', DB.orders.filter(o => o.date >= R.from && o.date <= R.to))]], `BaoCao_${R.from}_${R.to}.xlsx`);
};

/* =====================================================================
   DANH MỤC
   ===================================================================== */
const CAT = {
  customers: { title: 'Khách hàng', key: 'code', cols: ['code', 'name', 'phone', 'route', 'timeWindow', 'address'], fields: [
    ['code', 'Mã KH', 'text', 1], ['name', 'Tên khách hàng', 'text', 1], ['phone', 'SĐT', 'tel'], ['address', 'Địa chỉ', 'text', 1, 1], ['route', 'Tuyến', 'route'],
    ['timeWindow', 'Khung giờ nhận hàng', 'tw'], ['serviceMin', 'Thời gian giao tại điểm (phút)', 'number'], ['lat', 'Vĩ độ (lat)', 'number'], ['lng', 'Kinh độ (lng)', 'number'], ['note', 'Ghi chú', 'text', 0, 1]] },
  routes: { title: 'Tuyến giao', key: 'code', cols: ['code', 'name', 'area'], fields: [['code', 'Mã tuyến', 'text', 1], ['name', 'Tên tuyến', 'text', 1], ['area', 'Khu vực', 'text']] },
  vehicles: { title: 'Xe', key: 'plate', cols: ['plate', 'type', 'capacityKg'], fields: [['plate', 'Biển số', 'text', 1], ['type', 'Loại xe', 'vtype'], ['capacityKg', 'Tải trọng (kg)', 'number']] },
  users: { title: 'Người dùng', key: 'id', admin: 1, cols: ['id', 'name', 'role', 'phone', 'vehicle', 'active'], fields: [
    ['id', 'Mã NV (VD TX05)', 'text', 1], ['name', 'Họ tên', 'text', 1], ['role', 'Vai trò', 'role'], ['phone', 'SĐT', 'tel'], ['vehicle', 'Xe mặc định', 'vehicle'], ['active', 'Trạng thái', 'bool'], ['pin', 'PIN mới (để trống = không đổi)', 'password']] },
};
const LABEL = { code: 'Mã', name: 'Tên', phone: 'SĐT', route: 'Tuyến', timeWindow: 'Khung giờ', address: 'Địa chỉ', area: 'Khu vực', plate: 'Biển số', type: 'Loại', capacityKg: 'Tải trọng', id: 'Mã NV', role: 'Vai trò', vehicle: 'Xe', active: 'Hoạt động' };
function vCatalog() {
  const tabs = Object.entries(CAT).filter(([, c]) => !c.admin || isAdmin());
  const k = tabs.some(([x]) => x === STATE.catTab) ? STATE.catTab : 'customers', c = CAT[k], q = (STATE.f.q || '').toLowerCase();
  const list = DB[k].filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));
  const cell = (f, r) => f === 'role' ? ROLES[r.role] : f === 'active' ? (r.active === false ? '<span class="bd red">Khóa</span>' : '<span class="bd grn">Đang dùng</span>') : esc(r[f] ?? '');
  return `<div class="sec-title"><h2>Danh mục</h2><div class="row">${tabs.map(([x, cc]) => `<button class="btn sm ${x === k ? 'p' : ''}" data-act="catTab" data-id="${x}">${cc.title}</button>`).join('')}</div></div>
  <div class="row" style="margin-bottom:12px"><input name="q" value="${esc(STATE.f.q || '')}" placeholder="Tìm ${c.title.toLowerCase()}…" data-inp="1" style="max-width:320px"><span class="grow"></span>${can('catalog.edit') ? `<button class="btn p" data-act="catEdit" data-id="">＋ Thêm ${c.title.toLowerCase()}</button>` : ''}</div>
  <div class="tw"><table><thead><tr>${c.cols.map(f => `<th>${LABEL[f] || f}</th>`).join('')}</tr></thead><tbody>
  ${list.map(r => `<tr class="click" data-act="catEdit" data-id="${esc(r.id)}">${c.cols.map(f => `<td>${cell(f, r)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${c.cols.length}" class="muted">Chưa có dữ liệu</td></tr>`}</tbody></table></div>`;
}
ACT.catTab = k => { STATE.catTab = k; STATE.f = {}; renderView(); };
ACT.catEdit = id => {
  const k = STATE.catTab, c = CAT[k], r = id ? byId(k, id) : {}, isNew = !id;
  if (!can('catalog.edit')) return;
  const input = ([f, l, type, req, full]) => {
    const v = r[f] ?? '', lab = `<label class="f ${full ? 'full' : ''}">${l}${req ? ' *' : ''}`;
    if (type === 'route') return `${lab}${selectHTML(f, routeOpts(), v, { empty: '—' })}</label>`;
    if (type === 'tw') return `${lab}${selectHTML(f, TIME_WINDOWS.map(x => [x, x]), v || 'Cả ngày')}</label>`;
    if (type === 'vtype') return `${lab}${selectHTML(f, VEHICLE_TYPES.map(x => [x, x]), v, { empty: '—' })}</label>`;
    if (type === 'role') return `${lab}${selectHTML(f, Object.entries(ROLES), v || 'taixe')}</label>`;
    if (type === 'vehicle') return `${lab}${selectHTML(f, vehicleOpts(), v, { empty: '—' })}</label>`;
    if (type === 'bool') return `${lab}${selectHTML(f, [['1', 'Đang hoạt động'], ['0', 'Khóa tài khoản']], r.active === false ? '0' : '1')}</label>`;
    return `${lab}<input name="${f}" type="${type}" ${type === 'number' ? 'step="any"' : ''} value="${esc(v)}" ${f === c.key && !isNew ? 'readonly' : ''}></label>`;
  };
  openModal(`${isNew ? 'Thêm' : 'Sửa'} ${c.title.toLowerCase()}`, `<div class="row" id="cf">${c.fields.map(input).join('')}</div>
    ${k === 'customers' ? `<div class="row mt"><button class="btn sm" data-act="gpsHere">📍 Lấy tọa độ vị trí hiện tại</button><span class="small muted">Có tọa độ thì app tính tuyến chính xác hơn. Có thể copy tọa độ từ Google Maps (nhấn giữ vào điểm).</span></div>` : ''}
    <div class="row mt"><span class="grow"></span>${!isNew && isAdmin() && k !== 'users' ? `<button class="btn r" data-act="catDel" data-id="${esc(id)}">Xóa</button>` : ''}<button class="btn p" data-act="catSave" data-id="${esc(id || '')}">💾 Lưu</button></div>`);
};
ACT.gpsHere = async () => { toast('Đang lấy vị trí…'); const g = await getGPS(); if (!g) return toast('Không lấy được vị trí'); $('#cf [name=lat]').value = g.lat; $('#cf [name=lng]').value = g.lng; toast(`Đã lấy tọa độ (±${g.acc}m)`); };
ACT.catSave = async id => {
  const k = STATE.catTab, c = CAT[k], d = formData($('#cf'));
  for (const [f, l, , req] of c.fields) if (req && !d[f]) return toast(`Thiếu ${l}`);
  const key = d[c.key]; if (!id && byId(k, key)) return toast('Mã đã tồn tại');
  const r = id ? byId(k, id) : { id: key };
  for (const [f, , type] of c.fields) {
    if (type === 'password') continue;
    if (type === 'bool') r.active = d[f] !== '0';
    else r[f] = type === 'number' ? xlNum(d[f]) : d[f];
  }
  if (k === 'users') {
    if (d.pin) { if (!/^\d{4,8}$/.test(d.pin)) return toast('PIN gồm 4–8 chữ số'); r.pinHash = await hashPin(r.id, d.pin); }
    if (!r.pinHash) return toast('Người dùng mới cần PIN');
    if (r.id === ME.id && r.role !== 'admin') return toast('Không thể tự bỏ quyền Admin của mình');
  }
  upsert(k, r); if (r.id === ME.id) ME = r;
  log(id ? `Sửa ${c.title}` : `Thêm ${c.title}`, r.id, r.name || ''); closeModal(); renderView();
};
ACT.catDel = id => { if (!confirm('Xóa mục này?')) return; removeRec(STATE.catTab, id); log(`Xóa ${CAT[STATE.catTab].title}`, id); closeModal(); renderView(); };

/* =====================================================================
   EXCEL IN/OUT
   ===================================================================== */
function vData() {
  return `<div class="sec-title"><h2>Chuẩn hóa dữ liệu vào – ra (Excel)</h2></div>
  <div class="hint b">Tên sheet và tên cột được chuẩn hóa cố định (IN HOA, không dấu) để sau này nối với phần mềm bán hàng, kế toán, kho. Mã đơn, mã khách hàng, mã tài xế, mã chuyến là khóa liên kết.</div>
  <div class="split mt">
    <div class="card"><h3>⬇ Xuất dữ liệu (OUT)</h3><p class="small muted">Xuất đầy đủ các bảng chuẩn hóa + sheet mô tả cột.</p>
      <button class="btn p big" data-act="exportAll">Xuất toàn bộ dữ liệu</button>
      <button class="btn big mt" data-act="exportTpl">Tải file mẫu nhập liệu</button></div>
    <div class="card"><h3>⬆ Nhập dữ liệu (IN)</h3><p class="small muted">Nhận các sheet: <b>DON_HANG</b>, <b>KHACH_HANG</b>, <b>TUYEN</b>, <b>XE</b>. Đơn đã tồn tại và đã giao sẽ không bị ghi đè.</p>
      ${can('import') ? `<label class="btn p big">Chọn file Excel (.xlsx)<input type="file" accept=".xlsx,.xls,.csv" hidden data-chg="importFile"></label>` : '<div class="muted small">Bạn không có quyền nhập dữ liệu.</div>'}
      <div id="imp-res" class="small mt"></div></div>
  </div>`;
}
const colDoc = () => Object.values(XL).flatMap(x => x.cols.map(([, h, note]) => ({ SHEET: x.sheet, COT: h, MO_TA: note })));
ACT.exportAll = () => writeWorkbook([
  ...['orders', 'trips', 'customers', 'routes', 'vehicles', 'users', 'settlements', 'logs'].map(k => [XL[k].sheet, toXlRows(k, DB[k])]),
  ['MO_TA_COT', colDoc()]], `GiaoHangBinhChieu_${today()}.xlsx`);
ACT.exportTpl = () => {
  const oh = ['MA_DON', 'NGAY_GIAO', 'MA_KH', 'TEN_KH', 'SDT', 'DIA_CHI', 'MA_TUYEN', 'KHUNG_GIO', 'HANG_HOA', 'KHOI_LUONG_KG', 'TIEN_THU_HO', 'GHI_CHU'];
  const c = DB.customers[0] || {};
  writeWorkbook([[XL.orders.sheet, [{ MA_DON: '', NGAY_GIAO: today(), MA_KH: c.code || 'KH001', TEN_KH: '', SDT: '', DIA_CHI: '', MA_TUYEN: '', KHUNG_GIO: '', HANG_HOA: 'Gạo 10 bao', KHOI_LUONG_KG: 100, TIEN_THU_HO: 500000, GHI_CHU: 'Chỉ cần MA_KH – app tự điền tên, địa chỉ, tuyến, khung giờ' }], oh],
    [XL.customers.sheet, [], XL.customers.cols.map(x => x[1])], [XL.routes.sheet, [], XL.routes.cols.map(x => x[1])], [XL.vehicles.sheet, [], XL.vehicles.cols.map(x => x[1])], ['MO_TA_COT', colDoc()]], 'MauNhapLieu_GiaoHang.xlsx');
};
CHG.importFile = async el => {
  const file = el.files[0]; if (!file || !needXLSX()) return;
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true }); el.value = '';
  const res = [];
  const rowsOf = coll => { const ws = wb.Sheets[XL[coll].sheet]; if (!ws) return null; const map = Object.fromEntries(XL[coll].cols.map(([k, h]) => [h, k]));
    return XLSX.utils.sheet_to_json(ws, { defval: '' }).map(r => { const o = {}; for (const [h, v] of Object.entries(r)) if (map[h.trim()]) o[map[h.trim()]] = typeof v === 'string' ? v.trim() : v; return o; }); };
  for (const [coll, key] of [['routes', 'code'], ['vehicles', 'plate'], ['customers', 'code']]) {
    const rows = rowsOf(coll); if (!rows) continue; let n = 0;
    rows.forEach(r => { if (!r[key]) return; const ex = byId(coll, String(r[key])) || {}; const rec = { ...ex, ...r, id: String(r[key]) };
      ['serviceMin', 'lat', 'lng', 'capacityKg'].forEach(f => { if (f in r) rec[f] = xlNum(r[f]); }); upsert(coll, rec); n++; });
    res.push(`${XL[coll].sheet}: ${n} dòng`);
  }
  const ors = rowsOf('orders');
  if (ors) {
    let add = 0, upd = 0, skip = 0; const errs = [];
    ors.forEach((r, i) => {
      const date = xlDate(r.date); if (!date) { errs.push(`Dòng ${i + 2}: thiếu/sai NGAY_GIAO`); return; }
      const c = r.customerCode ? custOf(String(r.customerCode)) : null;
      if (!c && !r.customerName) { errs.push(`Dòng ${i + 2}: thiếu MA_KH hoặc TEN_KH`); return; }
      const code = r.code ? String(r.code) : nextCode('DH', date, 'orders'), ex = byId('orders', code);
      if (ex && ex.status !== 'cho_phan_cong') { skip++; return; }
      const o = ex || { id: code, code, status: 'cho_phan_cong', createdAt: nowISO(), createdBy: ME.id, photos: [] };
      if (c) orderFromCustomer(o, c);
      for (const f of ['customerName', 'phone', 'address', 'route', 'timeWindow', 'items', 'note']) if (r[f]) o[f] = String(r[f]);
      Object.assign(o, { date, customerCode: r.customerCode ? String(r.customerCode) : o.customerCode || '', weightKg: xlNum(r.weightKg), cod: xlNum(r.cod) || 0 });
      if (r.lat !== undefined && r.lat !== '') o.lat = xlNum(r.lat); if (r.lng !== undefined && r.lng !== '') o.lng = xlNum(r.lng);
      upsert('orders', o); ex ? upd++ : add++;
    });
    res.push(`DON_HANG: thêm ${add}, cập nhật ${upd}, bỏ qua ${skip} (đã giao/đang giao)`); if (errs.length) res.push(...errs.slice(0, 15));
  }
  if (!res.length) res.push('Không tìm thấy sheet hợp lệ (DON_HANG, KHACH_HANG, TUYEN, XE).');
  log('Nhập Excel', file.name, res.join(' | ')); $('#imp-res').innerHTML = res.map(esc).join('<br>'); toast('Đã nhập xong');
};

/* =====================================================================
   NHẬT KÝ THAO TÁC
   ===================================================================== */
function vLogs() {
  const f = STATE.f, q = (f.q || '').toLowerCase();
  const list = DB.logs.filter(l => (!f.user || l.userId === f.user) && (!f.day || localDate(new Date(l.t)) === f.day) && (!q || `${l.action} ${l.entity} ${l.detail}`.toLowerCase().includes(q))).sort((a, b) => b.t.localeCompare(a.t));
  return `<div class="sec-title"><h2>Nhật ký thao tác (${list.length})</h2><button class="btn" data-act="exportLogs">⬇ Xuất Excel</button></div>
  <div class="filters"><label class="f">Người dùng${selectHTML('user', DB.users.map(u => [u.id, u.name]), f.user, { empty: 'Tất cả', attrs: 'data-chg="f"' })}</label>
    <label class="f">Ngày<input type="date" name="day" value="${esc(f.day || '')}" data-chg="f"></label><label class="f">Tìm<input name="q" value="${esc(f.q || '')}" data-inp="1" placeholder="Thao tác, mã đơn…"></label></div>
  <div class="tw"><table><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Vai trò</th><th>Thao tác</th><th>Đối tượng</th><th>Chi tiết</th><th>GPS</th></tr></thead><tbody>
  ${list.slice(0, 500).map(l => `<tr><td>${fmtDT(l.t)}</td><td>${esc(l.userName)}</td><td>${esc(ROLES[l.role] || '')}</td><td><b>${esc(l.action)}</b></td><td>${esc(l.entity)}</td><td style="white-space:normal;min-width:220px">${esc(l.detail)}</td><td>${gpsLink(l.gps)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Không có</td></tr>'}</tbody></table></div>`;
}
ACT.exportLogs = () => writeWorkbook([[XL.logs.sheet, toXlRows('logs', [...DB.logs].sort((a, b) => b.t.localeCompare(a.t)))]], `NhatKy_${today()}.xlsx`);

/* =====================================================================
   CÀI ĐẶT
   ===================================================================== */
function vSettings() {
  const s = S(), c = Cloud.cfg;
  const admin = isAdmin();
  return `<div class="sec-title"><h2>Cài đặt</h2></div>
  <div class="card"><h3>📲 Cài app lên điện thoại</h3><div class="hint b mt">${installGuide()}</div>${installEvt ? '<button class="btn n mt" data-act="install">Cài app ngay</button>' : ''}</div>
  <div class="card"><h3>👤 Tài khoản</h3><p class="small muted">${esc(ME.name)} · ${ROLES[ME.role]}</p><button class="btn" data-act="userMenu">Đổi PIN / Đăng xuất</button></div>
  ${admin ? `
  <div class="card"><h3>🚚 Thông số điều phối</h3><div class="row mt" id="sf">
    <label class="f">Tên kho xuất phát<input name="dname" value="${esc(s.depot.name)}"></label>
    <label class="f">Vĩ độ kho<input name="dlat" type="number" step="any" value="${s.depot.lat}"></label>
    <label class="f">Kinh độ kho<input name="dlng" type="number" step="any" value="${s.depot.lng}"></label>
    <label class="f">Tốc độ TB (km/h)${selectHTML('speedKmh', [15, 18, 20, 22, 25, 30, 35, 40].map(x => [x, x + ' km/h']), s.speedKmh)}</label>
    <label class="f">Thời gian lên hàng (phút)${selectHTML('loadMin', [10, 15, 20, 30, 45, 60, 90].map(x => [x, x + ' phút']), s.loadMin)}</label>
    <label class="f">Giao tại điểm mặc định (phút)${selectHTML('defaultServiceMin', [5, 10, 15, 20, 30].map(x => [x, x + ' phút']), s.defaultServiceMin)}</label>
    <label class="f">Giờ xuất phát mặc định${selectHTML('startTime', START_TIMES.map(x => [x, x]), s.startTime)}</label>
    <label class="f">Hệ số đường phố${selectHTML('roadFactor', [1.2, 1.3, 1.35, 1.4, 1.5].map(x => [x, '× ' + x]), s.roadFactor)}</label>
    <label class="f">Bắt buộc ảnh khi giao TC${selectHTML('requirePhoto', [['1', 'Có'], ['0', 'Không']], s.requirePhoto ? '1' : '0')}</label>
  </div><button class="btn p mt" data-act="saveSettings">💾 Lưu thông số</button></div>
  ${cloudCard(true)}
  ${retentionCard()}
  <div class="card"><h3>🧹 Dữ liệu</h3><p class="small muted">Xóa toàn bộ dữ liệu trên máy này và nạp lại dữ liệu mẫu (không ảnh hưởng dữ liệu trên đám mây).</p><button class="btn r" data-act="resetDemo">Nạp lại dữ liệu mẫu</button></div>` :
  `<div class="card"><h3>☁️ Kết nối</h3><p class="small muted">${Cloud.enabled() ? `Đang đồng bộ qua ${Cloud.provider() === 'supabase' ? 'Supabase' : 'Google Sheet'}.` : 'Chưa kết nối đám mây – xin Admin “mã kết nối” rồi dán vào đây.'}</p>
    <label class="f full">Mã kết nối<textarea id="cc-in" placeholder="BC1:…"></textarea></label><button class="btn p mt" data-act="applyCode">Kết nối</button></div>`}
  <p class="small muted mt">Phiên bản 1.1 · ${APP_NAME}</p>`;
}
function cloudCard() {
  const c = Cloud.cfg, prov = STATE.f.prov || Cloud.provider();
  return `<div class="card"><h3>☁️ Đồng bộ đám mây</h3>
    <p class="small muted">Bật để mọi điện thoại/máy tính dùng chung dữ liệu. <b>Google Sheet</b>: mỗi bảng là 1 sheet (cột chuẩn hóa như Excel), ảnh lưu trong Google Drive, link ảnh ở sheet <b>ANH</b>. Hướng dẫn cài trong file <b>google-apps-script/Code.gs</b>.</p>
    <div class="row" id="cf2">
      <label class="f">Nơi lưu trữ${selectHTML('provider', [['gsheet', 'Google Sheet + Google Drive'], ['supabase', 'Supabase']], prov, { attrs: 'data-chg="prov"' })}</label>
      <label class="f">Trạng thái${selectHTML('enabled', [['1', 'Bật đồng bộ'], ['0', 'Tắt (chỉ lưu máy này)']], c.enabled ? '1' : '0')}</label>
      ${prov === 'gsheet' ? `
      <label class="f full">URL ứng dụng web Apps Script (…/exec)<input name="gsUrl" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(c.gsUrl || '')}"></label>
      <label class="f full">Mã bảo mật (TOKEN trong Code.gs)<input name="gsToken" type="password" value="${esc(c.gsToken || '')}"></label>` : `
      <label class="f full">Project URL<input name="url" placeholder="https://xxxx.supabase.co" value="${esc(c.url || '')}"></label>
      <label class="f full">Anon key<input name="key" value="${esc(c.key || '')}" placeholder="eyJhbGciOi…"></label>`}
    </div>
    <div class="row mt"><button class="btn" data-act="testCloud">Kiểm tra kết nối</button><button class="btn p" data-act="saveCloud">💾 Lưu & kết nối</button><button class="btn" data-act="pushAll">⬆ Đẩy toàn bộ dữ liệu + ảnh lên</button>${Cloud.enabled() ? '<button class="btn" data-act="showCode">🔗 Mã kết nối cho máy khác</button>' : ''}</div>
    ${Cloud.lastErr ? `<div class="hint mt">${esc(Cloud.lastErr)}</div>` : ''}</div>`;
}
function retentionCard() {
  const s = S(), m = s.retentionMonths || 3, cut = retentionCutoff(m), st = oldDataStats(cut), total = st.orders + st.trips + st.settlements + st.logs;
  return `<div class="card"><h3>🗄️ Thời hạn lưu trữ dữ liệu</h3>
    <div class="row mt"><label class="f">Chỉ lưu dữ liệu giao hàng trong${selectHTML('retentionMonths', [1, 2, 3, 6, 12].map(x => [x, x + ' tháng gần nhất']), m, { attrs: 'data-chg="retMonths"' })}</label>
      <div class="grow small muted" style="align-self:flex-end">Áp dụng cho đơn giao, chuyến, ảnh, đối soát, nhật ký. Danh mục (khách hàng, tuyến, xe, người dùng) luôn được giữ.</div></div>
    <ul class="list-mini mt">
      <li><span>Mốc giữ lại</span><b>từ ${fmtD(cut)} đến nay</b></li>
      <li><span>Dữ liệu cũ hơn mốc (trên máy này)</span><b>${st.orders} đơn · ${st.photos} ảnh · ${st.trips} chuyến · ${st.settlements} đối soát · ${st.logs} nhật ký</b></li>
      <li><span>Đơn cũ nhất đang lưu</span><b>${st.oldest ? fmtD(st.oldest) : '—'}</b></li>
      <li><span>Lần xác nhận gần nhất</span><b>${s.purgedAt ? `${fmtDT(s.purgedAt)} · ${esc(userName(s.purgedBy))} · gỡ khỏi app dữ liệu trước ${fmtD(s.purgeCutoff)}` : 'Chưa có'}</b></li>
    </ul>
    ${Cloud.enabled() ? `<label class="check mt"><input type="checkbox" id="ret-export"> Xuất thêm file Excel dữ liệu cũ về máy</label>
    <div class="hint b mt">Khi xác nhận, dữ liệu cũ hơn mốc chỉ bị xóa khỏi <b>app trên máy này và mọi máy khác</b> (điện thoại nhẹ, nhanh hơn).
      <b>Google Sheet và ảnh trên Google Drive vẫn giữ nguyên đầy đủ</b>, Admin xem lại dữ liệu cũ trực tiếp trong Google Sheet. Chỉ Admin được xác nhận.</div>`
    : `<input type="checkbox" id="ret-export" checked hidden>
    <div class="hint mt">⚠ Chưa bật đồng bộ Google Sheet nên dữ liệu cũ <b>không có bản lưu trên Google Sheet/Drive</b>. Khi xác nhận, app sẽ bắt buộc xuất file Excel lưu trữ rồi mới xóa khỏi máy; ảnh cũ sẽ mất. Nên bật đồng bộ Google Sheet trước.</div>`}
    <button class="btn r big mt" data-act="purgeOld" ${total ? '' : 'disabled'}>🗄️ Xác nhận app chỉ giữ dữ liệu ${m} tháng gần nhất</button></div>`;
}
CHG.prov = el => { STATE.f.prov = el.value; renderView(); };
CHG.retMonths = el => { const s = S(); s.retentionMonths = +el.value; upsert('settings', s); log('Đổi thời hạn lưu trữ', 'settings', `${s.retentionMonths} tháng`); renderView(); };
ACT.saveSettings = () => {
  const d = formData($('#sf')), s = S();
  Object.assign(s, { depot: { ...s.depot, name: d.dname, lat: xlNum(d.dlat), lng: xlNum(d.dlng) }, speedKmh: +d.speedKmh, loadMin: +d.loadMin, defaultServiceMin: +d.defaultServiceMin, startTime: d.startTime, roadFactor: +d.roadFactor, requirePhoto: d.requirePhoto === '1' });
  upsert('settings', s); log('Sửa cài đặt', 'settings', JSON.stringify({ speed: s.speedKmh, load: s.loadMin, start: s.startTime })); toast('Đã lưu');
};
const cloudFromForm = () => { const d = formData($('#cf2')); return Object.assign({}, Cloud.cfg, d, { enabled: d.enabled === '1' }); };
ACT.testCloud = async () => {
  const old = Cloud.cfg; Cloud.cfg = Object.assign(cloudFromForm(), { enabled: true });
  try { await Cloud.test(); toast('✅ Kết nối thành công'); } catch (e) { toast('❌ ' + e.message, 6000); } finally { Cloud.cfg = old; }
};
function applyCloudCfg(c, label) {
  const target = x => x.provider === 'supabase' ? x.url : x.gsUrl;
  const changed = c.provider !== Cloud.provider() || target(c) !== target(Cloud.cfg);
  Cloud.saveCfg(c); if (changed) Cloud.lastPull = '1970-01-01T00:00:00Z';
  Cloud.start(); log('Cấu hình đám mây', c.provider === 'supabase' ? 'Supabase' : 'Google Sheet', label); toast('Đã lưu cấu hình'); renderView();
}
ACT.saveCloud = () => { const c = cloudFromForm(); applyCloudCfg(c, c.enabled ? 'Bật' : 'Tắt'); };
ACT.pushAll = async () => {
  if (!Cloud.enabled()) return toast('Hãy bật & lưu cấu hình trước');
  if (!confirm('Đẩy toàn bộ dữ liệu và ảnh trên máy này lên đám mây?')) return;
  toast('Đang đẩy dữ liệu, vui lòng chờ…', 4000); await Cloud.pushAll(); toast(Cloud.status === 'err' ? Cloud.lastErr : 'Đã đẩy xong', 5000); updateSync();
};
// Mã kết nối: gom cấu hình đám mây thành 1 chuỗi để dán vào máy tài xế
const encodeCfg = c => 'BC1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ provider: Cloud.provider(), gsUrl: c.gsUrl, gsToken: c.gsToken, url: c.url, key: c.key }))));
ACT.showCode = () => openModal('Mã kết nối cho máy khác', `<p class="small muted">Gửi mã này cho tài xế/nhân viên (Zalo nội bộ). Trên máy họ: Cài đặt → Kết nối → dán mã → Kết nối. Không chia sẻ ra ngoài.</p>
  <textarea id="cc-out" readonly style="min-height:110px">${esc(encodeCfg(Cloud.cfg))}</textarea><button class="btn p mt" data-act="copyCode">📋 Sao chép</button>`);
ACT.copyCode = async () => { const t = $('#cc-out'); t.select(); try { await navigator.clipboard.writeText(t.value); } catch { document.execCommand('copy'); } toast('Đã sao chép mã kết nối'); };
ACT.reload = () => location.reload();
ACT.connectLogin = () => openModal('Kết nối dữ liệu công ty', `<p class="small muted">Dán “mã kết nối” do Admin gửi (bắt đầu bằng BC1:).</p>
  <textarea id="cc-in" placeholder="BC1:…" style="min-height:110px"></textarea><button class="btn p big mt" data-act="applyCode">Kết nối</button>`);
// Máy tham gia dữ liệu công ty: thay dữ liệu trên máy bằng dữ liệu trên đám mây
ACT.applyCode = async () => {
  const v = ($('#cc-in').value || '').trim();
  let c;
  try { if (!v.startsWith('BC1:')) throw 0; c = JSON.parse(decodeURIComponent(escape(atob(v.slice(4))))); } catch { return toast('Mã kết nối không hợp lệ'); }
  if (!confirm('Dữ liệu trên máy này sẽ được thay bằng dữ liệu của công ty trên đám mây. Tiếp tục?')) return;
  const old = Cloud.cfg; Cloud.cfg = Object.assign({}, c, { enabled: true });
  try { await Cloud.test(); } catch (e) { Cloud.cfg = old; return toast('❌ ' + e.message, 6000); }
  closeModal(); toast('Đang tải dữ liệu công ty…', 4000);
  await wipeLocalData();
  Cloud.saveCfg(Cloud.cfg); Cloud.lastPull = '1970-01-01T00:00:00Z';
  await Cloud.pull(); Cloud.start();
  if (Cloud.status === 'err') toast('❌ ' + Cloud.lastErr, 6000); else toast(`Đã kết nối · ${DB.users.length} người dùng, ${DB.orders.length} đơn`);
  ME = ME && byId('users', ME.id);
  if (!ME) { localStorage.removeItem('bc_session'); renderLogin(); } else { log('Kết nối đám mây', 'cloud', 'Bằng mã kết nối'); renderShell(); }
};
// Admin xác nhận: app chỉ giữ dữ liệu N tháng gần nhất; Google Sheet / Drive giữ toàn bộ làm kho lưu trữ
ACT.purgeOld = async () => {
  if (!isAdmin()) return;
  const m = S().retentionMonths || 3, cut = retentionCutoff(m), st = oldDataStats(cut), cloud = Cloud.enabled();
  if (!confirm(`XÁC NHẬN APP CHỈ GIỮ DỮ LIỆU ${m} THÁNG GẦN NHẤT\n\nSẽ gỡ khỏi app (máy này và mọi máy khác) dữ liệu trước ngày ${fmtD(cut)}:\n• ${st.orders} đơn giao (${st.photos} ảnh)\n• ${st.trips} chuyến\n• ${st.settlements} đối soát\n• ${st.logs} dòng nhật ký\n\n${cloud ? '✔ Google Sheet và Google Drive VẪN GIỮ NGUYÊN toàn bộ dữ liệu và ảnh.' : '⚠ Chưa bật Google Sheet: dữ liệu chỉ còn trong file Excel lưu trữ, ảnh cũ sẽ mất.'}\n\nTiếp tục?`)) return;
  if ((prompt('Gõ chữ XOA để xác nhận lần cuối') || '').trim().toUpperCase() !== 'XOA') return toast('Đã hủy');
  // Bảo đảm mọi dữ liệu cũ đã lên Google Sheet trước khi gỡ khỏi máy
  if (cloud) {
    toast('Đang kiểm tra dữ liệu đã lưu lên Google Sheet…', 4000);
    await Cloud.push();
    if (Cloud.status === 'err' || Cloud.pendingOld(cut)) return toast('❌ Còn dữ liệu cũ chưa lưu lên Google Sheet (kiểm tra mạng rồi thử lại). Chưa xóa gì.', 7000);
  }
  const olds = coll => DB[coll].filter(r => { const d = recDate(coll, r); return d && d < cut; });
  if ($('#ret-export')?.checked) {
    writeWorkbook([[XL.orders.sheet, toXlRows('orders', olds('orders'))], [XL.trips.sheet, toXlRows('trips', olds('trips'))],
      [XL.settlements.sheet, toXlRows('settlements', olds('settlements'))], [XL.logs.sheet, toXlRows('logs', olds('logs'))]], `LuuTru_truoc_${cut}.xlsx`);
  }
  const s = S(); Object.assign(s, { purgeCutoff: cut, purgedAt: nowISO(), purgedBy: ME.id }); upsert('settings', s);
  if (cloud) await Cloud.push();   // gửi ngay mốc lưu trữ để các máy khác cùng gỡ dữ liệu cũ
  await pruneLocal(cut);
  log('Xác nhận lưu trữ', `${m} tháng`, `Gỡ khỏi app dữ liệu trước ${fmtD(cut)}: ${st.orders} đơn, ${st.photos} ảnh, ${st.trips} chuyến, ${st.settlements} đối soát, ${st.logs} nhật ký${cloud ? ' · Google Sheet/Drive giữ nguyên' : ''}`);
  toast(`Đã gỡ dữ liệu cũ khỏi app${cloud ? ' · Google Sheet/Drive vẫn giữ đủ' : ''}`, 5000); renderView();
};
ACT.resetDemo = async () => {
  if (!confirm('Xóa toàn bộ dữ liệu trên máy này và nạp lại dữ liệu mẫu?')) return;
  await IDB.clear('kv'); await IDB.clear('photos'); Cloud.q.clear(); localStorage.removeItem('bc_session'); location.reload();
};
