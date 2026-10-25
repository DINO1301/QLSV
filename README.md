# 🎓 HỆ THỐNG QUẢN LÝ SINH VIÊN QLSV

Hệ thống quản lý sinh viên hiện đại, giao diện giống Excel, sử dụng React + Vite + Supabase.

## 🚀 Tính năng chính

✅ 17 tính năng đã được xây dựng đầy đủ:

| # | Tính năng | Trạng thái |
|---|---|---|
| 1 | Trang đăng nhập (Supabase Auth) | ✅ |
| 2 | Quên mật khẩu / Reset mật khẩu | ✅ |
| 3 | Dashboard biểu đồ + thống kê (Chart.js) | ✅ |
| 4 | Quản lý lớp học (CRUD + card responsive) | ✅ |
| 5 | **Bảng sinh viên GIỐNG EXCEL** (AG Grid) | ✅ |
| 6 | Thêm / Sửa / Xóa / Sắp xếp cột linh hoạt (5 kiểu dữ liệu) | ✅ |
| 7 | Cảnh báo 3 cấp độ (Xanh 🟩 / Vàng 🟨 / Đỏ 🟥) | ✅ |
| 8 | Bộ lọc cảnh báo theo lớp, cấp độ, ngày, từ khoá | ✅ |
| 9 | Import Excel 5 bước (map cột, preview, validate) | ✅ |
| 10 | Export Excel (toàn bộ / theo cảnh báo) | ✅ |
| 11 | Lịch sử chỉnh sửa chi tiết (old_data vs new_data) | ✅ |
| 12 | Quản lý tài khoản (CRUD, khóa/mở khóa) | ✅ |
| 13 | **Phân quyền USER theo từng lớp** (Xem / Sửa riêng) | ✅ |
| 14 | Supabase Row Level Security (RLS) bảo mật DB | ✅ |
| 15 | Trigger tự động log hoạt động + tạo profile | ✅ |
| 16 | Responsive (mobile, tablet, desktop) | ✅ |
| 17 | Giao diện tiếng Việt, toast + confirm dialog | ✅ |

---

## 🏗️ Công nghệ sử dụng

**Frontend:**
- React 18 + Vite 5
- TailwindCSS 3 (xanh navy chủ đạo)
- React Router v6
- **AG Grid Community** (bảng giống Excel, inline edit, copy/paste, sort, filter, pivot...)
- Chart.js (biểu đồ thống kê)
- SheetJS (xlsx) - Import/Export Excel

**Backend (tất cả trên Supabase):**
- Supabase Authentication (Email/Password, Reset password)
- PostgreSQL Database (7 bảng: profiles, classes, students, custom_columns, custom_values, class_permissions, activity_logs)
- **Row Level Security (RLS):** 7 helper functions (is_admin, can_edit_class, ...) + 20+ policies
- PostgreSQL Trigger: tự động tạo profile, log hoạt động, cập nhật `updated_at`

---

## 📦 CÀI ĐẶT VÀ CHẠY (bước thực hiện)

### Bước 1: Cài packages

```bash
npm install
```

### Bước 2: Tạo tài khoản Supabase & cấu hình

1. Đăng ký miễn phí tại https://supabase.com/
2. Tạo project mới (Region: Singapore là gần nhất)
3. Chờ ~2 phút để Supabase khởi tạo xong
4. Vào **Project Settings → API**: sao chép
   - `Project URL` (ví dụ: `https://abcd1234.supabase.co`)
   - `Project API keys → anon public`
5. Mở file `.env` ở project root, dán vào:
```env
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....
```

### Bước 3: Chạy file SQL tạo database & RLS

Mở **Supabase → SQL Editor → New Query**, chạy **đúng thứ tự** 4 file trong thư mục `supabase/`:

