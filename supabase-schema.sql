-- =====================================================================
-- App quản lý công việc giao hàng của tài xế nhà Bình Chiểu
-- Bảng đồng bộ dữ liệu trên Supabase (chạy 1 lần trong SQL Editor)
-- =====================================================================

create table if not exists public.bc_records (
  coll        text        not null,              -- users | customers | routes | vehicles | orders | trips | logs | settlements | settings | photos
  id          text        not null,              -- mã duy nhất (VD: DH251030-001, CH251030-01, KH001, TX01)
  data        jsonb       not null,
  deleted     boolean     not null default false,
  updated_at  timestamptz not null default now(), -- do máy chủ đặt → làm mốc đồng bộ
  primary key (coll, id)
);

create index if not exists bc_records_updated_idx on public.bc_records (updated_at);

-- Máy chủ luôn tự đặt updated_at (không phụ thuộc giờ điện thoại)
create or replace function public.bc_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists bc_touch on public.bc_records;
create trigger bc_touch before insert or update on public.bc_records
for each row execute function public.bc_touch();

-- Giai đoạn 1: app dùng anon key + PIN nội bộ.
-- Bật RLS và cho phép anon đọc/ghi bảng này (KHÔNG xóa được).
alter table public.bc_records enable row level security;

drop policy if exists bc_read on public.bc_records;
drop policy if exists bc_insert on public.bc_records;
drop policy if exists bc_update on public.bc_records;
create policy bc_read   on public.bc_records for select to anon using (true);
create policy bc_insert on public.bc_records for insert to anon with check (true);
create policy bc_update on public.bc_records for update to anon using (true) with check (true);

-- Giai đoạn sau (khuyến nghị): chuyển sang Supabase Auth, tách bảng orders/trips riêng,
-- lưu ảnh vào Supabase Storage và giới hạn quyền theo vai trò bằng RLS.
