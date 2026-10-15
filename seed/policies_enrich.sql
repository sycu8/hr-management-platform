-- Enrich policy_documents with management fields (run after migrations + demo.sql).
-- Scoped to org_demo; safe to re-run (UPDATE / INSERT OR REPLACE).

UPDATE policy_documents SET
  policy_type = 'HR',
  status = 'active',
  applicable_departments = 'Tất cả',
  content_text = 'Giờ làm việc 08:00–17:30 (T2–T6). Chấm công qua app hoặc máy văn phòng; giải trình trong 48 giờ. Vi phạm kỷ luật xử lý theo Bộ luật Lao động 2019.',
  owner_name = 'Phòng Nhân sự',
  owner_user_id = 'u_hr_admin',
  last_reviewed_at = '2026-09-01',
  effective_to = NULL,
  updated_at = '2026-09-01T03:00:00Z'
WHERE organization_id = 'org_demo' AND id = 'pol1';

UPDATE policy_documents SET
  policy_type = 'HR',
  status = 'active',
  applicable_departments = 'Tất cả',
  content_text = 'Phép năm 12 ngày + thâm niên. Đăng ký trước tối thiểu 3 ngày làm việc trên HRM Portal.',
  owner_name = 'Phòng Nhân sự',
  owner_user_id = 'u_hr_admin',
  last_reviewed_at = '2026-08-15',
  updated_at = '2026-08-15T03:00:00Z'
WHERE organization_id = 'org_demo' AND id = 'pol2';

UPDATE policy_documents SET
  policy_type = 'Tài chính',
  status = 'active',
  applicable_departments = 'Tất cả',
  content_text = 'Đề nghị công tác → duyệt QL → HR → tạm ứng → quyết toán trong 7 ngày kể từ ngày về.',
  owner_name = 'Phòng Nhân sự',
  owner_user_id = 'u_hr_admin',
  last_reviewed_at = '2026-10-01',
  updated_at = '2026-10-01T03:00:00Z'
WHERE organization_id = 'org_demo' AND id = 'pol3';

UPDATE policy_documents SET
  policy_type = 'Tài chính',
  status = 'active',
  applicable_departments = '["Nhân sự","Kế toán"]',
  content_text = 'Khóa công → tính lương → duyệt → chi trả trước ngày 5 tháng sau. Tham số BHXH/PIT chỉ áp dụng khi legal_review_status=approved.',
  owner_name = 'Kế toán trưởng',
  owner_user_id = 'u_finance',
  last_reviewed_at = '2026-09-20',
  updated_at = '2026-09-20T03:00:00Z'
WHERE organization_id = 'org_demo' AND id = 'pol4';

UPDATE policy_documents SET
  policy_type = 'Pháp lý',
  status = 'active',
  applicable_departments = 'Tất cả',
  content_text = 'Cam kết xử lý dữ liệu hồ sơ, lương, chấm công chỉ cho mục đích nhân sự theo quy định hiện hành.',
  owner_name = 'Pháp chế',
  owner_user_id = 'u_hr_admin',
  last_reviewed_at = '2026-03-15',
  updated_at = '2026-03-15T03:00:00Z'
WHERE organization_id = 'org_demo' AND id = 'pol5';

UPDATE policy_documents SET
  policy_type = 'IT',
  status = 'active',
  applicable_departments = 'Tất cả',
  content_text = 'Không chia sẻ mật khẩu; báo cáo sự cố an ninh trong 24 giờ. Tuân thủ Luật An ninh mạng.',
  owner_name = 'Trưởng phòng CNTT',
  owner_user_id = 'u_it',
  last_reviewed_at = '2026-07-01',
  updated_at = '2026-07-01T03:00:00Z'
WHERE organization_id = 'org_demo' AND id = 'pol6';

UPDATE policy_documents SET
  policy_type = 'HR', status = 'active', applicable_departments = 'Tất cả',
  content_text = COALESCE(content_text, summary),
  owner_name = COALESCE(owner_name, 'Phòng Nhân sự'),
  last_reviewed_at = COALESCE(last_reviewed_at, '2026-06-01')
WHERE organization_id = 'org_demo' AND id IN ('pol_h1','pol_h2');

