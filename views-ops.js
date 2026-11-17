'use strict';
/* =====================================================================
   views-ops.js — Tổng quan, Đơn giao (nhập Excel), Giao việc nhiều ngày, Chuyến giao
   ===================================================================== */
const driverOpts = (all = false) => drivers(all).map(u => [u.id, `${u.name} (${u.id})`]);
const routeOpts = () => DB.routes.map(r => [r.code, r.code]).sort((a, b) => a[0].localeCompare(b[0], 'vi'));
const vehicleOpts = () => DB.vehicles.map(v => [v.plate, `${v.plate}${v.type ? ' · ' + v.type : ''}`]);
const provOpts = () => provinceNames().map(p => [p, p]);
const dayChips = (a, b) => { const r = []; for (let d = a, i = 0; d <= b && i < 21; d = addDays(d, 1), i++) r.push(d); return r; };

/* =====================================================================
   TỔNG QUAN — tiến độ theo thời gian thực, theo tài xế
   ===================================================================== */
function vDash() {
  const f = STATE.f, [ra, rb] = rangeOn();
  const inR = DB.orders.filter(o => inRange(o.date) && (!f.driver || o.driverId === f.driver));
  const c = st => inR.filter(o => st.includes(o.status)).length;
  const okN = c(OK_ST), failN = c(['giao_that_bai']);
  const overdue = DB.orders.filter(o => !isDone(o) && o.dueDate && o.dueDate < today() && (!f.driver || o.driverId === f.driver));
  const doneOnTime = inR.filter(o => OK_ST.includes(o.status) && !dueInfo(o).late).length;
  const waitAdmin = DB.orders.filter(o => o.status === 'giao_thanh_cong' || (o.status === 'giao_that_bai' && !o.adminConfirmAt)).length;
  const logs = [...DB.logs].sort((a, b) => b.t.localeCompare(a.t)).slice(0, 12);
  const ret = isAdmin() ? (() => { const m = S().retentionMonths || 3, st = oldDataStats(retentionCutoff(m)); return st.orders + st.logs + st.trips ? alertBox('info', `Có dữ liệu cũ hơn ${m} tháng`, `${num(st.orders, 0)} đơn, ${num(st.photos, 0)} ảnh, ${num(st.logs, 0)} nhật ký. Vào <a href="#" data-act="tab" data-id="admin">Quản trị</a> để xác nhận chỉ giữ ${m} tháng gần nhất trên app (Google Sheet và Drive vẫn lưu đủ).`) : ''; })() : '';
  return `
  ${pageTitle('Tổng quan giao hàng', can('map') ? btn(`${ico('map')} Theo dõi bản đồ`, 'tab', 'map', 'secondary') : '')}
  ${MIGRATION && !localStorage.getItem('bc_mig_' + MIGRATION.to) ? alertBox('success', `Đã nâng cấp app lên phiên bản ${APP_VERSION}`, `Dữ liệu của bạn được giữ nguyên${MIGRATION.demo ? `; đã gỡ ${num(MIGRATION.demo, 0)} mục dữ liệu mẫu cũ` : ''}${MIGRATION.orders ? `; chuyển ${num(MIGRATION.orders, 0)} đơn sang cấu trúc mới (bỏ thu hộ / hàng hóa, thêm hạn giao)` : ''}${MIGRATION.customers ? `; nạp ${num(MIGRATION.customers, 0)} khách hàng từ file mẫu` : ''}.`, btn('Đã hiểu', 'migOk', '', 'secondary', 'sm')) : ''}
  ${!DB.customers.length && can('catalog.edit') ? alertBox('warning', 'Chưa có danh mục khách hàng', 'Vào Excel In/Out → “Nhập danh mục khách hàng / địa chỉ giao” và chọn 2 file Excel (hạn mức giao hàng, địa chỉ giao hàng) để nạp khách hàng, tuyến và hạn mức giao.', btn('Mở Excel In/Out', 'tab', 'data', 'primary', 'sm')) : ''}
  ${STATE.defPin ? alertBox('warning', 'Bạn đang dùng PIN mặc định', 'Hãy đổi PIN để bảo vệ tài khoản.', btn('Đổi PIN', 'userMenu', '', 'secondary', 'sm')) : ''}
  ${ret}
  ${waitAdmin && isAdmin() ? alertBox('warning', `${num(waitAdmin, 0)} đơn đang chờ bạn xác nhận cuối cùng`, 'Admin là người xác nhận kết quả giao.', btn('Mở trang Duyệt', 'tab', 'review', 'primary', 'sm')) : ''}
  <div class="filters">${rangeBar()}${fsel('Tài xế', 'driver', driverOpts(true), f.driver, { empty: 'Tất cả tài xế', cls: 'narrow', attrs: 'data-chg="f"' })}</div>
  <div class="kpis">
    ${kpi('Tổng đơn', num(inR.length, 0), '', `<span>Thùng: <b>${num(inR.reduce((s, o) => s + cartonsOf(o), 0), 0)}</b></span><span>Khối lượng: <b>${kgTxt(inR.reduce((s, o) => s + kgOf(o), 0))}</b></span>`)}
    ${kpi('Chờ phân công', num(c(['cho_phan_cong']), 0))}
    ${kpi('Đang xử lý', num(c(['da_phan_cong', 'da_nhan', 'dang_giao', 'da_den']), 0))}
    ${kpi('Giao thành công', num(okN, 0), '', `<span>Đúng hạn: <b>${okN ? num(doneOnTime / okN * 100, 1) : '—'}%</b></span>`)}
    ${kpi('Không giao được', num(failN, 0), '', '', failN ? ['danger', 'Cần xử lý'] : null)}
    ${kpi('Quá hạn chưa giao', num(overdue.length, 0), '', `<span>Tất cả các ngày</span>`, overdue.length ? ['danger', 'Quá hạn'] : null)}
  </div>
  ${f.driver ? driverTrips(f.driver) : `
  <div class="split mt2">
    <div><h3 class="mb">Tiến độ theo tài xế · ${rangeLabel()}</h3>${driverCards(inR)}</div>
    <div><h3 class="mb">Hoạt động mới nhất</h3><div class="card"><ul class="list-mini">${logs.map(l => `<li><span><b>${esc(l.userName)}</b> · ${esc(l.action)} <span class="muted">${esc(l.entity)}</span></span><span class="muted small">${fmtHM(l.t)}</span></li>`).join('') || '<li class="muted">Chưa có hoạt động</li>'}</ul></div></div>
  </div>`}`;
}
function driverCards(inR) {
  const out = drivers(true).map(u => {
    const mo = inR.filter(o => o.driverId === u.id); if (!mo.length) return '';
    const ok = mo.filter(o => OK_ST.includes(o.status)).length, fail = mo.filter(o => o.status === 'giao_that_bai').length;
    const mt = DB.trips.filter(t => t.driverId === u.id && inRange(t.date) && t.status !== 'huy');
    const cur = mt.find(t => !['hoan_thanh', 'huy'].includes(t.status)) || mt[mt.length - 1];
    const next = mo.filter(o => !isDone(o)).sort((a, b) => (a.date + a.seq).localeCompare(b.date + b.seq))[0];
    const lastT = [...mt.flatMap(t => [t.tAccept, t.tLoadStart, t.tDepart, t.tReturn]), ...mo.flatMap(o => [o.tArrive, o.tDelivered, o.tFailed])].filter(Boolean).sort().pop();
    return `<div class="card click" data-act="pickDriver" data-id="${esc(u.id)}" style="cursor:pointer"><div class="rw sb center"><div><b>${esc(u.name)}</b> ${cur ? badge(TST, cur.status) : ''}
      <div class="small muted">${num(mt.length, 0)} chuyến · ${num(ok, 0)}/${num(mo.length, 0)} giao TC${fail ? ` · ${num(fail, 0)} không giao được` : ''} · ${kgTxt(mo.reduce((s, o) => s + kgOf(o), 0))} · Check-in gần nhất: ${fmtHM(lastT)}</div></div>
      <div class="small">${next ? `Điểm kế tiếp: <b>${esc(next.customerName)}</b> (${next.eta || '—'})` : (ok + fail === mo.length ? statusTag('Đã xong việc', 'success') : '')}</div></div>
      <div class="bar mt"><i class="ok" style="width:${ok / mo.length * 100}%"></i><i class="bad" style="width:${fail / mo.length * 100}%"></i></div></div>`;
  }).join('');
  return out || '<div class="card empty">Chưa có đơn nào được giao trong khoảng ngày này.</div>';
}
ACT.migOk = () => { localStorage.setItem('bc_mig_' + MIGRATION.to, '1'); renderView(); };
ACT.pickDriver = id => { STATE.f.driver = id; renderView(); window.scrollTo(0, 0); };
// Tất cả chuyến của 1 tài xế trong khoảng ngày, lọc theo trạng thái / từ khóa
function driverTrips(did) {
  const f = STATE.f, q = vnorm(f.tq || ''), u = byId('users', did);
  let ts = DB.trips.filter(t => t.driverId === did && inRange(t.date) && (f.ts ? t.status === f.ts : t.status !== 'huy' || f.ts === 'huy')).sort((a, b) => b.date.localeCompare(a.date) || a.code.localeCompare(b.code));
  if (q) ts = ts.filter(t => vnorm([t.code, ...tripOrders(t).map(o => `${o.code} ${o.customerName} ${o.province}`)].join(' ')).includes(q));
  const list = ts.map(t => {
    const os = tripOrders(t), ok = os.filter(o => OK_ST.includes(o.status)).length, fail = os.filter(o => o.status === 'giao_that_bai').length;
    return `<div class="card"><div class="rw sb center"><div><b class="nn-mono">${esc(t.code)}</b> ${badge(TST, t.status)} <span class="small muted">${wday(t.date)} ${fmtD(t.date)} · Xe ${esc(t.vehicle || '—')}</span>
      <div class="small muted">${num(os.length, 0)} điểm · ${loadTxt(t)} · ~${num(t.planKm || 0, 1)} km · dự kiến ${t.plannedStart}→${t.planEnd || '—'} · Lên hàng ${fmtHM(t.tLoadStart)} · Đi ${fmtHM(t.tDepart)} · Về ${fmtHM(t.tReturn)}</div></div>
      <div class="rw center">${can('map') ? btn(`${ico('map', 16)} Hành trình`, 'mapTrip', t.code, 'secondary', 'sm') : ''}${can('trip.edit') ? btn('Chi tiết', 'openTrip', t.code, 'secondary', 'sm') : ''}</div></div>
      <div class="bar mt"><i class="ok" style="width:${os.length ? ok / os.length * 100 : 0}%"></i><i class="bad" style="width:${os.length ? fail / os.length * 100 : 0}%"></i></div>
      <details class="mt"><summary class="small">Xem ${num(os.length, 0)} điểm giao</summary>${tbl(['TT', 'Mã đơn', 'Khách hàng', 'Hạn giao', 'Dự kiến', 'Đến điểm', 'Giao TC', 'Trạng thái'], os.map(o => `<tr class="click" data-act="openOrder" data-id="${esc(o.code)}"><td>${o.seq || ''}</td><td class="nn-mono">${esc(o.code)}</td><td>${esc(o.customerName)}</td><td>${dueTag(o)}</td><td>${o.eta || ''}</td><td>${fmtHM(o.tArrive)}</td><td>${fmtHM(o.tDelivered)}</td><td>${badge(OST, o.status)}</td></tr>`))}</details></div>`;
  }).join('');
  return `<div class="mt2"><div class="rw sb center mb"><h3>Các chuyến của ${esc(u?.name || did)} · ${rangeLabel()}</h3>${btn('← Tất cả tài xế', 'pickDriver', '', 'secondary', 'sm')}</div>
    <div class="filters">${fsel('Trạng thái chuyến', 'ts', [...Object.entries(TST).map(([k, v]) => [k, v[0]])], f.ts, { empty: 'Đang có (ẩn đã hủy)', cls: 'narrow', attrs: 'data-chg="f"' })}${fld('Tìm trong chuyến', 'tq', f.tq || '', { cls: 'grow', ph: 'Mã chuyến, mã đơn, khách, tỉnh…', attrs: 'data-inp="1"' })}</div>
    ${list || '<div class="card empty">Không có chuyến nào trong khoảng ngày / bộ lọc này.</div>'}</div>`;
}
const loadTxt = t => { const l = tripLoad(t), c = capOfVeh(t.vehicle); return `<span class="${capOn() && c && l > c ? 'nn-tone-danger bold' : ''}">${num(l, 1)}${c ? '/' + num(c, 0) : ''} kg</span>`; };

