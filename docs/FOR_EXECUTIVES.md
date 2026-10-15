# Tóm tắt điều hành — HR Management Platform

**Đối tượng:** CEO, COO, CHRO, CFO — không cần đọc code.

**Ứng dụng:** https://hrm.orangecloud.vn  
**Mục tiêu:** Một cổng số cho nhân sự Việt Nam (tuyển dụng → vận hành hàng ngày → lương → phát triển).

---

## Giá trị mang lại

1. **Minh bạch** — cùng một nguồn dữ liệu cho HR, quản lý, kế toán.  
2. **Kiểm soát tiền** — công tác phí và lương có công thức + kiểm thử; tham số pháp lý có cổng duyệt.  
3. **Phân quyền** — mỗi người chỉ thấy / làm đúng phạm vi.  
4. **Sẵn sàng đám mây** — không phụ thuộc máy chủ trong văn phòng.  
5. **Triển khai có kiểm soát** — mỗi bản phát hành qua GitHub (test → migrate → deploy).

---

## Kiến trúc “bằng ngôn ngữ đời thường”

| Tầng | Chức năng | Công nghệ (chỉ để tham chiếu) |
| --- | --- | --- |
| Màn hình | Người dùng làm việc | React (web) |
| Quy tắc & API | Ai được làm gì, tính toán đúng | Cloudflare Worker |
| Sổ chính | Lưu hồ sơ, phép, lương… | D1 (database SQL) |
| Hồ sơ đính kèm | PDF, chứng từ, file xuất | R2 |
| Việc nền | Gửi mail, job chậm | Queues / Cron / Email |

Chi tiết đầy đủ hơn: [ARCHITECTURE.md](./ARCHITECTURE.md) (Phần 1).  
Tổng quan repo: [README.md](../README.md).

---

## Module nghiệp vụ (checklist)

- [ ] Bảng điều khiển & cảnh báo  
- [ ] Hồ sơ nhân viên & tài liệu  
- [ ] Tuyển dụng & onboarding  
- [ ] Nghỉ phép & chấm công  
- [ ] Công tác phí (đề nghị → duyệt → quyết toán)  
- [ ] Lương, phụ cấp, bảo hiểm  
- [ ] KPI/OKR & đánh giá  
- [ ] Đào tạo & chứng chỉ  
- [ ] Kho chính sách / SOP / pháp lý  
- [ ] Phân quyền tài khoản  

---

## Quyết định lãnh đạo cần nắm

| Chủ đề | Khuyến nghị |
| --- | --- |
| Ai là Super Admin? | Í định 1–2 người IT/HR cấp cao; không chia sẻ mật khẩu. |
| Khi nào bật lương “thật”? | Sau legal review tham số BHXH/PIT và chạy song song 1 kỳ. |
| Dữ liệu demo | Chỉ để demo/training; production dùng import nhân sự thật. |
| Thay đổi công thức tiền | Phải có phê duyệt bằng văn bản / ticket; đội kỹ thuật cập nhật + test. |

---

## Liên hệ kỹ thuật

- Repo GitHub: nhánh `main`  
- Vận hành secrets / Cloudflare: [OPERATIONS.md](./OPERATIONS.md)  
