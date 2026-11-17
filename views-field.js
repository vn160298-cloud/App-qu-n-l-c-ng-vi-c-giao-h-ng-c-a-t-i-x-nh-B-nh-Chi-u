'use strict';
/* =====================================================================
   views-field.js — Việc của tôi (tài xế), Lịch, Duyệt, Ảnh giao, Đối soát, Báo cáo, Bản đồ hành trình
   ===================================================================== */

/* =====================================================================
   TÀI XẾ — VIỆC CỦA TÔI (check-in chính xác từng mốc + ghi hành trình)
   ===================================================================== */
function vMine() {
  const [ra, rb] = rangeOn();
  const ts = DB.trips.filter(t => t.driverId === ME.id && t.status !== 'huy' && (inRange(t.date) || (t.date < today() && t.status !== 'hoan_thanh' && rb >= today()))).sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
  const os = ts.flatMap(tripOrders), ok = os.filter(o => OK_ST.includes(o.status));
  const tracking = Track.watchId != null;
  return `
  ${pageTitle('Việc của tôi')}
  <div class="filters">${rangeBar('Ngày giao')}</div>
  ${Track.activeTrip() ? (tracking ? alertBox('success', 'Đang ghi hành trình', 'Vị trí của bạn được ghi lại và gửi về điều phối trong lúc chạy chuyến. Hãy giữ app mở và màn hình sáng.') : alertBox('warning', 'Chưa ghi được hành trình', 'Hãy cho phép app truy cập vị trí (GPS) để điều phối theo dõi chuyến.', btn('Bật lại', 'trackRetry', '', 'secondary', 'sm'))) : ''}
  <div class="kpis">${kpi('Điểm giao', num(os.length, 0))}${kpi('Đã giao TC', num(ok.length, 0))}${kpi('Còn lại', num(os.filter(o => !isDone(o)).length, 0))}${kpi('Khối lượng', num(os.reduce((s, o) => s + kgOf(o), 0), 1), 'kg')}</div>
  ${ts.length ? ts.map(tripCardDriver).join('') : '<div class="card empty mt">Chưa có chuyến nào được giao cho bạn trong khoảng ngày này.</div>'}`;
}
ACT.trackRetry = () => { Track.stop(); Track.ensure(); setTimeout(renderView, 600); };
function tripCardDriver(t) {
  const os = tripOrders(t), allDone = os.length && os.every(isDone);
  const links = mapsLinks(os.filter(o => !isDone(o)));
  const btnS = {
    moi: btn(`Nhận chuyến (${num(os.length, 0)} điểm)`, 'tripStep', t.code, 'primary', 'lg', 'style="width:100%"'),
    da_nhan: btn('Check-in: BẮT ĐẦU LÊN HÀNG', 'tripStep', t.code, 'primary', 'lg', 'style="width:100%"'),
    dang_len_hang: btn('Check-in: BẮT ĐẦU DI CHUYỂN', 'tripStep', t.code, 'primary', 'lg', 'style="width:100%"'),
    dang_di_chuyen: allDone ? btn('Về kho – kết thúc chuyến', 'tripStep', t.code, 'primary', 'lg', 'style="width:100%"') : '',
  }[t.status] || '';
  return `<div class="card mt">
    <div class="rw sb center"><div><b class="nn-mono">Chuyến ${esc(t.code)}</b> ${badge(TST, t.status)}<div class="small muted">${t.date !== today() ? `<b class="nn-tone-danger">${wday(t.date)} ${fmtD(t.date)}</b> · ` : ''}Xe ${esc(t.vehicle || '—')} · Xuất phát DK ${t.plannedStart} · ${num(os.length, 0)} điểm · ${loadTxt(t)} · ~${num(t.planKm || 0, 1)} km · về DK ${t.planEnd || '—'}</div></div></div>
    <div class="steps">
      <div class="step ${t.tAccept ? 'done' : ''}">Nhận chuyến<b>${fmtHM(t.tAccept)}</b></div>
      <div class="step ${t.tLoadStart ? 'done' : ''}">Lên hàng<b>${fmtHM(t.tLoadStart)}</b></div>
      <div class="step ${t.tDepart ? 'done' : ''}">Di chuyển<b>${fmtHM(t.tDepart)}</b></div>
      <div class="step ${t.tReturn ? 'done' : ''}">Về kho<b>${fmtHM(t.tReturn)}</b></div>
    </div>
    ${btnS}
    ${links.length && t.status !== 'hoan_thanh' ? `<div class="rw mt">${links.map((l, i) => abtn('Chỉ đường cả tuyến' + (links.length > 1 ? ' ' + (i + 1) : ''), l, 'secondary', 'md', 'style="flex:1"')).join('')}</div>` : ''}
    <div class="mt">${os.map(o => jobCard(o, t)).join('')}</div>
  </div>`;
}
function jobCard(o, t) {
  const moving = t.status === 'dang_di_chuyen';
  const nav = hasXY(o) && precise(o) ? `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${o.lat},${o.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.address || '')}`;
  let act = '';
  if (!isDone(o)) {
    if (!moving) act = `<div class="small muted mt">Bấm “Bắt đầu di chuyển” để check-in tại điểm.</div>`;
    else if (o.status !== 'da_den') act = `<div class="mt">${btn('Check-in: ĐÃ ĐẾN ĐIỂM GIAO', 'arrive', o.code, 'primary', 'lg', 'style="width:100%"')}</div>`;
    else act = `<div class="rw mt">${btn('Giao thành công', 'deliverOk', o.code, 'primary', 'lg', 'style="flex:1"')}${btn('Không giao được', 'deliverFail', o.code, 'danger', 'lg', 'style="flex:1"')}</div>`;
  }
  return `<div class="job ${isDone(o) ? 'is-done' : ''}">
    <div class="rw start" style="flex-wrap:nowrap"><span class="seqno">${o.seq || '•'}</span>
      <div class="grow"><h3>${esc(o.customerName)}</h3><div class="mt" style="margin-top:4px">${badge(OST, o.status)} ${dueTag(o)}</div><div class="small muted mt" style="margin-top:4px">${esc(o.code)} · ${esc(o.address || '')}</div>
      <div class="small">Khung giờ <b>${esc(o.timeWindow || OFFICE)}</b> · Dự kiến <b>${o.eta || '—'}</b> · <b>${num(cartonsOf(o), 0)}</b> thùng · <b>${kgTxt(kgOf(o))}</b></div>
      ${o.note ? `<div class="small muted">${esc(o.note)}</div>` : ''}${o.rejectNote && !isDone(o) ? `<div class="small nn-tone-danger">Admin trả lại: ${esc(o.rejectNote)}</div>` : ''}</div></div>
    <div class="steps">
      <div class="step ${t.tLoadStart ? 'done' : ''}">Lên hàng<b>${fmtHM(t.tLoadStart)}</b></div>
      <div class="step ${t.tDepart ? 'done' : ''}">Di chuyển<b>${fmtHM(t.tDepart)}</b></div>
      <div class="step ${o.tArrive ? 'done' : ''}">Đến điểm<b>${fmtHM(o.tArrive)}</b></div>
      <div class="step ${o.tDelivered ? 'done' : o.tFailed ? 'fail' : ''}">${o.status === 'giao_that_bai' ? 'Không giao được' : 'Giao TC'}<b>${fmtHM(o.tDelivered || o.tFailed)}</b></div>
    </div>
    <div class="rw center">${o.phone ? abtn('Gọi', `tel:${esc(o.phone)}`, 'secondary', 'sm') : ''}${abtn('Chỉ đường', nav, 'secondary', 'sm')}${btn(`Ảnh (${(o.photos || []).length})`, 'addPhoto', o.code, 'secondary', 'sm')}${btn('Chi tiết', 'openOrder', o.code, 'secondary', 'sm')}</div>
    ${thumbs(o)}${act}</div>`;
}
// Mốc thời gian được ghi ngay lúc bấm (giờ thiết bị), GPS bổ sung sau nếu có
ACT.tripStep = async id => {
  const t = byId('trips', id), now = nowISO(), os = tripOrders(t);
  const step = { moi: ['da_nhan', 'tAccept', null, 'Nhận chuyến'], da_nhan: ['dang_len_hang', 'tLoadStart', 'gpsLoad', 'Bắt đầu lên hàng'],
    dang_len_hang: ['dang_di_chuyen', 'tDepart', 'gpsDepart', 'Bắt đầu di chuyển'], dang_di_chuyen: ['hoan_thanh', 'tReturn', 'gpsReturn', 'Về kho'] }[t.status];
  if (!step) return;
  if (step[0] === 'hoan_thanh' && !os.every(isDone)) return toast('Còn điểm chưa xử lý');
  t.status = step[0]; t[step[1]] = now; upsert('trips', t);
  if (step[0] === 'da_nhan') os.forEach(o => { if (o.status === 'da_phan_cong') { o.status = 'da_nhan'; upsert('orders', o); } });
  if (step[0] === 'dang_di_chuyen') os.forEach(o => { if (['da_phan_cong', 'da_nhan'].includes(o.status)) { o.status = 'dang_giao'; upsert('orders', o); } });
  Track.ensure(); renderView(); toast(`${step[3]}: ${fmtT(now)}`);
  const gps = step[2] ? await getGPS() : null;
  if (gps) { t[step[2]] = gps; upsert('trips', t); Track.mark(gps); }
  log(step[3], id, `Lúc ${fmtT(now)}`, gps);
  if (step[0] === 'hoan_thanh') Track.ensure();
};
// Học tọa độ khách từ vị trí GPS tài xế check-in (chính xác hơn tọa độ ước lượng theo quận/tỉnh)
function learnGeo(o, gps) {
  if (!gps || gps.acc > 150 || !o.customerCode) return;
  const c = custOf(o.customerCode); if (!c || ['gps', 'manual'].includes(c.geoSrc)) return;
  Object.assign(c, { lat: gps.lat, lng: gps.lng, geoSrc: 'gps' }); upsert('customers', c);
  // các đơn chưa giao của khách này cũng dùng tọa độ chính xác mới
  DB.orders.filter(x => x.customerCode === c.code && !isDone(x)).forEach(x => { Object.assign(x, { lat: gps.lat, lng: gps.lng, geoSrc: 'gps' }); upsert('orders', x); });
}
ACT.arrive = async code => {
  const o = byId('orders', code), now = nowISO();
  o.status = 'da_den'; o.tArrive = now; upsert('orders', o); renderView(); toast(`Đã đến điểm: ${fmtT(now)}`);
  const gps = await getGPS(); if (gps) { o.gpsArrive = gps; upsert('orders', o); learnGeo(o, gps); Track.mark(gps); }
  log('Đến điểm giao', code, `${o.customerName} · ${fmtT(now)}`, gps);
};
ACT.deliverOk = code => {
  const o = byId('orders', code);
  openModal('Xác nhận giao thành công', `<div data-order="${esc(code)}"></div>
    <p><b>${esc(o.customerName)}</b><br><span class="small muted">${esc(o.code)} · ${esc(o.address || '')} · ${num(cartonsOf(o), 0)} thùng · ${kgTxt(kgOf(o))}</span></p>
    <div class="rw" id="dv">${fld('Người nhận hàng', 'receiver', '', { ph: 'Tên người nhận', size: 'lg', cls: 'full' })}${ftxt('Ghi chú', 'note')}</div>
    <div class="mt"><b>Ảnh xác nhận giao ${S().requirePhoto ? '<span class="nn-tone-danger">(bắt buộc)</span>' : ''}</b><div class="mt">${photoPicker()}</div></div>
    <div class="mt">${btn('Check-in: GIAO HÀNG THÀNH CÔNG', 'confirmDeliver', code, 'primary', 'lg', 'style="width:100%"')}</div>`);
};
ACT.confirmDeliver = async code => {
  const o = byId('orders', code), d = formData($('#dv')), now = nowISO();
  if (S().requirePhoto && !STATE.pending.length && !(o.photos || []).some(p => p.kind === 'Giao thành công')) return toast('Cần chụp ít nhất 1 ảnh xác nhận giao');
  if (STATE.pending.length) await savePhotos(o, STATE.pending, 'Giao thành công');
  Object.assign(o, { status: 'giao_thanh_cong', tDelivered: now, receiver: d.receiver, deliverNote: d.note });
  if (!o.tArrive) o.tArrive = now;
  upsert('orders', o); closeModal(); renderView(); toast(`Giao thành công lúc ${fmtT(now)} – chờ Admin xác nhận`);
  const gps = await getGPS(); if (gps) { o.gpsDone = gps; upsert('orders', o); learnGeo(o, gps); Track.mark(gps); }
  log('Giao thành công', code, `${o.customerName} · ${fmtT(now)}`, gps);
};
ACT.deliverFail = code => {
  const o = byId('orders', code);
  openModal('Báo không giao được', `<div data-order="${esc(code)}"></div>
    <p><b>${esc(o.customerName)}</b> <span class="small muted">${esc(o.code)}</span></p>
    <div class="rw" id="fv">${fsel('Lý do', 'reason', FAIL_REASONS.map(x => [x, x]), FAIL_REASONS[0], { cls: 'full', size: 'lg' })}${ftxt('Ghi chú', 'note')}</div>
    <div class="mt"><b>Ảnh hiện trường (nên có)</b><div class="mt">${photoPicker()}</div></div>
    <div class="mt">${btn('Xác nhận không giao được', 'confirmFail', code, 'danger', 'lg', 'style="width:100%"')}</div>`);
};
ACT.confirmFail = async code => {
  const o = byId('orders', code), d = formData($('#fv')), now = nowISO();
  if (STATE.pending.length) await savePhotos(o, STATE.pending, 'Không giao được');
  Object.assign(o, { status: 'giao_that_bai', tFailed: now, failReason: d.reason + (d.note ? ' – ' + d.note : '') });
  if (!o.tArrive) o.tArrive = now;
  upsert('orders', o); closeModal(); renderView(); toast('Đã báo không giao được');
  const gps = await getGPS(); if (gps) { o.gpsDone = gps; upsert('orders', o); Track.mark(gps); }
  log('Không giao được', code, o.failReason, gps);
};
function vHistory() {
  const os = DB.orders.filter(o => o.driverId === ME.id && inRange(o.date)).sort((a, b) => b.date.localeCompare(a.date) || (a.seq || 0) - (b.seq || 0)).slice(0, 300);
  return `${pageTitle('Lịch sử giao hàng của tôi')}<div class="filters">${rangeBar('Ngày giao')}</div>
  ${tbl(['Ngày', 'Mã đơn', 'Khách', 'Hạn giao', 'Đến điểm', 'Giao TC', 'Trạng thái'], os.map(o => `<tr class="click" data-act="openOrder" data-id="${esc(o.code)}"><td>${fmtD(o.date)}</td><td class="nn-mono">${esc(o.code)}</td><td class="wrap">${esc(o.customerName)}</td><td>${dueTag(o)}</td><td>${fmtHM(o.tArrive)}</td><td>${fmtHM(o.tDelivered)}</td><td>${badge(OST, o.status)}</td></tr>`), { empty: 'Chưa có dữ liệu trong khoảng ngày này' })}`;
}

