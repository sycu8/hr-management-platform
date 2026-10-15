# HR Management Platform

**Hệ thống quản lý nhân sự nội bộ** cho doanh nghiệp Việt Nam — dùng tại [hrm.orangecloud.vn](https://hrm.orangecloud.vn).

Tài liệu này viết cho **lãnh đạo / CEO** (không cần nền tảng kỹ thuật) và cho đội kỹ thuật khi triển khai.

---

## Hệ thống này làm gì?

Thay cho nhiều file Excel / email rời rạc, nền tảng gom **toàn bộ vòng đời nhân sự** vào một cổng web:

| Nhóm nghiệp vụ | Việc lãnh đạo / HR thấy được |
| --- | --- |
| **Bảng điều khiển** | Tổng quan headcount, cảnh báo, sự kiện sắp tới |
| **Nhân viên** | Hồ sơ, hợp đồng, lịch sử công việc, tài liệu |
| **Tuyển dụng** | Đăng JD, theo dõi ứng viên, onboarding |
| **Nghỉ phép & chấm công** | Đăng ký phép, số dư, chấm công, lịch team |
| **Công tác & công tác phí** | Đề nghị → duyệt → tạm ứng → quyết toán (có định mức) |
| **Lương & phúc lợi** | Bảng lương tháng, phụ cấp/thưởng, BHXH/BHYT |
| **Hiệu suất** | Chu kỳ đánh giá, KPI/OKR, 360°, lịch sử |
| **Đào tạo** | Khóa học, tiến độ, chứng chỉ, lộ trình nghề |
| **Chính sách nội bộ** | Quy định, SOP, văn bản pháp lý tham chiếu |
| **Quản trị** | Phân quyền tài khoản, bảo mật, xuất dữ liệu |

Giao diện tiếng Việt; tiền tệ VND; múi giờ Việt Nam.

---

## Vì sao chọn kiến trúc này? (góc nhìn CEO)

Hãy nghĩ hệ thống như một **tòa nhà văn phòng số**:

```text
  Nhân viên / HR / Kế toán
           │
           ▼
   ┌───────────────────┐
   │  Cổng web (giao diện)  │  ← màn hình mọi người dùng mỗi ngày
   └─────────┬─────────┘
             │
             ▼
   ┌───────────────────┐
   │  Bộ não trung tâm (API) │  ← kiểm tra quyền, tính toán nghiệp vụ
   └─────────┬─────────┘
             │
     ┌───────┼───────┬──────────┐
     ▼       ▼       ▼          ▼
  Cơ sở    Kho tệp  Hàng đợi   Email /
  dữ liệu  (PDF…)   việc nền   lịch tự động
```

| Phần | Ví dụ đời thường | Vai trò trong dự án |
| --- | --- | --- |
| **Cổng web** | Quầy lễ tân + form | React — màn hình tiếng Việt |
| **API** | Quy trình nội bộ “ai được làm gì” | Cloudflare Worker + Hono |
| **Cơ sở dữ liệu** | Sổ cái chính thức | Cloudflare D1 (SQL) |
| **Kho tệp** | Tủ hồ sơ / kho chứng từ | Cloudflare R2 (hợp đồng, xuất báo cáo) |
| **Bộ nhớ tạm** | Giấy nhớ / cache | Cloudflare KV |
| **Hàng đợi** | Hộp việc “làm sau” | Queues (gửi mail, job nặng) |
| **Lịch tự động** | Lịch nhắc hàng ngày | Cron (nhắc việc, kiểm tra hạn) |
| **Email** | Phòng thư | Cloudflare Email |
| **Chống bot** | Bảo vệ form công khai | Turnstile (khi bật) |

**Lợi ích kinh doanh:**

1. **Một nền tảng đám mây** (Cloudflare) — ít máy chủ tự quản, scale theo lưu lượng.  
2. **Triển khai gần người dùng toàn cầu** — mở app nhanh, kể cả ngoài văn phòng.  
3. **Phân quyền thật trên máy chủ** — không tin nút “chọn vai trò” phía trình duyệt.  
4. **Số liệu lương / công tác phí được khóa bằng kiểm thử tự động** — thay đổi công thức phải được duyệt, tránh lệch số tiền.  
5. **Tham số lương có cổng pháp lý** — chỉ đóng bảng lương thanh toán khi tham số đã được review.

---

## Ai dùng hệ thống? (3 loại tài khoản)

| Loại | Ai thường dùng | Quyền chính |
| --- | --- | --- |
| **Super Admin** | Chủ hệ thống / IT nội bộ | Toàn quyền + “xem như” người khác (view-as) |
| **Admin (HR)** | Nhân sự | Tạo user, quản lý dữ liệu, reset mật khẩu (không phải system admin) |
| **User** | Nhân viên theo chức năng | Chỉ các module được cấp (vd. tuyển dụng, hoặc lương) |

Đăng nhập bằng **email + mật khẩu** (cổng công khai).  
Ứng dụng demo: **https://hrm.orangecloud.vn**

| Vai trò demo | Email | Mật khẩu |
| --- | --- | --- |
| Super Admin | `super@orangecloud.vn` | `SuperAdmin!2026` |
| Admin (HR) | `admin@orangecloud.vn` | `Admin!2026` |
| User tuyển dụng | `user.tuyendung@orangecloud.vn` | `User!2026` |
| User lương | `user.luong@orangecloud.vn` | `User!2026` |

> Tài khoản demo chỉ dùng môi trường thử nghiệm. Production thật cần đổi mật khẩu và quy trình cấp phát chính thức.

---

## Luồng dữ liệu quan trọng (dễ hình dung)

### Công tác phí

1. Nhân viên tạo **đề nghị** → hệ thống tính **dự toán** theo vùng / cấp bậc.  
2. Quản lý / Nhân sự **duyệt** → có thể **tạm ứng**.  
3. Sau chuyến đi → **quyết toán** kèm chứng từ.  
4. Kế toán xác nhận chênh lệch.

Số liệu chuyến mẫu `CT-2026-0001` (dự toán **6.870.000 ₫** / quyết toán **6.990.000 ₫**) được **khóa bằng test tự động**.

### Lương tháng

1. Chấm công + phụ cấp/thưởng + tham số BHXH/PIT.  
2. Tính bảng lương.  
3. Chỉ **đóng để chi trả** khi tham số pháp lý đã được duyệt (`LEGAL_REVIEW_REQUIRED`).

Tổng lương mẫu tháng **09/2026** (nhóm nhân viên gốc) cũng được khóa bằng test.

---

## Tech stack (tóm tắt cho lãnh đạo + chi tiết cho kỹ thuật)

### Phiên bản “một trang” (CEO)

| Hạng mục | Công nghệ | Ý nghĩa |
| --- | --- | --- |
| Giao diện | React + Vite | Web app hiện đại, build nhanh |
| Máy chủ ứng dụng | Cloudflare Workers | Chạy logic gần người dùng, không cần thuê VPS riêng |
| API | Hono | Bộ định tuyến HTTP nhẹ trên Worker |
| Database | Cloudflare D1 | SQL trên biên; lưu hồ sơ, phép, lương… |
| File | Cloudflare R2 | Lưu PDF / xuất báo cáo (tương tự “ổ đĩa đối tượng”) |
| Cache | KV | Lưu ngắn hạn, tăng tốc |
| Việc nền | Queues + Workflows | Gửi thông báo, quy trình nhiều bước |
| Lịch | Cron | Nhắc việc theo ngày |
| Ngôn ngữ code | TypeScript | Giảm lỗi kiểu dữ liệu |
| Kiểm thử | Vitest (+ Playwright e2e) | Bảo vệ công thức nghiệp vụ |
| CI/CD | GitHub Actions | Đẩy code → kiểm tra → migrate → seed → deploy |

### Sơ đồ triển khai

```text
GitHub (mã nguồn)
    │  push main
    ▼
GitHub Actions
    │  typecheck → test → migrate D1 → seed → deploy
    ▼
Cloudflare
    ├── Worker + SPA  →  https://hrm.orangecloud.vn
    ├── D1  (HRM_DB)
    ├── R2  (documents, exports)
    ├── KV / Queues / Cron / Email
    └── Observability (logs + traces)
```

Chi tiết kỹ thuật đầy đủ: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**  
Vận hành / secrets: **[docs/OPERATIONS.md](docs/OPERATIONS.md)**  
Tham số pháp lý lương: **[docs/LEGAL_PARAMETERS.md](docs/LEGAL_PARAMETERS.md)**

---

## Quick start (đội kỹ thuật)

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run db:seed:local
npm run db:seed:auth:local
npm run dev
```

| Script | Mục đích |
| --- | --- |
| `npm run dev` | Chạy local (SPA + Worker) |
| `npm run test:unit` | Test nghiệp vụ (golden travel / payroll) |
| `npm run build` | Build production |
| `npm run deploy` | Build + deploy Worker |
| `npm run db:migrate:local` / `:remote` | Áp migration D1 |

Deploy production: push lên `main` → workflow **Deploy Cloudflare** (cần secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). Xem [docs/GITHUB_SECRETS.md](docs/GITHUB_SECRETS.md).

---

## Nguyên tắc tương thích & tuân thủ

- Giữ kết quả tính **công tác** và **lương mẫu** khớp handoff cho đến khi có **phê duyệt thay đổi chính sách** (có hiệu lực theo ngày).  
- Tham số BHXH / PIT / giảm trừ… chỉ dùng để **chi trả** sau khi legal review = approved.  
- Không dán token / mật khẩu production vào chat; chỉ lưu trong GitHub Secrets / Worker secrets.

---

## Kho mã nguồn

Repository GitHub: cập nhật trên nhánh `main`.  
Tài liệu kiến trúc dành cho lãnh đạo + kỹ thuật nằm trong thư mục `docs/`.