/* =====================================================================
   ĐƠN GIAO
   ===================================================================== */
function filteredOrders() {
  const f = STATE.f, q = vnorm(f.q || ''), df = f.df || 'date';
  return DB.orders.filter(o =>
    (f.allDates === '1' || inRange(o[df])) &&
    (!f.status || o.status === f.status) && (!f.driver || o.driverId === f.driver) && (!f.route || o.route === f.route) && (!f.prov || o.province === f.prov) &&
    (!f.late || (!isDone(o) && o.dueDate && o.dueDate < today())) &&
    (!q || vnorm([o.code, o.refNo, o.customerName, o.customerCode, o.address, o.phone, o.tripCode, o.province].join(' ')).includes(q))
  ).sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date) || a.code.localeCompare(b.code));
}
function vOrders() {
  const os = filteredOrders(), f = STATE.f, pg = pager(os.length, 'orders', 50);
  return `
  ${pageTitle(`Đơn giao (${num(os.length, 0)})`, `${can('import') ? btn(`${ico('up')} Nhập đơn từ Excel`, 'importOrders', '', 'primary') : ''}${can('order.edit') ? btn(`${ico('plus')} Tạo đơn`, 'newOrder') : ''}${btn(`${ico('down')} Xuất Excel`, 'exportOrders')}`)}
  <div class="filters">${rangeBar('Khoảng ngày')}
    ${fsel('Lọc theo ngày', 'df', [['date', 'Ngày giao'], ['dueDate', 'Hạn giao'], ['orderDate', 'Ngày tạo đơn']], f.df || 'date', { cls: 'narrow', attrs: 'data-chg="f"' })}
    ${fsel('Phạm vi', 'allDates', [['', 'Trong khoảng'], ['1', 'Tất cả ngày']], f.allDates, { cls: 'narrow', attrs: 'data-chg="f"' })}</div>
  <div class="filters">
    ${fsel('Trạng thái', 'status', Object.entries(OST).map(([k, v]) => [k, v[0]]), f.status, { empty: 'Tất cả', cls: 'narrow', attrs: 'data-chg="f"' })}
    ${fsel('Tài xế', 'driver', driverOpts(true), f.driver, { empty: 'Tất cả', cls: 'narrow', attrs: 'data-chg="f"' })}
    ${fsel('Tỉnh', 'prov', provOpts(), f.prov, { empty: 'Tất cả tỉnh', cls: 'narrow', attrs: 'data-chg="f"' })}
    ${fsel('Tuyến', 'route', routeOpts(), f.route, { empty: 'Tất cả tuyến', cls: 'narrow', attrs: 'data-chg="f"' })}
    ${fsel('Hạn giao', 'late', [['1', 'Quá hạn chưa giao']], f.late, { empty: 'Tất cả', cls: 'narrow', attrs: 'data-chg="f"' })}
    ${fld('Tìm kiếm', 'q', f.q || '', { cls: 'grow', ph: 'Mã đơn, khách, địa chỉ, SĐT…', attrs: 'data-inp="1"' })}</div>
  <p class="small muted mb">${num(os.length, 0)} đơn · ${num(os.reduce((s, o) => s + cartonsOf(o), 0), 0)} thùng · ${kgTxt(os.reduce((s, o) => s + kgOf(o), 0))}</p>
  ${tbl(['Mã đơn', 'Ngày tạo', 'Hạn giao', 'Ngày giao', 'Khách hàng', 'Tỉnh · Tuyến', ['Thùng', 'num'], ['Kg', 'num'], 'Tài xế', 'Chuyến', 'Trạng thái'], os.slice(pg.from, pg.to).map(o => `<tr class="click" data-act="openOrder" data-id="${esc(o.code)}">
    <td class="nn-mono">${esc(o.code)}</td><td>${fmtD(o.orderDate)}</td><td class="nowrap">${fmtD(o.dueDate)}<div>${dueTag(o)}</div></td><td>${fmtD(o.date)}${o.date < (o.dueDate || o.date) ? '<div class="small muted">giao sớm</div>' : ''}</td>
    <td class="wrap">${esc(o.customerName)}<div class="small muted nn-mono">${esc(o.customerCode || 'chưa có trong danh mục')}</div></td><td>${esc(o.province || '')}<div class="small muted">${esc(o.route || '')}</div></td>
    <td class="num">${num(cartonsOf(o), 0)}</td><td class="num">${num(kgOf(o), 1)}</td><td>${esc(userName(o.driverId))}</td><td class="nn-mono">${esc(o.tripCode || '—')}</td><td>${badge(OST, o.status)}</td></tr>`), { empty: 'Không có đơn nào phù hợp bộ lọc. Bấm “Nhập đơn từ Excel” để thêm đơn.' })}
  ${pg.html}`;
}
ACT.exportOrders = () => writeWorkbook([[XL.orders.sheet, toXlRows('orders', filteredOrders())]], `DonGiao_${rangeOn()[0]}_${rangeOn()[1]}.xlsx`);