UPDATE policy_documents SET
  policy_type = 'Tài chính', status = 'active', applicable_departments = 'Tất cả',
  content_text = COALESCE(content_text, summary),
  owner_name = COALESCE(owner_name, 'Phòng Nhân sự'),
  last_reviewed_at = COALESCE(last_reviewed_at, '2026-10-01')
WHERE organization_id = 'org_demo' AND id = 'pol_h3';

UPDATE policy_documents SET
  policy_type = 'IT', status = 'active', applicable_departments = 'Tất cả',
  content_text = COALESCE(content_text, summary),
  owner_name = COALESCE(owner_name, 'Trưởng phòng CNTT'),
  last_reviewed_at = COALESCE(last_reviewed_at, '2026-05-01')
WHERE organization_id = 'org_demo' AND id = 'pol_h4';

UPDATE policy_documents SET
  policy_type = 'HR', status = 'active', applicable_departments = '["Nhân sự"]',
  content_text = COALESCE(content_text, summary),
  owner_name = COALESCE(owner_name, 'Phòng Nhân sự'),
  last_reviewed_at = COALESCE(last_reviewed_at, '2026-04-01')
WHERE organization_id = 'org_demo' AND id IN ('pol_h5','pol_h6','pol_h8');

UPDATE policy_documents SET
  policy_type = 'Tài chính', status = 'active', applicable_departments = 'Tất cả',
  content_text = COALESCE(content_text, summary),
  owner_name = COALESCE(owner_name, 'Phòng Nhân sự'),
  last_reviewed_at = COALESCE(last_reviewed_at, '2026-10-01')
WHERE organization_id = 'org_demo' AND id = 'pol_h7';

UPDATE policy_documents SET
  policy_type = 'Pháp lý', status = 'active', applicable_departments = 'Tất cả',
  content_text = COALESCE(content_text, summary),
  owner_name = COALESCE(owner_name, 'Pháp chế'),
  last_reviewed_at = COALESCE(last_reviewed_at, effective_from)
WHERE organization_id = 'org_demo' AND category = 'Pháp lý';