/* =====================================================================
   LỊCH — bảng lịch theo ngày xuất phát
   ===================================================================== */
function vCal() {
  const [y, m] = STATE.calMonth.split('-').map(Number), sel = STATE.calDay || today();
  const first = new Date(y, m - 1, 1), startDow = (first.getDay() + 6) % 7;
  const mine = ME.role === 'taixe';
  const tsAll = DB.trips.filter(t => t.status !== 'huy' && (!mine || t.driverId === ME.id));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(y, m - 1, 1 - startDow + i), ds = localDate(dt), n = tsAll.filter(t => t.date === ds), no = DB.orders.filter(o => o.date === ds && (!mine || o.driverId === ME.id)).length;
    cells.push(`<div class="d ${dt.getMonth() !== m - 1 ? 'o' : ''} ${ds === sel ? 'sel' : ''} ${ds === today() ? 'today' : ''}" data-act="calDay" data-id="${ds}"><b>${dt.getDate()}</b>${n.length ? `<div class="c">${n.length} chuyến</div>` : ''}${no ? `<div class="small muted">${num(no, 0)} đơn</div>` : ''}</div>`);
  }
  const ts = tsAll.filter(t => t.date === sel).sort((a, b) => (a.plannedStart || '').localeCompare(b.plannedStart || ''));
  const H0 = 6, H1 = 20, pos = min => Math.max(0, Math.min(100, (min - H0 * 60) / ((H1 - H0) * 60) * 100));
  const rows = [...new Set(ts.map(t => t.driverId))].map(did => {
    const mts = ts.filter(t => t.driverId === did);
    return `<div class="g-row"><div class="g-name">${esc(userName(did))}</div><div class="g-track">${mts.map(t => {
      const a = toMin(t.plannedStart), b = toMin(t.planEnd) || a + 60;
      const ra = t.tLoadStart ? isoMinOfDay(t.tLoadStart) : null, rb = t.tReturn ? isoMinOfDay(t.tReturn) : (ra != null && t.date === today() ? isoMinOfDay(nowISO()) : null);
      return `<div class="g-bar plan" style="left:${pos(a)}%;width:${Math.max(1, pos(b) - pos(a))}%" title="Kế hoạch ${t.plannedStart}–${t.planEnd}">${esc(t.code)} · ${t.plannedStart}–${t.planEnd || ''}</div>${ra != null && rb != null ? `<div class="g-bar real" style="left:${pos(ra)}%;width:${Math.max(0.5, pos(rb) - pos(ra))}%" title="Thực tế"></div>` : ''}`;
    }).join('')}</div></div>`;
  }).join('');
  return `${pageTitle('Lịch giao hàng', `${btn('‹', 'calNav', '-1', 'secondary', 'sm')}<b>Tháng ${m}/${y}</b>${btn('›', 'calNav', '1', 'secondary', 'sm')}${btn('Hôm nay', 'calDay', today(), 'secondary', 'sm')}`)}
  <div class="cal">${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(x => `<div class="dh">${x}</div>`).join('')}${cells.join('')}</div>
  <div class="sec-title mt2"><h2>Bảng lịch ngày ${wday(sel)} ${fmtD(sel)}</h2><div class="rw center">${can('export') ? btn(`${ico('down')} Xuất Excel bảng lịch`, 'exportSchedule') : ''}${can('assign') ? btn('Giao việc ngày này', 'calAssign', sel, 'primary') : ''}</div></div>
  ${ts.length ? `${tbl(['Tài xế', 'Chuyến', 'Xe', ['Số điểm', 'num'], ['Kg', 'num'], 'Xuất phát DK', 'Về kho DK', ['TG làm việc DK', 'num'], ['Km DK', 'num'], 'Lên hàng', 'Di chuyển', 'Về kho', 'Trạng thái'], ts.map(t => `<tr class="${can('trip.edit') ? 'click' : ''}" ${can('trip.edit') ? `data-act="openTrip" data-id="${esc(t.code)}"` : ''}><td>${esc(userName(t.driverId))}</td><td class="nn-mono">${esc(t.code)}</td><td>${esc(t.vehicle || '')}</td><td class="num">${num(tripOrders(t).length, 0)}</td><td class="num">${num(tripLoad(t), 1)}</td><td>${t.plannedStart}</td><td>${t.planEnd || ''}</td><td class="num">${durTxt(t.planMin)}</td><td class="num">${num(t.planKm || 0, 1)}</td><td>${fmtHM(t.tLoadStart)}</td><td>${fmtHM(t.tDepart)}</td><td>${fmtHM(t.tReturn)}</td><td>${badge(TST, t.status)}</td></tr>`))}
  <div class="nn-table-wrap mt"><div class="gantt"><div class="g-hours"><div></div><div>${Array.from({ length: 14 }, (_, i) => `<div>${H0 + i}h</div>`).join('')}</div></div>${rows}</div></div>
  <p class="small muted">Thanh xám: kế hoạch · thanh xanh: thực tế (từ lúc bắt đầu lên hàng đến lúc về kho).</p>` : '<div class="card empty">Chưa có chuyến nào trong ngày này.</div>'}`;
}
ACT.calNav = dir => { const [y, m] = STATE.calMonth.split('-').map(Number); STATE.calMonth = localDate(new Date(y, m - 1 + Number(dir), 1)).slice(0, 7); renderView(); };
ACT.calDay = ds => { STATE.calDay = ds; STATE.calMonth = ds.slice(0, 7); renderView(); };
ACT.calAssign = ds => { STATE.f = { from: ds, to: ds }; ACT.tab('assign'); STATE.f = { from: ds, to: addDays(ds, 1) }; renderView(); };
ACT.exportSchedule = () => {
  const sel = STATE.calDay || today(), ts = DB.trips.filter(t => t.date === sel && t.status !== 'huy');
  const rows = ts.flatMap(t => tripOrders(t).map(o => ({ NGAY_XUAT_PHAT: t.date, MA_TAI_XE: t.driverId, TAI_XE: userName(t.driverId), MA_CHUYEN: t.code, BIEN_SO_XE: t.vehicle, GIO_XUAT_PHAT_DK: t.plannedStart,
    THU_TU: o.seq, MA_DON: o.code, MA_KH: o.customerCode, TEN_KH: o.customerName, DIA_CHI: o.address, TINH: o.province, HAN_GIAO: o.dueDate, KHUNG_GIO: o.timeWindow, GIO_DU_KIEN: o.eta, SO_THUNG: o.cartons, KG: o.weightKg, TRANG_THAI: OST[o.status][0] })));
  writeWorkbook([['BANG_LICH', rows], [XL.trips.sheet, toXlRows('trips', ts)]], `BangLich_${sel}.xlsx`);
};