| # | File | Mục đích |
|---|---|---|
| 1 | `01_init_schema.sql` | Tạo 7 bảng, indexes, ENUM types |
| 2 | `02_rls_policies.sql` | ✅ RLS Policies + 7 hàm phân quyền (QUAN TRỌNG) |
| 3 | `03_functions_triggers.sql` | Trigger auto profile, auto log, updated_at |
| 4 | `04_seed.sql` | Dữ liệu mẫu (4 lớp, cột tùy chỉnh, 18 sinh viên) |

> 💡 **Lưu ý seed:** File seed tạo sinh viên mẫu cho lớp `CNTT01`. Nếu chưa có ADMIN thì tạo user trước (xem bước 4).

### Bước 4: Tắt xác nhận Email (tạo user nhanh)

Vào **Supabase → Authentication → Providers → Email**:
- Tắt `Confirm email` (Enable email confirmations = **OFF**)
- Save

Đây là môi trường dev/prototype. Production nên bật lại để bảo mật.

### Bước 5: Tạo ADMIN đầu tiên

- Chạy project:
```bash
npm run dev
```

- Mở trình duyệt (thường là http://localhost:5173)
- Vào `/login` → nhấn **"Đăng ký"** (hoặc dùng đường link tạo tài khoản qua Supabase Auth).
  - **Cách đơn giản hơn:** Mở tab Sign up trên Supabase Auth UI tạo user.
  - User **đầu tiên** được tạo tự động có `role = 'admin'`.
  - Các user tiếp theo mặc định là `role = 'user'` (phải được admin cấp quyền).

> 🎯 Hoặc tạo nhanh qua Supabase: Authentication → Users → **Add user** → Create new user → email: `admin@qlsv.com`, password: `Admin@123`.

### Bước 6: Kiểm tra hoạt động

1. **Đăng nhập** bằng ADMIN
2. Mở **Dashboard** xem thống kê (đã có dữ liệu mẫu nếu chạy seed)
3. Mở **Quản lý lớp** → vào lớp CNTT01 → bảng Excel hiện ra:
   - Nhấp **đúp** chuột vào ô để sửa → Enter lưu
   - Chọn nhiều dòng = checkbox
   - Thêm cột mới: nút **📋 Quản lý cột**
4. Mở **Import Excel**: upload file .xlsx mẫu, map cột, preview và import
5. Mở **Cảnh báo sinh viên**: bộ lọc, export
6. Mở **Quản lý tài khoản**: tạo user, vào 🔑 Phân quyền cho lớp CNTT02 (chỉ xem)

---

## 📐 Cấu trúc thư mục

```
QLSV/
├── supabase/
│   ├── 01_init_schema.sql       ← Tạo bảng
│   ├── 02_rls_policies.sql      ← RLS + phân quyền
│   ├── 03_functions_triggers.sql ← Trigger
│   └── 04_seed.sql              ← Dữ liệu mẫu
├── src/
│   ├── components/
│   │   ├── Layout/ (Sidebar, Header, MainLayout)
│   │   ├── UI/ (Button, Input, Select, Card, Modal, Skeleton, Toast...)
│   │   └── DataTable/
│   │       ├── ExcelTable.jsx      ← AG Grid wrapper (CORE)
│   │       ├── ColumnManager.jsx   ← Quản lý cột
│   │       └── WarningBadge.jsx
│   ├── pages/
│   │   ├── Login.jsx, ForgotPassword.jsx, ResetPassword.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Classes.jsx, Students.jsx
│   │   ├── Warnings.jsx, ImportExcel.jsx
│   │   ├── ActivityLogs.jsx, Users.jsx, Settings.jsx
│   ├── services/ (supabaseClient, auth, class, student, column, user, permission, log, excel)
│   ├── contexts/ (AuthContext, ToastContext)
│   ├── utils/ (constants, helpers)
│   ├── styles/index.css
│   ├── App.jsx, main.jsx
│   └── ProtectedRoute.jsx
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── postcss.config.js
```

---

## 🔐 Row Level Security hoạt động

Hệ thống **KHÔNG** chỉ ẩn menu bằng React. Tất cả truy vấn đều được Supabase RLS kiểm tra trên database.

Ví dụ RLS `students`:
```sql
-- USER chỉ xem sinh viên của lớp được cấp quyền can_view
CREATE POLICY students_select ON students FOR SELECT USING (
  class_id IN (SELECT my_viewable_classes())
);
-- USER chỉ sửa được lớp có can_edit = true
CREATE POLICY students_update ON students FOR UPDATE USING (
  class_id IN (SELECT my_editable_classes())
);
```

Nếu USER cố gọi trực tiếp API lấy lớp CNTT03 (chưa được cấp quyền), Supabase sẽ trả về mảng rỗng `[]` dù có gọi đúng URL.

---

## 🚀 Deploy Frontend

### Deploy lên Vercel (khuyến nghị)

1. Push code lên GitHub / GitLab
2. Vào vercel.com → Add new → Project → import repo này
3. Trong phần **Environment Variables**, thêm 2 biến:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy → Vercel tự build và ra URL như `https://qlsv-tenban.vercel.app`

### Deploy lên Netlify

Tương tự Vercel:
- Build command: `npm run build`
- Publish directory: `dist`
- Thêm 2 env variables giống Vercel.

### Cấu hình Supabase cho production

Trước khi public, cần:
1. Authentication → URL Configuration → thêm Vercel/Netlify URL vào:
   - `Site URL` và `Redirect URLs`
   - Ví dụ: `https://qlsv-tenban.vercel.app/**`
2. Bật lại `Email Confirmations` nếu cần bảo mật user
3. Vào Storage → tạo bucket `excel-files` (nếu cần lưu file import/export lâu dài)

---

## 📊 Cách test 3 luồng quan trọng

### A - Test Phân quyền theo lớp
1. Admin tạo 1 user `teacher@qlsv.com`
2. Vào **Quản lý tài khoản → 🔑 Phân quyền**
   - CNTT01: ☑️ Xem + ☑️ Sửa
   - CNTT02: ☑️ Xem (KHÔNG sửa)
3. Đăng nhập bằng teacher → Sidebar chỉ hiện mục user được phép
   - Vào lớp CNTT01: sửa được ô, thêm sinh viên
   - Vào lớp CNTT02: ô chỉ đọc, không hiện nút Thêm / Xóa

### B - Test bảng Excel
- Double-click ô `Điểm TB` thay `8.5` → `7.5` → Enter → Toast "Đã lưu"
- Trang **Activity Logs** tự động có dòng "Cập nhật sinh viên" → xem chi tiết old (8.5) → new (7.5)

### C - Test Import
- Tạo file Excel `sv.xlsx` với các cột: `Mã SV, Họ tên, Ngày sinh, Điểm TB`
- Vào Import Excel → chọn lớp CNTT02 → upload → step 3 map cột tự động → Preview (đánh dấu OK/lỗi) → nhập
- Vào lớp CNTT02 thấy dữ liệu vừa import

---

## ❌ Lỗi thường gặp

| Lỗi | Cách fix |
|---|---|
| `FetchError: Failed to fetch` | Kiểm tra VITE_SUPABASE_URL và Anon Key trong `.env` |
| `403 RLS policy` | Chưa chạy file `02_rls_policies.sql` trên Supabase |
| `500 null value in column "id"` | Trigger tạo profile chưa chạy → chạy `03_functions_triggers.sql` |
| Đăng nhập nhưng không vào được | Kiểm tra profile.status của user có bị 'locked' không |
| Bảng Excel không load | Mở DevTools → Console xem lỗi Supabase (thường là custom columns trả về rỗng OK, lỗi policy thì cần chạy lại SQL) |

---

## 🎯 Scripts

```bash
npm run dev       # Chạy local development
npm run build     # Build production ra thư mục dist/
npm run preview   # Xem thử build local
```

---

© 2026 - QLSV Student Management System - Học làm React + Supabase

--
m csdl : hieu104369@ 
