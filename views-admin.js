'use strict';
/* =====================================================================
   views-admin.js — Danh mục, Excel In/Out, Nhật ký, Quản trị (dung lượng, phiên bản, sao lưu), Cài đặt
   ===================================================================== */
function afterRender(tab) { if (tab === 'map') mapInit(); if (tab === 'admin') adminLoad(); }
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'vi'));
const dlist = (id, arr) => `<datalist id="${id}">${arr.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;

/* =====================================================================
   DANH MỤC — khách hàng, xe, người dùng (sửa tự do, lọc theo tỉnh, xuất file)
   ===================================================================== */
const CAT_TABS = [['customers', 'Khách hàng'], ['vehicles', 'Xe'], ['users', 'Người dùng']];
function vCatalog() {
  const tabs = CAT_TABS.filter(([k]) => k !== 'users' || isAdmin());
  const k = tabs.some(([x]) => x === STATE.catTab) ? STATE.catTab : 'customers';
  const body = { customers: catCustomers, vehicles: catVehicles, users: catUsers }[k]();
  return `${pageTitle('Danh mục', `${btn(`${ico('down')} Xuất danh mục (Excel)`, 'exportCatalog')}`)}
  <div class="rw center mb"><div class="seg lg">${tabs.map(([x, l]) => `<button type="button" data-act="catTab" data-id="${x}" class="${x === k ? 'on' : ''}">${l} (${num(DB[x].length, 0)})</button>`).join('')}</div></div>${body}`;
}
ACT.catTab = k => { STATE.catTab = k; STATE.f = {}; STATE.pg = {}; renderView(); };
ACT.exportCatalog = () => {
  if (!needXLSX()) return;
  const noPin = DB.users.map(u => ({ ...u }));
  writeWorkbook([[XL.customers.sheet, toXlRows('customers', DB.customers)], [XL.addresses.sheet, addressRows(DB.customers)], [XL.vehicles.sheet, toXlRows('vehicles', DB.vehicles)], [XL.users.sheet, toXlRows('users', noPin)]], `DanhMuc_${today()}.xlsx`);
  toast('Đã xuất danh mục để lưu trữ');
};
const catToolbar = (addLabel, extra = '') => `<div class="rw center mb">${can('catalog.edit') ? btn(`${ico('plus')} ${addLabel}`, 'catEdit', '', 'primary') : ''}${extra}</div>`;

// --- Khách hàng
function custList() {
  const f = STATE.f, q = vnorm(f.q || '');
  return DB.customers.filter(c => (!f.prov || c.province === f.prov) && (!f.ch || c.channel === f.ch) &&
    (!f.geo || (f.geo === 'precise' ? precise(c) : !precise(c))) && (!q || vnorm(`${c.code} ${c.name} ${c.alias || ''} ${c.address || ''} ${c.chain || ''}`).includes(q))).sort((a, b) => a.code.localeCompare(b.code));
}
function catCustomers() {
  const f = STATE.f, list = custList(), pg = pager(list.length, 'cust', 50);
  return `${catToolbar('Thêm khách hàng')}
  <div class="filters">${fsel('Tỉnh', 'prov', provOpts(), f.prov, { empty: 'Tất cả tỉnh', cls: 'narrow', attrs: 'data-chg="f"' })}
    ${fsel('Kênh', 'ch', uniq(DB.customers.map(c => c.channel)).map(x => [x, x]), f.ch, { empty: 'Tất cả kênh', cls: 'narrow', attrs: 'data-chg="f"' })}
    ${fsel('Tọa độ', 'geo', [['precise', 'Chính xác (GPS / nhập tay)'], ['approx', 'Ước lượng theo quận / tỉnh']], f.geo, { empty: 'Tất cả', cls: 'narrow', attrs: 'data-chg="f"' })}
    ${fld('Tìm kiếm', 'q', f.q || '', { cls: 'grow', ph: 'Mã, tên, địa chỉ, chuỗi…', attrs: 'data-inp="1"' })}</div>
  <p class="small muted mb">${num(list.length, 0)} khách hàng · ${num(list.filter(precise).length, 0)} có tọa độ chính xác</p>
  ${tbl(['Mã KH', 'Tên khách hàng', 'Kênh', 'Tỉnh', 'Quận/huyện', ['Hạn mức (ngày)', 'num'], 'Địa chỉ giao', 'Tọa độ'], list.slice(pg.from, pg.to).map(c => `<tr class="click" data-act="catEdit" data-id="${esc(c.id)}"><td class="nn-mono">${esc(c.code)}</td><td class="wrap">${esc(c.name)}${c.chain ? `<div class="small muted">${esc(c.chain)}</div>` : ''}</td><td>${esc(c.channel || '')}</td><td>${esc(c.province || '')}</td><td>${esc(c.district || '')}</td><td class="num">${c.slaDays ?? '<span class="muted">mặc định ' + (S().defaultSlaDays ?? 3) + '</span>'}</td><td class="wrap">${esc(c.address || '')}${(c.addresses || []).length > 1 ? `<div class="small muted">+${c.addresses.length - 1} địa chỉ khác</div>` : ''}</td><td>${precise(c) ? statusTag('Chính xác', 'success') : hasXY(c) ? statusTag('Ước lượng', 'info') : statusTag('Chưa có', 'warning')}</td></tr>`))}${pg.html}`;
}
// --- Xe
function catVehicles() {
  const q = vnorm(STATE.f.q || ''), list = DB.vehicles.filter(v => !q || vnorm(`${v.plate} ${v.type}`).includes(q)).sort((a, b) => a.plate.localeCompare(b.plate));
  return `${catToolbar('Thêm xe')}<div class="filters">${fld('Tìm kiếm', 'q', STATE.f.q || '', { cls: 'grow', ph: 'Biển số, loại xe…', attrs: 'data-inp="1"' })}</div>
  ${tbl(['Biển số', 'Loại xe', ['Tải trọng (kg)', 'num'], 'Tài xế mặc định'], list.map(v => `<tr class="click" data-act="catEdit" data-id="${esc(v.id)}"><td class="nn-mono">${esc(v.plate)}</td><td>${esc(v.type || '')}</td><td class="num">${v.capacityKg ? num(v.capacityKg, 0) : '—'}</td><td>${esc(DB.users.filter(u => u.vehicle === v.id).map(u => u.name).join(', ') || '—')}</td></tr>`), { empty: 'Chưa có xe. Bấm “Thêm xe” để khai báo biển số, loại xe và tải trọng.' })}`;
}
// --- Người dùng (giống bảng quản lý nhân sự: Mã NV, Họ tên, Vai trò, Nhà máy, Bộ phận, Tài khoản, Trạng thái)
function catUsers() {
  const f = STATE.f, q = vnorm(f.q || '');
  const list = DB.users.filter(u => (!f.role || u.role === f.role) && (!q || vnorm(`${u.id} ${u.name} ${u.plant} ${u.dept}`).includes(q))).sort((a, b) => a.id.localeCompare(b.id, 'vi', { numeric: true }));
  return `${catToolbar('Thêm nhân sự')}
  <div class="filters">${fsel('Vai trò', 'role', Object.entries(ROLES), f.role, { empty: 'Tất cả vai trò', cls: 'narrow', attrs: 'data-chg="f"' })}${fld('Tìm kiếm', 'q', f.q || '', { cls: 'grow', ph: 'Mã NV, họ tên, bộ phận…', attrs: 'data-inp="1"' })}</div>
  ${tbl(['Mã NV', 'Họ tên', 'Vai trò', 'Nhà máy', 'Bộ phận', 'Tài khoản', 'Trạng thái', ''], list.map(u => `<tr><td class="nn-mono">${esc(u.id)}</td><td><b>${esc(u.name)}</b></td><td>${esc(ROLES[u.role] || u.role)}</td><td>${esc(u.plant || '—')}</td><td>${esc(u.dept || '—')}</td>
    <td>${u.pinHash ? statusTag('Có PIN', 'success') : statusTag('Chưa cấp', 'warning')}</td><td>${u.active === false ? statusTag('Đã khóa', 'danger') : statusTag('Đang dùng', 'success')}</td>
    <td class="nowrap">${btn(`${u.pinHash ? 'Đổi PIN' : 'Cấp PIN'}`, 'pinUser', u.id, 'secondary', 'sm')} ${btn('Sửa', 'catEdit', u.id, 'ghost', 'sm')}</td></tr>`))}`;
}
ACT.pinUser = id => {
  const u = byId('users', id);
  openModal(`${u.pinHash ? 'Đổi PIN' : 'Cấp PIN'} – ${esc(u.name)} (${esc(u.id)})`, `<div class="rw" id="pf">${pinFld('PIN mới (4–8 chữ số)', 'p1')}${pinFld('Nhập lại PIN', 'p2')}</div>
    <p class="small muted mt">Nhân viên đăng nhập bằng mã <b class="nn-mono">${esc(u.id)}</b> và PIN này, nên tự đổi PIN trong menu tài khoản sau lần đăng nhập đầu.</p>
    <div class="rw center mt">${btn('Lưu PIN', 'savePin', id, 'primary', 'lg')}${u.pinHash ? btn('Gỡ PIN (khóa đăng nhập)', 'clearPin', id, 'secondary') : ''}</div>`);
};
ACT.savePin = async id => {
  const f = formData($('#pf')); if (!/^\d{4,8}$/.test(f.p1)) return toast('PIN gồm 4–8 chữ số'); if (f.p1 !== f.p2) return toast('Hai lần nhập PIN không khớp');
  const u = byId('users', id); u.pinHash = await hashPin(id, f.p1); upsert('users', u); if (ME.id === id) { ME = u; saveSession(u); STATE.defPin = false; }
  log('Cấp / đổi PIN', id, u.name); closeModal(); toast('Đã lưu PIN'); renderView();
};
ACT.clearPin = id => { if (!confirm('Gỡ PIN? Nhân viên sẽ không đăng nhập được cho tới khi được cấp PIN mới.')) return; const u = byId('users', id); u.pinHash = ''; upsert('users', u); log('Gỡ PIN', id); closeModal(); renderView(); };

// --- Biểu mẫu thêm / sửa
ACT.catEdit = id => {
  const k = STATE.catTab; if (!can('catalog.edit')) return;
  const r = id ? byId(k, id) : {}, isNew = !id;
  const forms = {
    customers: () => `<div class="rw start" id="cf">${fld('Mã khách hàng', 'code', r.code || '', { required: true, cls: 'narrow', msg: isNew ? '' : 'Đổi mã sẽ cập nhật cả các đơn của khách' })}${fld('Tên khách hàng', 'name', r.name || '', { required: true })}
      ${fld('Tên gọi khác (tên trong file đơn)', 'alias', r.alias || '', { cls: 'grow' })}${fld('Kênh bán hàng', 'channel', r.channel || '', { cls: 'narrow', list: 'dl-ch' })}${fld('Chuỗi', 'chain', r.chain || '', { cls: 'narrow' })}${fld('SĐT', 'phone', r.phone || '', { type: 'tel', cls: 'narrow' })}
      ${fld('Địa chỉ giao mặc định', 'address', r.address || '', { cls: 'full' })}
      ${ftxt('Các địa chỉ giao khác (mỗi dòng: MÃ ĐỊA CHỈ | địa chỉ)', 'addrs', (r.addresses || []).map(a => `${a.code} | ${a.address}`).join('\n'))}
      ${fsel('Tỉnh', 'province', provOpts(), r.province, { empty: '—', cls: 'narrow' })}${fld('Khu vực', 'area', r.area || '', { cls: 'narrow' })}
      ${fld('Hạn mức giao hàng', 'slaDays', r.slaDays ?? '', { fmt: true, unit: 'ngày', cls: 'narrow', msg: `Hạn giao = ngày đặt + hạn mức (trống = ${S().defaultSlaDays ?? 3} ngày)` })}${fld('Thời gian giao tại điểm', 'serviceMin', r.serviceMin ?? '', { fmt: true, unit: 'phút', cls: 'narrow' })}
      ${fld('Vĩ độ', 'lat', r.lat ?? '', { cls: 'narrow', attrs: 'inputmode="decimal"' })}${fld('Kinh độ', 'lng', r.lng ?? '', { cls: 'narrow', attrs: 'inputmode="decimal"' })}
      <div class="nn-field full"><span class="nn-field-msg">Nguồn tọa độ: <b>${{ gps: 'GPS tài xế', manual: 'nhập tay', quan: 'ước lượng theo quận/huyện', tinh: 'ước lượng theo tỉnh' }[r.geoSrc] || 'chưa có'}</b> · Khách nhận hàng trong giờ hành chính, khung giờ chọn theo từng đơn.</span>
      <span class="rw mt">${btn(`${ico('pin', 16)} Lấy GPS hiện tại`, 'gpsHere', '', 'secondary', 'sm')}${btn('Ước lượng lại từ địa chỉ', 'guessHere', '', 'secondary', 'sm')}</span></div>
      ${ftxt('Ghi chú', 'note', r.note || '')}<input type="hidden" name="geoSrc" value="${esc(r.geoSrc || '')}"></div>${dlist('dl-ch', uniq(DB.customers.map(c => c.channel)))}`,
    vehicles: () => `<div class="rw" id="cf">${fld('Biển số', 'plate', r.plate || '', { required: true, cls: 'narrow', msg: 'Có thể sửa tự do; đổi biển số sẽ cập nhật tài xế và chuyến đang dùng xe này' })}${fld('Loại xe', 'type', r.type || '', { cls: 'narrow', list: 'dl-vt', ph: 'Chọn hoặc gõ loại xe' })}${fld('Tải trọng', 'capacityKg', r.capacityKg ?? '', { fmt: true, unit: 'kg', cls: 'narrow' })}</div>${dlist('dl-vt', uniq([...VEHICLE_TYPES, ...DB.vehicles.map(v => v.type)]))}`,
    users: () => `<div class="rw" id="cf">${fld('Mã NV', 'id', r.id || '', { required: true, cls: 'narrow', msg: isNew ? 'VD: TX05, 01, KV-12' : 'Đổi mã NV sẽ phải cấp lại PIN' })}${fld('Họ tên', 'name', r.name || '', { required: true })}
      ${fsel('Vai trò', 'role', Object.entries(ROLES), r.role || 'taixe', { cls: 'narrow' })}${fld('Nhà máy', 'plant', r.plant ?? DEFAULT_PLANT, { cls: 'narrow', list: 'dl-pl' })}${fld('Bộ phận', 'dept', r.dept ?? DEFAULT_DEPT, { cls: 'narrow', list: 'dl-dp' })}
      ${fld('SĐT', 'phone', r.phone || '', { type: 'tel', cls: 'narrow' })}${fld('Xe mặc định', 'vehicle', r.vehicle || '', { cls: 'narrow', list: 'dl-vh', ph: 'Chọn hoặc gõ biển số mới', msg: 'Gõ biển số chưa có sẽ tự thêm vào danh mục xe' })}
      ${fsel('Trạng thái', 'active', [['1', 'Đang dùng'], ['0', 'Khóa tài khoản']], r.active === false ? '0' : '1', { cls: 'narrow' })}</div>
      ${dlist('dl-pl', uniq([DEFAULT_PLANT, ...DB.users.map(u => u.plant)]))}${dlist('dl-dp', uniq([DEFAULT_DEPT, 'Kỹ thuật', 'Sản xuất', 'QA', 'Thu mua', ...DB.users.map(u => u.dept)]))}${dlist('dl-vh', DB.vehicles.map(v => v.plate))}
      ${alertBox('info', '', 'Vai trò quyết định quyền: <b>Admin</b> toàn quyền · <b>Điều phối</b> tạo đơn, giao việc, theo dõi bản đồ · <b>Tài xế</b> chỉ thấy việc của mình · <b>Kế toán</b> đối soát, báo cáo.')}`,
  };
  const title = { customers: 'khách hàng', vehicles: 'xe', users: 'nhân sự' }[k];
  openModal(`${isNew ? 'Thêm' : 'Sửa'} ${title}`, `${forms[k]()}<div class="rw center mt"><span class="grow"></span>${!isNew && isAdmin() && !(k === 'users' && id === ME.id) ? btn('Xóa', 'catDel', id, 'danger') : ''}${btn(`${ico('save')} Lưu`, 'catSave', id || '', 'primary', 'lg')}</div>`, true);
};
ACT.gpsHere = async () => { toast('Đang lấy vị trí…'); const g = await getGPS(); if (!g) return toast('Không lấy được vị trí'); $('#cf [name=lat]').value = g.lat; $('#cf [name=lng]').value = g.lng; $('#cf [name=geoSrc]').value = 'manual'; toast(`Đã lấy tọa độ (±${g.acc} m)`); };
ACT.guessHere = () => { const f = formData($('#cf')), g = guessGeo(f.address, f.province); if (!g) return toast('Không nhận ra tỉnh / quận từ địa chỉ'); $('#cf [name=lat]').value = g.lat; $('#cf [name=lng]').value = g.lng; $('#cf [name=geoSrc]').value = g.src; if (!f.province) $('#cf [name=province]').value = g.province; toast(`Ước lượng theo ${g.district || g.province}`); };
ACT.catSave = async id => {
  const k = STATE.catTab, d = formData($('#cf')), isNew = !id;
  const key = { customers: d.code, vehicles: d.plate, users: d.id }[k];
  if (!key) return toast('Thiếu mã / biển số'); if (k !== 'users' || true) { if ((isNew || key !== id) && byId(k, key)) return toast('Mã này đã tồn tại'); }
  if (k === 'customers' && !d.name) return toast('Thiếu tên khách hàng'); if (k === 'users' && !d.name) return toast('Thiếu họ tên');
  if (k === 'users' && !isNew && id === ME.id && (key !== id || d.role !== 'admin' || d.active === '0')) return toast('Không thể tự đổi mã, bỏ quyền Admin hoặc khóa chính mình');
  if (!isNew && key !== id) renameKey(k, id, key);
  const r = isNew ? { id: key } : byId(k, key);
  if (k === 'customers') {
    const addrs = (d.addrs || '').split('\n').map(s => s.trim()).filter(Boolean).map((s, i) => { const [a, ...b] = s.split('|'); return b.length ? { code: a.trim(), address: b.join('|').trim() } : { code: `${key}_S${z2(i + 1)}`, address: s }; });
    const addrChanged = r.address !== d.address;
    Object.assign(r, { code: key, name: d.name, alias: d.alias, channel: d.channel, chain: d.chain, phone: d.phone, address: d.address, addresses: addrs, province: d.province, area: d.area, slaDays: parseVN(d.slaDays), serviceMin: parseVN(d.serviceMin), note: d.note });
    const la = parseGeo(d.lat), ln = parseGeo(d.lng), moved = la != null && (la !== r.lat || ln !== r.lng);
    Object.assign(r, { lat: la, lng: ln, geoSrc: moved && d.geoSrc !== 'gps' && d.geoSrc !== 'manual' ? 'manual' : d.geoSrc });
    if ((la == null || (addrChanged && !precise(r))) && d.address) { const g = guessGeo(d.address, d.province); if (g) { Object.assign(r, { lat: g.lat, lng: g.lng, geoSrc: g.src, district: g.district }); if (!r.province) r.province = g.province; } }
    if (!r.province && d.address) r.province = provinceOf(d.address);
  } else if (k === 'vehicles') Object.assign(r, { plate: key, type: d.type, capacityKg: parseVN(d.capacityKg) });
  else if (k === 'users') {
    Object.assign(r, { name: d.name, role: d.role, plant: d.plant, dept: d.dept, phone: d.phone, vehicle: d.vehicle, active: d.active !== '0' });
    if (isNew) r.pinHash = '';
    if (d.vehicle && !byId('vehicles', d.vehicle)) { upsert('vehicles', { id: d.vehicle, plate: d.vehicle, type: '', capacityKg: null }); toast(`Đã thêm xe ${d.vehicle} vào danh mục xe`); }
  }
  upsert(k, r); if (k === 'users' && r.id === ME.id) ME = r;
  log(isNew ? 'Thêm danh mục' : 'Sửa danh mục', `${k}:${key}`, r.name || r.plate || ''); closeModal(); renderView();
  if (k === 'users' && (isNew || key !== id)) setTimeout(() => toast('Nhớ bấm “Cấp PIN” để nhân viên đăng nhập được', 5000), 300);
};
ACT.catDel = id => {
  const k = STATE.catTab; if (!confirm('Xóa mục này? Các đơn / chuyến cũ vẫn giữ nguyên thông tin đã ghi.')) return;
  removeRec(k, id); log('Xóa danh mục', `${k}:${id}`); closeModal(); renderView();
};

/* =====================================================================
   EXCEL IN/OUT
   ===================================================================== */
function vData() {
  return `${pageTitle('Chuẩn hóa dữ liệu vào – ra (Excel)')}
  ${alertBox('info', 'Dữ liệu vào / ra chuẩn hóa', 'Tên sheet và tên cột xuất ra được cố định (IN HOA, không dấu) để nối với phần mềm bán hàng, kế toán, kho. Khóa liên kết: MA_DON, MA_KH, MA_TAI_XE, MA_CHUYEN.')}
  <div class="split mt">
    <div class="card"><h3 class="mb">${ico('down')} Xuất dữ liệu (OUT)</h3><p class="small muted">Xuất các bảng chuẩn hóa kèm sheet mô tả cột.</p><div class="rw">
      ${btn('Xuất toàn bộ dữ liệu', 'exportAll', '', 'primary')}${btn('Xuất danh mục', 'exportCatalog')}${btn('Tải file mẫu đơn giao', 'orderTemplate')}</div></div>
    <div class="card"><h3 class="mb">${ico('up')} Nhập dữ liệu (IN)</h3>
      <div class="rw">${can('import') ? btn('Nhập đơn giao từ Excel', 'importOrders', '', 'primary') : '<span class="small muted">Bạn không có quyền nhập dữ liệu.</span>'}</div>
      <p class="small muted mt">Dùng đúng file mẫu đơn giao: nhập xong app tự khớp khách hàng, tính hạn giao, gộp các dòng cùng mã đơn.</p>
      ${can('import') && can('catalog.edit') ? `<div class="mt2"><b>Nhập danh mục khách hàng / địa chỉ giao</b><p class="small muted">Chọn 1 hoặc 2 file Excel cùng lúc: “Hạn mức giao hàng từng khách hàng” và “Địa chỉ giao hàng” (hoặc file danh mục đã xuất từ app).</p>
        <label class="nn-btn nn-btn-secondary nn-btn-md">Chọn file danh mục<input type="file" accept=".xlsx,.xls,.csv" multiple hidden data-chg="catFiles"></label><div id="cat-imp" class="mt"></div></div>` : ''}</div>
  </div>`;
}
const colDoc = () => Object.values(XL).flatMap(x => x.cols.map(([, h, note]) => ({ SHEET: x.sheet, COT: h, MO_TA: note })));
ACT.exportAll = () => writeWorkbook([
  ...['orders', 'trips', 'customers', 'vehicles', 'users', 'settlements', 'logs'].map(k => [XL[k].sheet, toXlRows(k, DB[k])]), [XL.addresses.sheet, addressRows(DB.customers)],
  ['MO_TA_COT', colDoc()]], `GiaoHangBinhChieu_${today()}.xlsx`);
CHG.catFiles = async el => {
  const files = [...el.files]; el.value = ''; if (!files.length || !needXLSX()) return;
  const box = $('#cat-imp'); box.innerHTML = '<p class="muted">Đang đọc file…</p>';
  try {
    const merged = new Map(), addrs = new Map(); let rows = 0;
    for (const file of files) {
      const wb = XLSX.read(await file.arrayBuffer()), r = parseCustomerWorkbook(wb); rows += r.rowsRead;
      for (const c of r.customers) { const m = merged.get(c.c) || { c: c.c }; if (!m.n) m.n = c.n; else if (c.n && c.n !== m.n && !m.al) m.al = c.n;
        for (const k of ['ch', 'chain', 'ad', 'rt', 'ar', 'rg', 'phone']) if (c[k] && !m[k]) m[k] = c[k]; if (c.sla != null && m.sla == null) m.sla = c.sla; merged.set(c.c, m); }
      for (const a of r.addresses) addrs.set(a[1] || `${a[0]}_${addrs.size}`, a);
    }
    // bỏ nhân viên (nhóm "E1. Nhân viên") và mã chỉ xuất hiện trong file địa chỉ mà chưa có trong danh mục
    const isMaster = m => ['ch', 'chain', 'ad', 'rt', 'sla', 'ar', 'rg', 'phone'].some(k => m[k] != null && m[k] !== '');
    let skippedN = 0;
    const list = [...merged.values()].filter(m => { const keep = !/nhan vien/.test(vnorm(m.ch)) && (isMaster(m) || byId('customers', m.c)); if (!keep) skippedN++; return keep; });
    if (!list.length) return box.innerHTML = alertBox('danger', 'Không đọc được', 'Không thấy cột “Mã KH” / “Mã Khách hàng” trong file.');
    const newN = list.filter(c => !byId('customers', c.c)).length, byC = {}; [...addrs.values()].forEach(a => (byC[a[0]] = byC[a[0]] || []).push(a));
    STATE.catImp = { list, byC };
    box.innerHTML = `${alertBox('success', `Đọc được ${num(list.length, 0)} khách hàng, ${num(addrs.size, 0)} địa chỉ giao`, `${num(newN, 0)} khách mới · ${num(list.length - newN, 0)} khách cập nhật (giữ nguyên SĐT, ghi chú và tọa độ chính xác). Tỉnh, quận và hạn mức giao được cập nhật theo file.${skippedN ? ` Bỏ qua ${num(skippedN, 0)} mã là nhân viên hoặc chưa có trong danh mục khách.` : ''}`)}${btn('Nhập vào danh mục', 'doCatImport', '', 'primary')}`;
  } catch (e) { box.innerHTML = alertBox('danger', 'Lỗi đọc file', esc(e.message)); }
};
ACT.doCatImport = () => {
  const { list, byC } = STATE.catImp || {}; if (!list) return; let add = 0, upd = 0;
  for (const c of list) {
    const prev = byId('customers', c.c); const r = buildCustomer(c, byC[c.c] || (prev ? (prev.addresses || []).map(a => [c.c, a.code, a.address]) : []), prev);
    if (prev) { r.phone = prev.phone || c.phone || ''; r.note = prev.note || ''; r.serviceMin = prev.serviceMin ?? null; if (!c.sla && prev.slaDays != null) r.slaDays = prev.slaDays; if (!r.name) r.name = prev.name; } else if (c.phone) r.phone = c.phone;
    upsert('customers', r); prev ? upd++ : add++;
  }
  log('Nhập danh mục khách hàng', 'Excel', `Thêm ${add}, cập nhật ${upd}`); STATE.catImp = null;
  $('#cat-imp').innerHTML = alertBox('success', 'Đã nhập danh mục', `Thêm ${num(add, 0)} khách, cập nhật ${num(upd, 0)} khách.`);
};

/* =====================================================================
   NHẬT KÝ THAO TÁC
   ===================================================================== */
function vLogs() {
  const f = STATE.f, q = vnorm(f.q || '');
  const list = DB.logs.filter(l => (!f.user || l.userId === f.user) && inRange(localDate(new Date(l.t))) && (!q || vnorm(`${l.action} ${l.entity} ${l.detail} ${l.userName}`).includes(q))).sort((a, b) => b.t.localeCompare(a.t));
  const pg = pager(list.length, 'logs', 100);
  return `${pageTitle(`Nhật ký thao tác (${num(list.length, 0)})`, btn(`${ico('down')} Xuất Excel`, 'exportLogs'))}
  <div class="filters">${rangeBar('Khoảng ngày')}</div><div class="filters">${fsel('Người dùng', 'user', DB.users.map(u => [u.id, `${u.name} (${u.id})`]), f.user, { empty: 'Tất cả', cls: 'narrow', attrs: 'data-chg="f"' })}${fld('Tìm', 'q', f.q || '', { cls: 'grow', ph: 'Thao tác, mã đơn…', attrs: 'data-inp="1"' })}</div>
  ${tbl(['Thời gian', 'Người dùng', 'Vai trò', 'Thao tác', 'Đối tượng', 'Chi tiết', 'GPS'], list.slice(pg.from, pg.to).map(l => `<tr><td class="nowrap">${fmtDT(l.t)}</td><td>${esc(l.userName)}</td><td>${esc(ROLES[l.role] || '')}</td><td><b>${esc(l.action)}</b></td><td class="nn-mono">${esc(l.entity)}</td><td class="wrap">${esc(l.detail)}</td><td>${gpsLink(l.gps)}</td></tr>`))}${pg.html}`;
}
ACT.exportLogs = () => writeWorkbook([[XL.logs.sheet, toXlRows('logs', DB.logs.filter(l => inRange(localDate(new Date(l.t)))).sort((a, b) => b.t.localeCompare(a.t)))]], `NhatKy_${rangeOn()[0]}_${rangeOn()[1]}.xlsx`);

/* =====================================================================
   QUẢN TRỊ — dung lượng, thông số, đám mây, lưu trữ, phiên bản & sao lưu
   ===================================================================== */
const usageBar = (used, limit, label, f = bytesTxt) => { const p = limit ? Math.min(100, used / limit * 100) : 0, tone = p >= 90 ? 'bad' : p >= 70 ? 'warn' : 'dept';
  return `<div class="mb"><div class="rw sb center small"><b>${label}</b><span>${f(used)}${limit ? ` / ${f(limit)} · ${num(p, 1)}%` : ''}</span></div><div class="bar"><i class="${tone}" style="width:${p}%"></i></div></div>`; };
function vAdmin() {
  const s = S();
  return `${pageTitle('Quản trị hệ thống')}
  <div class="card"><h3 class="mb">Dung lượng đang sử dụng</h3><div id="stor-box"><p class="muted">Đang tính dung lượng…</p></div></div>
  <div class="card"><h3 class="mb">Thông số điều phối</h3><div class="rw" id="sf">
    ${fld('Tên nhà máy / kho xuất phát', 'dname', s.depot.name, { cls: 'narrow' })}${fld('Vĩ độ kho', 'dlat', s.depot.lat, { cls: 'narrow' })}${fld('Kinh độ kho', 'dlng', s.depot.lng, { cls: 'narrow' })}
    ${fsel('Tốc độ nội thành', 'speedKmh', [15, 18, 20, 22, 25, 30, 35, 40].map(x => [x, x + ' km/h']), s.speedKmh, { cls: 'narrow' })}${fsel('Tốc độ liên tỉnh', 'highwayKmh', [35, 40, 45, 50, 55, 60].map(x => [x, x + ' km/h']), s.highwayKmh ?? 45, { cls: 'narrow' })}
    ${fsel('Thời gian lên hàng', 'loadMin', [10, 15, 20, 30, 45, 60, 90].map(x => [x, x + ' phút']), s.loadMin, { cls: 'narrow' })}${fsel('Giao tại điểm mặc định', 'defaultServiceMin', [5, 10, 15, 20, 30].map(x => [x, x + ' phút']), s.defaultServiceMin, { cls: 'narrow' })}
    ${fsel('Giờ xuất phát mặc định', 'startTime', START_TIMES.map(x => [x, x]), s.startTime, { cls: 'narrow' })}${fsel('Hệ số đường phố', 'roadFactor', [1.2, 1.3, 1.35, 1.4, 1.5].map(x => [x, '× ' + x]), s.roadFactor, { cls: 'narrow' })}
    ${fsel('Hạn mức giao mặc định', 'defaultSlaDays', [1, 2, 3, 5, 7, 10].map(x => [x, x + ' ngày']), s.defaultSlaDays ?? 3, { cls: 'narrow', msg: 'Khi khách chưa có hạn mức' })}${fsel('Quãng đường tối đa tự xếp', 'maxDayKm', [100, 150, 200, 250, 300, 500, 1000].map(x => [x, x + ' km một chiều']), s.maxDayKm ?? 250, { cls: 'narrow', msg: 'Đơn xa hơn để riêng, không tự xếp' })}${fsel('Giao sớm tối đa', 'earlyDays', [0, 1, 2, 3, 4, 5, 7].map(x => [x, x + ' ngày']), s.earlyDays ?? 3, { cls: 'narrow' })}
    ${fsel('Gửi hành trình GPS mỗi', 'trackSyncSec', [60, 120, 180, 300, 600].map(x => [x, x / 60 + ' phút']), s.trackSyncSec ?? 180, { cls: 'narrow', msg: 'Nhanh hơn = tốn hạn mức Google' })}
    ${fsel('Bắt buộc ảnh khi giao TC', 'requirePhoto', [['1', 'Có'], ['0', 'Không']], s.requirePhoto ? '1' : '0', { cls: 'narrow' })}
    ${fsel('Gom đơn theo khu vực', 'keepRoute', [['1', 'Ưu tiên cùng quận/huyện, tỉnh'], ['0', 'Chỉ theo khoảng cách']], s.keepRoute === false ? '0' : '1', { cls: 'narrow' })}${fsel('Tải trọng xe', 'useCapacity', [['1', 'Xe đầy thì tách thêm chuyến'], ['0', 'Không xét tải trọng']], s.useCapacity === false ? '0' : '1', { cls: 'narrow' })}
  </div><div class="mt">${btn(`${ico('save')} Lưu thông số`, 'saveSettings', '', 'primary')}</div></div>
  ${cloudCard()}${retentionCard()}${versionCard()}
  <div class="card"><h3 class="mb">Xóa dữ liệu trên máy này</h3><p class="small muted">Xóa toàn bộ dữ liệu đang lưu trên thiết bị này (không ảnh hưởng dữ liệu đã đồng bộ lên Google Sheet / Drive). Nên sao lưu trước.</p>${btn('Xóa dữ liệu trên máy này', 'wipeDevice', '', 'danger')}</div>`;
}
async function adminLoad() {
  const box = $('#stor-box'); if (!box) return;
  const st = await storageStats(), tot = Object.values(st.colls).reduce((s, c) => s + c.bytes, 0);
  const photoDay = (() => { const cut = addDays(today(), -30), n = DB.orders.filter(o => o.date >= cut).reduce((s, o) => s + (o.photos || []).length, 0); return n / 30; })();
  const avg = st.photos.n ? st.photos.bytes / st.photos.n : 150 * 1024;
  if (!$('#stor-box')) return;
  box.innerHTML = `${st.quota ? usageBar(st.usage || 0, st.quota, 'Bộ nhớ thiết bị (trình duyệt cấp cho app)') : ''}
    <div class="split"><div>${tbl(['Dữ liệu trên máy này', ['Số mục', 'num'], ['Dung lượng', 'num']], [...Object.entries(st.colls).filter(([, c]) => c.n).map(([k, c]) => `<tr><td>${esc(({ users: 'Nhân sự', customers: 'Khách hàng', routes: 'Tuyến (cũ, không dùng)', vehicles: 'Xe', orders: 'Đơn giao', trips: 'Chuyến', logs: 'Nhật ký', settlements: 'Đối soát', settings: 'Cài đặt', tracks: 'Hành trình GPS' })[k] || k)}</td><td class="num">${num(c.n, 0)}</td><td class="num">${bytesTxt(c.bytes)}</td></tr>`), `<tr><td><b>Ảnh giao hàng</b></td><td class="num">${num(st.photos.n, 0)}</td><td class="num">${bytesTxt(st.photos.bytes)}</td></tr>`, `<tr><td><b>Tổng cộng</b></td><td></td><td class="num"><b>${bytesTxt(tot + st.photos.bytes)}</b></td></tr>`])}</div>
      <div><div class="card" style="box-shadow:none"><b>Ước tính tốc độ tăng</b><ul class="list-mini"><li><span>Ảnh trung bình</span><b>${bytesTxt(avg)}</b></li><li><span>Số ảnh mỗi ngày (30 ngày gần nhất)</span><b>${num(photoDay, 0)}</b></li><li><span>Dung lượng ảnh mỗi tháng</span><b>${bytesTxt(photoDay * 30 * avg)}</b></li><li><span>Giữ ${S().retentionMonths || 3} tháng trên app</span><b>${bytesTxt(photoDay * 30 * (S().retentionMonths || 3) * avg)}</b></li></ul></div></div></div>
    <div class="rw center mt">${Cloud.enabled() ? btn(`${ico('cloud', 16)} Kiểm tra dung lượng Google Sheet / Drive`, 'cloudStats', '', 'secondary') : '<span class="small muted">Bật đồng bộ đám mây để xem dung lượng Google Sheet / Drive.</span>'}</div><div id="cloud-stats" class="mt"></div>
    <details class="mt"><summary class="bold">Hướng dẫn nâng cấp dung lượng</summary><div class="small mt">
      <p><b>1. Bộ nhớ thiết bị đầy:</b> vào “Thời hạn lưu trữ dữ liệu” bên dưới, xác nhận chỉ giữ ${S().retentionMonths || 3} tháng gần nhất trên app (Google Sheet và Drive vẫn lưu đủ). Có thể đổi xuống 1–2 tháng nếu điện thoại tài xế đầy.</p>
      <p><b>2. Google Drive (ảnh) đầy:</b> gói miễn phí 15 GB dùng chung Gmail, Drive, Google Photos. Nâng cấp bằng <b>Google One</b> (vào one.google.com → chọn gói 100 GB / 200 GB / 2 TB) hoặc dùng tài khoản <b>Google Workspace</b> của công ty (dung lượng theo gói). Sau khi nâng cấp, app tự lưu tiếp, không cần cài lại. Có thể dọn thêm bằng cách chuyển ảnh cũ trong thư mục <i>GiaoHang_BinhChieu_AnhGiaoHang</i> sang thư mục lưu trữ.</p>
      <p><b>3. Google Sheet đầy (giới hạn 10 triệu ô mỗi file):</b> khi quá 70%, tạo <b>file Google Sheet mới</b> cho năm mới: dán lại Code.gs, triển khai ứng dụng web mới, rồi vào Quản trị → Đồng bộ đám mây dán URL mới và bấm “Đẩy toàn bộ dữ liệu”. File cũ giữ nguyên làm kho lưu trữ.</p>
      <p><b>4. Nhiều tài xế, cần theo dõi bản đồ thời gian thực:</b> Google Apps Script có hạn mức thời gian chạy mỗi ngày. Khi quá 20–30 tài xế, nên chuyển sang <b>Supabase</b> (chọn ở “Đồng bộ đám mây”, dùng file supabase-schema.sql); gói miễn phí 500 MB cơ sở dữ liệu, gói trả phí lớn hơn nhiều lần – xem bảng giá hiện hành trên supabase.com.</p></div></details>`;
}
ACT.cloudStats = async () => {
  const box = $('#cloud-stats'); box.innerHTML = '<p class="muted">Đang kiểm tra…</p>';
  try {
    const r = await Cloud.stats(), limC = r.cellLimit || 1e7;
    box.innerHTML = `${usageBar(r.cells, limC, `Google Sheet (${num(r.sheets.length, 0)} sheet · giới hạn 10 triệu ô mỗi file)`, n => num(n, 0) + ' ô')}
      ${r.driveLimit ? usageBar(r.driveUsed, r.driveLimit, 'Google Drive của tài khoản (gồm cả Gmail, Photos)') : ''}
      ${usageBar(r.photoBytes || 0, 0, `Ảnh giao hàng trên Drive (${num(r.photoCount || 0, 0)} ảnh)`)}
      ${r.cells / limC > .7 ? alertBox('warning', 'Google Sheet sắp đầy', 'Hãy tạo file Sheet mới cho năm mới theo hướng dẫn bên trên.') : ''}${r.driveLimit && r.driveUsed / r.driveLimit > .8 ? alertBox('warning', 'Google Drive sắp đầy', 'Hãy nâng cấp dung lượng Google One hoặc dọn ảnh cũ theo hướng dẫn bên trên.') : ''}
      <details><summary class="small">Chi tiết từng sheet</summary>${tbl(['Sheet', ['Số dòng', 'num'], ['Số ô', 'num']], r.sheets.map(x => `<tr><td>${esc(x.name)}</td><td class="num">${num(x.rows, 0)}</td><td class="num">${num(x.cells, 0)}</td></tr>`))}</details>`;
  } catch (e) { box.innerHTML = alertBox('danger', 'Không kiểm tra được', esc(e.message) + ' — nếu vừa cập nhật app, hãy dán Code.gs mới vào Apps Script và triển khai “Phiên bản mới”.'); }
};
function versionCard() {
  const s = S(), lat = STATE.latest;
  return `<div class="card"><h3 class="mb">Phiên bản & sao lưu</h3>
    <ul class="list-mini"><li><span>Phiên bản app</span><b>${APP_VERSION}</b></li><li><span>Cấu trúc dữ liệu</span><b>v${s.schemaVersion || 1} / v${SCHEMA_VERSION}</b></li><li><span>Phiên bản mới nhất</span><b>${lat ? lat.version : '—'}</b></li></ul>
    ${lat && lat.notes ? `<details class="mt"><summary class="small">Có gì mới</summary><ul class="small">${lat.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''}
    <div class="rw center mt">${btn('Kiểm tra bản mới', 'checkUpdate')}${btn(`${ico('down', 16)} Sao lưu dữ liệu (JSON)`, 'backup')}<label class="nn-btn nn-btn-secondary nn-btn-md">${ico('up', 16)} Khôi phục từ file sao lưu<input type="file" accept=".json" hidden data-chg="restoreFile"></label>${btn('Nạp lại danh mục từ dữ liệu mẫu', 'reseed')}</div>
    <p class="small muted mt">Nâng cấp phiên bản không làm mất dữ liệu: dữ liệu nằm trong bộ nhớ máy và Google Sheet, mỗi phiên bản mới tự chuyển cấu trúc dữ liệu cũ. Nên bấm “Sao lưu dữ liệu” trước khi nâng cấp lớn.</p></div>`;
}
ACT.checkUpdate = async () => { await checkAppUpdate(true); renderView(); };
ACT.backup = () => {
  const data = { app: APP_NAME, version: APP_VERSION, schema: SCHEMA_VERSION, at: nowISO(), data: Object.fromEntries(COLLS.map(c => [c, DB[c]])) };
  downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `SaoLuu_GiaoHangBC_${today()}.json`); log('Sao lưu dữ liệu', 'JSON', `${DB.orders.length} đơn, ${DB.customers.length} khách`);
  toast('Đã sao lưu (chưa gồm ảnh – ảnh đã có trên Google Drive nếu bật đồng bộ)', 5000);
};
CHG.restoreFile = async el => {
  const file = el.files[0]; el.value = ''; if (!file) return;
  try {
    const j = JSON.parse(await file.text()); if (!j.data) throw new Error('Không phải file sao lưu của app');
    if (!confirm(`Khôi phục từ bản sao lưu ${fmtDT(j.at)} (phiên bản ${j.version})?\nDữ liệu mới hơn trên máy được giữ nguyên; chỉ bổ sung / cập nhật bản ghi cũ hơn.`)) return;
    let n = 0; for (const c of COLLS) for (const rec of (j.data[c] || [])) { const cur = byId(c, rec.id); if (!cur || (rec._u || '') > (cur._u || '')) { const i = DB[c].findIndex(x => x.id === rec.id); i >= 0 ? DB[c][i] = rec : DB[c].push(rec); persist(c); Cloud.queue(c, rec); n++; } }
    if ((j.schema || 1) < SCHEMA_VERSION) toast('Bản sao lưu cũ hơn: hãy tải lại app để tự nâng cấp cấu trúc dữ liệu', 6000);
    log('Khôi phục sao lưu', file.name, `${n} bản ghi`); toast(`Đã khôi phục ${num(n, 0)} bản ghi`); renderView();
  } catch (e) { toast('Không khôi phục được: ' + e.message, 5000); }
};
ACT.reseed = async () => {
  if (!confirm('Nạp lại danh mục khách hàng và địa chỉ từ dữ liệu mẫu (data/seed.json)?\nĐơn, chuyến, SĐT/ghi chú và tọa độ chính xác của khách được giữ nguyên.')) return;
  try { const r = await seedCatalog(); log('Nạp lại danh mục', 'seed.json', `${r.customers} khách`); toast(`Đã nạp ${num(r.customers, 0)} khách hàng`); renderView(); } catch (e) { toast(e.message, 5000); }
};
ACT.wipeDevice = async () => {
  if (!confirm('Xóa TOÀN BỘ dữ liệu trên máy này?')) return;
  if ((prompt('Gõ chữ XOA để xác nhận') || '').trim().toUpperCase() !== 'XOA') return toast('Đã hủy');
  Track.stop(); await IDB.clear('kv'); await IDB.clear('photos'); Cloud.q.clear(); localStorage.removeItem(SESSION_KEY); localStorage.removeItem('bc_lastPull'); location.reload();
};
ACT.saveSettings = () => {
  const d = formData($('#sf')), s = S();
  Object.assign(s, { depot: { ...s.depot, name: d.dname, lat: parseGeo(d.dlat), lng: parseGeo(d.dlng) }, speedKmh: +d.speedKmh, highwayKmh: +d.highwayKmh, loadMin: +d.loadMin, defaultServiceMin: +d.defaultServiceMin, startTime: d.startTime, roadFactor: +d.roadFactor,
    defaultSlaDays: +d.defaultSlaDays, earlyDays: +d.earlyDays, maxDayKm: +d.maxDayKm, trackSyncSec: +d.trackSyncSec, requirePhoto: d.requirePhoto === '1', keepRoute: d.keepRoute === '1', useCapacity: d.useCapacity === '1' });
  upsert('settings', s); log('Sửa thông số điều phối', 'settings', JSON.stringify({ speed: s.speedKmh, hw: s.highwayKmh, load: s.loadMin, sla: s.defaultSlaDays, early: s.earlyDays })); toast('Đã lưu');
};