/* =====================================================================
   DUYỆT — Admin là người xác nhận cuối cùng
   ===================================================================== */
const awaiting = () => DB.orders.filter(o => o.status === 'giao_thanh_cong' || (o.status === 'giao_that_bai' && !o.adminConfirmAt));
function vReview() {
  const f = STATE.f, list = awaiting().filter(o => f.scope !== 'range' || inRange(o.date)).sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
  const ad = admins(), pg = pager(list.length, 'review', 40);
  return `${pageTitle(`Duyệt kết quả giao (${num(list.length, 0)})`)}
  ${alertBox('info', 'Người xác nhận cuối cùng là Admin', `App gợi ý người duyệt: <b>${esc(ad[0]?.name || 'Admin')}</b>. ${isAdmin() ? '' : 'Bạn chỉ xem được, không duyệt được.'}`)}
  <div class="filters">${fsel('Phạm vi', 'scope', [['range', 'Chỉ khoảng ngày đã chọn']], f.scope, { empty: 'Tất cả các ngày', cls: 'narrow', attrs: 'data-chg="f"' })}${f.scope === 'range' ? rangeBar() : ''}
    ${isAdmin() ? fsel('Người xác nhận cuối (gợi ý Admin)', 'approver', ad.map(u => [u.id, u.name]), ME.id, { cls: 'narrow', attrs: 'id="approver"' }) : ''}</div>
  ${list.length ? list.slice(pg.from, pg.to).map(o => `<div class="job"><div class="rw sb center">
      <label class="check" style="padding:0">${isAdmin() ? `<input type="checkbox" class="rv" value="${esc(o.code)}" ${o.status === 'giao_thanh_cong' ? 'checked' : ''}>` : ''}<span><b class="nn-mono">${esc(o.code)}</b> · ${esc(o.customerName)} <span class="small muted">· ${fmtD(o.date)} · ${esc(userName(o.driverId))}</span></span></label>${badge(OST, o.status)}</div>
    <div class="small mt">${o.status === 'giao_thanh_cong' ? `Giao lúc <b>${fmtT(o.tDelivered)}</b> · ${dueTag(o)} · ${num(cartonsOf(o), 0)} thùng · ${kgTxt(kgOf(o))}${o.receiver ? ' · Người nhận: ' + esc(o.receiver) : ''}${o.deliverNote ? ' · ' + esc(o.deliverNote) : ''}` : `Báo lúc <b>${fmtT(o.tFailed)}</b> · Lý do: <b>${esc(o.failReason)}</b>`}
      ${(o.photos || []).length ? '' : ' ' + statusTag('Chưa có ảnh', 'danger')}</div>
    ${thumbs(o)}
    ${isAdmin() ? `<div class="rw center mt">${o.status === 'giao_thanh_cong' ? `${btn('Duyệt hoàn tất', 'approve', o.code, 'primary', 'sm')}${btn('Trả lại tài xế', 'reject', o.code, 'secondary', 'sm')}`
      : `${btn('Giao lại (về chờ phân công)', 'redeliver', o.code, 'secondary', 'sm')}${btn('Chốt không giao', 'closeFail', o.code, 'danger', 'sm')}`}${btn('Chi tiết', 'openOrder', o.code, 'secondary', 'sm')}</div>` : ''}
  </div>`).join('') + pg.html + (isAdmin() ? `<div class="mt">${btn('Duyệt hoàn tất các đơn đã chọn', 'approveSelected', '', 'primary', 'lg', 'style="width:100%"')}</div>` : '') : '<div class="card empty">Không có đơn nào chờ duyệt.</div>'}`;
}
const approverId = () => $('#approver')?.value || ME.id;
function doApprove(o) { Object.assign(o, { status: 'hoan_tat', adminConfirmBy: approverId(), adminConfirmAt: nowISO() }); upsert('orders', o); log('Admin duyệt hoàn tất', o.code, `Người xác nhận: ${userName(o.adminConfirmBy)}`); }
ACT.approve = code => { if (!isAdmin()) return; doApprove(byId('orders', code)); renderView(); };
ACT.reviewOne = code => { closeModal(); STATE.tab = 'review'; STATE.f = {}; renderNav(); renderView(); };
ACT.approveSelected = () => {
  if (!isAdmin()) return; const codes = [...document.querySelectorAll('.rv:checked')].map(x => x.value).filter(c => byId('orders', c)?.status === 'giao_thanh_cong');
  if (!codes.length) return toast('Chọn đơn giao thành công để duyệt'); codes.forEach(c => doApprove(byId('orders', c))); toast(`Đã duyệt ${codes.length} đơn`); renderView();
};
ACT.reject = code => {
  const why = prompt('Lý do trả lại cho tài xế (VD: ảnh mờ, thiếu chữ ký):'); if (why == null) return;
  const o = byId('orders', code); Object.assign(o, { status: 'da_den', tDelivered: null, rejectNote: why }); upsert('orders', o); log('Admin trả lại', code, why); renderView();
};
ACT.redeliver = code => {
  const d = prompt('Ngày giao lại (yyyy-mm-dd):', addDays(today(), 1)); if (!d) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return toast('Ngày không hợp lệ');
  const o = byId('orders', code), oldTrip = o.tripCode;
  Object.assign(o, { adminConfirmBy: approverId(), adminConfirmAt: nowISO() }); upsert('orders', o);
  const nc = nextCode('DH', d, 'orders');   // đơn mới giữ lịch sử đơn cũ
  const n = { ...o, id: nc, code: nc, date: d, dueDate: d, status: 'cho_phan_cong', driverId: '', tripCode: '', seq: null, eta: '', tArrive: null, tDelivered: null, tFailed: null, failReason: '', photos: [], adminConfirmAt: null, adminConfirmBy: '', gpsArrive: null, gpsDone: null, note: `Giao lại từ ${code}. ${o.note || ''}`.trim(), createdAt: nowISO(), createdBy: ME.id, tAssigned: null, receiver: '', deliverNote: '', orderDate: today() };
  upsert('orders', n); log('Lên lịch giao lại', code, `Đơn mới ${nc} ngày ${fmtD(d)} (chuyến cũ ${oldTrip})`); toast(`Đã tạo đơn giao lại ${nc}`); renderView();
};
ACT.closeFail = code => { const o = byId('orders', code); Object.assign(o, { adminConfirmBy: approverId(), adminConfirmAt: nowISO() }); upsert('orders', o); log('Admin chốt không giao', code, o.failReason); renderView(); };