/* ---------- Tạo / sửa đơn ---------- */
function orderForm(o) {
  const isNew = !o, od = o?.orderDate || today();
  o = o || { orderDate: od, dueDate: addDays(od, S().defaultSlaDays || 3), timeWindow: OFFICE, serviceMin: S().defaultServiceMin };
  const code = o.code || nextCode('DH', o.orderDate, 'orders');
  const tripsOfDay = DB.trips.filter(t => t.date === (o.date || o.dueDate) && !['huy', 'hoan_thanh'].includes(t.status) && (!o.driverId || t.driverId === o.driverId));
  const c = o.customerCode ? custOf(o.customerCode) : null;
  return `<div class="rw start" id="of">
    ${fld('Mã đơn (duy nhất)', 'code', code, { readonly: !isNew, cls: 'narrow' })}${fld('Số đơn hàng xuất', 'refNo', o.refNo || '', { cls: 'narrow' })}
    ${fld('Ngày tạo đơn', 'orderDate', o.orderDate, { type: 'date', cls: 'narrow', attrs: 'data-chg="ofOrderDate"' })}
    ${fld('Hạn giao', 'dueDate', o.dueDate, { type: 'date', cls: 'narrow', attrs: 'data-chg="ofDue"' })}
    ${fld('Ngày giao theo kế hoạch', 'date', o.date || o.dueDate, { type: 'date', cls: 'narrow', msg: 'Giao sớm hơn hạn giao nếu tiện đường' })}
    ${custPicker(o.customerCode, o.customerName)}
    ${fld('Tên khách hàng', 'customerName', o.customerName || '', { required: true })}${fld('SĐT', 'phone', o.phone || '', { type: 'tel', cls: 'narrow' })}
    ${fld('Địa chỉ giao', 'address', o.address || '', { cls: 'full', list: 'dl-addr', msg: c && (c.addresses || []).length > 1 ? `Khách có ${c.addresses.length} địa chỉ giao – bấm ô để chọn` : '' })}
    <datalist id="dl-addr">${(c?.addresses || []).map(a => `<option value="${esc(a.address)}">${esc(a.code)}</option>`).join('')}</datalist>
    ${fsel('Tỉnh', 'province', provOpts(), o.province, { empty: '—', cls: 'narrow' })}${fsel('Tuyến', 'route', routeOpts(), o.route, { empty: '—', cls: 'narrow' })}
    ${fsel('Khung giờ nhận (trong giờ hành chính)', 'timeWindow', TIME_WINDOWS.map(x => [x, x]), o.timeWindow || OFFICE, { cls: 'narrow' })}
    ${fld('Thời gian giao tại điểm', 'serviceMin', o.serviceMin ?? '', { fmt: true, unit: 'phút', cls: 'narrow' })}
    ${fld('Số thùng', 'cartons', o.cartons ?? '', { fmt: true, unit: 'thùng', cls: 'narrow' })}${fld('Khối lượng', 'weightKg', o.weightKg ?? '', { fmt: true, unit: 'kg', cls: 'narrow' })}
    <label class="check" style="flex:1 1 100%"><input type="checkbox" name="noEarly" ${o.noEarly ? 'checked' : ''}> Khách không nhận sớm – không giao trước hạn giao</label>
    ${fsel('Tài xế', 'driverId', driverOpts(), o.driverId, { empty: 'Chưa phân công', cls: 'narrow', attrs: 'data-chg="ofDriver"' })}
    <label class="nn-field narrow"><span class="nn-label">Chuyến giao</span><span class="nn-input-wrap nn-input-md"><select class="nn-select" name="tripCode" id="of-trip">${tripOptsHTML(tripsOfDay, o.tripCode)}</select></span></label>
    ${ftxt('Ghi chú', 'note', o.note || '')}
    <input type="hidden" name="lat" value="${esc(o.lat ?? '')}"><input type="hidden" name="lng" value="${esc(o.lng ?? '')}"><input type="hidden" name="geoSrc" value="${esc(o.geoSrc || '')}"><input type="hidden" name="addrCode" value="${esc(o.addrCode || '')}">
  </div>
  <div class="rw center mt"><span class="grow small muted">Mỗi đơn gắn với 1 tài xế và 1 chuyến. Chọn tài xế mà để trống chuyến thì app tự gắn vào chuyến đang mở của tài xế trong ngày giao (hoặc tạo chuyến mới).</span>
  ${btn(`${ico('save')} Lưu đơn`, 'saveOrder', isNew ? '' : o.code, 'primary', 'lg')}</div>`;
}
const tripOptsHTML = (trips, cur) => opt('', 'Tự động', cur) + trips.map(t => opt(t.code, `${t.code} · ${userName(t.driverId)} · ${TST[t.status][0]}`, cur)).join('');
ACT.newOrder = () => openModal('Tạo đơn giao', orderForm(null), true);
ACT.editOrder = id => openModal(`Sửa đơn ${esc(id)}`, orderForm(byId('orders', id)), true);
const setF = (n, v) => { const x = $('#of')?.querySelector(`[name="${n}"]`); if (x) x.value = v ?? ''; };
function recalcDue(c) {
  const f = $('#of'); if (!f || f.dataset.dueManual) return;
  const od = f.querySelector('[name=orderDate]').value || today(), sla = c?.slaDays ?? S().defaultSlaDays ?? 3;
  setF('dueDate', addDays(od, sla)); if (!f.dataset.dateManual) setF('date', addDays(od, sla));
}
ACT.pickCust = code => {
  const c = custOf(code), f = $('#of'); if (!c || !f) return;
  f.querySelector('[data-custsearch]').value = `${c.code} – ${c.name}`; $('#cp-list').hidden = true; setF('customerCode', c.code);
  setF('customerName', c.name); setF('phone', c.phone); setF('address', c.address); setF('route', c.route); setF('province', c.province);
  setF('serviceMin', c.serviceMin || S().defaultServiceMin); setF('lat', c.lat); setF('lng', c.lng); setF('geoSrc', c.geoSrc); setF('addrCode', (c.addresses || [])[0]?.code || '');
  $('#dl-addr').innerHTML = (c.addresses || []).map(a => `<option value="${esc(a.address)}">${esc(a.code)}</option>`).join('');
  recalcDue(c); toast(`Đã điền: ${c.name}${c.route ? ' · tuyến ' + c.route : ''}${c.slaDays != null ? ' · hạn mức ' + c.slaDays + ' ngày' : ''}`);
};
CHG.ofOrderDate = () => { const c = custOf($('#of [name=customerCode]').value); recalcDue(c); };
CHG.ofDue = () => { const f = $('#of'); f.dataset.dueManual = 1; if (!f.dataset.dateManual) setF('date', f.querySelector('[name=dueDate]').value); };
CHG.ofDriver = () => refreshTripSelect();
function refreshTripSelect() {
  const f = $('#of'), d = f.querySelector('[name=date]').value, dr = f.querySelector('[name=driverId]').value;
  $('#of-trip').innerHTML = tripOptsHTML(DB.trips.filter(t => t.date === d && !['huy', 'hoan_thanh'].includes(t.status) && (!dr || t.driverId === dr)), '');
}
ACT.saveOrder = id => {
  const d = formData($('#of'));
  if (!d.code || !d.orderDate || !d.customerName) return toast('Cần nhập mã đơn, ngày tạo đơn và tên khách');
  const isNew = !id;
  if (isNew && byId('orders', d.code)) return toast('Mã đơn đã tồn tại – mỗi đơn phải có mã duy nhất');
  const o = isNew ? { id: d.code, code: d.code, status: 'cho_phan_cong', createdAt: nowISO(), createdBy: ME.id, photos: [] } : byId('orders', id);
  const oldTrip = o.tripCode, oldDriver = o.driverId;
  const due = d.dueDate || addDays(d.orderDate, S().defaultSlaDays || 3);
  Object.assign(o, { refNo: d.refNo, orderDate: d.orderDate, dueDate: due, date: d.date || due, customerCode: d.customerCode, customerName: d.customerName, phone: d.phone, address: d.address, addrCode: d.addrCode,
    province: d.province, route: d.route, timeWindow: d.timeWindow, serviceMin: parseVN(d.serviceMin), cartons: parseVN(d.cartons) || 0, weightKg: parseVN(d.weightKg) || 0, noEarly: !!d.noEarly, note: d.note,
    lat: parseGeo(d.lat), lng: parseGeo(d.lng), geoSrc: d.geoSrc });
  if (o.lat == null && o.address) { const g = guessGeo(o.address, o.province); if (g) { o.lat = g.lat; o.lng = g.lng; o.geoSrc = g.src; o.province = o.province || g.province; o.district = g.district; } }
  if (d.driverId) assignOrder(o, d.driverId, d.tripCode);
  else if (oldDriver) unassignOrder(o);
  upsert('orders', o);
  if (o.tripCode) planTrip(byId('trips', o.tripCode));
  if (oldTrip && oldTrip !== o.tripCode) { const t = byId('trips', oldTrip); if (t) planTrip(t); }
  log(isNew ? 'Tạo đơn' : 'Sửa đơn', o.code, `${o.customerName}${o.driverId ? ' → ' + userName(o.driverId) : ''}`);
  toast(isNew ? `Đã tạo đơn ${o.code}` : 'Đã lưu'); closeModal(); renderView();
  if (o.tripCode) { const t = byId('trips', o.tripCode), cap = capOfVeh(t.vehicle), load = tripLoad(t); if (capOn() && cap && load > cap) toast(`Chuyến ${t.code} vượt tải ${num(load, 1)}/${num(cap, 0)} kg`, 5000); }
  else if (isNew && can('assign') && insertionOptions(o).length) ACT.openOrder(o.code);
};
function assignOrder(o, driverId, tripCode) {
  if (!tripCode && o.driverId === driverId && o.tripCode && byId('trips', o.tripCode)) return;
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
    <div class="rw sb center">${badge(OST, o.status)} ${dueTag(o)}<span class="small muted">Chuyến ${esc(o.tripCode || '—')} · Tài xế ${esc(userName(o.driverId))} · Thứ tự ${o.seq || '—'} · Dự kiến ${o.eta || '—'}</span></div>
    <div class="split mt">
      <ul class="list-mini">
        <li><span>Khách hàng</span><b>${esc(o.customerName)} ${o.customerCode ? `<span class="nn-mono">(${esc(o.customerCode)})</span>` : ''}</b></li>
        <li><span>SĐT</span><span>${o.phone ? `<a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : '—'}</span></li>
        <li><span>Địa chỉ</span><span>${esc(o.address)}</span></li>
        <li><span>Tỉnh · Tuyến</span><span>${esc(o.province || '—')} · ${esc(o.route || '—')}</span></li>
        <li><span>Ngày tạo đơn</span><b>${fmtD(o.orderDate)}</b></li>
        <li><span>Hạn giao</span><b>${fmtD(o.dueDate)}</b></li>
        <li><span>Ngày giao kế hoạch</span><span>${fmtD(o.date)}${o.date < (o.dueDate || o.date) ? ' (giao sớm)' : ''}</span></li>
        <li><span>Khung giờ nhận</span><span>${esc(o.timeWindow || OFFICE)}</span></li>
        <li><span>Số thùng · Khối lượng</span><b>${num(cartonsOf(o), 0)} thùng · ${kgTxt(kgOf(o))}</b></li>
        ${o.refNo ? `<li><span>Số đơn hàng xuất</span><span class="nn-mono">${esc(o.refNo)}</span></li>` : ''}
        ${o.receiver ? `<li><span>Người nhận</span><span>${esc(o.receiver)}</span></li>` : ''}
        ${o.failReason ? `<li><span>Lý do không giao được</span><span class="nn-tone-danger">${esc(o.failReason)}</span></li>` : ''}
        ${o.note ? `<li><span>Ghi chú</span><span>${esc(o.note)}</span></li>` : ''}
        ${o.adminConfirmBy ? `<li><span>Người xác nhận cuối</span><b>${esc(userName(o.adminConfirmBy))}</b></li>` : ''}
      </ul>
      <div><b>Mốc thời gian check-in</b><ul class="list-mini">${tl}</ul></div>
    </div>
    ${o.status === 'cho_phan_cong' && can('assign') ? mergeOptionsHTML(o) : ''}
    <div class="mt"><b>Ảnh xác nhận (${(o.photos || []).length})</b>${thumbs(o) || '<div class="small muted">Chưa có ảnh</div>'}</div>
    <div class="rw center mt">
      ${can('photo') ? btn(`${ico('photos', 16)} Thêm ảnh`, 'addPhoto', o.code) : ''}
      ${editable ? btn('Sửa đơn', 'editOrder', o.code) : ''}
      ${isAdmin() && ['giao_thanh_cong', 'giao_that_bai'].includes(o.status) && !o.adminConfirmAt ? btn('Duyệt', 'reviewOne', o.code, 'primary') : ''}
      ${isAdmin() && ['cho_phan_cong', 'da_phan_cong'].includes(o.status) ? btn('Xóa đơn', 'delOrder', o.code, 'danger') : ''}
    </div>
    ${logs.length ? `<details class="mt"><summary class="small">Nhật ký thao tác của đơn (${logs.length})</summary><ul class="list-mini">${logs.map(l => `<li><span>${esc(l.userName)} · ${esc(l.action)} <span class="muted">${esc(l.detail)}</span></span><span class="small muted">${fmtDT(l.t)}</span></li>`).join('')}</ul></details>` : ''}
  `, true);
};
ACT.delOrder = id => {
  const o = byId('orders', id); if (!o || !confirm(`Xóa đơn ${id}?`)) return;
  const t = o.tripCode && byId('trips', o.tripCode); removeRec('orders', id); if (t) planTrip(t);
  log('Xóa đơn', id, o.customerName); closeModal(); renderView();
};

