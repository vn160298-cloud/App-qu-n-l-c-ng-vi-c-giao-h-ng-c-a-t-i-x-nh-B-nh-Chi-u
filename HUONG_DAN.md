# App quản lý công việc giao hàng của tài xế nhà Bình Chiểu

Ứng dụng web cài được lên điện thoại (PWA): điều phối giao việc → tài xế nhận việc & check-in → Admin xác nhận cuối → đối soát → báo cáo. Chạy độc lập, không cần cài phần mềm.

## 1. Cấu trúc file

| File | Vai trò |
|---|---|
| `index.html` | Giao diện, kiểu dáng, khai báo PWA |
| `core.js` | Lưu trữ, đồng bộ đám mây, phân quyền, nhật ký, thuật toán tuyến & chia việc, chuẩn Excel |
| `app.js` | Các màn hình và thao tác |
| `sw.js`, `manifest.webmanifest`, `icons/` | Giúp app cài lên màn hình chính, chạy toàn màn hình, mở được khi mất mạng |
| `google-apps-script/Code.gs` | Code dán vào Google Apps Script: lưu dữ liệu vào Google Sheet, ảnh vào Google Drive |
| `supabase-schema.sql` | (Tùy chọn) Lệnh tạo bảng nếu dùng Supabase |
| `README.md`, `.nojekyll` | Dùng khi đưa code lên GitHub Pages |

## 2. Lưu trữ dữ liệu trên Google Sheet + Google Drive (đang dùng)

Toàn bộ dữ liệu được lưu vào **1 file Google Sheet**. Mỗi bảng nằm trên 1 sheet riêng, tên cột đặt theo chuẩn Excel In/Out:
`DON_HANG`, `CHUYEN_GIAO`, `KHACH_HANG`, `TUYEN`, `XE`, `NHAN_SU`, `DOI_SOAT`, `NHAT_KY`, `CAI_DAT`, `ANH`.
- 4 cột đầu của mỗi sheet là `ID`, `COLL`, `UPDATED_AT`, `DELETED`. Đây là các cột dùng để đồng bộ, **không sửa tay**.
- Cột cuối `DATA_JSON` chứa bản ghi đầy đủ. App đọc lại dữ liệu từ cột này.
- **Ảnh** giao hàng được lưu vào Google Drive, trong thư mục `GiaoHang_BinhChieu_AnhGiaoHang/yyyy-mm`. Sheet `ANH` ghi mã đơn, ngày, loại ảnh, **link ảnh** và FILE_ID. Ảnh ở chế độ riêng tư (chỉ chủ Google Drive mở được), app lấy ảnh qua Apps Script.
- Google Sheet + Drive là **kho lưu trữ đầy đủ, không bao giờ bị app xóa**. Lệnh xóa trong app chỉ đánh dấu `DELETED = TRUE`, dòng vẫn còn.

### Cài đặt (khoảng 10 phút)
1. Vào Google Drive, tạo 1 **Google Sheet** mới, ví dụ đặt tên *Dữ liệu giao hàng Bình Chiểu*.
2. Trong file Sheet, chọn **Tiện ích mở rộng → Apps Script**. Xóa code mẫu, dán toàn bộ nội dung file `google-apps-script/Code.gs` vào.
3. **Đổi `TOKEN`** ở đầu file thành một chuỗi bí mật của bạn, ví dụ `BinhChieu-2026-x7Kq`. Bấm 💾 để lưu.
4. Bấm **Triển khai → Tùy chọn triển khai mới**, chọn loại **Ứng dụng web**, rồi chọn:
   *Thực thi với tư cách: **Tôi*** và *Người có quyền truy cập: **Bất kỳ ai***. Bấm **Triển khai** và cấp quyền truy cập Sheet và Drive.
5. Copy **URL ứng dụng web** (có dạng `https://script.google.com/macros/s/…/exec`).
6. Trong app, đăng nhập Admin, vào **Cài đặt → Đồng bộ đám mây**:
   - Chọn nơi lưu trữ **Google Sheet + Google Drive**, dán URL và TOKEN, chọn *Bật đồng bộ*.
   - Bấm **Kiểm tra kết nối**, rồi **Lưu & kết nối**, rồi **Đẩy toàn bộ dữ liệu + ảnh lên** (chỉ cần làm lần đầu).
7. Bấm **🔗 Mã kết nối cho máy khác** và gửi mã cho tài xế. Trên máy tài xế, vào **Cài đặt → Kết nối**, dán mã rồi bấm Kết nối.

Mỗi khi sửa Code.gs, vào **Triển khai → Quản lý triển khai → ✏️ → Phiên bản: Phiên bản mới**. Cách này giữ nguyên URL.

