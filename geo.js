'use strict';
/* =====================================================================
   geo.js — danh sách tỉnh/thành, quận/huyện chính và tọa độ ước lượng.
   Dùng để: suy ra tỉnh từ địa chỉ, lọc theo tỉnh, và ước lượng khoảng cách
   khi khách hàng chưa có tọa độ chính xác (tọa độ chính xác sẽ tự học từ
   vị trí GPS tài xế check-in hoặc nhập tay trong Danh mục).
   ===================================================================== */

// Chuẩn hóa tiếng Việt để so khớp: bỏ dấu, chữ thường, chỉ giữ chữ-số
function vnorm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// [Tên hiển thị, vĩ độ, kinh độ, [tên gọi khác]]
const PROVINCES = [
  ['An Giang', 10.52, 105.13, []], ['Bà Rịa - Vũng Tàu', 10.54, 107.24, ['ba ria vung tau', 'ba ria', 'vung tau', 'brvt']],
  ['Bắc Giang', 21.28, 106.19, []], ['Bắc Kạn', 22.15, 105.83, ['bac can']], ['Bạc Liêu', 9.29, 105.72, []],
  ['Bắc Ninh', 21.19, 106.07, []], ['Bến Tre', 10.24, 106.38, []], ['Bình Định', 13.78, 109.22, ['quy nhon']],
  ['Bình Dương', 11.0, 106.65, ['thu dau mot', 'thuan an', 'di an', 'tan uyen', 'ben cat']], ['Bình Phước', 11.75, 106.72, ['dong xoai']],
  ['Bình Thuận', 10.93, 108.1, ['phan thiet']], ['Cà Mau', 9.18, 105.15, []], ['Cần Thơ', 10.03, 105.78, []],
  ['Cao Bằng', 22.67, 106.26, []], ['Đà Nẵng', 16.05, 108.2, []], ['Đắk Lắk', 12.67, 108.04, ['dak lak', 'dac lac', 'buon ma thuot']],
  ['Đắk Nông', 12.0, 107.69, ['dak nong', 'dac nong']], ['Điện Biên', 21.39, 103.02, []],
  ['Đồng Nai', 10.95, 106.82, ['bien hoa', 'long thanh', 'nhon trach']], ['Đồng Tháp', 10.46, 105.63, ['cao lanh', 'sa dec']],
  ['Gia Lai', 13.98, 108.0, ['pleiku']], ['Hà Giang', 22.82, 104.98, []], ['Hà Nam', 20.54, 105.91, ['phu ly']],
  ['Hà Nội', 21.03, 105.85, ['ha noi', 'tp ha noi']], ['Hà Tĩnh', 18.34, 105.91, []], ['Hải Dương', 20.94, 106.33, []],
  ['Hải Phòng', 20.86, 106.68, []], ['Hậu Giang', 9.78, 105.47, []], ['Hòa Bình', 20.82, 105.34, []],
  ['Hưng Yên', 20.65, 106.05, []], ['Khánh Hòa', 12.24, 109.19, ['nha trang', 'cam ranh']], ['Kiên Giang', 10.01, 105.08, ['rach gia', 'phu quoc']],
  ['Kon Tum', 14.35, 108.0, ['kontum']], ['Lai Châu', 22.4, 103.46, []], ['Lâm Đồng', 11.94, 108.44, ['da lat', 'bao loc']],
  ['Lạng Sơn', 21.85, 106.76, []], ['Lào Cai', 22.48, 103.97, []], ['Long An', 10.54, 106.41, ['tan an', 'can giuoc', 'can duoc', 'ben luc']],
  ['Nam Định', 20.42, 106.17, []], ['Nghệ An', 18.68, 105.68, ['vinh']], ['Ninh Bình', 20.25, 105.97, []],
  ['Ninh Thuận', 11.57, 108.99, ['phan rang']], ['Phú Thọ', 21.32, 105.4, ['viet tri']], ['Phú Yên', 13.09, 109.31, ['tuy hoa']],
  ['Quảng Bình', 17.47, 106.62, ['dong hoi']], ['Quảng Nam', 15.57, 108.47, ['tam ky', 'hoi an']], ['Quảng Ngãi', 15.12, 108.8, []],
  ['Quảng Ninh', 21.01, 107.29, ['ha long']], ['Quảng Trị', 16.75, 107.19, ['dong ha']], ['Sóc Trăng', 9.6, 105.97, []],
  ['Sơn La', 21.33, 103.91, []], ['Tây Ninh', 11.31, 106.1, []], ['Thái Bình', 20.45, 106.34, []],
  ['Thái Nguyên', 21.59, 105.84, []], ['Thanh Hóa', 19.81, 105.78, []], ['Thừa Thiên Huế', 16.46, 107.59, ['thua thien hue', 'hue']],
  ['Tiền Giang', 10.36, 106.36, ['my tho', 'go cong']], ['TP. Hồ Chí Minh', 10.78, 106.7, ['ho chi minh', 'tp hcm', 'tphcm', 'hcm', 'sai gon', 'tp ho chi minh']],
  ['Trà Vinh', 9.93, 106.34, []], ['Tuyên Quang', 21.82, 105.21, []], ['Vĩnh Long', 10.25, 105.97, []],
  ['Vĩnh Phúc', 21.31, 105.6, ['vinh yen']], ['Yên Bái', 21.72, 104.9, []],
];
const PROV_KEYS = PROVINCES.map(p => ({ name: p[0], lat: p[1], lng: p[2], keys: [vnorm(p[0]).replace(/^tp /, ''), ...p[3]].map(k => vnorm(k)).filter(Boolean) }));
const provByName = name => PROV_KEYS.find(p => p.name === name);
const provinceNames = () => PROVINCES.map(p => p[0]).sort((a, b) => a.localeCompare(b, 'vi'));