/* =====================================================================
   ẢNH GIAO — check-in file hình cho đơn đã giao / chưa giao
   ===================================================================== */
function vPhotos() {
  const f = STATE.f, g = f.pg || 'all', pc = vnorm(f.pc || ''), pk = vnorm(f.pk || '');
  const os = DB.orders.filter(o => inRange(o.date)).filter(o => ({ all: true, done: OK_ST.includes(o.status), notdone: !isDone(o), fail: o.status === 'giao_that_bai', missing: isDone(o) && !(o.photos || []).length })[g])
    .filter(o => (!pc || vnorm(`${o.code} ${o.refNo || ''}`).includes(pc)) && (!pk || vnorm(`${o.customerName} ${o.customerCode || ''}`).includes(pk))).sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
  const opts = [['all', 'Tất cả'], ['done', 'Đã giao'], ['notdone', 'Chưa giao'], ['fail', 'Không giao được'], ['missing', 'Đã xử lý nhưng thiếu ảnh']];
  const pg = pager(os.length, 'photos', 30);
  return `${pageTitle(`Ảnh check-in giao hàng (${num(os.length, 0)})`)}
  <div class="filters">${rangeBar('Ngày giao')}</div>
  <div class="filters">${fsel('Nhóm đơn', 'pg', opts, g, { cls: 'narrow', attrs: 'data-chg="f"' })}${fld('Mã đơn', 'pc', f.pc || '', { cls: 'narrow', ph: 'Lọc theo mã đơn', attrs: 'data-inp="1"' })}${fld('Khách hàng', 'pk', f.pk || '', { cls: 'grow', ph: 'Lọc theo tên / mã khách', attrs: 'data-inp="1"' })}</div>
  ${os.length ? os.slice(pg.from, pg.to).map(o => `<div class="job"><div class="rw sb center"><span><b class="nn-mono">${esc(o.code)}</b> · ${esc(o.customerName)} <span class="small muted">· ${fmtD(o.date)} · ${esc(userName(o.driverId))}</span></span>${badge(OST, o.status)}</div>
    ${thumbs(o) || '<div class="small muted mt">Chưa có ảnh</div>'}
    <div class="rw center mt">${btn(`${ico('photos', 16)} Tải ảnh lên`, 'addPhoto', o.code, 'secondary', 'sm')}${btn('Chi tiết', 'openOrder', o.code, 'secondary', 'sm')}</div></div>`).join('') + pg.html : '<div class="card empty">Không có đơn phù hợp.</div>'}`;
}