**Giới hạn của Google Sheet:** app tự đồng bộ khoảng mỗi 20 giây. Google Sheet chậm hơn cơ sở dữ liệu thật, nhưng đủ dùng cho khoảng 10–20 tài xế và dữ liệu 3 tháng. Mỗi file Sheet chứa tối đa 10 triệu ô. Ảnh tính vào dung lượng Google Drive (gói miễn phí có 15GB, mỗi ảnh khoảng 150KB).
Nếu sau này quy mô lớn hơn, có thể chuyển sang **Supabase**: app vẫn hỗ trợ, chọn ở cùng màn hình cài đặt và dùng file `supabase-schema.sql`.

## 2b. Xác nhận app chỉ giữ dữ liệu 3 tháng (Google Sheet & Drive vẫn giữ đủ)
- Vào **Cài đặt → Thời hạn lưu trữ dữ liệu** (chỉ Admin). Mặc định là **3 tháng gần nhất**, có thể đổi thành 1, 2, 6 hoặc 12 tháng.
- App hiển thị số đơn, ảnh, chuyến, đối soát và nhật ký cũ hơn mốc. Trang Tổng quan của Admin cũng có nhắc nhở khi có dữ liệu cũ.
- Admin bấm **Xác nhận app chỉ giữ dữ liệu 3 tháng gần nhất**. App hỏi xác nhận rồi yêu cầu gõ chữ `XOA`. Sau đó:
  1. App kiểm tra mọi dữ liệu cũ **đã lên Google Sheet**. Nếu còn dữ liệu chưa gửi được (ví dụ do mất mạng), app dừng lại và **không xóa gì**.
  2. Dữ liệu và ảnh cũ bị **gỡ khỏi app** trên máy Admin. Các máy tài xế và nhân viên tự gỡ ở lần đồng bộ kế tiếp. Nhờ vậy điện thoại nhẹ và chạy nhanh hơn.
  3. **Google Sheet và ảnh trên Google Drive giữ nguyên đầy đủ.** Muốn xem lại đơn, ảnh hay đối soát cũ, mở thẳng Google Sheet: sheet `ANH` có link từng ảnh.
  4. Muốn có thêm bản Excel trên máy thì tick ô *Xuất thêm file Excel dữ liệu cũ*.
- Dữ liệu cũ đã gỡ sẽ không bị tải lại vào app, kể cả trên máy mới kết nối.
- **Danh mục** (khách hàng, tuyến, xe, người dùng) luôn được giữ trong app.
- Thao tác xác nhận được ghi vào Nhật ký.
- Nếu chưa bật Google Sheet, app bắt buộc xuất file Excel lưu trữ trước khi gỡ, và ảnh cũ sẽ mất. Vì vậy nên bật Google Sheet trước.
- Lâu dài, sau vài năm nếu Google Sheet quá lớn, có thể tạo file Sheet mới cho năm mới: chỉ cần triển khai Code.gs trên file mới rồi gửi mã kết nối mới.

## 3. Chạy app trên GitHub Pages & cài lên điện thoại
1. Tạo repository trên GitHub, ví dụ `giaohang-binhchieu`, ở chế độ Public (GitHub Pages miễn phí chỉ dùng được với repo Public). Tải toàn bộ file trong thư mục lên. Không cần tải thư mục `.claude`.
2. Vào **Settings → Pages**. Chọn **Source: Deploy from a branch**, **Branch: main / (root)**, rồi bấm **Save**.
3. Sau khoảng 1–2 phút, app chạy ở `https://<tài-khoản>.github.io/giaohang-binhchieu/`.
4. Gửi link cho tài xế:
   - **iPhone (Safari):** bấm nút Chia sẻ ⬆, chọn **Thêm vào MH chính**.
   - **Android (Chrome):** bấm ⋮, chọn **Cài đặt ứng dụng / Thêm vào màn hình chính**.
5. Khi cập nhật code, chỉ cần đẩy file mới lên GitHub. Lần mở app kế tiếp sẽ tự lấy bản mới.

> ⚠ **Bảo mật:** repo Public thì ai cũng xem được code, nhưng **không** xem được dữ liệu, vì dữ liệu nằm trong Google Sheet của bạn và cần TOKEN mới truy cập được. Tuyệt đối **không ghi TOKEN thật vào file Code.gs trên GitHub**, chỉ đổi TOKEN trong bản Code.gs nằm trên Google Apps Script.


## 4. Tài khoản mẫu (PIN mặc định `1234`, hãy đổi ngay)
| Mã | Vai trò | Quyền chính |
|---|---|---|
| AD01 | Admin | Toàn quyền, **người xác nhận cuối cùng**, quản lý người dùng, cài đặt, nhật ký |
| DP01 | Điều phối | Tạo đơn, giao việc, chuyến, lịch, ảnh, danh mục, Excel |
| KT01 | Kế toán | Đối soát thu hộ, báo cáo, xuất Excel |
| TX01–TX04 | Tài xế | Chỉ thấy việc của mình: nhận chuyến, check-in, chụp ảnh, ghi tiền thu hộ |