// Tìm vị trí xuất hiện cuối cùng của 1 cụm từ (đủ từ) trong chuỗi đã chuẩn hóa
function lastIdx(hay, key) { return (' ' + hay + ' ').lastIndexOf(' ' + key + ' '); }

// Suy ra tỉnh từ địa chỉ: ưu tiên cụm tỉnh xuất hiện cuối cùng (tỉnh nằm cuối địa chỉ)
function provinceOf(text) {
  const parts = String(text || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean).slice(-3);
  const n = vnorm(parts.join(' , '));
  let best = null, bi = -1, bl = 0;
  for (const p of PROV_KEYS) for (const k of p.keys) {
    const i = lastIdx(n, k);
    if (i > bi || (i === bi && k.length > bl)) { if (i >= 0) { best = p; bi = i; bl = k.length; } }
  }
  return best ? best.name : '';
}
// Mã tuyến dạng "HÀ NỘI 1" → tỉnh "Hà Nội"
function provinceOfRoute(code) {
  const n = vnorm(String(code || '').replace(/\d+\s*$/, ''));
  if (!n) return '';
  for (const p of PROV_KEYS) if (p.keys.includes(n) || vnorm(p.name) === n) return p.name;
  return provinceOf(n);
}

// [Tỉnh, tên quận/huyện, vĩ độ, kinh độ, [từ khóa]]
const DISTRICTS = [
  ...[['1', 10.776, 106.700], ['3', 10.784, 106.686], ['4', 10.759, 106.705], ['5', 10.754, 106.667], ['6', 10.747, 106.635], ['7', 10.734, 106.722],
    ['8', 10.724, 106.628], ['10', 10.773, 106.667], ['11', 10.763, 106.650], ['12', 10.867, 106.654]]
    .map(([n, la, ln]) => ['TP. Hồ Chí Minh', 'Quận ' + n, la, ln, ['#' + n]]),
  ['TP. Hồ Chí Minh', 'Bình Tân', 10.765, 106.604, ['binh tan']], ['TP. Hồ Chí Minh', 'Bình Thạnh', 10.811, 106.707, ['binh thanh']],
  ['TP. Hồ Chí Minh', 'Gò Vấp', 10.838, 106.665, ['go vap']], ['TP. Hồ Chí Minh', 'Phú Nhuận', 10.8, 106.68, ['phu nhuan']],
  ['TP. Hồ Chí Minh', 'Tân Bình', 10.801, 106.653, ['tan binh']], ['TP. Hồ Chí Minh', 'Tân Phú', 10.791, 106.628, ['quan tan phu', 'q tan phu']],
  ['TP. Hồ Chí Minh', 'TP. Thủ Đức', 10.85, 106.757, ['thu duc']], ['TP. Hồ Chí Minh', 'Bình Chánh', 10.69, 106.571, ['binh chanh']],
  ['TP. Hồ Chí Minh', 'Củ Chi', 10.973, 106.494, ['cu chi']], ['TP. Hồ Chí Minh', 'Hóc Môn', 10.888, 106.592, ['hoc mon']],
  ['TP. Hồ Chí Minh', 'Nhà Bè', 10.695, 106.737, ['nha be']], ['TP. Hồ Chí Minh', 'Cần Giờ', 10.411, 106.954, ['can gio']],
  ['Bình Dương', 'Thuận An', 10.936, 106.713, ['thuan an']], ['Bình Dương', 'Dĩ An', 10.903, 106.769, ['di an']],
  ['Bình Dương', 'Thủ Dầu Một', 10.98, 106.652, ['thu dau mot']], ['Bình Dương', 'Tân Uyên', 11.057, 106.793, ['tan uyen']],
  ['Bình Dương', 'Bến Cát', 11.147, 106.601, ['ben cat']],
  ['Đồng Nai', 'Biên Hòa', 10.957, 106.843, ['bien hoa']], ['Đồng Nai', 'Long Thành', 10.79, 107.014, ['long thanh']],
  ['Đồng Nai', 'Nhơn Trạch', 10.72, 106.9, ['nhon trach']],
  ['Hà Nội', 'Hà Đông', 20.96, 105.77, ['ha dong']], ['Hà Nội', 'Long Biên', 21.05, 105.89, ['long bien']],
  ['Hà Nội', 'Cầu Giấy', 21.03, 105.79, ['cau giay']], ['Hà Nội', 'Đống Đa', 21.02, 105.83, ['dong da']],
  ['Hà Nội', 'Bắc Từ Liêm', 21.07, 105.76, ['bac tu liem']], ['Hà Nội', 'Nam Từ Liêm', 21.01, 105.76, ['nam tu liem']],
  ['Hà Nội', 'Đông Anh', 21.14, 105.85, ['dong anh']], ['Hà Nội', 'Thanh Xuân', 20.99, 105.81, ['thanh xuan']],
  ['Hà Nội', 'Hoàng Mai', 20.97, 105.86, ['hoang mai']], ['Hà Nội', 'Gia Lâm', 21.02, 105.94, ['gia lam']],
].map(([prov, name, lat, lng, keys]) => ({ prov, name, lat, lng, keys }));

function districtOf(address, province) {
  const n = vnorm(address);
  let best = null, bi = -1;
  for (const d of DISTRICTS) {
    if (province && d.prov !== province) continue;
    for (const k of d.keys) {
      let i;
      if (k[0] === '#') { const m = new RegExp('(?:^| )(?:quan|q|district|dist) 0?' + k.slice(1) + '(?: |$)', 'g'); let mm, li = -1; while ((mm = m.exec(n))) li = mm.index; i = li; }
      else i = lastIdx(n, k);
      if (i > bi) { bi = i; best = d; }
    }
  }
  return best;
}
// Ước lượng tọa độ từ địa chỉ: quận/huyện nếu nhận ra, nếu không thì trung tâm tỉnh
function guessGeo(address, province) {
  const prov = province || provinceOf(address), pr = prov && provByName(prov);
  const d = districtOf(address, prov);
  if (d) return { lat: d.lat, lng: d.lng, src: 'quan', province: d.prov, district: d.name };
  if (pr) return { lat: pr.lat, lng: pr.lng, src: 'tinh', province: pr.name, district: '' };
  return null;
}
