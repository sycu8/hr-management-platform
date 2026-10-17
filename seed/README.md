# Demo seed (Orange Cloud)

Dữ liệu giả lập tiếng Việt cho D1. Tổ chức: **Công ty Cổ phần Orange Cloud** (`org_demo`) — https://hrm.orangecloud.vn

## Thứ tự áp dụng

```bash
npm run db:migrate:local
npm run db:seed:local          # seed/demo.sql
npm run db:seed:auth:local     # seed/auth_users.sql
```

Remote: chạy trong GitHub Actions deploy, hoặc:

```bash
npx wrangler d1 execute HRM_DB --remote --file=./seed/demo.sql
npx wrangler d1 execute HRM_DB --remote --file=./seed/auth_users.sql
```

## Tài khoản

| Email | Loại | Nhân viên liên kết |
| --- | --- | --- |
| super@orangecloud.vn | super_admin | — |
| admin@orangecloud.vn | admin (HR) | e3 Lê Thu Hà |
| user.tuyendung@orangecloud.vn | user + recruiting | e9 Ngô Thị Thảo |
| user.luong@orangecloud.vn | user + payroll | e8 Hoàng Phương Linh |

Mật khẩu mặc định xem README gốc / `auth_users.sql`.

## Nội dung `demo.sql`

- 32 nhân viên, nhiều phòng ban, 2 đã nghỉ
- Sự kiện nhân sự, tài liệu (metadata), ngày lễ 2026
- ~42 đơn nghỉ phép, ~800+ chấm công T9–T10/2026
- 12 chuyến công tác gồm **CT-2026-0001** (golden)
- Tuyển dụng, onboarding, đánh giá, đào tạo, chính sách
- Thư viện **Pháp lý doanh nghiệp** (`pol_h9`–`pol_h20`): BLLĐ, BHXH, BHYT, Việc làm/BHTN, TNCN, LTT vùng, lương cơ sở — đồng bộ `paypol_v2`
- Thu nhập T9/2026 (golden); bảng lương Aug/Sep đóng theo paypol_v2
- Audit + hàng đợi email mẫu

Sau `demo.sql`, chạy thêm `policies_enrich.sql` (hoặc `npm run db:seed:policies:local`) để làm giàu `content_text` pháp lý.

Tái tạo: `node scripts/generate-demo-seed.mjs`
