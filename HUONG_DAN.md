# App quản lý công việc giao hàng của tài xế nhà Bình Chiểu

Phiên bản **2.0.1** · Kho vận NutriNest · Ứng dụng web cài được lên điện thoại (PWA).
Điều phối giao việc → tài xế nhận việc, check-in, chụp ảnh → Admin xác nhận cuối → đối soát → báo cáo, kèm theo dõi hành trình trên bản đồ.

## 1. Các file trong thư mục

| File | Vai trò |
|---|---|
| `index.html` | Khung trang, giao diện NutriNest (bộ phận Kho vận), khai báo PWA |
| `geo.js` | Danh sách 63 tỉnh, quận/huyện chính, tọa độ ước lượng |
| `core.js` | Lưu trữ, đồng bộ, nâng cấp dữ liệu, thuật toán tuyến, chuẩn Excel |
| `app.js`, `views-ops.js`, `views-field.js`, `views-admin.js` | Các màn hình |
| `sw.js`, `manifest.webmanifest`, `icons/` | Cài lên màn hình chính, chạy toàn màn hình, mở được khi mất mạng |
| `version.json` | Số phiên bản mới nhất, để app báo “Có phiên bản mới” |
| `google-apps-script/Code.gs` | Code dán vào Google Apps Script: lưu dữ liệu vào Google Sheet, ảnh vào Google Drive |
| `data/seed.json` | Danh mục khách hàng nạp sẵn từ file Excel của bạn (**không đưa lên GitHub công khai**, xem mục 2) |
| `DỮ LIỆU/` | File Excel mẫu của bạn (**không đưa lên GitHub công khai**) |
| `supabase-schema.sql` | (Tùy chọn) nếu dùng Supabase thay Google Sheet |

## 2. Cài đặt lần đầu

### 2.1 Đưa app lên GitHub Pages
1. Tạo repository trên GitHub, tải toàn bộ file trong thư mục lên (file `.gitignore` đã loại sẵn `DỮ LIỆU/` và `data/seed.json`).
2. Vào **Settings → Pages**, chọn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`, bấm Save.
3. Sau 1–2 phút app chạy ở `https://<tài-khoản>.github.io/<tên-repo>/`.

> **Vì sao không đưa danh sách khách hàng lên GitHub?** Gói GitHub Pages miễn phí yêu cầu repo **công khai**, ai cũng đọc được file trong repo. Danh sách khách hàng (tên công ty, địa chỉ) nên chỉ nằm trong Google Sheet riêng tư của bạn. Vì vậy app nạp danh mục bằng **Excel In/Out** (mục 2.3). Nếu bạn dùng repo **private** (có trả phí) và muốn app tự nạp lần đầu, xóa 2 dòng cuối trong `.gitignore`.

### 2.2 Google Sheet + Google Drive
1. Tạo 1 Google Sheet mới. Chọn **Tiện ích mở rộng → Apps Script**, xóa code mẫu, dán toàn bộ `google-apps-script/Code.gs`.
2. **Đổi `TOKEN`** ở đầu file thành chuỗi bí mật của bạn (chỉ đổi trong Apps Script, không ghi vào file trên GitHub).
3. **Triển khai → Tùy chọn triển khai mới → Ứng dụng web**: thực thi với tư cách *Tôi*, quyền truy cập *Bất kỳ ai*. Cấp quyền và copy URL (`…/exec`).
4. Trong app, đăng nhập **ADMIN / PIN 1234** (đổi PIN ngay), vào **Quản trị → Đồng bộ đám mây**: chọn *Google Sheet + Google Drive*, dán URL và TOKEN, *Bật đồng bộ*, bấm **Kiểm tra kết nối**, **Lưu & kết nối**, **Đẩy toàn bộ dữ liệu + ảnh lên**.
5. Bấm **Mã kết nối cho máy khác** và gửi cho nhân sự. Trên máy họ: màn hình đăng nhập → **Kết nối dữ liệu công ty** → dán mã.

### 2.3 Nạp danh mục khách hàng, địa chỉ từ Excel
Vào **Excel In/Out → Nhập danh mục khách hàng / địa chỉ giao**, chọn **cùng lúc 2 file**: “Hạn mức giao hàng từng khách hàng.xlsx” và “Địa chỉ giao hàng.xlsx”, bấm **Nhập vào danh mục**. App tự:
- bỏ các mã nhân viên, lấy **tỉnh** và **quận/huyện** từ địa chỉ;
- lấy **hạn mức giao hàng (ngày)**, kênh bán hàng, khu vực của từng khách;
- gộp nhiều địa chỉ giao của một khách (khách nhiều điểm giao).
Bản chạy thử trên máy bạn đã có sẵn 1.856 khách hàng từ 2 file này. (App không dùng “tuyến giao”; khi chia việc, đơn được gom theo quận/huyện và tỉnh lấy từ địa chỉ.)