/* ---------- Đồng bộ đám mây ---------- */
function cloudCard() {
  const c = Cloud.cfg, prov = STATE.f.prov || Cloud.provider();
  return `<div class="card"><h3 class="mb">Đồng bộ đám mây</h3>
    <p class="small muted">Bật để mọi điện thoại / máy tính dùng chung dữ liệu. <b>Google Sheet</b>: mỗi bảng là 1 sheet (cột chuẩn hóa như Excel), ảnh lưu trong Google Drive, link ảnh ở sheet <b>ANH</b>. Hướng dẫn cài trong file <b>google-apps-script/Code.gs</b>.</p>
    <div class="rw" id="cf2">
      ${fsel('Nơi lưu trữ', 'provider', [['gsheet', 'Google Sheet + Google Drive'], ['supabase', 'Supabase']], prov, { cls: 'narrow', attrs: 'data-chg="prov"' })}
      ${fsel('Trạng thái', 'enabled', [['1', 'Bật đồng bộ'], ['0', 'Tắt (chỉ lưu máy này)']], c.enabled ? '1' : '0', { cls: 'narrow' })}
      ${prov === 'gsheet' ? `${fld('URL ứng dụng web Apps Script (…/exec)', 'gsUrl', c.gsUrl || '', { cls: 'full', ph: 'https://script.google.com/macros/s/…/exec' })}${fld('Mã bảo mật (TOKEN trong Code.gs)', 'gsToken', c.gsToken || '', { type: 'password', cls: 'full' })}`
        : `${fld('Project URL', 'url', c.url || '', { cls: 'full', ph: 'https://xxxx.supabase.co' })}${fld('Anon key', 'key', c.key || '', { cls: 'full', ph: 'eyJhbGciOi…' })}`}
    </div>
    <div class="rw center mt">${btn('Kiểm tra kết nối', 'testCloud')}${btn(`${ico('save')} Lưu & kết nối`, 'saveCloud', '', 'primary')}${btn(`${ico('up', 16)} Đẩy toàn bộ dữ liệu + ảnh lên`, 'pushAll')}${Cloud.enabled() ? btn('Mã kết nối cho máy khác', 'showCode') : ''}</div>
    ${Cloud.lastErr ? `<div class="mt">${alertBox('danger', '', esc(Cloud.lastErr))}</div>` : ''}</div>`;
}
function retentionCard() {
  const s = S(), m = s.retentionMonths || 3, cut = retentionCutoff(m), st = oldDataStats(cut), total = st.orders + st.trips + st.settlements + st.logs + st.tracks;
  return `<div class="card"><h3 class="mb">Thời hạn lưu trữ dữ liệu trên app</h3>
    <div class="rw">${fsel('Chỉ giữ dữ liệu giao hàng trong', 'retentionMonths', [1, 2, 3, 6, 12].map(x => [x, x + ' tháng gần nhất']), m, { cls: 'narrow', attrs: 'data-chg="retMonths"' })}
      <div class="grow small muted" style="align-self:flex-end">Áp dụng cho đơn giao, chuyến, ảnh, đối soát, nhật ký, hành trình GPS. Danh mục (khách hàng, xe, nhân sự) luôn được giữ.</div></div>
    <ul class="list-mini mt">
      <li><span>Mốc giữ lại</span><b>từ ${fmtD(cut)} đến nay</b></li>
      <li><span>Dữ liệu cũ hơn mốc (trên máy này)</span><b>${num(st.orders, 0)} đơn · ${num(st.photos, 0)} ảnh · ${num(st.trips, 0)} chuyến · ${num(st.logs, 0)} nhật ký</b></li>
      <li><span>Lần xác nhận gần nhất</span><b>${s.purgedAt ? `${fmtDT(s.purgedAt)} · ${esc(userName(s.purgedBy))} · gỡ khỏi app dữ liệu trước ${fmtD(s.purgeCutoff)}` : 'Chưa có'}</b></li>
    </ul>
    ${Cloud.enabled() ? `<label class="check mt"><input type="checkbox" id="ret-export"> Xuất thêm file Excel dữ liệu cũ về máy</label>
    <div class="mt">${alertBox('info', '', 'Khi xác nhận, dữ liệu cũ hơn mốc chỉ bị xóa khỏi <b>app trên máy này và mọi máy khác</b>. <b>Google Sheet và ảnh trên Google Drive vẫn giữ nguyên đầy đủ</b>. Chỉ Admin được xác nhận.')}</div>`
    : `<input type="checkbox" id="ret-export" checked hidden><div class="mt">${alertBox('warning', '', 'Chưa bật đồng bộ Google Sheet nên dữ liệu cũ <b>không có bản lưu trên Google Sheet / Drive</b>. Khi xác nhận, app bắt buộc xuất file Excel lưu trữ rồi mới xóa khỏi máy; ảnh cũ sẽ mất. Nên bật đồng bộ trước.')}</div>`}
    <div class="mt">${btn(`Xác nhận app chỉ giữ dữ liệu ${m} tháng gần nhất`, 'purgeOld', '', 'danger', 'lg', `style="width:100%" ${total ? '' : 'disabled'}`)}</div></div>`;
}
CHG.prov = el => { STATE.f.prov = el.value; renderView(); };
CHG.retMonths = el => { const s = S(); s.retentionMonths = +el.value; upsert('settings', s); log('Đổi thời hạn lưu trữ', 'settings', `${s.retentionMonths} tháng`); renderView(); };
const cloudFromForm = () => { const d = formData($('#cf2')); return Object.assign({}, Cloud.cfg, d, { enabled: d.enabled === '1' }); };
ACT.testCloud = async () => {
  const old = Cloud.cfg; Cloud.cfg = Object.assign(cloudFromForm(), { enabled: true });
  try { await Cloud.test(); toast('Kết nối thành công'); } catch (e) { toast('Lỗi: ' + e.message, 6000); } finally { Cloud.cfg = old; }
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
  if (!confirm('Đẩy toàn bộ dữ liệu và ảnh trên máy này lên đám mây?\nDanh mục khách hàng lớn có thể mất vài phút.')) return;
  toast('Đang đẩy dữ liệu, vui lòng chờ…', 5000); await Cloud.pushAll(); toast(Cloud.status === 'err' ? Cloud.lastErr : 'Đã đẩy xong', 5000); updateSync();
};
const encodeCfg = c => 'BC1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ provider: Cloud.provider(), gsUrl: c.gsUrl, gsToken: c.gsToken, url: c.url, key: c.key }))));
ACT.showCode = () => openModal('Mã kết nối cho máy khác', `<p class="small muted">Gửi mã này cho tài xế / nhân viên (Zalo nội bộ). Trên máy họ: màn hình đăng nhập → “Kết nối dữ liệu công ty” → dán mã. Không chia sẻ ra ngoài.</p>
  <label class="nn-field full"><span class="nn-input-wrap tall"><textarea class="nn-textarea" id="cc-out" readonly style="min-height:110px">${esc(encodeCfg(Cloud.cfg))}</textarea></span></label><div class="mt">${btn('Sao chép', 'copyCode', '', 'primary')}</div>`);
