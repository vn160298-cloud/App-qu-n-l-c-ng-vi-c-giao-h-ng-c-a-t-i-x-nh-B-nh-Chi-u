/* =====================================================================
   App quản lý công việc giao hàng của tài xế nhà Bình Chiểu
   Google Apps Script — lưu toàn bộ dữ liệu vào Google Sheet,
   ảnh giao hàng lưu vào Google Drive (link ghi trong sheet ANH).
   Đây là KHO LƯU TRỮ ĐẦY ĐỦ: script không có lệnh xóa dữ liệu. Chức năng
   "chỉ lưu 3 tháng" của app chỉ gỡ dữ liệu cũ khỏi các máy, Sheet/Drive giữ nguyên.

   CÀI ĐẶT (làm 1 lần):
   1. Tạo 1 Google Sheet mới → Tiện ích mở rộng → Apps Script.
   2. Xóa code mẫu, dán toàn bộ file này vào, ĐỔI giá trị TOKEN bên dưới.
   3. Bấm Triển khai → Tùy chọn triển khai mới → Loại: Ứng dụng web
        - Thực thi với tư cách: Tôi
        - Người có quyền truy cập: Bất kỳ ai
      → Triển khai → cấp quyền → copy "URL ứng dụng web" (…/exec).
   4. Trong app: Cài đặt → Đồng bộ đám mây → Google Sheet → dán URL + TOKEN.
   Khi sửa code: Triển khai → Quản lý triển khai → ✏️ → Phiên bản mới.
   ===================================================================== */

const TOKEN = 'DOI-MA-BI-MAT-NAY';                       // ⚠ đổi thành chuỗi bí mật của bạn
const PHOTO_FOLDER = 'GiaoHang_BinhChieu_AnhGiaoHang';   // thư mục ảnh trên Google Drive
const PHOTO_SHEET = 'ANH';
const BASE = ['ID', 'COLL', 'UPDATED_AT', 'DELETED'];
const PHOTO_COLS = ['MA_DON', 'NGAY', 'LOAI', 'LINK', 'FILE_ID'];

function doGet() {
  return out({ ok: true, msg: 'Apps Script App giao hàng Bình Chiểu đang chạy' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }); }
  if (req.token !== TOKEN) return out({ ok: false, error: 'Sai mã bảo mật (TOKEN)' });
  try {
    switch (req.action) {
      case 'ping':  return out({ ok: true, sheet: SpreadsheetApp.getActive().getName() });
      case 'push':  return out(withLock(() => push(req.rows || [])));
      case 'pull':  return out(pull(req.since || '', req.limit || 1000));
      case 'photo': return out(photo(req.id));
      default:      return out({ ok: false, error: 'Thao tác không hỗ trợ: ' + req.action });
    }
  } catch (err) {
    return out({ ok: false, error: String((err && err.message) || err) });
  }
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function withLock(fn) { const l = LockService.getScriptLock(); l.waitLock(30000); try { return fn(); } finally { l.releaseLock(); } }

// Lấy (hoặc tạo) sheet, bổ sung cột còn thiếu; mọi ô định dạng văn bản để giữ số 0 đầu SĐT, mã, giờ
function sheetFor(name, cols) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, BASE.length + 1).setValues([BASE.concat(['DATA_JSON'])]);
    sh.setFrozenRows(1);
    sh.hideColumns(BASE.length + 1);   // ẩn cột DATA_JSON cho dễ đọc (app vẫn dùng)
  }
  let header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const missing = cols.filter(h => header.indexOf(h) < 0);
  if (missing.length) {
    if (sh.getMaxColumns() < header.length + missing.length) sh.insertColumnsAfter(sh.getMaxColumns(), header.length + missing.length - sh.getMaxColumns());
    sh.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
    header = header.concat(missing);
  }
  sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#0f2a4a').setFontColor('#ffffff');
  return { sh, header };
}

// Mốc thời gian máy chủ tăng dần, duy nhất cho từng dòng → làm con trỏ đồng bộ
function stamps(n) {
  const p = PropertiesService.getScriptProperties();
  const prev = Date.parse(p.getProperty('lastWrite') || '');
  const t = isNaN(prev) ? Date.now() : Math.max(Date.now(), prev + 1);
  const res = [];
  for (let i = 0; i < n; i++) res.push(new Date(t + i).toISOString());
  if (n) p.setProperty('lastWrite', res[n - 1]);
  return res;
}