-- Additional Orange Cloud sample policies
INSERT OR REPLACE INTO policy_documents (
  id, organization_id, category, code, title, version, effective_from, summary, body_json,
  policy_type, effective_to, status, applicable_departments, content_text,
  owner_name, owner_user_id, last_reviewed_at, file_name, content_type, size_bytes, r2_key
) VALUES
(
  'pol_oc_it01', 'org_demo', 'Quy định', 'QD-IT-01', 'Quy định sử dụng thiết bị và tài khoản CNTT',
  'v2.0', '2026-01-01',
  'Thiết bị công ty, mật khẩu, làm việc từ xa và xử lý sự cố CNTT tại Orange Cloud.',
  '{"sections":[{"h":"Tài khoản","b":"Mỗi nhân viên một tài khoản; bật MFA bắt buộc."},{"h":"Thiết bị","b":"Máy cấp phát được mã hóa ổ cứng; trả lại khi nghỉ việc."}]}',
  'IT', NULL, 'active', 'Tất cả',
  'Mã chính sách: QD-IT-01\nTiêu đề: Quy định sử dụng thiết bị và tài khoản CNTT\nPhiên bản: v2.0\nNgày hiệu lực: 01/01/2026\nNgười sở hữu: Trưởng phòng CNTT\n\n1. Tài khoản Orange Cloud bắt buộc MFA.\n2. Không cài phần mềm ngoài danh mục đã duyệt.\n3. Làm việc từ xa qua VPN công ty.\n4. Sự cố bảo mật báo trong 24 giờ.',
  'Trưởng phòng CNTT', 'u_it', '2026-09-10',
  NULL, NULL, 0, NULL
),
(
  'pol_oc_at01', 'org_demo', 'Quy định', 'QD-AT-01', 'Nội quy an toàn lao động và PCCC',
  'v1.3', '2025-07-01',
  'An toàn tại văn phòng, PCCC, sơ tán và trách nhiệm người lao động.',
  '{"sections":[{"h":"PCCC","b":"Tham gia diễn tập hàng năm; không che lối thoát hiểm."},{"h":"Tai nạn","b":"Báo ngay cho Hành chính và Nhân sự."}]}',
  'An toàn', NULL, 'active', 'Tất cả',
  'Mã chính sách: QD-AT-01\nTiêu đề: Nội quy an toàn lao động và PCCC\nPhiên bản: v1.3\nNgày hiệu lực: 01/07/2025\nPhòng ban áp dụng: Tất cả\n\nNhân viên Orange Cloud tuân thủ nội quy PCCC, tham gia diễn tập và báo cáo tai nạn lao động ngay khi phát hiện.',
  'Hành chính', 'u_hr_admin', '2026-07-20',
  NULL, NULL, 0, NULL
),
(
  'pol_oc_tc01', 'org_demo', 'Quy trình', 'QT-TC-01', 'Quy trình tạm ứng và hoàn ứng chi phí',
  'v1.1', '2026-02-01',
  'Tạm ứng nội bộ, chứng từ và hoàn ứng trong 10 ngày làm việc.',
  '{"sections":[{"h":"Tạm ứng","b":"Đề nghị trên HRM, duyệt trưởng bộ phận và Kế toán."},{"h":"Hoàn ứng","b":"Nộp chứng từ trong 10 ngày làm việc."}]}',
  'Tài chính', NULL, 'active', '["Kế toán","Nhân sự","Ban giám đốc"]',
  'Mã: QT-TC-01\nQuy trình tạm ứng và hoàn ứng chi phí Orange Cloud.\nHiệu lực từ 01/02/2026.\nÁp dụng cho Kế toán, Nhân sự, Ban giám đốc.',
  'Kế toán trưởng', 'u_finance', '2026-08-01',
  NULL, NULL, 0, NULL
),
(
  'pol_oc_hr03', 'org_demo', 'Quy định', 'QD-NS-03', 'Quy định làm việc hybrid',
  'v1.0', '2026-04-01',
  'Tối đa 2 ngày remote/tuần sau thử việc; đăng ký trên portal trước 1 ngày.',
  '{"sections":[{"h":"Điều kiện","b":"Đã hết thử việc, KPI quý gần nhất đạt."},{"h":"Đăng ký","b":"Qua HRM Portal trước ít nhất 1 ngày làm việc."}]}',
  'HR', NULL, 'active', '["Kỹ thuật","Marketing","Customer Success"]',
  'Quy định làm việc hybrid Orange Cloud — tối đa 2 ngày remote mỗi tuần sau khi hết thử việc.',
  'Phòng Nhân sự', 'u_hr_admin', '2026-09-05',
  NULL, NULL, 0, NULL
),
(
  'pol_oc_draft', 'org_demo', 'Quy trình', 'QT-HR-09', 'Quy trình đánh giá thử việc (nháp)',
  'v0.9', '2026-11-01',
  'Bản nháp SOP đánh giá thử việc 2 tháng — chờ Ban giám đốc phê duyệt.',
  '{"sections":[{"h":"Mốc","b":"Đánh giá giữa kỳ (30 ngày) và cuối kỳ (60 ngày)."}]}',
  'HR', NULL, 'draft', '["Nhân sự"]',
  'BẢN NHÁP — Quy trình đánh giá thử việc Orange Cloud. Chưa ban hành.',
  'Phòng Nhân sự', 'u_hr_admin', '2026-10-10',
  NULL, NULL, 0, NULL
),
(
  'pol_oc_exp', 'org_demo', 'Quy định', 'QD-NS-00', 'Nội quy làm việc (phiên bản cũ)',
  'v2.0', '2023-01-01',
  'Đã thay bằng QD-NS-01 / QĐ-01 — giữ để đối chiếu lịch sử.',
  '{"sections":[{"h":"Lưu ý","b":"Hết hiệu lực từ 01/01/2025."}]}',
  'HR', '2024-12-31', 'expired', 'Tất cả',
  'Nội quy cũ, hết hiệu lực 31/12/2024. Thay thế bởi QD-NS-01.',
  'Phòng Nhân sự', 'u_hr_admin', '2025-01-05',
  NULL, NULL, 0, NULL
);