ACT.copyCode = async () => { const t = $('#cc-out'); t.select(); try { await navigator.clipboard.writeText(t.value); } catch { document.execCommand('copy'); } toast('Đã sao chép mã kết nối'); };
// Admin xác nhận: app chỉ giữ dữ liệu N tháng gần nhất; Google Sheet / Drive giữ toàn bộ làm kho lưu trữ
ACT.purgeOld = async () => {
  if (!isAdmin()) return;
  const m = S().retentionMonths || 3, cut = retentionCutoff(m), st = oldDataStats(cut), cloud = Cloud.enabled();
  if (!confirm(`XÁC NHẬN APP CHỈ GIỮ DỮ LIỆU ${m} THÁNG GẦN NHẤT\n\nSẽ gỡ khỏi app (máy này và mọi máy khác) dữ liệu trước ngày ${fmtD(cut)}:\n• ${st.orders} đơn giao (${st.photos} ảnh)\n• ${st.trips} chuyến\n• ${st.settlements} đối soát\n• ${st.logs} dòng nhật ký\n\n${cloud ? 'Google Sheet và Google Drive VẪN GIỮ NGUYÊN toàn bộ dữ liệu và ảnh.' : 'Chưa bật Google Sheet: dữ liệu chỉ còn trong file Excel lưu trữ, ảnh cũ sẽ mất.'}\n\nTiếp tục?`)) return;
  if ((prompt('Gõ chữ XOA để xác nhận lần cuối') || '').trim().toUpperCase() !== 'XOA') return toast('Đã hủy');
  if (cloud) {
    toast('Đang kiểm tra dữ liệu đã lưu lên Google Sheet…', 4000); await Cloud.push();
    if (Cloud.status === 'err' || Cloud.pendingOld(cut)) return toast('Còn dữ liệu cũ chưa lưu lên Google Sheet (kiểm tra mạng rồi thử lại). Chưa xóa gì.', 7000);
  }
  const olds = coll => DB[coll].filter(r => { const d = recDate(coll, r); return d && d < cut; });
  if ($('#ret-export')?.checked) writeWorkbook([[XL.orders.sheet, toXlRows('orders', olds('orders'))], [XL.trips.sheet, toXlRows('trips', olds('trips'))], [XL.settlements.sheet, toXlRows('settlements', olds('settlements'))], [XL.logs.sheet, toXlRows('logs', olds('logs'))]], `LuuTru_truoc_${cut}.xlsx`);
  const s = S(); Object.assign(s, { purgeCutoff: cut, purgedAt: nowISO(), purgedBy: ME.id }); upsert('settings', s);
  if (cloud) await Cloud.push();
  await pruneLocal(cut);
  log('Xác nhận lưu trữ', `${m} tháng`, `Gỡ khỏi app dữ liệu trước ${fmtD(cut)}: ${st.orders} đơn, ${st.photos} ảnh, ${st.trips} chuyến, ${st.settlements} đối soát, ${st.logs} nhật ký${cloud ? ' · Google Sheet/Drive giữ nguyên' : ''}`);
  toast(`Đã gỡ dữ liệu cũ khỏi app${cloud ? ' · Google Sheet/Drive vẫn giữ đủ' : ''}`, 5000); renderView();
};