function push(rows) {
  const groups = {};
  rows.forEach(r => { const name = r.sheet || r.coll; (groups[name] = groups[name] || []).push(r); });
  const ts = stamps(rows.length);
  let k = 0, files = 0;
  for (const name in groups) {
    const list = groups[name];
    const isPhoto = list[0].coll === 'photos';
    const viewKeys = [];
    if (isPhoto) PHOTO_COLS.forEach(c => viewKeys.push(c));
    else list.forEach(r => Object.keys(r.view || {}).forEach(c => { if (viewKeys.indexOf(c) < 0 && BASE.indexOf(c) < 0) viewKeys.push(c); }));
    const { sh, header } = sheetFor(name, viewKeys);
    const last = sh.getLastRow();
    const values = sh.getRange(1, 1, Math.max(1, last), header.length).getValues();
    values[0] = header;
    const col = h => header.indexOf(h);
    const pos = {};
    for (let i = 1; i < values.length; i++) pos[String(values[i][0])] = i;
    list.forEach(r => {
      const i = pos[r.id] != null ? pos[r.id] : values.push(new Array(header.length).fill('')) - 1;
      pos[r.id] = i;
      const row = values[i];
      row[col('ID')] = r.id; row[col('COLL')] = r.coll; row[col('UPDATED_AT')] = ts[k++]; row[col('DELETED')] = r.deleted ? 'TRUE' : '';
      const data = r.data || {};
      if (isPhoto) {
        if (r.deleted) {
          if (row[col('FILE_ID')]) { try { DriveApp.getFileById(row[col('FILE_ID')]).setTrashed(true); } catch (e) {} }
          row[col('FILE_ID')] = ''; row[col('LINK')] = '';
        } else if (!row[col('FILE_ID')] && data.data) {
          const f = savePhotoFile(data);
          row[col('FILE_ID')] = f.getId(); row[col('LINK')] = f.getUrl(); files++;
        }
        row[col('MA_DON')] = data.order || row[col('MA_DON')] || '';
        row[col('NGAY')] = data.date || row[col('NGAY')] || '';
        row[col('LOAI')] = data.kind || row[col('LOAI')] || '';
        const meta = Object.assign({}, data); delete meta.data;     // không lưu base64 trong sheet
        row[col('DATA_JSON')] = JSON.stringify(meta);
      } else {
        const v = r.view || {};
        Object.keys(v).forEach(h => { const c = col(h); if (c >= 0 && BASE.indexOf(h) < 0) row[c] = v[h] == null ? '' : String(v[h]); });
        row[col('DATA_JSON')] = JSON.stringify(data);
      }
    });
    sh.getRange(1, 1, values.length, header.length).setNumberFormat('@').setValues(values);
  }
  return { ok: true, saved: rows.length, files };
}

function photoFolder(date) {
  const root = DriveApp.getFoldersByName(PHOTO_FOLDER);
  const base = root.hasNext() ? root.next() : DriveApp.createFolder(PHOTO_FOLDER);
  const month = String(date || '').slice(0, 7) || 'khong-ro-ngay';
  const sub = base.getFoldersByName(month);
  return sub.hasNext() ? sub.next() : base.createFolder(month);
}

function savePhotoFile(p) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(p.data);
  if (!m) throw new Error('Ảnh không đúng định dạng');
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], (p.order || 'anh') + '_' + p.id + '.jpg');
  return photoFolder(p.date).createFile(blob);
}

function pull(since, limit) {
  const lw = PropertiesService.getScriptProperties().getProperty('lastWrite') || '';
  if (since && lw && since >= lw) return { ok: true, rows: [], cursor: since, more: false };   // không có gì mới
  const res = [];
  SpreadsheetApp.getActive().getSheets().forEach(sh => {
    if (sh.getName() === PHOTO_SHEET || sh.getLastRow() < 2) return;
    const vals = sh.getDataRange().getValues(), h = vals[0].map(String);
    const iI = h.indexOf('ID'), iC = h.indexOf('COLL'), iU = h.indexOf('UPDATED_AT'), iD = h.indexOf('DELETED'), iJ = h.indexOf('DATA_JSON');
    if (iC < 0 || iJ < 0) return;
    for (let r = 1; r < vals.length; r++) {
      const u = String(vals[r][iU]);
      if (u <= since) continue;
      let data = null; try { data = JSON.parse(vals[r][iJ]); } catch (e) {}
      res.push({ coll: String(vals[r][iC]), id: String(vals[r][iI]), updated_at: u, deleted: String(vals[r][iD]) === 'TRUE', data });
    }
  });
  res.sort((a, b) => a.updated_at < b.updated_at ? -1 : 1);
  const rows = res.slice(0, limit);
  return { ok: true, rows, cursor: rows.length ? rows[rows.length - 1].updated_at : since, more: res.length > limit };
}

function photo(id) {
  const sh = SpreadsheetApp.getActive().getSheetByName(PHOTO_SHEET);
  if (!sh || sh.getLastRow() < 2) return { ok: true, data: null };
  const vals = sh.getDataRange().getValues(), h = vals[0].map(String), iF = h.indexOf('FILE_ID');
  const row = vals.find((r, i) => i > 0 && String(r[0]) === String(id));
  if (!row || !row[iF]) return { ok: true, data: null };
  const blob = DriveApp.getFileById(row[iF]).getBlob();
  return { ok: true, data: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}