/* =====================================================================
   ĐỐI SOÁT GIAO HÀNG — chốt kết quả giao theo tài xế / ngày
   ===================================================================== */
function settleRows() {
  const map = new Map();
  DB.orders.filter(o => inRange(o.date) && o.driverId).forEach(o => { const k = `${o.date}_${o.driverId}`; (map.get(k) || map.set(k, []).get(k)).push(o); });
  return [...map].map(([k, os]) => {
    const ok = os.filter(o => OK_ST.includes(o.status)), fail = os.filter(o => o.status === 'giao_that_bai'), pending = os.filter(o => !isDone(o));
    return { k, date: os[0].date, driverId: os[0].driverId, os, ok, fail, pending, cartons: ok.reduce((s, o) => s + cartonsOf(o), 0), kg: ok.reduce((s, o) => s + kgOf(o), 0),
      onTime: ok.length ? ok.filter(o => !dueInfo(o).late).length / ok.length * 100 : 0, st: byId('settlements', k) };
  }).sort((a, b) => b.date.localeCompare(a.date) || userName(a.driverId).localeCompare(userName(b.driverId), 'vi'));
}
function vSettle() {
  const rows = settleRows(), T = k => rows.reduce((s, r) => s + (typeof k === 'function' ? k(r) : r[k]), 0), pg = pager(rows.length, 'settle', 40);
  return `${pageTitle('Đối soát giao hàng', btn(`${ico('down')} Xuất Excel đối soát`, 'exportSettle'))}
  <div class="filters">${rangeBar('Ngày giao')}</div>
  <div class="kpis">${kpi('Đơn đã phân công', num(T(r => r.os.length), 0))}${kpi('Giao thành công', num(T(r => r.ok.length), 0))}${kpi('Thùng đã giao', num(T('cartons'), 0))}${kpi('Khối lượng đã giao', num(T('kg'), 1), 'kg')}${kpi('Chưa chốt', num(rows.filter(r => !r.st).length, 0), '', '<span>tài xế · ngày</span>')}</div>
  <div class="mt">${tbl(['Ngày', 'Tài xế', ['Đơn', 'num'], ['Giao TC', 'num'], ['Không giao', 'num'], ['Chưa xong', 'num'], ['Thùng', 'num'], ['Kg', 'num'], ['Đúng hạn', 'num'], 'Trạng thái', ''],
    rows.slice(pg.from, pg.to).map(r => `<tr><td>${wday(r.date)} ${fmtD(r.date)}</td><td><b>${esc(userName(r.driverId))}</b></td><td class="num">${num(r.os.length, 0)}</td><td class="num">${num(r.ok.length, 0)}</td><td class="num">${num(r.fail.length, 0)}</td><td class="num">${num(r.pending.length, 0)}</td><td class="num">${num(r.cartons, 0)}</td><td class="num">${num(r.kg, 1)}</td><td class="num">${r.ok.length ? num(r.onTime, 1) + '%' : '—'}</td>
      <td>${r.st ? statusTag(`Đã chốt · ${userName(r.st.by)}`, 'success') : statusTag('Chưa chốt', 'warning')}</td><td>${btn(r.st ? 'Xem / sửa' : 'Chốt kết quả', 'settleOne', r.k, r.st ? 'secondary' : 'primary', 'sm')}</td></tr>`), { empty: 'Không có đơn nào đã phân công trong khoảng ngày này.' })}${pg.html}</div>`;
}
ACT.settleOne = k => {
  const r = settleRows().find(x => x.k === k); if (!r) return;
  openModal(`Đối soát – ${esc(userName(r.driverId))} – ${fmtD(r.date)}`, `
    ${tbl(['Mã đơn', 'Khách', 'Hạn giao', ['Thùng', 'num'], ['Kg', 'num'], 'Trạng thái'], r.os.map(o => `<tr><td class="nn-mono">${esc(o.code)}</td><td class="wrap">${esc(o.customerName)}</td><td>${dueTag(o)}</td><td class="num">${num(cartonsOf(o), 0)}</td><td class="num">${num(kgOf(o), 1)}</td><td>${badge(OST, o.status)}</td></tr>`))}
    ${r.pending.length ? `<div class="mt">${alertBox('warning', '', `Còn ${r.pending.length} đơn chưa xử lý xong – nên chốt sau khi tài xế về kho.`)}</div>` : ''}
    <div class="rw mt" id="sf">${fld('Ghi chú đối soát', 'note', r.st?.note || '', { cls: 'full' })}</div>
    <div class="rw center mt"><span class="grow small muted">Giao TC ${num(r.ok.length, 0)}/${num(r.os.length, 0)} đơn · ${num(r.cartons, 0)} thùng · ${kgTxt(r.kg)}</span>${can('settle') ? btn('Xác nhận đã đối soát', 'saveSettle', k, 'primary') : ''}</div>`, true);
};
ACT.saveSettle = k => {
  const r = settleRows().find(x => x.k === k), f = formData($('#sf'));
  upsert('settlements', { id: k, date: r.date, driverId: r.driverId, orders: r.os.length, ok: r.ok.length, fail: r.fail.length, cartons: r.cartons, kg: Math.round(r.kg * 10) / 10, onTimePct: Math.round(r.onTime * 10) / 10, by: ME.id, at: nowISO(), note: f.note });
  log('Chốt đối soát', k, `${userName(r.driverId)}: ${r.ok.length}/${r.os.length} đơn, ${r.cartons} thùng, ${Math.round(r.kg)} kg`); closeModal(); renderView();
};
ACT.exportSettle = () => writeWorkbook([[XL.settlements.sheet, settleRows().map(r => ({ NGAY: r.date, MA_TAI_XE: r.driverId, TAI_XE: userName(r.driverId), SO_DON: r.os.length, GIAO_TC: r.ok.length, KHONG_GIAO: r.fail.length, CHUA_XONG: r.pending.length, SO_THUNG_GIAO: r.cartons, KG_GIAO: Math.round(r.kg * 10) / 10, DUNG_HAN_PCT: Math.round(r.onTime * 10) / 10, NGUOI_XAC_NHAN: r.st ? userName(r.st.by) : '', GIO_XAC_NHAN: r.st ? fmtDT(r.st.at) : '', GHI_CHU: r.st?.note || '' }))],
  ['CHI_TIET', toXlRows('orders', settleRows().flatMap(r => r.os))]], `DoiSoat_${rangeOn()[0]}_${rangeOn()[1]}.xlsx`);