/* =====================================================================
   CÀI ĐẶT (mọi vai trò)
   ===================================================================== */
function vSettings() {
  const c = Cloud.cfg;
  return `${pageTitle('Cài đặt')}
  <div class="card"><h3 class="mb">Cài app lên điện thoại</h3>${alertBox('info', '', installGuide())}${installEvt ? `<div class="mt">${btn('Cài app ngay', 'install', '', 'primary')}</div>` : ''}</div>
  <div class="card"><h3 class="mb">Tài khoản</h3><p class="small muted">${esc(ME.name)} (${esc(ME.id)}) · ${ROLES[ME.role]}</p><div class="rw">${btn('Đổi PIN / Đăng xuất', 'userMenu')}</div>
    <p class="small muted mt">App tự ghi nhớ đăng nhập trên máy này, chỉ hỏi lại khi bạn bấm “Đăng xuất” hoặc PIN bị đổi.</p></div>
  ${ME.role === 'taixe' ? `<div class="card"><h3 class="mb">Định vị GPS</h3><p class="small muted">App ghi hành trình khi chuyến đang chạy (lên hàng → về kho). Cần cho phép truy cập vị trí cho trình duyệt / app.</p><div class="rw">${btn('Kiểm tra GPS', 'testGPS')}</div></div>` : ''}
  <div class="card"><h3 class="mb">Phiên bản</h3><p class="small muted">Phiên bản ${APP_VERSION} · ${Cloud.enabled() ? `đang đồng bộ qua ${Cloud.provider() === 'supabase' ? 'Supabase' : 'Google Sheet'}` : 'dữ liệu lưu trên máy này'}</p><div class="rw">${btn('Kiểm tra bản mới', 'checkUpdate')}</div></div>
  ${!Cloud.enabled() && !isAdmin() ? `<div class="card"><h3 class="mb">Kết nối dữ liệu công ty</h3><p class="small muted">Xin Admin “mã kết nối” rồi dán vào đây.</p>${btn('Dán mã kết nối', 'connectLogin', '', 'primary')}</div>` : ''}
  ${isAdmin() ? `<div class="card"><p class="small muted" style="margin:0">Thông số điều phối, đồng bộ đám mây, dung lượng, lưu trữ và sao lưu nằm ở mục <a href="#" data-act="tab" data-id="admin">Quản trị</a>.</p></div>` : ''}
  <p class="small muted mt">${APP_NAME}</p>`;
}
ACT.testGPS = async () => { toast('Đang lấy vị trí…'); const g = await getGPS(); toast(g ? `GPS hoạt động (±${g.acc} m)` : 'Không lấy được GPS – hãy cho phép truy cập vị trí', 5000); };