## 5. Quy trình làm việc
1. **Tạo đơn** (Đơn giao → ＋ Tạo đơn, hoặc nhập Excel). Chọn **mã khách hàng** thì app tự điền tên, SĐT, địa chỉ, tuyến, khung giờ. Mỗi đơn có mã duy nhất `DHyymmdd-###`.
2. **Giao việc** → chọn ngày xuất phát & giờ đi → **⚖️ Chia đều & tối ưu tuyến**. App chia đơn sao cho tổng thời gian của các tài xế gần bằng nhau, rồi sắp cung đường tốt nhất cho từng người. Có thể chuyển đơn qua lại giữa các tài xế, sau đó bấm **Xác nhận tạo chuyến**. Mỗi đơn gắn với 1 tài xế và 1 chuyến `CHyymmdd-##`.
3. **Tài xế** (Việc của tôi) bấm lần lượt: *Nhận chuyến → Bắt đầu lên hàng → Bắt đầu di chuyển → Đã đến điểm → Giao thành công (chụp ảnh + ghi tiền thu hộ) / Không giao được → Về kho*. Mỗi lần bấm ghi **giờ chính xác đến từng giây** kèm vị trí GPS. Ảnh được đóng dấu mã đơn, thời gian và tên tài xế.
4. **Duyệt**: Admin là người xác nhận cuối cùng (app gợi ý Admin). Admin có thể duyệt hoàn tất, trả lại tài xế, cho giao lại hoặc chốt không giao.
5. **Ảnh giao**: lọc đơn đã giao / chưa giao / thiếu ảnh và tải ảnh check-in lên.
6. **Lịch**: lịch tháng, bảng lịch theo ngày xuất phát và biểu đồ thời gian (kế hoạch so với thực tế).
7. **Đối soát**: so tiền phải thu, tài xế báo đã thu và tiền nộp về, rồi chốt theo từng tài xế.
8. **Báo cáo**: tỷ lệ giao thành công, tỷ lệ đúng khung giờ, thời gian tại điểm, thời gian làm việc thực tế/kế hoạch, lý do thất bại.
9. **Nhật ký**: mọi thao tác đều ghi lại người làm, giờ, nội dung và GPS.

## 6. Chuẩn Excel In/Out
Tên sheet và cột cố định (IN HOA, không dấu): `DON_HANG`, `CHUYEN_GIAO`, `KHACH_HANG`, `TUYEN`, `XE`, `NHAN_SU`, `DOI_SOAT`, `NHAT_KY`, `MO_TA_COT`.
Khóa liên kết: `MA_DON`, `MA_KH`, `MA_TAI_XE`, `MA_CHUYEN`. Vào **Excel In/Out → Tải file mẫu nhập liệu** để lấy mẫu. Khi nhập đơn chỉ cần `NGAY_GIAO` + `MA_KH`, app tự điền phần còn lại.

## 7. Cách app tính tuyến & chia việc
- Thời gian 1 chuyến = lên hàng + di chuyển (khoảng cách × hệ số đường phố ÷ tốc độ trung bình) + thời gian giao tại điểm + quay về kho. Các thông số chỉnh trong **Cài đặt**.
- Cung đường: khách hẹn buổi sáng đi trước, buổi chiều đi sau. Trong mỗi buổi, app dùng thuật toán điểm gần nhất kết hợp 2-opt để chọn đường ngắn nhất. Khách nhận "Cả ngày" được chèn vào vị trí ít tốn đường nhất. Bấm **Chỉ đường Google Maps** để mở cả tuyến.
- Muốn tính chính xác, khách hàng cần có **tọa độ** (Danh mục → Khách hàng → Lấy tọa độ). Khách chưa có tọa độ được tính tạm 12 phút di chuyển.

## 8. Lộ trình các giai đoạn sau
- Nối hệ thống bán hàng / kế toán / kho qua Excel chuẩn, sau đó qua API của Supabase.
- Theo dõi GPS liên tục trên bản đồ và tối ưu tuyến theo giao thông thực tế (Google Routes API / OSRM).
- Đăng nhập bằng tài khoản Google / Supabase Auth và phân quyền dữ liệu ở máy chủ.
- Gửi thông báo đẩy cho tài xế khi có chuyến mới.

> Lưu ý bảo mật: giai đoạn 1 dùng PIN nội bộ và TOKEN chung, phù hợp dùng trong nội bộ. Ai có TOKEN đều đọc/ghi được dữ liệu, nên chỉ đưa mã kết nối cho nhân viên và đổi TOKEN khi có người nghỉ việc. Khi đổi TOKEN, cần dán lại mã kết nối mới trên mọi máy.
