# App quản lý công việc giao hàng của tài xế nhà Bình Chiểu

Ứng dụng web cài được lên điện thoại (PWA) cho Kho vận NutriNest: giao việc cho tài xế, check-in giao hàng, theo dõi hành trình trên bản đồ, Admin duyệt, đối soát và báo cáo.
App chạy trên **GitHub Pages**. Dữ liệu lưu trên **Google Sheet**, ảnh giao hàng lưu trên **Google Drive**. Admin xác nhận để app **chỉ giữ dữ liệu 3 tháng** trên các máy, còn Google Sheet và Drive vẫn lưu đầy đủ.

👉 Hướng dẫn đầy đủ: [HUONG_DAN.md](HUONG_DAN.md)

## Chạy trên GitHub Pages
1. Tạo repository mới trên GitHub, tải toàn bộ file trong thư mục này lên (trừ `.claude`; `.gitignore` đã loại sẵn dữ liệu khách hàng).
2. **Settings → Pages**: *Deploy from a branch*, nhánh `main`, thư mục `/ (root)`, Save.
3. Sau 1–2 phút app chạy ở `https://<tên-tài-khoản>.github.io/<tên-repo>/`. Mở trên điện thoại rồi chọn **Thêm vào màn hình chính**.

## Kết nối Google Sheet
Làm theo phần đầu file [`google-apps-script/Code.gs`](google-apps-script/Code.gs), rồi dán URL và TOKEN vào app ở **Quản trị → Đồng bộ đám mây**.

> Không đưa TOKEN thật hoặc danh sách khách hàng (`DỮ LIỆU/`, `data/seed.json`) lên GitHub công khai.

## Cập nhật phiên bản
Tải file mới lên đè trong repo, đổi số phiên bản trong `core.js` (`APP_VERSION`) và `version.json`. Dữ liệu không bị ảnh hưởng; điện thoại sẽ hiện nút **Cập nhật ngay**.