/* ---------- Nhập đơn từ file mẫu Excel ---------- */
const TPL_HEAD = ['MÃ HÀNG', 'MÔ TẢ', 'TÊN KHÁCH HÀNG', 'SỐ ĐƠN HÀNG XUẤT', 'TÊN TÀI XẾ', 'MÃ ĐƠN HÀNG XUẤT', 'NGÀY XUẤT HÀNG THỰC TẾ', 'NGÀY ĐẶT HÀNG', 'SỐ LƯỢNG THÙNG', 'KG'];
const TPL_OPT = ['MÃ KH', 'ĐỊA CHỈ GIAO HÀNG', 'HẠN GIAO', 'KHUNG GIỜ', 'KHÔNG GIAO SỚM', 'GHI CHÚ'];
ACT.importOrders = () => {
  STATE.imp = null;
  openModal('Nhập đơn giao từ Excel', `
    ${alertBox('info', 'Dùng đúng file mẫu đơn giao', 'Mỗi dòng là 1 mặt hàng; các dòng cùng <b>MÃ ĐƠN HÀNG XUẤT</b> được gộp thành 1 đơn (cộng số thùng và kg). Khách hàng được khớp theo tên với danh mục; hạn giao = ngày đặt hàng + hạn mức giao của khách.')}
    <div class="rw center mt"><label class="nn-btn nn-btn-primary nn-btn-lg">${ico('up')} Chọn file Excel (.xlsx)<input type="file" accept=".xlsx,.xls,.csv" hidden data-chg="orderFile"></label>${btn(`${ico('down')} Tải file mẫu`, 'orderTemplate', '', 'secondary', 'lg')}</div>
    <p class="small muted mt">Cột bắt buộc: <b>TÊN KHÁCH HÀNG</b>, <b>MÃ ĐƠN HÀNG XUẤT</b>, <b>NGÀY ĐẶT HÀNG</b>, <b>SỐ LƯỢNG THÙNG</b>, <b>KG</b>. Cột tùy chọn: ${TPL_OPT.join(', ')}.</p>
    <div id="imp-box" class="mt"></div>`, true);
};
ACT.orderTemplate = () => {
  const d = s => { const [a, b, c] = s.split('/'); return new Date(`${c}-${b}-${a}T12:00:00`); };
  const rows = [['10020002', 'NutriNest 42g - Lốc 6', 'ECOM BC', 17692, '', 2600012062, '', d('11/11/2026'), 1, 8],
    ['10020009', 'Gold 190g - Hộp quà 3 hũ', 'ECOM BC', 17692, '', 2600012062, '', d('11/11/2026'), 2, 24],
    ['10020015', 'Green Bird 72g - Hũ đơn', 'LONG CHÂU HỒ CHÍ MINH', 89871, '', 2600011889, '', d('05/11/2026'), 10, 126.945],
    ['10020016', 'Green Bird 72g - Lốc 4', 'LONG CHÂU HỒ CHÍ MINH', 89871, '', 2600011889, '', d('05/11/2026'), 27, 346.8]]
    .map(r => Object.fromEntries([...TPL_HEAD.map((h, i) => [h, r[i]]), ...TPL_OPT.map(h => [h, ''])]));
  if (!needXLSX()) return;
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(rows, { header: [...TPL_HEAD, ...TPL_OPT], dateNF: 'dd/mm/yyyy' });
  ws['!cols'] = [...TPL_HEAD, ...TPL_OPT].map(h => ({ wch: Math.max(12, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, 'DON_HANG');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { COT: 'TÊN KHÁCH HÀNG', Y_NGHIA: 'Tên khách (khớp với danh mục, không cần đúng 100%); hoặc nhập MÃ KH để khớp chính xác' },
    { COT: 'MÃ ĐƠN HÀNG XUẤT', Y_NGHIA: 'Mã đơn duy nhất; các dòng cùng mã gộp thành 1 đơn' }, { COT: 'SỐ ĐƠN HÀNG XUẤT', Y_NGHIA: 'Số chứng từ xuất hàng (tham chiếu)' },
    { COT: 'NGÀY ĐẶT HÀNG', Y_NGHIA: 'Ngày tạo đơn, dạng dd/mm/yyyy' }, { COT: 'HẠN GIAO', Y_NGHIA: 'Tùy chọn. Bỏ trống = ngày đặt + hạn mức giao của khách (mặc định 3 ngày)' },
    { COT: 'TÊN TÀI XẾ + NGÀY XUẤT HÀNG THỰC TẾ', Y_NGHIA: 'Tùy chọn. Có cả hai và tên trùng tài xế trong app thì đơn được gán luôn vào chuyến của tài xế ngày đó' },
    { COT: 'SỐ LƯỢNG THÙNG / KG', Y_NGHIA: 'Số; dấu chấm là thập phân (126.945 = 126,945 kg)' }, { COT: 'KHUNG GIỜ', Y_NGHIA: 'Tùy chọn: ' + TIME_WINDOWS.join(' | ') },
    { COT: 'KHÔNG GIAO SỚM', Y_NGHIA: 'Nhập Có nếu khách không nhận trước hạn giao' }]), 'HUONG_DAN');
  XLSX.writeFile(wb, 'MauDonGiao.xlsx');
};
CHG.orderFile = async el => {
  const file = el.files[0]; if (!file || !needXLSX()) return; el.value = '';
  const box = $('#imp-box'); box.innerHTML = '<p class="muted">Đang đọc file…</p>';
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true }), parsed = parseOrderSheet(wb);
    if (parsed.error) return box.innerHTML = alertBox('danger', 'Không đọc được file', esc(parsed.error));
    const idx = buildCustIndex(); let matched = 0; const unmatched = new Map(), dups = { skip: 0, upd: 0 };
    parsed.orders.forEach(r => {
      const c = matchCustomer(idx, r.customerName, r.customerCode); c ? matched++ : unmatched.set(r.customerName, (unmatched.get(r.customerName) || 0) + 1);
      const ex = r.code && byId('orders', r.code); if (ex) ex.status === 'cho_phan_cong' ? dups.upd++ : dups.skip++;
    });
    STATE.imp = { parsed, idx, file: file.name };
    const ds = parsed.orders.map(r => r.orderDate).filter(Boolean).sort();
    box.innerHTML = `${alertBox('success', `Đọc được ${num(parsed.orders.length, 0)} đơn từ ${num(parsed.lines, 0)} dòng hàng`, `File “${esc(file.name)}” · sheet ${esc(parsed.sheet)} · ngày đặt ${ds.length ? fmtD(ds[0]) + ' – ' + fmtD(ds[ds.length - 1]) : '—'}`)}
      <div class="kpis">${kpi('Tổng đơn', num(parsed.orders.length, 0))}${kpi('Tổng thùng', num(parsed.orders.reduce((s, r) => s + r.cartons, 0), 0))}${kpi('Tổng khối lượng', num(parsed.orders.reduce((s, r) => s + r.kg, 0), 1), 'kg')}${kpi('Khớp danh mục', `${num(matched, 0)}/${num(parsed.orders.length, 0)}`, '', unmatched.size ? `<span>${num(unmatched.size, 0)} tên khách mới</span>` : '')}</div>
      ${dups.upd || dups.skip ? alertBox('warning', 'Có đơn trùng mã đã nhập', `${num(dups.upd, 0)} đơn chưa phân công sẽ được cập nhật; ${num(dups.skip, 0)} đơn đã phân công/đã giao sẽ được giữ nguyên (bỏ qua).`) : ''}
      ${parsed.errors.length ? alertBox('warning', `${parsed.errors.length} dòng bị bỏ qua`, esc(parsed.errors.slice(0, 5).join(' · '))) : ''}
      ${unmatched.size ? `<details class="mt"><summary class="small bold">${num(unmatched.size, 0)} tên khách chưa có trong danh mục</summary><ul class="list-mini">${[...unmatched].slice(0, 30).map(([n, k]) => `<li><span>${esc(n)}</span><span class="muted">${k} đơn</span></li>`).join('')}</ul></details>` : ''}
      <h3 class="mt2 mb">Xem trước (15 đơn đầu)</h3>
      ${tbl(['Mã đơn', 'Khách hàng', 'Ngày đặt', 'Hạn giao', ['Thùng', 'num'], ['Kg', 'num']], parsed.orders.slice(0, 15).map(r => { const b = buildOrderFromRow(r, idx).order; return `<tr><td class="nn-mono">${esc(r.code || r.refNo || '(tự sinh)')}</td><td class="wrap">${esc(r.customerName)}${b.customerCode ? `<div class="small muted">${esc(b.customerCode)} · ${esc(b.province || '')}</div>` : '<div class="small nn-tone-warning">chưa có trong danh mục</div>'}</td><td>${fmtD(b.orderDate)}</td><td>${fmtD(b.dueDate)}</td><td class="num">${num(b.cartons, 0)}</td><td class="num">${num(b.weightKg, 1)}</td></tr>`; }))}
      <div class="rw mt" id="imp-opt">
        <label class="check" style="flex:1 1 100%"><input type="checkbox" name="newCust" checked> Tạo khách hàng mới trong danh mục cho tên chưa khớp (mã KM0001…, bổ sung địa chỉ sau)</label>
        <label class="check" style="flex:1 1 100%"><input type="checkbox" name="update" checked> Cập nhật các đơn trùng mã còn “Chờ phân công”</label></div>
      <div class="mt">${btn(`Nhập ${num(parsed.orders.length, 0)} đơn giao`, 'doImport', '', 'primary', 'lg', 'style="width:100%"')}</div>`;
  } catch (e) { box.innerHTML = alertBox('danger', 'Lỗi đọc file', esc(e.message)); }
};
ACT.doImport = () => {
  const { parsed, idx, file } = STATE.imp || {}; if (!parsed) return;
  const opt = formData($('#imp-opt')); let add = 0, upd = 0, skip = 0, newC = 0, assigned = 0; const groups = new Map(), dates = [];
  const drvByName = new Map(drivers(true).map(u => [vnorm(u.name), u]));
  for (const r of parsed.orders) {
    r.code = r.code || r.refNo || nextCode('DH', r.orderDate || today(), 'orders');
    const ex = byId('orders', r.code);
    if (ex && (ex.status !== 'cho_phan_cong' || !opt.update)) { skip++; continue; }
    const { order: o, customer: c } = buildOrderFromRow(r, idx);
    let cust = c;
    if (!cust && opt.newCust) {
      const g = guessGeo(r.address || r.customerName), code = nextNewCustomerCode();
      cust = upsert('customers', { id: code, code, name: r.customerName, alias: '', channel: '', chain: '', address: r.address || '', addresses: r.address ? [{ code: r.addrCode || code + '_S01', address: r.address }] : [], route: '', area: '', region: '',
        slaDays: null, province: g?.province || '', district: g?.district || '', lat: g?.lat ?? null, lng: g?.lng ?? null, geoSrc: g?.src || '', phone: '', note: 'Tạo tự động khi nhập đơn – bổ sung địa chỉ, tuyến' });
      idx.exact.set(vnorm(r.customerName), cust); newC++;
      const keepAddr = r.address; orderFromCustomer(o, cust); if (keepAddr) o.address = keepAddr;
      o.dueDate = r.dueDate || addDays(o.orderDate, S().defaultSlaDays || 3); o.date = o.dueDate;
    }
    let rec = o;
    if (ex) { rec = Object.assign(ex, o, { status: 'cho_phan_cong', photos: ex.photos || [], createdAt: ex.createdAt, createdBy: ex.createdBy }); upd++; }
    else { rec.createdAt = nowISO(); rec.createdBy = ME.id; add++; }
    upsert('orders', rec); dates.push(rec.date);
    const dr = r.driverName && drvByName.get(vnorm(r.driverName));
    if (dr) { const day = r.shipDate || rec.date, k = `${dr.id}|${day}`; (groups.get(k) || groups.set(k, []).get(k)).push(rec); }
  }
  for (const [k, list] of groups) {
    const [did, day] = k.split('|'); const t = createTrip(day, did, byId('users', did)?.vehicle || '', S().startTime);
    list.forEach(o => { Object.assign(o, { date: day, driverId: did, tripCode: t.code, status: 'da_phan_cong', tAssigned: nowISO() }); upsert('orders', o); assigned++; });
    planTrip(t);
  }
  log('Nhập đơn từ Excel', file, `Thêm ${add}, cập nhật ${upd}, bỏ qua ${skip}, khách mới ${newC}, gán tài xế ${assigned}`);
  if (dates.length) { const s = dates.sort(); STATE.range = { preset: 'custom', from: s[0], to: s[s.length - 1] }; STATE.f = { df: 'date' }; }
  closeModal(); toast(`Đã nhập ${num(add + upd, 0)} đơn (thêm ${num(add, 0)}, cập nhật ${num(upd, 0)}, bỏ qua ${num(skip, 0)}${newC ? `, ${num(newC, 0)} khách mới` : ''})`, 6000);
  STATE.imp = null; ACT.tab('orders');
};