## 3. Nâng cấp phiên bản mà không mất dữ liệu
Dữ liệu nằm trong **bộ nhớ máy** (IndexedDB) và **Google Sheet / Drive**, tách riêng khỏi file chương trình, nên cập nhật code không xóa dữ liệu.
1. (Khuyến nghị) **Quản trị → Phiên bản & sao lưu → Sao lưu dữ liệu (JSON)**.
2. Thay file mới trong repo GitHub: tải lên đè các file `.html`, `.js`, `sw.js`, `version.json`, `google-apps-script/Code.gs` (không cần tải `.claude`). Khi phát hành bản mới, đổi số phiên bản ở cả `APP_VERSION` trong `core.js` và `version.json`.
3. Nếu `Code.gs` có thay đổi: dán vào Apps Script rồi **Triển khai → Quản lý triển khai → ✏️ → Phiên bản mới** (giữ nguyên URL, không cần dán lại URL trên các máy).
4. Điện thoại mở app có mạng sẽ hiện thanh vàng **“Có phiên bản mới – Cập nhật ngay”**. Bấm là xong.
5. Nếu cấu trúc dữ liệu đổi (số `SCHEMA_VERSION` tăng), app tự chuyển dữ liệu cũ sang cấu trúc mới ở lần mở đầu tiên và báo kết quả trên Tổng quan. Nâng từ bản 1.x lên 2.0: đơn cũ được bỏ trường thu hộ / hàng hóa, thêm hạn giao; dữ liệu mẫu cũ bị gỡ; khách hàng, tuyến, xe, nhân sự bạn tự thêm được **giữ nguyên**.
6. Có sự cố: **Khôi phục từ file sao lưu**.

## 4. Tài khoản và vai trò
Đăng nhập bằng **Mã NV + PIN** (có nút Hiện để xem PIN). App **tự ghi nhớ phiên đăng nhập** trên máy, chỉ hỏi lại khi bấm **Đăng xuất** hoặc khi PIN bị đổi.

| Vai trò | Quyền chính |
|---|---|
| Admin | Toàn quyền, **người xác nhận cuối cùng**, quản trị, nhật ký |
| Điều phối | Tạo / nhập đơn, giao việc, chuyến, **bản đồ theo dõi**, danh mục, ảnh |
| Tài xế | Chỉ thấy việc của mình: nhận chuyến, check-in, chụp ảnh |
| Kế toán | Đối soát, báo cáo, xuất Excel |

**Danh mục → Người dùng**: bảng Mã NV, Họ tên, Vai trò, Nhà máy, Bộ phận, Tài khoản (*Chưa cấp* / *Có PIN*), Trạng thái. Thêm nhân sự, sửa mọi trường (kể cả **Mã NV**; đổi mã thì app tự cập nhật các chuyến, đơn liên quan và phải cấp lại PIN), bấm **Cấp PIN / Đổi PIN** (nhập 2 lần để xác nhận). Gõ biển số xe mới ở ô “Xe mặc định” thì xe tự được thêm vào danh mục.

## 5. Quy trình làm việc
1. **Đơn giao → Nhập đơn từ Excel** (mục 6), hoặc **Tạo đơn** thủ công (gõ để tìm khách, chọn là tự điền địa chỉ, tỉnh, hạn giao).
2. **Giao việc**: chọn **một hoặc nhiều ngày** xuất phát (bỏ chọn ngày nghỉ), cho phép **giao sớm** tối đa N ngày, chọn tài xế → **Chia đều & tối ưu tuyến** → xem lại, chuyển đơn giữa tài xế / ngày nếu cần → **Xác nhận tạo chuyến**.
3. **Tài xế** (Việc của tôi): *Nhận chuyến → Bắt đầu lên hàng → Bắt đầu di chuyển → Đã đến điểm → Giao thành công (chụp ảnh, người nhận) / Không giao được → Về kho*. Mỗi bước ghi giờ chính xác đến từng giây kèm GPS.
4. **Duyệt**: Admin là người xác nhận cuối cùng (duyệt, trả lại tài xế, cho giao lại, chốt không giao).
5. **Ảnh giao**: lọc theo ngày, nhóm đơn, **mã đơn**, **khách hàng**.
6. **Đối soát**: theo tài xế và ngày — số đơn, giao thành công, số thùng, kg, tỷ lệ đúng hạn; bấm *Chốt kết quả*. (Đã bỏ thu hộ.)
7. **Báo cáo**: tỷ lệ giao thành công, đúng hạn, giao sớm, thùng, kg, theo tài xế / tỉnh, lý do không giao được.

