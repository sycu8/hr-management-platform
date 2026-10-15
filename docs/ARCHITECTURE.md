# Kiến trúc hệ thống — HR Management Platform

Tài liệu này có **hai lớp**:

1. **Dành cho CEO / lãnh đạo** — hiểu bức tranh lớn, không cần biết code.  
2. **Dành cho kỹ thuật** — quyết định triển khai Cloudflare và ranh giới module.

---

## Phần 1 — Dành cho lãnh đạo (không cần biết công nghệ)

### Hệ thống là gì?

Một **cổng nhân sự số** thay cho Excel / email rời: tuyển dụng → onboarding → chấm công / nghỉ phép → công tác phí → lương → đánh giá → đào tạo → chính sách nội bộ.

Mọi người vào cùng một địa chỉ web (**hrm.orangecloud.vn**), đăng nhập bằng email + mật khẩu, và chỉ thấy những phần được phép.

### Hình dung như tổ chức thật

| Trong công ty | Trong hệ thống |
| --- | --- |
| Nhân viên làm việc trên máy tính / điện thoại | **Giao diện web** (màn hình tiếng Việt) |
| Phòng Nhân sự / Kế toán kiểm soát quy trình | **Máy chủ ứng dụng (API)** — kiểm tra quyền và tính toán |
| Sổ hồ sơ / phần mềm kế toán | **Cơ sở dữ liệu** (D1) — nguồn sự thật |
| Tủ hồ sơ giấy / SharePoint | **Kho tệp** (R2) — hợp đồng, chứng từ, file xuất |
| Hộp việc “làm sau” + lịch nhắc | **Hàng đợi + cron** — gửi mail, nhắc hạn |
| Bảo vệ cổng / thẻ từ | **Đăng nhập + phân quyền trên máy chủ** |

### Vì sao dùng Cloudflare?

- **Không phải tự nuôi máy chủ** trong văn phòng: Cloudflare vận hành hạ tầng toàn cầu.  
- **Nhanh**: xử lý gần người dùng.  
- **Một hóa đơn / một nền tảng** cho web + API + database + file + email nền.  
- **Triển khai tự động** từ GitHub: mỗi lần duyệt code lên `main`, hệ thống kiểm tra và phát hành bản mới.

### Rủi ro nghiệp vụ được kiểm soát thế nào?

1. **Phân quyền thật** — trình duyệt không thể “tự phong HR”. Máy chủ quyết định.  
2. **Công thức tiền được khóa test** — chuyến `CT-2026-0001` và lương mẫu 09/2026 không được lệch số nếu không có phê duyệt thay đổi.  
3. **Cổng pháp lý lương** — tham số BHXH/PIT phải được review trước khi đóng bảng lương để chi trả.  
4. **Nhật ký thao tác** — các hành động quan trọng ghi audit (ai / khi nào / làm gì).

### Mười khối nghiệp vụ

1. Bảng điều khiển  
2. Quản lý nhân viên  
3. Tuyển dụng  
4. Nghỉ phép & chấm công  
5. Công tác & công tác phí  
6. Lương & phúc lợi  
7. Đánh giá hiệu suất  
8. Đào tạo & phát triển  
9. Chính sách nội bộ  
10. Quản trị hệ thống  

### Câu hỏi CEO thường hỏi

| Câu hỏi | Trả lời ngắn |
| --- | --- |
| Dữ liệu nằm ở đâu? | Chủ yếu trên Cloudflare (D1 + R2), tài khoản org của công ty. |
| Có cần IT on-prem không? | Không bắt buộc; chỉ cần domain + tài khoản Cloudflare + quy trình HR. |
| Ai được xem lương? | Theo phân quyền module + phạm vi (bản thân / cấp dưới / HR-Finance). |
| Đổi công thức lương/công tác phí? | Phải có phê duyệt; có test tự động bảo vệ số liệu cũ. |
| Mất điện văn phòng? | App vẫn chạy trên đám mây; chỉ cần internet. |
| Chi phí hạ tầng? | Theo mô hình sử dụng Cloudflare (Worker, D1, R2, …) — không thuê VPS riêng cho app này. |

---

## Phần 2 — Dành cho kỹ thuật

### Purpose

Production rebuild of the HRM Portal handoff for a Vietnamese organization. Prototype behavior and golden calculation values are preserved; storage, auth, durability, and operations use Cloudflare Developer Platform services.

### Decisions

| Topic | Choice |
| --- | --- |
| Hosting | Cloudflare Workers + Static Assets (SPA) |
| API | Hono on the same Worker (`/api/*`) |
| Database | D1 (`HRM_DB`) |
| Files | R2 (`hrm-documents`, `hrm-exports`) |
| Cache / short-lived state | KV (`CACHE`) |
| Async work | Queues (`hrm-notifications`, `hrm-jobs`) |
| Multi-step jobs | Workflows (reminders, payroll close) |
| Schedules | Cron (Asia/Ho_Chi_Minh business checks) |
| Email | Cloudflare Email Service binding |
| Identity | Public email/password sessions (PBKDF2 + `hrm_session` cookie); Access optional/off for public domain |
| Bot protection | Turnstile on selected forms |
| Observability | Workers Logs + Traces |
| Locale / money | `vi-VN`, VND integer amounts |
| Frontend | React 19 + Vite 8 + React Router |
| Validation | Zod |
| CI/CD | GitHub Actions → migrate → seed → `wrangler deploy` |

“Use all Cloudflare services” means every service that solves a concrete HRM requirement. Products without a clear role are omitted.

### Runtime shape

```text
Browser (React SPA)
    │  HTTPS
    ▼
Worker (assets for UI; run_worker_first for /api/*)
    ├── /api/auth, /api/users, /api/employees, /api/trips, /api/payroll, /api/lists, …
    ├── D1 binding DB
    ├── R2 DOCUMENTS / EXPORTS
    ├── KV CACHE
    ├── Queues NOTIFICATIONS / JOBS
    └── Cron + Email + (optional) Turnstile
```

### Authorization model

Server-enforced account types + capability matrix:

- **super_admin** — full + view-as  
- **admin** — manage users/data (not system-level)  
- **user** — module capabilities only  

Scope rules:

- Employee: self-scoped records where applicable  
- Manager / HR / Finance: elevated via matrix  
- Client-selected roles are never trusted  

### Compatibility rules

Legacy calculation results for travel trip `CT-2026-0001` and September 2026 payroll must remain bit-identical until an authorized, effective-dated policy change is approved.

Known prototype quirks preserved under compatibility mode:

- Holidays remain inside payroll standard weekday counts.  
- Closed payrolls store immutable snapshots in production.  
- Pseudo-attendance generation is removed; only punches, imports, leave, travel, and audited adjustments remain.

### Legal gate

Payroll parameters require `legal_review_status = approved` before a payroll run can be closed for payment. Values ship as configurable effective-dated policy with source citations (`LEGAL_REVIEW_REQUIRED=true`).

### Cutover outline

1. Seed demo organization and verify golden tests.  
2. Import real employees without payroll activation.  
3. Parallel payroll for one month.  
4. Approve legal parameters.  
5. Freeze legacy prototype.  
6. Keep rollback by redeploying previous Worker version; D1 export/snapshot beforehand.

### Related docs

- [OPERATIONS.md](./OPERATIONS.md) — secrets, provisioning  
- [LEGAL_PARAMETERS.md](./LEGAL_PARAMETERS.md) — payroll legal gate  
- [ACCEPTANCE_BASELINE.md](./ACCEPTANCE_BASELINE.md) — acceptance  
- [ASSUMPTIONS.md](./ASSUMPTIONS.md) — product assumptions  