/* =====================================================================
   BÁO CÁO
   ===================================================================== */
function reportData() {
  const [from, to] = rangeOn(), os = DB.orders.filter(o => inRange(o.date)), ts = DB.trips.filter(t => inRange(t.date) && t.status !== 'huy');
  const agg = list => {
    const ok = list.filter(o => OK_ST.includes(o.status)), fail = list.filter(o => o.status === 'giao_that_bai');
    const dwell = ok.map(o => minsBetween(o.tArrive, o.tDelivered)).filter(x => x != null && x >= 0);
    return { n: list.length, ok: ok.length, fail: fail.length, rate: list.length ? ok.length / list.length * 100 : 0, ontime: ok.length ? ok.filter(o => !dueInfo(o).late).length / ok.length * 100 : 0,
      early: ok.filter(o => o.date < (o.dueDate || o.date)).length, dwell: dwell.length ? dwell.reduce((a, b) => a + b, 0) / dwell.length : null,
      cartons: ok.reduce((s, o) => s + cartonsOf(o), 0), kg: ok.reduce((s, o) => s + kgOf(o), 0), photo: list.filter(o => isDone(o) && !(o.photos || []).length).length };
  };
  const byDriver = drivers(true).map(u => { const l = os.filter(o => o.driverId === u.id), mt = ts.filter(t => t.driverId === u.id);
    const work = mt.map(t => minsBetween(t.tLoadStart, t.tReturn)).filter(x => x != null), load = mt.map(t => minsBetween(t.tLoadStart, t.tDepart)).filter(x => x != null);
    return { u, a: agg(l), trips: mt.length, work: work.reduce((a, b) => a + b, 0), plan: mt.reduce((s, t) => s + (t.planMin || 0), 0), load: load.length ? load.reduce((a, b) => a + b, 0) / load.length : null }; }).filter(r => r.a.n || r.trips);
  const provs = [...new Set(os.map(o => o.province || 'Chưa rõ tỉnh'))].map(p => ({ p, a: agg(os.filter(o => (o.province || 'Chưa rõ tỉnh') === p)) })).sort((a, b) => b.a.n - a.a.n);
  const reasons = {}; os.filter(o => o.status === 'giao_that_bai').forEach(o => { const k = (o.failReason || 'Khác').split(' – ')[0]; reasons[k] = (reasons[k] || 0) + 1; });
  return { from, to, all: agg(os), byDriver, provs, reasons, os };
}
function vReport() {
  const R = reportData(), pct = x => num(x, 1) + '%';
  return `${pageTitle('Báo cáo giao hàng', btn(`${ico('down')} Xuất Excel báo cáo`, 'exportReport'))}
  <div class="filters">${rangeBar('Khoảng ngày giao')}</div>
  <div class="kpis">${kpi('Tổng đơn', num(R.all.n, 0))}${kpi('Tỷ lệ giao thành công', pct(R.all.rate), '', `<span>${num(R.all.ok, 0)} đơn</span>`)}${kpi('Không giao được', num(R.all.fail, 0))}
    ${kpi('Giao đúng hạn', pct(R.all.ontime), '', `<span>Giao sớm: <b>${num(R.all.early, 0)}</b></span>`)}${kpi('Thùng đã giao', num(R.all.cartons, 0))}${kpi('Khối lượng đã giao', num(R.all.kg, 1), 'kg')}${kpi('TB thời gian tại điểm', R.all.dwell != null ? num(R.all.dwell, 0) : '—', 'phút')}</div>
  <h3 class="mt2 mb">Theo tài xế</h3>
  ${tbl(['Tài xế', ['Chuyến', 'num'], ['Đơn', 'num'], ['Giao TC', 'num'], ['Không giao', 'num'], ['Tỷ lệ TC', 'num'], ['Đúng hạn', 'num'], ['Thùng', 'num'], ['Kg', 'num'], ['TG làm việc thực tế', 'num'], ['TG kế hoạch', 'num'], ['TB lên hàng', 'num'], ['Thiếu ảnh', 'num']],
    R.byDriver.map(r => `<tr><td>${esc(r.u.name)}</td><td class="num">${num(r.trips, 0)}</td><td class="num">${num(r.a.n, 0)}</td><td class="num">${num(r.a.ok, 0)}</td><td class="num">${num(r.a.fail, 0)}</td><td class="num">${pct(r.a.rate)}</td><td class="num">${pct(r.a.ontime)}</td><td class="num">${num(r.a.cartons, 0)}</td><td class="num">${num(r.a.kg, 1)}</td><td class="num">${durTxt(r.work)}</td><td class="num">${durTxt(r.plan)}</td><td class="num">${r.load != null ? num(r.load, 0) + '′' : '—'}</td><td class="num">${r.a.photo || ''}</td></tr>`))}
  <div class="split mt2"><div><h3 class="mb">Theo tỉnh</h3>${tbl(['Tỉnh', ['Đơn', 'num'], ['Tỷ lệ TC', 'num'], ['Đúng hạn', 'num'], ['Kg', 'num']], R.provs.map(x => `<tr><td>${esc(x.p)}</td><td class="num">${num(x.a.n, 0)}</td><td class="num">${pct(x.a.rate)}</td><td class="num">${pct(x.a.ontime)}</td><td class="num">${num(x.a.kg, 1)}</td></tr>`))}</div>
    <div><h3 class="mb">Lý do không giao được</h3><div class="card"><ul class="list-mini">${Object.entries(R.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span>${esc(k)}</span><b>${num(v, 0)}</b></li>`).join('') || '<li class="muted">Không có</li>'}</ul></div></div></div>`;
}
ACT.exportReport = () => {
  const R = reportData(), r1 = x => Math.round(x * 10) / 10;
  writeWorkbook([['TONG_HOP', [{ TU_NGAY: R.from, DEN_NGAY: R.to, TONG_DON: R.all.n, GIAO_TC: R.all.ok, KHONG_GIAO: R.all.fail, TY_LE_TC: r1(R.all.rate), DUNG_HAN: r1(R.all.ontime), GIAO_SOM: R.all.early, SO_THUNG: R.all.cartons, KG: r1(R.all.kg), TB_PHUT_TAI_DIEM: R.all.dwell != null ? Math.round(R.all.dwell) : '' }]],
    ['THEO_TAI_XE', R.byDriver.map(r => ({ MA_TAI_XE: r.u.id, TAI_XE: r.u.name, SO_CHUYEN: r.trips, SO_DON: r.a.n, GIAO_TC: r.a.ok, KHONG_GIAO: r.a.fail, TY_LE_TC: r1(r.a.rate), DUNG_HAN: r1(r.a.ontime), SO_THUNG: r.a.cartons, KG: r1(r.a.kg), PHUT_LAM_VIEC_THUC_TE: Math.round(r.work), PHUT_KE_HOACH: r.plan, THIEU_ANH: r.a.photo }))],
    ['THEO_TINH', R.provs.map(x => ({ TINH: x.p, SO_DON: x.a.n, TY_LE_TC: r1(x.a.rate), DUNG_HAN: r1(x.a.ontime), KG: r1(x.a.kg) }))],
    ['LY_DO_THAT_BAI', Object.entries(R.reasons).map(([k, v]) => ({ LY_DO: k, SO_DON: v }))],
    [XL.orders.sheet, toXlRows('orders', R.os)]], `BaoCao_${R.from}_${R.to}.xlsx`);
};

/* =====================================================================
   BẢN ĐỒ — theo dõi hành trình tài xế (điều phối & quản trị)
   Đường chạy thực tế vẽ từ GPS tài xế gửi về; điểm giao vẽ theo tọa độ khách
   (tọa độ chính xác tự học từ GPS check-in, còn lại là ước lượng theo quận/tỉnh).
   ===================================================================== */
function mapTrips() {
  const s = STATE.mapSel;
  return DB.trips.filter(t => t.status !== 'huy' && inRange(t.date) && (!s.driver || t.driverId === s.driver)).sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
}
function lastFix(code) { const p = tripTrack(code); return p[p.length - 1] || null; }
const agoTxt = sec => { const m = Math.round((Date.now() / 1000 - sec) / 60); return m < 1 ? 'vừa xong' : m < 60 ? `${m} phút trước` : `${Math.floor(m / 60)} giờ ${m % 60} phút trước`; };
function vMap() {
  const s = STATE.mapSel, ts = mapTrips();
  if (s.trip && !ts.some(t => t.code === s.trip)) s.trip = '';
  const rowsT = ts.map(t => { const fx = lastFix(t.code), active = ACTIVE_TRIP.includes(t.status), stale = active && (!fx || Date.now() / 1000 - fx[0] > 600);
    return `<tr class="click ${s.trip === t.code ? 'is-selected' : ''}" data-act="mapPick" data-id="${esc(t.code)}"><td class="nn-mono">${esc(t.code)}</td><td>${esc(userName(t.driverId))}</td><td>${badge(TST, t.status)}</td><td>${fmtD(t.date)}</td><td class="num">${num(tripOrders(t).length, 0)}</td>
      <td>${fx ? `${fmtHM(new Date(fx[0] * 1000).toISOString())} <span class="small muted">(${agoTxt(fx[0])})</span>` : '<span class="muted">chưa có</span>'}${stale ? ' ' + statusTag('mất tín hiệu', 'warning') : ''}</td></tr>`; });
  return `${pageTitle('Theo dõi hành trình tài xế', `${btn(`${ico('hold', 16)} Làm mới`, 'mapRefresh', '', 'secondary')}`)}
  <div class="filters">${rangeBar('Ngày xuất phát')}${fsel('Tài xế', 'mdriver', driverOpts(true), s.driver, { empty: 'Tất cả tài xế', cls: 'narrow', attrs: 'data-chg="mapF"' })}
    ${fsel('Chuyến', 'mtrip', ts.map(t => [t.code, `${t.code} · ${userName(t.driverId)} · ${TST[t.status][0]}`]), s.trip, { empty: `Tất cả ${ts.length} chuyến`, cls: 'grow', attrs: 'data-chg="mapF"' })}</div>
  <div class="mapbox" id="map"></div>
  <div class="legend"><span><i style="background:var(--brand-yellow)"></i>Kho</span><span><i style="background:var(--dept)"></i>Điểm giao</span><span><i style="background:var(--success)"></i>Đã giao</span><span><i style="background:var(--danger)"></i>Không giao được</span><span><i style="background:var(--brand-red)"></i>Vị trí tài xế mới nhất</span><span>Đường liền: hành trình thực tế · đường đứt: tuyến kế hoạch</span></div>
  <p class="small muted" id="map-note"></p>
  <h3 class="mt2 mb">Các chuyến (${num(ts.length, 0)}) – bấm để xem trên bản đồ</h3>
  ${tbl(['Chuyến', 'Tài xế', 'Trạng thái', 'Ngày', ['Điểm', 'num'], 'Vị trí cuối từ GPS'], rowsT, { empty: 'Không có chuyến nào trong khoảng ngày / bộ lọc này.' })}
  ${alertBox('info', 'Về độ chính xác', 'Vị trí tài xế chỉ được ghi khi app trên điện thoại tài xế đang mở và cho phép GPS, và được gửi về theo chu kỳ (mặc định 3 phút). Tọa độ điểm giao ước lượng sẽ chính xác dần khi tài xế check-in “Đã đến điểm”.')}`;
}
CHG.mapF = el => { STATE.mapSel[el.name === 'mdriver' ? 'driver' : 'trip'] = el.value; if (el.name === 'mdriver') STATE.mapSel.trip = ''; STATE.mapSel.fit = true; renderView(); };
ACT.mapPick = code => { STATE.mapSel.trip = STATE.mapSel.trip === code ? '' : code; STATE.mapSel.fit = true; renderView(); window.scrollTo(0, 0); };
ACT.mapRefresh = async () => { toast('Đang cập nhật vị trí…'); if (Cloud.enabled()) await Cloud.sync(); STATE.mapSel.fit = false; refreshView(); };
ACT.mapTrip = code => {
  const t = byId('trips', code); if (!t) return; closeModal();
  STATE.range = { preset: 'custom', from: t.date, to: t.date }; STATE.mapSel = { driver: '', trip: code, fit: true };
  STATE.tab = 'map'; renderNav(); renderView(); window.scrollTo(0, 0);
};
function mapInit() {
  const el = $('#map'); if (!el) return;
  if (!window.L) { el.innerHTML = '<div class="empty">Không tải được bản đồ (cần kết nối mạng). Xem bảng vị trí bên dưới.</div>'; return; }
  if (window.__map) { window.__map.remove(); window.__map = null; }
  const d = depotPt(), map = L.map(el, { zoomControl: true }).setView([d.lat || 10.88, d.lng || 106.73], 10);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  window.__map = map; window.__mapLayer = L.layerGroup().addTo(map);
  clearInterval(window.__mapTimer);
  window.__mapTimer = setInterval(async () => { if (document.hidden || STATE.tab !== 'map') return; if (Cloud.enabled()) await Cloud.pull(); mapUpdate(); }, 20000);
  mapUpdate(true); setTimeout(() => { if (window.__map === map) map.invalidateSize(); }, 200);
}
function mapStop() { clearInterval(window.__mapTimer); if (window.__map) { window.__map.remove(); window.__map = null; } }
const mkIcon = (cls, txt, s = 28) => L.divIcon({ className: '', html: `<div class="mk ${cls}">${txt}</div>`, iconSize: [s, s], iconAnchor: [s / 2, s / 2] });
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function mapUpdate(fit) {
  const map = window.__map, layer = window.__mapLayer; if (!map || !layer) return;
  layer.clearLayers();
  const s = STATE.mapSel, ts = s.trip ? mapTrips().filter(t => t.code === s.trip) : mapTrips(), pts = [], d = depotPt();
  if (hasXY(d)) { L.marker([d.lat, d.lng], { icon: mkIcon('depot', 'K', 32) }).bindPopup(`<b>${esc(d.name || 'Kho')}</b>`).addTo(layer); pts.push([d.lat, d.lng]); }
  let approx = 0, noXY = 0;
  for (const t of ts) {
    const os = tripOrders(t), plan = [hasXY(d) ? [d.lat, d.lng] : null];
    os.forEach(o => {
      if (!hasXY(o)) { noXY++; return; }
      if (!precise(o)) approx++;
      const cls = OK_ST.includes(o.status) ? 'ok' : o.status === 'giao_that_bai' ? 'bad' : '';
      L.marker([o.lat, o.lng], { icon: mkIcon(cls, o.seq || '•'), opacity: precise(o) ? 1 : .65 })
        .bindPopup(`<b>${esc(o.customerName)}</b><br>${esc(o.code)} · ${esc(OST[o.status][0])}<br>${esc(o.address || '')}<br>Dự kiến ${o.eta || '—'} · Đến ${fmtHM(o.tArrive)} · Giao ${fmtHM(o.tDelivered)}${precise(o) ? '' : '<br><i>Vị trí ước lượng theo quận/tỉnh</i>'}`).addTo(layer);
      plan.push([o.lat, o.lng]); pts.push([o.lat, o.lng]);
      [o.gpsArrive, o.gpsDone].filter(Boolean).forEach(g => { L.circleMarker([g.lat, g.lng], { radius: 4, color: cssv('--ink'), weight: 1, fillOpacity: .8 }).bindTooltip('Check-in GPS · ' + esc(o.customerName)).addTo(layer); pts.push([g.lat, g.lng]); });
    });
    if (hasXY(d)) plan.push([d.lat, d.lng]);
    const pl = plan.filter(Boolean); if (pl.length > 1) L.polyline(pl, { color: cssv('--line-strong'), weight: 2, dashArray: '6 8', opacity: .8 }).addTo(layer);
    const tr = tripTrack(t.code);
    if (tr.length) {
      const line = tr.map(p => [p[1], p[2]]); L.polyline(line, { color: cssv('--dept'), weight: 4, opacity: .9 }).addTo(layer); pts.push(...line);
      const fx = tr[tr.length - 1]; L.marker([fx[1], fx[2]], { icon: mkIcon('live', 'XE', 34), zIndexOffset: 1000 })
        .bindPopup(`<b>${esc(userName(t.driverId))}</b> · ${esc(t.code)}<br>${esc(TST[t.status][0])}<br>Cập nhật ${fmtT(new Date(fx[0] * 1000).toISOString())} (${agoTxt(fx[0])}) · ±${fx[3]} m`).addTo(layer);
    }
  }
  const note = $('#map-note');
  if (note) note.textContent = `${num(ts.length, 0)} chuyến${approx ? ` · ${num(approx, 0)} điểm giao dùng vị trí ước lượng` : ''}${noXY ? ` · ${num(noXY, 0)} điểm chưa có tọa độ (không vẽ)` : ''}${ts.some(t => tripTrack(t.code).length) ? '' : ' · chưa có dữ liệu GPS của tài xế'}`;
  if ((fit || s.fit) && pts.length > 1) { map.fitBounds(pts, { padding: [30, 30], maxZoom: 14, animate: false }); s.fit = false; }
  else if (fit && pts.length === 1) map.setView(pts[0], 12, { animate: false });
}