**Lọc ngày nhanh** ở Tổng quan, Đơn giao, Chuyến giao, Ảnh giao, Đối soát, Báo cáo, Nhật ký, Việc của tôi: *Hôm qua · Hôm nay · Tuần này · Tháng này · Tùy chỉnh* (chọn từ–đến trong lịch).

**Tổng quan** có chọn **tài xế** (hoặc bấm vào thẻ tài xế) để xem tất cả chuyến của người đó, lọc theo trạng thái và từ khóa, xem từng điểm giao.

## 6. Nhập đơn từ file mẫu đơn giao
Cột nhận diện theo tên (không phân biệt hoa thường, dấu): **MÃ HÀNG, MÔ TẢ, TÊN KHÁCH HÀNG, SỐ ĐƠN HÀNG XUẤT, TÊN TÀI XẾ, MÃ ĐƠN HÀNG XUẤT, NGÀY XUẤT HÀNG THỰC TẾ, NGÀY ĐẶT HÀNG, SỐ LƯỢNG THÙNG, KG**. Cột tùy chọn: MÃ KH, ĐỊA CHỈ GIAO HÀNG, HẠN GIAO, KHUNG GIỜ, KHÔNG GIAO SỚM, GHI CHÚ. Bấm **Tải file mẫu** trong cửa sổ nhập để lấy file đúng định dạng.
- Mỗi dòng là một mặt hàng; các dòng cùng **MÃ ĐƠN HÀNG XUẤT** gộp thành **1 đơn** (cộng thùng và kg). Mã đơn này là mã duy nhất của đơn.
- **Khách hàng** khớp theo tên với danh mục (hoặc theo MÃ KH). Tên chưa có trong danh mục thì app tạo khách mới (mã KM0001…) để bạn bổ sung địa chỉ, tuyến.
- **Hạn giao = NGÀY ĐẶT HÀNG + hạn mức giao hàng của khách** (số ngày trong file “Hạn mức giao hàng”, khách chưa có thì lấy mặc định 3 ngày, đổi trong Quản trị). Có cột HẠN GIAO thì dùng cột đó.
- Nếu có cả **TÊN TÀI XẾ** (trùng tên trong app) và **NGÀY XUẤT HÀNG THỰC TẾ**, đơn được gán luôn vào chuyến của tài xế ngày đó.
- Đơn trùng mã: đơn còn “Chờ phân công” được cập nhật, đơn đã phân công / đã giao được giữ nguyên.
- Số theo kiểu Excel: dấu chấm là thập phân (126.945 kg = 126,945 kg).

## 7. Danh mục
- **Khách hàng**: lọc theo tỉnh, kênh, loại tọa độ; sửa tự do (mã, tên, nhiều địa chỉ giao, hạn mức, tọa độ…). Khách nhận hàng **trong giờ hành chính**; **không có khung giờ cố định theo khách**, khung giờ chọn theo từng đơn (Giờ hành chính, 08–10, 10–12, 13–15, 15–17…).
- **Xe**: sửa tự do biển số, loại xe, tải trọng.
- **Người dùng**: mục 4.
- **Xuất danh mục (Excel)** để lưu trữ: khách hàng, địa chỉ giao, xe, nhân sự (không gồm PIN).

## 8. Cách app tính đường đi và chia việc
- Thời gian một chuyến = lên hàng + di chuyển + giao tại điểm + quay về kho. 15 km đầu tính tốc độ nội thành, đoạn còn lại tính tốc độ liên tỉnh (chỉnh trong Quản trị).
- **Tọa độ**: khách chưa có tọa độ chính xác được ước lượng theo **quận/huyện** (TP.HCM, Bình Dương, Đồng Nai, một số quận Hà Nội) hoặc **tỉnh**. Khi tài xế bấm **Đã đến điểm** có GPS, app **tự học tọa độ chính xác** của khách; cũng có thể nhập tay trong Danh mục. Tọa độ càng chính xác, thứ tự giao càng tốt.
- **Cung đường**: khách hẹn buổi sáng trước, buổi chiều sau; trong mỗi buổi chọn đường ngắn nhất; khách nhận cả ngày chèn vào chỗ tiện đường nhất. Có nút mở Google Maps chỉ đường.
- **Cùng khu vực / tiện đường**: đơn cùng quận/huyện (hoặc cùng tỉnh) gom thành cụm và giao cho một tài xế; chỉ tách lẻ khi thời gian giữa các tài xế vẫn lệch quá 30 phút.
- **Chia đều**: tổng thời gian làm việc cả ngày của các tài xế gần bằng nhau.
- **Tải trọng**: xe đầy thì tự tách chuyến 2, 3 (về kho lấy hàng rồi đi tiếp).
- **Nhiều ngày và giao sớm**: đơn sắp hết hạn giao được giao trước. Đơn có hạn muộn hơn được **giao sớm** (tối đa N ngày) nếu cùng khu vực / tiện đường với đơn đang đi ngày đó; đơn đánh dấu **Khách không nhận sớm** thì không giao trước hạn.
- **Đơn quá xa** (mặc định hơn 250 km một chiều, chỉnh trong Quản trị) không tự xếp vì không giao kịp trong ngày; app báo riêng để xử lý bằng chuyến liên tỉnh.
- **Ghép đơn phát sinh**: tạo đơn mới mà trong ngày đã có chuyến thì app gợi ý chuyến tiện đường nhất (số phút đi thêm), kể cả chuyến đang chạy.