/* =====================================================================
   GIAO VIỆC — nhiều ngày, giao sớm, chia đều thời gian, gom cùng tuyến, tải trọng xe
   ===================================================================== */
function asgState() {
  const f = STATE.f;
  f.from = f.from || today(); f.to = f.to || addDays(f.from, 2); if (f.to < f.from) f.to = f.from; if (diffDays(f.from, f.to) > 20) f.to = addDays(f.from, 20);
  const chips = dayChips(f.from, f.to);
  if (!f.days || f._chips !== f.from + f.to) { f.days = Object.fromEntries(chips.map(d => [d, wday(d) !== 'CN'])); f._chips = f.from + f.to; }
  return { chips, days: chips.filter(d => f.days[d]) };
}
function vAssign() {
  const f = STATE.f, { chips, days } = asgState();
  const early = f.early ?? String(S().earlyDays ?? 3), last = days[days.length - 1] || f.to;
  const limit = addDays(last, Number(early));
  const all = DB.orders.filter(o => o.status === 'cho_phan_cong');
  const pool = all.filter(o => (o.dueDate || o.date) <= limit && (!f.prov || o.province === f.prov) && (!f.q || vnorm(`${o.code} ${o.customerName} ${o.province} ${o.route}`).includes(vnorm(f.q))))
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || (a.province || '').localeCompare(b.province || '', 'vi'));
  const sel = f.pick || (f.pick = {}); pool.forEach(o => { if (!(o.code in sel)) sel[o.code] = true; });
  const drs = f.drs || (f.drs = Object.fromEntries(drivers().map(u => [u.id, true])));
  const start = f.start || S().startTime, plan = STATE.plan;
  const picked = pool.filter(o => sel[o.code]);
  return `
  ${pageTitle('Giao việc & chia đều thời gian')}
  ${alertBox('info', 'Cách app chia việc', `Chọn <b>một hoặc nhiều ngày xuất phát</b>. Đơn sắp hết hạn giao được giao trước; đơn có hạn muộn hơn <b>giao sớm</b> (tối đa ${early} ngày) nếu <b>cùng tuyến / tiện đường</b>. Mỗi tài xế chạy theo cung đường tốt nhất, xe đầy (${S().useCapacity !== false ? 'theo tải trọng' : 'không xét tải'}) thì tách chuyến 2, 3…; tổng thời gian cả ngày của các tài xế gần bằng nhau.`)}
  ${all.length && DB.trips.some(t => !['hoan_thanh', 'huy'].includes(t.status)) ? mergeCard(all.filter(o => days.includes(o.date) || o.date <= (days[0] || today())).slice(0, 20)) : ''}
  <div class="card mb"><h3 class="mb">1. Chọn ngày xuất phát</h3>
    <div class="rw">${fld('Từ ngày', 'from', f.from, { type: 'date', cls: 'narrow', attrs: 'data-chg="asgDate"' })}${fld('Đến ngày', 'to', f.to, { type: 'date', cls: 'narrow', attrs: 'data-chg="asgDate"' })}
      ${fsel('Giờ xuất phát', 'start', START_TIMES.map(x => [x, x]), start, { cls: 'narrow', attrs: 'data-chg="f"' })}
      ${fsel('Cho phép giao sớm', 'early', [0, 1, 2, 3, 4, 5, 7].map(x => [String(x), x ? `Tối đa ${x} ngày trước hạn` : 'Không giao sớm']), early, { cls: 'narrow', attrs: 'data-chg="asgEarly"' })}</div>
    <div class="mt"><div class="nn-label mb">Các ngày sẽ giao (bỏ chọn ngày nghỉ)</div><div class="rw center">${chips.map(d => `<label class="check"><input type="checkbox" data-chg="dayPick" value="${d}" ${f.days[d] ? 'checked' : ''}><span class="${wday(d) === 'CN' ? 'nn-tone-danger' : ''}">${wday(d)} ${fmtD(d).slice(0, 5)}</span></label>`).join('')}</div></div>
    <label class="check mt"><input type="checkbox" data-chg="asgAny" ${f.any ? 'checked' : ''}> Giao sớm cả đơn khác tuyến (mặc định chỉ giao sớm đơn cùng tuyến / tiện đường)</label>
    <label class="check"><input type="checkbox" data-chg="asgFar" ${f.farAll ? 'checked' : ''}> Xếp cả đơn ở xa kho hơn ${num(S().maxDayKm ?? 250, 0)} km (mặc định để riêng vì không giao kịp trong ngày)</label></div>
  <div class="split">
    <div class="card"><div class="rw sb center mb"><h3>2. Đơn chờ phân công (${num(picked.length, 0)}/${num(pool.length, 0)})</h3><span>${btn('Chọn hết', 'pickAll', '1', 'secondary', 'sm')} ${btn('Bỏ hết', 'pickAll', '', 'secondary', 'sm')}</span></div>
      <div class="filters" style="margin-bottom:var(--space-2)">${fsel('Tỉnh', 'prov', provOpts(), f.prov, { empty: 'Tất cả', cls: 'narrow', attrs: 'data-chg="f"' })}${fld('Tìm', 'q', f.q || '', { cls: 'narrow', attrs: 'data-inp="1"' })}</div>
      <div style="max-height:360px;overflow:auto">${pool.length ? pool.map(o => `<label class="check"><input type="checkbox" data-chg="pick" value="${esc(o.code)}" ${sel[o.code] !== false ? 'checked' : ''}><span><b class="nn-mono">${esc(o.code)}</b> · ${esc(o.customerName)}<br><span class="small muted">${esc(o.province || '')}${o.route ? ' · ' + esc(o.route) : ''} · hạn ${fmtD(o.dueDate)} · ${num(kgOf(o), 1)} kg${o.noEarly ? ' · không giao sớm' : ''}</span> ${dueTag(o)}</span></label>`).join('') : '<div class="empty">Không có đơn chờ phân công trong khoảng này.</div>'}</div>
      <p class="small muted mt">${num(all.length - pool.length, 0)} đơn khác có hạn giao muộn hơn ${fmtD(limit)} chưa hiển thị.</p>
    </div>
    <div class="card"><h3 class="mb">3. Tài xế tham gia</h3>
      ${drivers().length ? drivers().map(u => { const cap = capOf(u.id);
        return `<label class="check"><input type="checkbox" data-chg="drv" value="${esc(u.id)}" ${drs[u.id] !== false ? 'checked' : ''}><span>${esc(u.name)} <span class="small muted">· ${esc(u.vehicle || 'chưa gán xe')}${cap ? ` (${num(cap, 0)} kg)` : ''}</span></span></label>`; }).join('') : alertBox('warning', 'Chưa có tài xế', 'Thêm nhân sự vai trò “Tài xế” trong Danh mục → Người dùng.')}
      <div class="mt">${btn('Chia đều & tối ưu tuyến', 'runBalance', '', 'primary', 'lg', `style="width:100%" ${picked.length && days.length ? '' : 'disabled'}`)}</div>
      ${days.length ? '' : '<p class="small nn-tone-danger mt">Chọn ít nhất 1 ngày giao.</p>'}
    </div>
  </div>
  ${plan ? planPreview(plan) : ''}`;
}
CHG.asgDate = el => { STATE.f[el.name] = el.value; STATE.plan = null; STATE.f.pick = null; renderView(); };
CHG.asgEarly = el => { STATE.f.early = el.value; STATE.plan = null; renderView(); };
CHG.asgAny = el => { STATE.f.any = el.checked; STATE.plan = null; };
CHG.asgFar = el => { STATE.f.farAll = el.checked; STATE.plan = null; };
CHG.dayPick = el => { STATE.f.days[el.value] = el.checked; STATE.plan = null; renderView(); };
CHG.pick = el => { STATE.f.pick[el.value] = el.checked; STATE.plan = null; };
CHG.drv = el => { STATE.f.drs[el.value] = el.checked; STATE.plan = null; };
ACT.pickAll = v => { Object.keys(STATE.f.pick).forEach(k => STATE.f.pick[k] = !!v); STATE.plan = null; renderView(); };
ACT.runBalance = () => {
  const f = STATE.f, { days } = asgState(), early = Number(f.early ?? S().earlyDays ?? 3);
  const orders = DB.orders.filter(o => o.status === 'cho_phan_cong' && f.pick[o.code]);
  const ids = drivers().filter(u => f.drs[u.id] !== false).map(u => u.id);
  if (!orders.length || !ids.length || !days.length) return toast('Chọn ít nhất 1 ngày, 1 đơn và 1 tài xế');
  toast('Đang tính phương án…', 1500);
  setTimeout(() => {
    const t0 = Date.now(), res = planDays(orders, days, ids, { earlyDays: early, earlyAny: !!f.any, maxKm: f.farAll ? 0 : (S().maxDayKm ?? 250) });
    STATE.plan = { start: f.start || S().startTime, days: res.days, leftover: res.leftover, far: res.far || [], ms: Date.now() - t0 };
    renderView(); setTimeout(() => $('#plan')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, 30);
};
function groupStart(g, date, start) {
  const prev = DB.trips.filter(t => t.driverId === g.id && t.date === date && t.status !== 'huy').map(t => toMin(t.planEnd) || 0);
  return prev.length ? hhmm(Math.max(toMin(start), Math.max(...prev) + 15)) : start;
}
// Các chuyến trong ngày của 1 tài xế: tách theo tải trọng xe, chuyến sau xuất phát khi chuyến trước về kho
function groupLegs(g, date, start) {
  const os = g.codes.map(c => byId('orders', c)).filter(Boolean), cap = capOfVeh(g.vehicle);
  let st = groupStart(g, date, start);
  return splitByCapacity(os, cap, false).map(ch => {
    const sch = scheduleSeq(optimizeRoute(ch), st), leg = { start: st, sch, load: ch.reduce((s, o) => s + kgOf(o), 0), cap, codes: ch.map(o => o.code) };
    st = sch.end; return leg;
  });
}
function planPreview(plan) {
  const groupsOpts = (cur) => plan.days.flatMap((d, di) => d.groups.map(g => [`${di}|${g.id}`, `${wday(d.date)} ${fmtD(d.date).slice(0, 5)} · ${userName(g.id)}`]));
  const dayCards = plan.days.map((day, di) => {
    const cards = day.groups.map(g => { const legs = groupLegs(g, day.date, plan.start); g._tot = g.base + legs.reduce((s, l) => s + l.sch.work, 0); return { g, legs }; });
    const act = cards.filter(c => c.g.codes.length), tots = (act.length ? act : cards).map(c => c.g._tot), spread = Math.max(...tots) - Math.min(...tots);
    const nOrders = cards.reduce((s, c) => s + c.g.codes.length, 0);
    return `<div class="mt2"><div class="rw sb center mb"><h3>${wday(day.date)} ${fmtD(day.date)} · ${num(nOrders, 0)} đơn${day.early.length ? ` · <span class="nn-tone-info">${num(day.early.length, 0)} đơn giao sớm</span>` : ''}</h3>
      ${nOrders ? statusTag(`Chênh lệch thời gian giữa tài xế: ${durTxt(spread)}`, spread <= 30 ? 'success' : 'warning') : '<span class="small muted">Không có đơn</span>'}</div>
      ${nOrders ? `<div class="split">${cards.filter(c => c.g.codes.length).map(({ g, legs }) => { const routes = [...new Set(g.codes.map(c => byId('orders', c)?.route || byId('orders', c)?.province).filter(Boolean))];
        return `<div class="card"><div class="rw sb center"><b>${esc(userName(g.id))}</b><span class="small">${fsel('', 'veh', vehicleOpts(), g.vehicle, { empty: 'Chưa gán xe', cls: 'narrow', size: 'sm', attrs: `data-chg="planVeh" data-id="${di}|${esc(g.id)}"` })}</span></div>
          <div class="small muted">${num(g.codes.length, 0)} điểm · <b>${legs.length} chuyến</b>${routes.length ? ` · ${esc(routes.slice(0, 3).join(', '))}${routes.length > 3 ? '…' : ''}` : ''} · ~${num(legs.reduce((s, l) => s + l.sch.km, 0), 1)} km · <b>làm việc ${durTxt(g._tot)}</b></div>
          ${legs.map((l, k) => `<div class="mt" style="border-top:1px dashed var(--line);padding-top:var(--space-2)"><b>Chuyến ${k + 1}</b> <span class="small">· ${l.start} → về kho ~${l.sch.end} · ${num(l.codes.length, 0)} điểm · ${num(l.load, 1)}${l.cap ? '/' + num(l.cap, 0) : ''} kg${l.cap && capOn() && l.load > l.cap ? ' ' + statusTag('vượt tải (1 đơn quá nặng)', 'danger') : ''}${l.sch.end > '17:00' ? ' ' + statusTag('về sau 17:00', 'warning') : ''}</span>
            <ol style="padding-left:20px;margin:6px 0 0">${l.sch.rows.map(r => `<li style="margin:4px 0"><b>${r.eta}</b> · ${esc(r.o.customerName)} <span class="small muted">${esc(r.o.province || '')} · ${esc(r.o.timeWindow || OFFICE)}${r.late ? ' · ' : ''}</span>${r.late ? statusTag('ngoài khung giờ', 'warning') : ''}${day.early.includes(r.o.code) ? ' ' + statusTag(`giao sớm ${diffDays(day.date, r.o.dueDate)} ngày`, 'info') : ''}
              <select class="nn-select" style="width:auto;max-width:170px;font-size:12px;border:1px solid var(--line);border-radius:var(--radius-sm);height:28px" data-chg="planMove" data-id="${esc(r.o.code)}">${opt(`${di}|${g.id}`, 'Giữ', `${di}|${g.id}`)}${groupsOpts().filter(x => x[0] !== `${di}|${g.id}`).map(x => opt(x[0], '→ ' + x[1], '')).join('')}</select></li>`).join('')}</ol></div>`).join('')}</div>`; }).join('')}</div>` : ''}</div>`;
  }).join('');
  return `<div id="plan" class="mt2"><div class="sec-title"><h2>Phương án đề xuất</h2><span class="small muted">Tính trong ${num((plan.ms || 0) / 1000, 1)} giây</span></div>
    ${plan.far && plan.far.length ? alertBox('warning', `${num(plan.far.length, 0)} đơn ở xa kho hơn ${num(S().maxDayKm ?? 250, 0)} km chưa được xếp`, `Không giao kịp trong ngày: ${esc(Object.entries(plan.far.reduce((m, c) => { const p = byId('orders', c)?.province || 'Chưa rõ tỉnh'; m[p] = (m[p] || 0) + 1; return m; }, {})).map(([p, n]) => `${p} (${n})`).join(', '))}. Các đơn này vẫn ở “Chờ phân công”; tick “Xếp cả đơn ở xa” nếu muốn xếp, hoặc xử lý bằng chuyến liên tỉnh riêng.`) : ''}
    ${plan.leftover.length ? alertBox('warning', `${num(plan.leftover.length, 0)} đơn chưa được xếp`, 'Các đơn này có hạn giao sau các ngày đã chọn (và không thuộc diện giao sớm). Chọn thêm ngày hoặc tăng “Cho phép giao sớm”.') : ''}
    ${dayCards}
    <div class="rw center mt2"><span class="grow small muted">Có thể chuyển đơn sang tài xế / ngày khác bằng ô chọn cạnh mỗi điểm, hoặc đổi xe; app tự tính lại số chuyến, tuyến và thời gian.</span>${btn('Tính lại', 'runBalance')}${btn('Xác nhận tạo chuyến & giao việc', 'commitPlan', '', 'primary', 'lg')}</div></div>`;
}
CHG.planMove = el => {
  const code = el.dataset.id, [di, gid] = el.value.split('|'), p = STATE.plan;
  p.days.forEach(d => d.groups.forEach(g => g.codes = g.codes.filter(c => c !== code)));
  const day = p.days[Number(di)]; day.groups.find(g => g.id === gid).codes.push(code);
  const o = byId('orders', code); if (o) { p.days.forEach(d => d.early = d.early.filter(c => c !== code)); if ((o.dueDate || o.date) > day.date) day.early.push(code); }
  renderView();
};
CHG.planVeh = el => { const [di, gid] = el.dataset.id.split('|'); STATE.plan.days[Number(di)].groups.find(g => g.id === gid).vehicle = el.value; renderView(); };
ACT.commitPlan = () => {
  const p = STATE.plan; let n = 0, nt = 0;
  for (const day of p.days) for (const g of day.groups) {
    for (const leg of groupLegs(g, day.date, p.start)) {
      const t = createTrip(day.date, g.id, g.vehicle, leg.start);
      leg.codes.forEach(c => { const o = byId('orders', c); Object.assign(o, { date: day.date, driverId: g.id, tripCode: t.code, status: 'da_phan_cong', tAssigned: nowISO() }); upsert('orders', o); n++; });
      planTrip(t); nt++;
      log('Phân công', t.code, `${userName(g.id)} nhận ${leg.codes.length} đơn (${num(leg.load, 1)} kg) ngày ${fmtD(day.date)}`);
    }
  }
  const ds = p.days.map(d => d.date); STATE.range = { preset: 'custom', from: ds[0], to: ds[ds.length - 1] };
  STATE.plan = null; STATE.f = {}; toast(`Đã giao ${num(n, 0)} đơn thành ${num(nt, 0)} chuyến`); ACT.tab('trips');
};
// Đơn phát sinh: gợi ý ghép vào chuyến đã lập / đang chạy tốn thêm ít thời gian nhất
const optBadges = x => `${x.sameRoute ? ' ' + statusTag('cùng tuyến', 'success') : ''}${x.moving ? ' ' + statusTag('xe đã rời kho', 'warning') : ''}${x.over ? ' ' + statusTag(`vượt tải ${num(x.load, 1)}/${num(x.cap, 0)} kg`, 'danger') : ''}`;
function mergeCard(pool) {
  const rows = pool.map(o => ({ o, best: insertionOptions(o)[0] })).filter(r => r.best).sort((a, b) => a.best.add - b.best.add).slice(0, 8);
  if (!rows.length) return '';
  return `<div class="card mb"><h3>Ghép đơn tiện đường vào chuyến đã lập (${rows.length})</h3>
    <p class="small muted" style="margin:4px 0 8px">Với mỗi đơn chờ, app tìm chuyến cùng ngày mà ghép vào tốn thêm ít thời gian nhất.</p>
    <ul class="list-mini">${rows.map(({ o, best: x }) => `<li><span><b class="nn-mono">${esc(o.code)}</b> · ${esc(o.customerName)} <span class="small muted">${esc(o.province || '')}</span><br>
      <span class="small">Tiện nhất: <b>${esc(x.t.code)}</b> · ${esc(userName(x.t.driverId))} · <b>+${x.add} phút</b> · +${num(x.km, 1)} km</span>${optBadges(x)}</span>
      <span class="nowrap">${btn('Ghép', 'mergeInto', `${o.code}|${x.t.code}`, 'primary', 'sm')} ${btn('Chọn khác', 'openOrder', o.code, 'secondary', 'sm')}</span></li>`).join('')}</ul></div>`;
}
function mergeOptionsHTML(o) {
  const opts = insertionOptions(o).slice(0, 6);
  if (!opts.length) return '';
  return `<div class="mt"><b>Gợi ý ghép tiện đường</b><div class="small muted">Thời gian tăng thêm của chuyến khi ghép đơn này vào (gồm ${svcMin(o)}′ giao tại điểm).</div>
    <ul class="list-mini">${opts.map(x => `<li><span><b class="nn-mono">${esc(x.t.code)}</b> · ${esc(userName(x.t.driverId))} · ${badge(TST, x.t.status)}<br><span class="small"><b>+${x.add} phút</b> · +${num(x.km, 1)} km · tải sau ghép ${num(x.load, 1)}${x.cap ? '/' + num(x.cap, 0) : ''} kg</span>${optBadges(x)}</span>
      ${btn('Ghép', 'mergeInto', `${o.code}|${x.t.code}`, x.over ? 'secondary' : 'primary', 'sm')}</li>`).join('')}</ul></div>`;
}
ACT.mergeInto = v => {
  const [oc, tc] = v.split('|'), o = byId('orders', oc), t = byId('trips', tc);
  if (!o || !t) return;
  const x = insertionOptions(o).find(y => y.t.code === tc);
  if (x?.over && !confirm(`Chuyến ${tc} sẽ vượt tải (${num(x.load, 1)}/${num(x.cap, 0)} kg). Vẫn ghép?`)) return;
  if (x?.moving && !confirm(`Xe chuyến ${tc} đã rời kho – hàng của đơn này phải có sẵn trên xe hoặc tài xế quay lại lấy. Vẫn ghép?`)) return;
  assignOrder(o, t.driverId, tc);
  log('Ghép đơn tiện đường', tc, `${oc} → ${userName(t.driverId)}${x ? ` · +${x.add} phút, +${x.km} km` : ''}`);
  toast(`Đã ghép ${oc} vào ${tc}${x ? ` (+${x.add} phút)` : ''}`); closeModal(); renderView();
};

/* =====================================================================
   CHUYẾN GIAO
   ===================================================================== */
function vTrips() {
  const f = STATE.f, q = vnorm(f.q || '');
  const ts = DB.trips.filter(t => inRange(t.date) && (f.showCancel === '1' || t.status !== 'huy') && (!f.driver || t.driverId === f.driver) && (!f.ts || t.status === f.ts) &&
    (!q || vnorm([t.code, userName(t.driverId), t.vehicle, ...tripOrders(t).map(o => `${o.code} ${o.customerName}`)].join(' ')).includes(q))).sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
  const pg = pager(ts.length, 'trips', 30);
  return `${pageTitle(`Chuyến giao (${num(ts.length, 0)})`, `${can('trip.edit') ? btn(`${ico('plus')} Tạo chuyến trống`, 'newTrip') : ''}${btn(`${ico('down')} Xuất Excel`, 'exportTrips')}`)}
  <div class="filters">${rangeBar('Ngày xuất phát')}</div>
  <div class="filters">${fsel('Tài xế', 'driver', driverOpts(true), f.driver, { empty: 'Tất cả tài xế', cls: 'narrow', attrs: 'data-chg="f"' })}${fsel('Trạng thái', 'ts', Object.entries(TST).map(([k, v]) => [k, v[0]]), f.ts, { empty: 'Tất cả', cls: 'narrow', attrs: 'data-chg="f"' })}
    ${fsel('Chuyến đã hủy', 'showCancel', [['1', 'Hiện cả chuyến đã hủy']], f.showCancel, { empty: 'Ẩn', cls: 'narrow', attrs: 'data-chg="f"' })}${fld('Tìm kiếm', 'q', f.q || '', { cls: 'grow', ph: 'Mã chuyến, tài xế, mã đơn, khách…', attrs: 'data-inp="1"' })}</div>
  ${ts.length ? ts.slice(pg.from, pg.to).map(t => { const os = tripOrders(t), ok = os.filter(o => OK_ST.includes(o.status)).length, fail = os.filter(o => o.status === 'giao_that_bai').length;
    return `<div class="card click" data-act="openTrip" data-id="${esc(t.code)}" style="cursor:pointer">
      <div class="rw sb center"><div><b class="nn-mono">${esc(t.code)}</b> ${badge(TST, t.status)} <span class="small muted">${wday(t.date)} ${fmtD(t.date)}</span><div class="small muted">${esc(userName(t.driverId))} · Xe ${esc(t.vehicle || '—')} · ${num(os.length, 0)} điểm · ${loadTxt(t)} · ~${num(t.planKm || 0, 1)} km · dự kiến ${t.plannedStart}→${t.planEnd || '—'} (${durTxt(t.planMin)})</div></div>
      <div class="small">Lên hàng <b>${fmtHM(t.tLoadStart)}</b> · Đi <b>${fmtHM(t.tDepart)}</b> · Về <b>${fmtHM(t.tReturn)}</b></div></div>
      <div class="bar mt"><i class="ok" style="width:${os.length ? ok / os.length * 100 : 0}%"></i><i class="bad" style="width:${os.length ? fail / os.length * 100 : 0}%"></i></div></div>`; }).join('') + pg.html
    : '<div class="card empty">Chưa có chuyến nào trong khoảng ngày này. Vào <b>Giao việc</b> để chia đơn tự động.</div>'}`;
}
ACT.exportTrips = () => {
  const ts = DB.trips.filter(t => inRange(t.date));
  writeWorkbook([[XL.trips.sheet, toXlRows('trips', ts)], [XL.orders.sheet, toXlRows('orders', ts.flatMap(tripOrders))]], `ChuyenGiao_${rangeOn()[0]}_${rangeOn()[1]}.xlsx`);
};
ACT.newTrip = () => openModal('Tạo chuyến trống', `<div class="rw" id="nt">
  ${fld('Ngày xuất phát', 'date', today(), { type: 'date', cls: 'narrow' })}${fsel('Tài xế', 'driverId', driverOpts(), '', { empty: 'Chọn', cls: 'narrow' })}
  ${fsel('Xe', 'vehicle', vehicleOpts(), '', { empty: 'Theo tài xế', cls: 'narrow' })}${fsel('Giờ xuất phát', 'plannedStart', START_TIMES.map(x => [x, x]), S().startTime, { cls: 'narrow' })}</div>
  <div class="mt">${btn('Tạo chuyến', 'saveNewTrip', '', 'primary', 'lg', 'style="width:100%"')}</div>`);
ACT.saveNewTrip = () => {
  const d = formData($('#nt')); if (!d.driverId) return toast('Chọn tài xế');
  const t = createTrip(d.date, d.driverId, d.vehicle || byId('users', d.driverId)?.vehicle || '', d.plannedStart); planTrip(t);
  closeModal(); ACT.openTrip(t.code);
};
ACT.openTrip = id => {
  const t = byId('trips', id); if (!t) return; const os = tripOrders(t), ed = can('trip.edit') && !['hoan_thanh', 'huy'].includes(t.status);
  const pool = DB.orders.filter(o => o.status === 'cho_phan_cong' && (o.dueDate || o.date) <= addDays(t.date, 7));
  const links = mapsLinks(os.filter(o => !isDone(o)).length ? os.filter(o => !isDone(o)) : os);
  const sortedPool = pool.map(o => ({ o, x: insertionOptions(o).find(y => y.t.code === t.code) })).sort((a, b) => (a.x?.add ?? 999) - (b.x?.add ?? 999)).slice(0, 80);
  openModal(`Chuyến ${esc(t.code)}`, `
    <div class="rw sb center">${badge(TST, t.status)}<span class="small muted">${wday(t.date)} ${fmtD(t.date)} · ${num(os.length, 0)} điểm · ~${num(t.planKm || 0, 1)} km · dự kiến ${t.plannedStart} → ${t.planEnd || '—'} (${durTxt(t.planMin)}) · ${loadTxt(t)}</span></div>
    <div class="rw mt" id="tf">
      ${fsel('Tài xế', 'driverId', driverOpts(true), t.driverId, { cls: 'narrow', attrs: ed ? '' : 'disabled' })}${fsel('Xe', 'vehicle', vehicleOpts(), t.vehicle, { empty: '—', cls: 'narrow', attrs: ed ? '' : 'disabled' })}
      ${fsel('Giờ xuất phát DK', 'plannedStart', START_TIMES.map(x => [x, x]), t.plannedStart, { cls: 'narrow', attrs: ed ? '' : 'disabled' })}${ed ? btn('Lưu', 'saveTrip', t.code, 'secondary') : ''}</div>
    <div class="steps mt">
      <div class="step ${t.tAccept ? 'done' : ''}">Nhận chuyến<b>${fmtT(t.tAccept)}</b></div>
      <div class="step ${t.tLoadStart ? 'done' : ''}">Bắt đầu lên hàng<b>${fmtT(t.tLoadStart)}</b>${gpsLink(t.gpsLoad)}</div>
      <div class="step ${t.tDepart ? 'done' : ''}">Bắt đầu di chuyển<b>${fmtT(t.tDepart)}</b>${gpsLink(t.gpsDepart)}</div>
      <div class="step ${t.tReturn ? 'done' : ''}">Về kho<b>${fmtT(t.tReturn)}</b>${gpsLink(t.gpsReturn)}</div>
    </div>
    ${tbl(['TT', 'Mã đơn', 'Khách hàng', 'Hạn giao', ['Kg', 'num'], 'Dự kiến', 'Đến điểm', 'Giao TC', 'Trạng thái', ed ? '' : null].filter(h => h !== null), os.map(o => `<tr><td>${o.seq || ''}</td><td><a href="#" data-act="openOrder" data-id="${esc(o.code)}" class="nn-mono">${esc(o.code)}</a></td><td class="wrap">${esc(o.customerName)}<div class="small muted">${esc(o.province || '')}</div></td><td>${dueTag(o)}</td><td class="num">${num(kgOf(o), 1)}</td><td>${o.eta || ''}</td><td>${fmtHM(o.tArrive)}</td><td>${fmtHM(o.tDelivered)}</td><td>${badge(OST, o.status)}</td>${ed ? `<td>${isDone(o) ? '' : btn('Gỡ', 'removeFromTrip', o.code, 'secondary', 'sm')}</td>` : ''}</tr>`), { empty: 'Chuyến chưa có đơn' })}
    ${ed && pool.length ? `<div class="rw mt">${fsel('Thêm đơn chờ phân công vào chuyến (tiện đường nhất ở trên)', 'addOrder', sortedPool.map(({ o, x }) => [o.code, `${x ? '+' + x.add + ' phút' : ''} · ${o.code} – ${o.customerName} · ${o.province || ''}${x?.over ? ' · VƯỢT TẢI' : ''}`]), '', { empty: 'Chọn đơn', cls: 'grow', attrs: 'id="add-o"' })}${btn(`${ico('plus', 16)} Thêm`, 'addToTrip', t.code)}</div>` : ''}
    <div class="rw center mt">
      ${can('map') ? btn(`${ico('map', 16)} Xem hành trình trên bản đồ`, 'mapTrip', t.code, 'primary') : ''}
      ${links.map((l, i) => abtn('Chỉ đường Google Maps' + (links.length > 1 ? ' – chặng ' + (i + 1) : ''), l)).join('')}
      ${ed ? btn('Tối ưu lại tuyến', 'reoptTrip', t.code) : ''}
      ${ed && t.status === 'moi' ? btn('Hủy chuyến', 'cancelTrip', t.code, 'danger') : ''}
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
ACT.reoptTrip = id => { const t = byId('trips', id); const s = planTrip(t, true); log('Tối ưu tuyến', id, `~${s.km} km · về ${s.end}`); toast(`Đã tối ưu: ~${num(s.km, 1)} km, về kho ${s.end}`); ACT.openTrip(id); };
ACT.cancelTrip = id => {
  if (!confirm('Hủy chuyến? Các đơn sẽ trở về “Chờ phân công”.')) return;
  const t = byId('trips', id); tripOrders(t).forEach(o => { Object.assign(o, { driverId: '', tripCode: '', seq: null, eta: '', status: 'cho_phan_cong' }); upsert('orders', o); });
  t.status = 'huy'; upsert('trips', t); log('Hủy chuyến', id); closeModal(); renderView();
};
