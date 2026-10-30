# App quản lý công việc giao hàng của tài xế nhà Bình Chiểu

Đây là ứng dụng web cài được lên điện thoại (PWA), dùng cho các việc: giao việc cho tài xế, check-in giao hàng, Admin duyệt, đối soát và báo cáo.
App chạy trên **GitHub Pages**. Dữ liệu lưu trên **Google Sheet**, ảnh giao hàng lưu trên **Google Drive**. Admin xác nhận để app **chỉ giữ dữ liệu 3 tháng** trên các máy, còn Google Sheet và Drive vẫn lưu đầy đủ.

👉 Hướng dẫn đầy đủ nằm trong [HUONG_DAN.md](HUONG_DAN.md).

## Chạy trên GitHub Pages
1. Tạo repository mới trên GitHub, ví dụ `giaohang-binhchieu`, rồi tải toàn bộ file trong thư mục này lên.
2. Vào **Settings → Pages**. Ở mục **Source** chọn *Deploy from a branch*. Ở mục **Branch** chọn `main` và `/ (root)`, rồi bấm **Save**.
3. Chờ khoảng 1–2 phút, app sẽ chạy ở địa chỉ `https://<tên-tài-khoản>.github.io/giaohang-binhchieu/`.
4. Mở link đó trên điện thoại, rồi chọn **Thêm vào màn hình chính**.

## Kết nối Google Sheet
Làm theo phần hướng dẫn ở đầu file [`google-apps-script/Code.gs`](google-apps-script/Code.gs). Sau đó dán URL và TOKEN vào app ở mục **Cài đặt → Đồng bộ đám mây**.

> ⚠ Không đưa TOKEN thật lên GitHub. Chỉ đổi TOKEN trong bản Code.gs nằm trên Google Apps Script.