## 9. Theo dõi hành trình trên bản đồ (Admin, Điều phối)
Tab **Bản đồ**: chọn ngày, tài xế, chuyến để xem kho, các điểm giao (xanh = đã giao, đỏ = không giao được), tuyến kế hoạch (đường đứt), **hành trình thực tế** (đường liền) và **vị trí mới nhất** của tài xế. Từ Tổng quan hoặc Chuyến giao bấm **Hành trình** để xem một chuyến.
- GPS chỉ ghi khi chuyến đang chạy (từ *Bắt đầu lên hàng* đến *Về kho*) và **app trên điện thoại tài xế đang mở**, đã cho phép vị trí. App giữ màn hình sáng trong lúc chạy chuyến.
- Vị trí gửi về theo chu kỳ (mặc định 3 phút, chỉnh trong Quản trị). Nhanh hơn thì tốn hạn mức thời gian chạy của Google Apps Script (xem mục 10).
- Cần bản đồ cập nhật theo từng giây hoặc nhiều tài xế: dùng Supabase thay Google Sheet.

## 10. Dung lượng, lưu trữ và nâng cấp
**Quản trị → Dung lượng đang sử dụng** hiển thị: bộ nhớ thiết bị, dung lượng từng loại dữ liệu, ảnh, ước tính tốc độ tăng; bấm **Kiểm tra dung lượng Google Sheet / Drive** để xem số ô Google Sheet (giới hạn 10 triệu ô mỗi file), ảnh trên Drive và dung lượng Drive còn lại. Mục **Hướng dẫn nâng cấp dung lượng** ngay bên dưới gồm:
- Thiết bị đầy → xác nhận chỉ giữ 1–3 tháng gần nhất trên app.
- Google Drive đầy → nâng cấp **Google One** (hoặc Google Workspace), app tự lưu tiếp.
- Google Sheet gần đầy → tạo file Sheet mới cho năm mới, dán lại Code.gs, đẩy dữ liệu; file cũ giữ làm kho lưu trữ.
- Nhiều tài xế hoặc cần thời gian thực → chuyển sang Supabase.

**Thời hạn lưu trữ**: Admin xác nhận để app chỉ giữ dữ liệu 3 tháng (chọn 1–12 tháng). Dữ liệu cũ chỉ bị **gỡ khỏi app trên các máy**; **Google Sheet và ảnh trên Drive vẫn giữ nguyên đầy đủ**.

**Hạn mức Google Apps Script**: có giới hạn tổng thời gian chạy mỗi ngày (tài khoản Gmail thường khoảng 90 phút, Workspace khoảng 6 giờ). Mỗi lần đồng bộ tốn một ít, nên với khoảng 20–30 tài xế chạy cả ngày, hãy tăng chu kỳ gửi GPS hoặc chuyển sang Supabase.

## 11. Quy ước hiển thị và bảo mật
- Số: dấu chấm ngăn phần nghìn và triệu, dấu phẩy là thập phân (`12.450 kg`, `98,6%`); ngày `dd/mm/yyyy`; giờ `hh:mm`. Các ô nhập số tự định dạng khi rời ô.
- Giai đoạn này dùng PIN nội bộ và TOKEN chung. Ai có TOKEN đều đọc / ghi được dữ liệu, nên chỉ gửi mã kết nối cho nhân viên, đổi TOKEN khi có người nghỉ việc (rồi dán lại mã kết nối mới trên các máy).
- Đổi PIN mặc định của ADMIN ngay lần đầu đăng nhập.

## 12. Lộ trình sau
- Nối hệ thống bán hàng / kế toán / kho qua Excel chuẩn, sau đó qua API.
- Tối ưu tuyến theo giao thông thực tế (Google Routes / OSRM), thông báo đẩy cho tài xế.
- Đăng nhập bằng tài khoản Google / Supabase Auth, phân quyền dữ liệu ở máy chủ.
