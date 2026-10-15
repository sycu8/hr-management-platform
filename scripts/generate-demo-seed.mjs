/**
 * One-shot generator for seed/demo.sql — Orange Cloud fictional VN demo.
 * Run: node scripts/generate-demo-seed.mjs
 */
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'seed', 'demo.sql')

const ORG = 'org_demo'
const HOLIDAYS = [
  ['2026-01-01', 'Tết Dương lịch'],
  ['2026-02-14', 'Tết Nguyên đán'],
  ['2026-02-15', 'Tết Nguyên đán'],
  ['2026-02-16', 'Tết Nguyên đán'],
  ['2026-02-17', 'Mùng 1 Tết'],
  ['2026-02-18', 'Tết Nguyên đán'],
  ['2026-02-19', 'Tết Nguyên đán'],
  ['2026-02-20', 'Tết Nguyên đán'],
  ['2026-02-21', 'Tết Nguyên đán'],
  ['2026-02-22', 'Tết Nguyên đán'],
  ['2026-04-27', 'Nghỉ bù Giỗ Tổ Hùng Vương'],
  ['2026-04-30', 'Ngày Giải phóng miền Nam'],
  ['2026-05-01', 'Quốc tế Lao động'],
  ['2026-09-02', 'Quốc khánh'],
]
const holidaySet = new Set(HOLIDAYS.map(([d]) => d))

function esc(s) {
  if (s === null || s === undefined) return 'NULL'
  return `'${String(s).replace(/'/g, "''")}'`
}
function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  return esc(v)
}

function isWeekend(iso) {
  const d = new Date(iso + 'T12:00:00Z')
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

function eachDate(from, to) {
  const out = []
  const cur = new Date(from + 'T12:00:00Z')
  const end = new Date(to + 'T12:00:00Z')
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

function workdays(from, to) {
  return eachDate(from, to).filter((d) => !isWeekend(d) && !holidaySet.has(d))
}

function pad(n, w = 2) {
  return String(n).padStart(w, '0')
}

function timeVar(seed, baseH, baseM, jitter = 25) {
  const m = (baseM + ((seed * 17) % jitter) - Math.floor(jitter / 3) + 60) % 60
  const hAdj = baseM + ((seed * 17) % jitter) - Math.floor(jitter / 3) < 0 ? -1 : 0
  const h = baseH + hAdj + Math.floor((seed * 3) % 2 === 0 ? 0 : 0)
  return `${pad(Math.max(7, Math.min(9, h)))}:${pad(m)}`
}

const lines = []
const push = (...xs) => lines.push(...xs)
const counts = Object.create(null)
function count(table, n = 1) {
  counts[table] = (counts[table] || 0) + n
}

push(`-- =============================================================================
-- Demo seed: Công ty Cổ phần Orange Cloud (org_demo) — hrm.orangecloud.vn
-- Fictional Vietnamese HR data only. No real personal data. No passwords here
-- (see seed/auth_users.sql). Idempotent for wrangler d1 execute --file.
-- Golden locks preserved: e1–e12 payroll bases, CT-2026-0001, Sep 2026 earnings,
-- holidays 2026, leave l1/l8/l9. Closed payroll_run omitted (headcount expanded).
-- =============================================================================

PRAGMA foreign_keys = ON;

-- Child tables first (org-scoped cleanup for re-seed)
DELETE FROM notification_outbox WHERE organization_id = ${esc(ORG)};
DELETE FROM audit_events WHERE organization_id = ${esc(ORG)};
DELETE FROM export_jobs WHERE organization_id = ${esc(ORG)};
DELETE FROM trip_receipts WHERE organization_id = ${esc(ORG)};
DELETE FROM trip_history WHERE trip_id IN (SELECT id FROM trips WHERE organization_id = ${esc(ORG)});
DELETE FROM trips WHERE organization_id = ${esc(ORG)};
DELETE FROM travel_policy_versions WHERE organization_id = ${esc(ORG)};
DELETE FROM payroll_items WHERE payroll_run_id IN (SELECT id FROM payroll_runs WHERE organization_id = ${esc(ORG)});
DELETE FROM payroll_runs WHERE organization_id = ${esc(ORG)};
DELETE FROM earnings WHERE organization_id = ${esc(ORG)};
DELETE FROM payroll_policy_versions WHERE organization_id = ${esc(ORG)};
DELETE FROM attendance_adjustments WHERE organization_id = ${esc(ORG)};
DELETE FROM attendance_punches WHERE organization_id = ${esc(ORG)};
DELETE FROM leave_requests WHERE organization_id = ${esc(ORG)};
DELETE FROM leave_adjustments WHERE organization_id = ${esc(ORG)};
DELETE FROM leave_types WHERE organization_id = ${esc(ORG)};
DELETE FROM holidays WHERE organization_id = ${esc(ORG)};
DELETE FROM documents WHERE organization_id = ${esc(ORG)};
DELETE FROM document_types WHERE organization_id = ${esc(ORG)};
DELETE FROM employment_events WHERE organization_id = ${esc(ORG)};
DELETE FROM onboarding_plans WHERE organization_id = ${esc(ORG)};
DELETE FROM candidates WHERE organization_id = ${esc(ORG)};
DELETE FROM job_requisitions WHERE organization_id = ${esc(ORG)};
DELETE FROM ratings WHERE organization_id = ${esc(ORG)};
DELETE FROM objectives WHERE organization_id = ${esc(ORG)};
DELETE FROM feedback_360 WHERE organization_id = ${esc(ORG)};
DELETE FROM review_cycles WHERE organization_id = ${esc(ORG)};
DELETE FROM enrollments WHERE organization_id = ${esc(ORG)};
DELETE FROM certificates WHERE organization_id = ${esc(ORG)};
DELETE FROM employee_careers WHERE organization_id = ${esc(ORG)};
DELETE FROM career_paths WHERE organization_id = ${esc(ORG)};
DELETE FROM courses WHERE organization_id = ${esc(ORG)};
DELETE FROM policy_documents WHERE organization_id = ${esc(ORG)};
DELETE FROM permission_matrix WHERE organization_id = ${esc(ORG)};
-- Keep auth users from auth_users.sql; clear legacy demo-only users
DELETE FROM users WHERE organization_id = ${esc(ORG)} AND id IN ('u_admin','u_hr','u_mgr','u_fin','u_emp');
DELETE FROM employees WHERE organization_id = ${esc(ORG)};
`)

// --- org + security ---
push(`
INSERT OR REPLACE INTO organizations (id, name, legal_name, timezone, locale, currency)
VALUES (${esc(ORG)}, ${esc('Công ty Cổ phần Orange Cloud')}, ${esc('Công ty Cổ phần Orange Cloud')}, 'Asia/Ho_Chi_Minh', 'vi-VN', 'VND');
`)
count('organizations')

push(`
INSERT OR REPLACE INTO security_settings (organization_id, mask_salary, require_2fa, session_minutes, log_exports)
VALUES (${esc(ORG)}, 1, 0, 480, 1);
`)
count('security_settings')

// --- employees (e1–e12 golden-compatible; e13–e32 expansion) ---
// Columns: id, code, name, email, phone, gender, birth, address, dept, title, level, mgr, base, deps, status, joined, left, ctype, cstart, cend, skills
const employees = [
  // Golden core
  ['e1','NV001','Nguyễn Minh Anh','minh.anh@orangecloud.vn','0901 234 501','Nữ','1994-03-18','Số 12 ngõ 45 Xuân Thủy, Cầu Giấy, Hà Nội','Kinh doanh','Chuyên viên kinh doanh',1,'e4',18000000,1,'active','2022-03-01',null,'Không xác định thời hạn','2025-03-01',null,'["Bán hàng B2B","CRM","Thuyết trình"]'],
  ['e2','NV002','Trần Quốc Bảo','quoc.bao@orangecloud.vn','0901 234 502','Nam','1997-07-09','P. Khương Trung, Thanh Xuân, Hà Nội','Kỹ thuật','Kỹ sư triển khai',0,'e7',14000000,0,'active','2023-06-15',null,'Không xác định thời hạn','2026-06-15',null,'["Cloud","DevOps","Linux"]'],
  ['e3','NV003','Lê Thu Hà','thu.ha@orangecloud.vn','0901 234 503','Nữ','1989-12-02','Hai Bà Trưng, Hà Nội','Nhân sự','Trưởng phòng nhân sự',2,'e5',38000000,2,'active','2019-09-01',null,'Không xác định thời hạn','2022-09-01',null,'["Luật lao động","Quản lý nhóm","Giao tiếp","Tuyển dụng"]'],
  ['e4','NV004','Phạm Đức Long','duc.long@orangecloud.vn','0901 234 504','Nam','1986-05-27','Tây Hồ, Hà Nội','Kinh doanh','Giám đốc kinh doanh',2,'e5',45000000,2,'active','2018-02-12',null,'Không xác định thời hạn','2021-02-12',null,'["Bán hàng B2B","Quản lý nhóm","Giao tiếp","Chiến lược"]'],
  ['e5','NV005','Võ Thanh Tùng','thanh.tung@orangecloud.vn','0901 234 505','Nam','1980-01-14','Ba Đình, Hà Nội','Ban giám đốc','Tổng giám đốc',3,null,85000000,2,'active','2016-01-04',null,'Không xác định thời hạn','2019-01-04',null,'["Lãnh đạo","Chiến lược","Quản lý nhóm","Giao tiếp"]'],
  ['e6','NV006','Đặng Ngọc Mai','ngoc.mai@orangecloud.vn','0901 234 506','Nữ','1996-10-20','Đống Đa, Hà Nội','Marketing','Chuyên viên marketing',1,'e10',17000000,0,'active','2022-11-07',null,'Không xác định thời hạn','2025-11-07',null,'["Digital Marketing","Content","SEO"]'],
  ['e7','NV007','Bùi Gia Huy','gia.huy@orangecloud.vn','0901 234 507','Nam','1991-09-30','Nam Từ Liêm, Hà Nội','Kỹ thuật','Trưởng nhóm kỹ thuật',1,'e5',28000000,1,'active','2020-08-17',null,'Không xác định thời hạn','2023-08-17',null,'["Cloud","Quản lý nhóm","Kiến trúc phần mềm"]'],
  ['e8','NV008','Hoàng Phương Linh','phuong.linh@orangecloud.vn','0901 234 508','Nữ','1993-04-11','Hà Đông, Hà Nội','Kế toán','Kế toán tổng hợp / Lương thưởng',1,'e5',22000000,0,'active','2021-05-10',null,'Xác định thời hạn 24 tháng','2025-01-01','2026-12-31','["Excel nâng cao","Payroll","Thuế TNCN"]'],
  ['e9','NV009','Ngô Thị Thảo','thi.thao@orangecloud.vn','0901 234 509','Nữ','1998-10-15','Long Biên, Hà Nội','Nhân sự','Chuyên viên tuyển dụng',0,'e3',13000000,0,'active','2024-02-01',null,'Xác định thời hạn 36 tháng','2026-02-01','2029-01-31','["Tuyển dụng","Giao tiếp","Phỏng vấn"]'],
  ['e10','NV010','Đỗ Anh Khoa','anh.khoa@orangecloud.vn','0901 234 510','Nam','1988-08-05','Cầu Giấy, Hà Nội','Marketing','Trưởng phòng marketing',2,'e5',40000000,1,'active','2019-04-08',null,'Không xác định thời hạn','2022-04-08',null,'["Digital Marketing","Quản lý nhóm","Giao tiếp","Thương hiệu"]'],
  ['e11','NV011','Lý Hải Nam','hai.nam@orangecloud.vn','0901 234 511','Nam','2000-11-22','Hoàng Mai, Hà Nội','Kỹ thuật','Kỹ sư phần mềm',0,'e7',12000000,0,'active','2026-08-03',null,'Thử việc','2026-08-03','2026-10-31','["JavaScript","React"]'],
  ['e12','NV012','Trịnh Mỹ Duyên','my.duyen@orangecloud.vn','0901 234 512','Nữ','1999-06-03','Hà Đông, Hà Nội','Kế toán','Kế toán viên',0,'e8',11000000,0,'left','2023-01-09','2026-08-15','Xác định thời hạn 24 tháng','2025-01-09','2027-01-08','["Excel nâng cao"]'],
  // Expansion
  ['e13','NV013','Nguyễn Hoàng Nam','hoang.nam@orangecloud.vn','0912 345 601','Nam','1984-06-21','Quận 1, TP. Hồ Chí Minh','Ban giám đốc','Phó tổng giám đốc',3,'e5',72000000,2,'active','2017-03-15',null,'Không xác định thời hạn','2020-03-15',null,'["Lãnh đạo","Vận hành","Chiến lược"]'],
  ['e14','NV014','Phan Thị Lan','thi.lan@orangecloud.vn','0912 345 602','Nữ','1995-02-08','Cầu Giấy, Hà Nội','Kinh doanh','Chuyên viên kinh doanh',0,'e4',15000000,0,'active','2024-05-02',null,'Xác định thời hạn 24 tháng','2024-05-02','2026-05-01','["Bán hàng B2B","CRM"]'],
  ['e15','NV015','Vũ Minh Tuấn','minh.tuan@orangecloud.vn','0912 345 603','Nam','1992-11-19','Tây Hồ, Hà Nội','Kinh doanh','Chuyên viên kinh doanh cao cấp',1,'e4',21000000,1,'active','2021-09-01',null,'Không xác định thời hạn','2024-09-01',null,'["Bán hàng B2B","Đàm phán","CRM"]'],
  ['e16','NV016','Lương Thị Huyền','thi.huyen@orangecloud.vn','0912 345 604','Nữ','1990-04-25','Quận 3, TP. Hồ Chí Minh','Kinh doanh','Trưởng nhóm kinh doanh miền Nam',1,'e4',26000000,1,'active','2020-01-20',null,'Không xác định thời hạn','2023-01-20',null,'["Bán hàng B2B","Quản lý nhóm","Giao tiếp"]'],
  ['e17','NV017','Đinh Công Thành','cong.thanh@orangecloud.vn','0912 345 605','Nam','1994-08-12','Nam Từ Liêm, Hà Nội','Kỹ thuật','Kỹ sư backend',1,'e7',24000000,0,'active','2022-04-11',null,'Không xác định thời hạn','2025-04-11',null,'["Node.js","PostgreSQL","API"]'],
  ['e18','NV018','Mai Thu Trang','thu.trang@orangecloud.vn','0912 345 606','Nữ','1996-01-30','Thanh Xuân, Hà Nội','Kỹ thuật','Kỹ sư QA',0,'e7',16000000,0,'active','2023-10-02',null,'Xác định thời hạn 36 tháng','2023-10-02','2026-10-01','["QA","Automation","Selenium"]'],
  ['e19','NV019','Hồ Văn Khoa','van.khoa@orangecloud.vn','0912 345 607','Nam','1989-09-03','Quận 7, TP. Hồ Chí Minh','Kỹ thuật','Kỹ sư DevOps',1,'e7',27000000,2,'active','2019-07-08',null,'Không xác định thời hạn','2022-07-08',null,'["DevOps","Kubernetes","Cloud"]'],
  ['e20','NV020','Trần Bảo Châu','bao.chau@orangecloud.vn','0912 345 608','Nữ','1993-12-17','Đống Đa, Hà Nội','Nhân sự','Chuyên viên C&B',1,'e3',19000000,1,'active','2021-11-01',null,'Không xác định thời hạn','2024-11-01',null,'["C&B","Luật lao động","Excel nâng cao"]'],
  ['e21','NV021','Nguyễn Đức Anh','duc.anh@orangecloud.vn','0912 345 609','Nam','1997-03-09','Hà Đông, Hà Nội','Kế toán','Kế toán viên',0,'e8',14000000,0,'active','2025-09-01',null,'Xác định thời hạn 24 tháng','2025-12-01','2027-11-30','["Kế toán","Excel"]'],
  ['e22','NV022','Lê Quang Huy','quang.huy@orangecloud.vn','0912 345 610','Nam','1995-07-14','Ba Đình, Hà Nội','Marketing','Chuyên viên content',0,'e10',14500000,0,'active','2024-08-19',null,'Xác định thời hạn 24 tháng','2024-08-19','2026-08-18','["Content","Copywriting","Social"]'],
  ['e23','NV023','Phạm Khánh Linh','khanh.linh@orangecloud.vn','0912 345 611','Nữ','1991-05-28','Quận Bình Thạnh, TP. Hồ Chí Minh','Marketing','Chuyên viên performance',1,'e10',20000000,1,'active','2022-02-14',null,'Không xác định thời hạn','2025-02-14',null,'["Performance ads","Analytics","SEO"]'],
  ['e24','NV024','Đặng Quốc Việt','quoc.viet@orangecloud.vn','0912 345 612','Nam','1987-10-11','Cầu Giấy, Hà Nội','Customer Success','Trưởng phòng Customer Success',2,'e5',36000000,1,'active','2018-06-01',null,'Không xác định thời hạn','2021-06-01',null,'["CSM","Quản lý nhóm","Giao tiếp","SaaS"]'],
  ['e25','NV025','Bùi Thanh Nga','thanh.nga@orangecloud.vn','0912 345 613','Nữ','1994-09-22','Hai Bà Trưng, Hà Nội','Customer Success','Chuyên viên CS',1,'e24',18000000,0,'active','2022-07-05',null,'Không xác định thời hạn','2025-07-05',null,'["CSM","Giao tiếp","CRM"]'],
  ['e26','NV026','Ngô Minh Đức','minh.duc@orangecloud.vn','0912 345 614','Nam','1998-02-16','Long Biên, Hà Nội','Customer Success','Chuyên viên CS',0,'e24',13500000,0,'active','2024-11-11',null,'Xác định thời hạn 24 tháng','2024-11-11','2026-11-10','["CSM","Support"]'],
  ['e27','NV027','Hoàng Thị Yến','thi.yen@orangecloud.vn','0912 345 615','Nữ','1996-06-04','Quận 10, TP. Hồ Chí Minh','Customer Success','Chuyên viên CS cao cấp',1,'e24',19500000,1,'active','2021-03-22',null,'Không xác định thời hạn','2024-03-22',null,'["CSM","Onboarding khách hàng","Giao tiếp"]'],
  ['e28','NV028','Trịnh Văn Sơn','van.son@orangecloud.vn','0912 345 616','Nam','1990-12-01','Thanh Xuân, Hà Nội','Kỹ thuật','Kỹ sư frontend',1,'e7',23000000,0,'left','2021-01-15','2026-06-30','Không xác định thời hạn','2024-01-15',null,'["React","TypeScript","UI"]'],
  ['e29','NV029','Cao Thị Hạnh','thi.hanh@orangecloud.vn','0912 345 617','Nữ','1992-08-07','Đống Đa, Hà Nội','Kế toán','Kế toán trưởng',2,'e5',42000000,2,'active','2018-09-03',null,'Không xác định thời hạn','2021-09-03',null,'["Kế toán quản trị","Thuế","Quản lý nhóm"]'],
  ['e30','NV030','Lý Thị Kim Oanh','kim.oanh@orangecloud.vn','0912 345 618','Nữ','1999-04-18','Hoàng Mai, Hà Nội','Nhân sự','Chuyên viên hành chính nhân sự',0,'e3',12500000,0,'active','2025-03-10',null,'Xác định thời hạn 36 tháng','2025-03-10','2028-03-09','["Hành chính","Giao tiếp"]'],
  ['e31','NV031','Đỗ Thành Đạt','thanh.dat@orangecloud.vn','0912 345 619','Nam','1993-01-26','Quận 2, TP. Hồ Chí Minh','Kinh doanh','Chuyên viên pre-sales',1,'e4',22000000,0,'active','2022-09-12',null,'Không xác định thời hạn','2025-09-12',null,'["Pre-sales","Demo sản phẩm","Giao tiếp"]'],
  ['e32','NV032','Võ Thị Mỹ Hạnh','my.hanh@orangecloud.vn','0912 345 620','Nữ','1985-11-09','Ba Đình, Hà Nội','Ban giám đốc','Trợ lý tổng giám đốc',1,'e5',25000000,1,'active','2019-05-06',null,'Không xác định thời hạn','2022-05-06',null,'["Điều phối","Giao tiếp","Quản trị văn phòng"]'],
]

push(`
-- Self-referential manager_id: relax FK for bulk employee upsert
PRAGMA foreign_keys = OFF;

INSERT OR REPLACE INTO employees (
  id, organization_id, code, full_name, email, phone, gender, birth_date, address,
  department, title, level, manager_id, base_salary, dependents, status, joined_on, left_on,
  contract_type, contract_start, contract_end, skills_json
) VALUES`)

const empRows = employees.map((e) => {
  const [
    id, code, name, email, phone, gender, birth, address, dept, title, level, mgr, base, deps, status, joined, left, ctype, cstart, cend, skills,
  ] = e
  count('employees')
  return ` (${esc(id)},${esc(ORG)},${esc(code)},${esc(name)},${esc(email)},${esc(phone)},${esc(gender)},${esc(birth)},${esc(address)},${esc(dept)},${esc(title)},${level},${mgr ? esc(mgr) : 'NULL'},${base},${deps},${esc(status)},${esc(joined)},${left ? esc(left) : 'NULL'},${esc(ctype)},${esc(cstart)},${cend ? esc(cend) : 'NULL'},${esc(skills)})`
})
push(empRows.join(',\n') + ';\n')

push(`
-- Org chart: payroll specialist + kế toán viên report to Kế toán trưởng
UPDATE employees SET manager_id = 'e29' WHERE id IN ('e8','e21') AND organization_id = ${esc(ORG)};
PRAGMA foreign_keys = ON;
`)

// --- employment_events ---
const events = [
  ['ee1','e5','2016-01-04','join','Gia nhập công ty — Tổng giám đốc'],
  ['ee2','e4','2018-02-12','join','Gia nhập — Kinh doanh'],
  ['ee3','e4','2021-02-12','promotion','Bổ nhiệm Giám đốc kinh doanh'],
  ['ee4','e4','2024-01-01','salary_change','Điều chỉnh lương cơ bản lên 45.000.000 ₫'],
  ['ee5','e3','2019-09-01','join','Gia nhập — Nhân sự'],
  ['ee6','e3','2022-09-01','promotion','Bổ nhiệm Trưởng phòng nhân sự'],
  ['ee7','e1','2022-03-01','join','Gia nhập — Kinh doanh'],
  ['ee8','e1','2025-03-01','salary_change','Tăng lương sau đánh giá năm 2024'],
  ['ee9','e7','2020-08-17','join','Gia nhập — Kỹ thuật'],
  ['ee10','e7','2023-08-17','promotion','Bổ nhiệm Trưởng nhóm kỹ thuật'],
  ['ee11','e12','2023-01-09','join','Gia nhập — Kế toán'],
  ['ee12','e12','2026-08-15','leave','Nghỉ việc theo thỏa thuận'],
  ['ee13','e28','2021-01-15','join','Gia nhập — Kỹ thuật'],
  ['ee14','e28','2026-06-30','leave','Nghỉ việc — chuyển việc'],
  ['ee15','e11','2026-08-03','join','Nhận việc thử việc 3 tháng'],
  ['ee16','e24','2018-06-01','join','Gia nhập — Customer Success'],
  ['ee17','e24','2021-06-01','promotion','Bổ nhiệm Trưởng phòng CS'],
  ['ee18','e9','2024-02-01','join','Gia nhập — Tuyển dụng'],
  ['ee19','e8','2021-05-10','join','Gia nhập — Kế toán'],
  ['ee20','e21','2025-09-01','join','Nhận việc thay thế vị trí kế toán viên'],
  ['ee21','e29','2018-09-03','join','Gia nhập — Kế toán'],
  ['ee22','e29','2021-09-03','promotion','Bổ nhiệm Kế toán trưởng'],
  ['ee23','e13','2017-03-15','join','Gia nhập — Ban giám đốc'],
  ['ee24','e10','2019-04-08','join','Gia nhập — Marketing'],
  ['ee25','e6','2022-11-07','join','Gia nhập — Marketing'],
]
push(`INSERT OR REPLACE INTO employment_events (id, organization_id, employee_id, event_date, event_type, detail, created_by) VALUES`)
push(
  events
    .map(([id, emp, date, type, detail]) => {
      count('employment_events')
      return ` (${esc(id)},${esc(ORG)},${esc(emp)},${esc(date)},${esc(type)},${esc(detail)},'u_hr_admin')`
    })
    .join(',\n') + ';\n',
)

// --- document_types + documents ---
const docTypes = [
  ['dt1', 'CMND/CCCD', 1],
  ['dt2', 'Hợp đồng lao động', 1],
  ['dt3', 'Sổ BHXH', 1],
  ['dt4', 'Bằng cấp', 0],
  ['dt5', 'Giấy khám sức khỏe', 0],
]
push(`INSERT OR REPLACE INTO document_types (id, organization_id, name, required) VALUES`)
push(
  docTypes
    .map(([id, name, req]) => {
      count('document_types')
      return ` (${esc(id)},${esc(ORG)},${esc(name)},${req})`
    })
    .join(',\n') + ';\n',
)

const docs = []
let di = 1
for (const e of employees.filter((x) => x[14] === 'active').slice(0, 20)) {
  const id = e[0]
  docs.push([`doc${di++}`, id, 'CMND/CCCD', `cccd_${e[1]}.pdf`, 'application/pdf', 245000, `org_demo/docs/${id}/cccd.pdf`, '2024-01-15', '2034-01-15'])
  docs.push([`doc${di++}`, id, 'Hợp đồng lao động', `hdld_${e[1]}.pdf`, 'application/pdf', 180000, `org_demo/docs/${id}/contract.pdf`, e[18], e[19]])
}
// a few more variety
docs.push(['doc_bh_e3', 'e3', 'Sổ BHXH', 'bhxh_e3.pdf', 'application/pdf', 120000, 'org_demo/docs/e3/bhxh.pdf', '2019-10-01', null])
docs.push(['doc_deg_e7', 'e7', 'Bằng cấp', 'bang_dai_hoc_e7.pdf', 'application/pdf', 890000, 'org_demo/docs/e7/degree.pdf', '2013-06-20', null])

push(`INSERT OR REPLACE INTO documents (id, organization_id, employee_id, type_name, file_name, content_type, size_bytes, r2_key, issued_on, expires_on, uploaded_by) VALUES`)
push(
  docs
    .map(([id, emp, type, file, ct, size, key, issued, exp]) => {
      count('documents')
      return ` (${esc(id)},${esc(ORG)},${esc(emp)},${esc(type)},${esc(file)},${esc(ct)},${size},${esc(key)},${issued ? esc(issued) : 'NULL'},${exp ? esc(exp) : 'NULL'},'u_hr_admin')`
    })
    .join(',\n') + ';\n',
)

// --- holidays ---
push(`INSERT OR REPLACE INTO holidays (id, organization_id, holiday_date, name, year) VALUES`)
push(
  HOLIDAYS.map(([d, name], i) => {
    count('holidays')
    return ` ('h${i + 1}',${esc(ORG)},${esc(d)},${esc(name)},2026)`
  }).join(',\n') + ';\n',
)

// --- leave types ---
const leaveTypes = [
  ['lt_annual', 'annual', 'Phép năm', 1, 12],
  ['lt_sick', 'sick', 'Ốm đau', 1, 30],
  ['lt_special', 'special', 'Việc riêng / chế độ', 1, 3],
  ['lt_unpaid', 'unpaid', 'Không lương', 0, null],
]
push(`INSERT OR REPLACE INTO leave_types (id, organization_id, code, name, paid, quota_days) VALUES`)
push(
  leaveTypes
    .map(([id, code, name, paid, quota]) => {
      count('leave_types')
      return ` (${esc(id)},${esc(ORG)},${esc(code)},${esc(name)},${paid},${quota === null ? 'NULL' : quota})`
    })
    .join(',\n') + ';\n',
)

// leave adjustments
const leaveAdj = [
  ['la_e1', 'e1', 2026, 2, 'Thâm niên + phép chuyển năm'],
  ['la_e3', 'e3', 2026, 3, 'Thâm niên'],
  ['la_e5', 'e5', 2026, 5, 'Thâm niên lãnh đạo'],
  ['la_e7', 'e7', 2026, 1, 'Phép chuyển từ 2025'],
  ['la_e4', 'e4', 2026, 2, 'Thâm niên'],
  ['la_e24', 'e24', 2026, 2, 'Thâm niên'],
]
push(`INSERT OR REPLACE INTO leave_adjustments (id, organization_id, employee_id, year, days, reason, created_by) VALUES`)
push(
  leaveAdj
    .map(([id, emp, year, days, reason]) => {
      count('leave_adjustments')
      return ` (${esc(id)},${esc(ORG)},${esc(emp)},${year},${days},${esc(reason)},'u_hr_admin')`
    })
    .join(',\n') + ';\n',
)

// ~40 leave requests including golden l1, l8, l9
const leaves = [
  // Golden
  ['l1', 'e1', 'annual', '2026-03-09', '2026-03-11', 3, 'approved', 'Nghỉ phép gia đình', 'u_hr_admin', '2026-03-08T10:00:00Z'],
  ['l8', 'e9', 'special', '2026-09-14', '2026-09-16', 3, 'approved', 'Việc gia đình', 'u_hr_admin', '2026-09-13T09:00:00Z'],
  ['l9', 'e10', 'unpaid', '2026-10-12', '2026-10-12', 1, 'approved', 'Việc đột xuất', 'u_hr_admin', '2026-10-11T16:00:00Z'],
  // More spanning 2026
  ['l2', 'e2', 'annual', '2026-01-20', '2026-01-21', 2, 'approved', 'Nghỉ đầu năm', 'e7', '2026-01-18T08:00:00Z'],
  ['l3', 'e3', 'annual', '2026-04-06', '2026-04-08', 3, 'approved', 'Nghỉ phép quý 2', 'e5', '2026-04-01T09:00:00Z'],
  ['l4', 'e4', 'sick', '2026-05-12', '2026-05-13', 2, 'approved', 'Ốm sốt', 'e5', '2026-05-12T07:30:00Z'],
  ['l5', 'e6', 'annual', '2026-06-02', '2026-06-04', 3, 'approved', 'Du lịch hè', 'e10', '2026-05-20T11:00:00Z'],
  ['l6', 'e7', 'annual', '2026-07-13', '2026-07-17', 5, 'approved', 'Nghỉ hè gia đình', 'e5', '2026-07-01T10:00:00Z'],
  ['l7', 'e8', 'annual', '2026-08-10', '2026-08-11', 2, 'approved', 'Việc cá nhân', 'e29', '2026-08-05T09:00:00Z'],
  ['l10', 'e11', 'sick', '2026-09-08', '2026-09-08', 1, 'approved', 'Khám bệnh', 'e7', '2026-09-08T08:00:00Z'],
  ['l11', 'e14', 'annual', '2026-09-21', '2026-09-22', 2, 'approved', 'Nghỉ phép', 'e4', '2026-09-15T10:00:00Z'],
  ['l12', 'e15', 'annual', '2026-02-23', '2026-02-25', 3, 'approved', 'Nghỉ sau Tết', 'e4', '2026-02-10T09:00:00Z'],
  ['l13', 'e16', 'special', '2026-03-16', '2026-03-16', 1, 'approved', 'Cưới hỏi họ hàng', 'e4', '2026-03-10T14:00:00Z'],
  ['l14', 'e17', 'annual', '2026-04-20', '2026-04-22', 3, 'approved', 'Nghỉ phép', 'e7', '2026-04-10T09:00:00Z'],
  ['l15', 'e18', 'sick', '2026-05-26', '2026-05-27', 2, 'approved', 'Cảm cúm', 'e7', '2026-05-26T07:00:00Z'],
  ['l16', 'e19', 'annual', '2026-06-15', '2026-06-17', 3, 'approved', 'Nghỉ phép', 'e7', '2026-06-01T10:00:00Z'],
  ['l17', 'e20', 'annual', '2026-07-06', '2026-07-07', 2, 'approved', 'Việc gia đình', 'e3', '2026-07-01T09:00:00Z'],
  ['l18', 'e22', 'annual', '2026-08-03', '2026-08-05', 3, 'approved', 'Nghỉ hè', 'e10', '2026-07-20T11:00:00Z'],
  ['l19', 'e23', 'unpaid', '2026-09-28', '2026-09-29', 2, 'approved', 'Việc riêng không lương', 'e10', '2026-09-25T15:00:00Z'],
  ['l20', 'e24', 'annual', '2026-03-23', '2026-03-25', 3, 'approved', 'Nghỉ phép', 'e5', '2026-03-15T09:00:00Z'],
  ['l21', 'e25', 'annual', '2026-05-04', '2026-05-05', 2, 'approved', 'Nghỉ lễ kéo dài', 'e24', '2026-04-28T10:00:00Z'],
  ['l22', 'e26', 'sick', '2026-06-09', '2026-06-09', 1, 'approved', 'Đau răng', 'e24', '2026-06-09T08:15:00Z'],
  ['l23', 'e27', 'annual', '2026-07-20', '2026-07-22', 3, 'approved', 'Nghỉ phép', 'e24', '2026-07-10T09:00:00Z'],
  ['l24', 'e29', 'annual', '2026-04-13', '2026-04-14', 2, 'approved', 'Việc cá nhân', 'e5', '2026-04-08T10:00:00Z'],
  ['l25', 'e30', 'annual', '2026-09-07', '2026-09-08', 2, 'approved', 'Nghỉ phép', 'e3', '2026-09-01T09:00:00Z'],
  ['l26', 'e31', 'annual', '2026-08-24', '2026-08-26', 3, 'approved', 'Nghỉ phép', 'e4', '2026-08-15T11:00:00Z'],
  ['l27', 'e32', 'special', '2026-02-09', '2026-02-10', 2, 'approved', 'Chuẩn bị Tết công ty', 'e5', '2026-02-05T09:00:00Z'],
  ['l28', 'e1', 'sick', '2026-06-22', '2026-06-22', 1, 'approved', 'Khám sức khỏe', 'e4', '2026-06-22T07:45:00Z'],
  ['l29', 'e6', 'annual', '2026-10-06', '2026-10-07', 2, 'approved', 'Nghỉ phép quý 4', 'e10', '2026-09-28T10:00:00Z'],
  ['l30', 'e13', 'annual', '2026-05-18', '2026-05-20', 3, 'approved', 'Nghỉ phép', 'e5', '2026-05-10T09:00:00Z'],
  ['l31', 'e15', 'annual', '2026-10-20', '2026-10-21', 2, 'pending', 'Nghỉ phép cuối tháng', null, null],
  ['l32', 'e17', 'annual', '2026-10-26', '2026-10-28', 3, 'pending', 'Nghỉ phép đăng ký trước', null, null],
  ['l33', 'e25', 'annual', '2026-09-01', '2026-09-03', 3, 'rejected', 'Trùng lịch sự kiện khách hàng', null, null],
  ['l34', 'e2', 'annual', '2026-10-13', '2026-10-13', 1, 'cancelled', 'Hủy do có công tác', null, null],
  ['l35', 'e18', 'annual', '2026-09-10', '2026-09-11', 2, 'approved', 'Nghỉ phép', 'e7', '2026-09-05T09:00:00Z'],
  ['l36', 'e20', 'special', '2026-08-17', '2026-08-17', 1, 'approved', 'Việc riêng', 'e3', '2026-08-14T10:00:00Z'],
  ['l37', 'e14', 'sick', '2026-07-28', '2026-07-29', 2, 'approved', 'Ốm', 'e4', '2026-07-28T08:00:00Z'],
  ['l38', 'e23', 'annual', '2026-01-05', '2026-01-06', 2, 'approved', 'Nghỉ đầu năm', 'e10', '2026-01-02T09:00:00Z'],
  ['l39', 'e27', 'unpaid', '2026-04-02', '2026-04-02', 1, 'approved', 'Việc riêng', 'e24', '2026-04-01T16:00:00Z'],
  ['l40', 'e4', 'annual', '2026-10-08', '2026-10-09', 2, 'approved', 'Nghỉ phép', 'e5', '2026-10-01T10:00:00Z'],
  ['l41', 'e8', 'sick', '2026-09-25', '2026-09-25', 1, 'approved', 'Khám bệnh', 'e29', '2026-09-25T07:50:00Z'],
  ['l42', 'e26', 'annual', '2026-10-01', '2026-10-02', 2, 'approved', 'Nghỉ phép', 'e24', '2026-09-20T09:00:00Z'],
]

push(`INSERT OR REPLACE INTO leave_requests (
  id, organization_id, employee_id, leave_type, start_date, end_date, working_days, status, reason, reject_note, approved_by, approved_at
) VALUES`)
push(
  leaves
    .map(([id, emp, type, from, to, days, status, reason, approver, at]) => {
      count('leave_requests')
      const reject = status === 'rejected' ? esc('Trùng lịch sự kiện khách hàng — vui lòng chọn tuần khác') : 'NULL'
      return ` (${esc(id)},${esc(ORG)},${esc(emp)},${esc(type)},${esc(from)},${esc(to)},${days},${esc(status)},${esc(reason)},${reject},${approver ? esc(approver) : 'NULL'},${at ? esc(at) : 'NULL'})`
    })
    .join(',\n') + ';\n',
)

// Build leave/travel day sets for attendance skip
const leaveDaysByEmp = new Map()
function addLeaveDays(emp, from, to, status) {
  if (status !== 'approved') return
  if (!leaveDaysByEmp.has(emp)) leaveDaysByEmp.set(emp, new Set())
  for (const d of eachDate(from, to)) leaveDaysByEmp.get(emp).add(d)
}
for (const [id, emp, type, from, to, days, status] of leaves) {
  addLeaveDays(emp, from, to, status)
}
// trips affecting attendance
const tripRanges = [
  ['e1', '2026-09-14', '2026-09-17'],
  ['e2', '2026-09-23', '2026-09-26'],
  ['e15', '2026-08-10', '2026-08-12'],
  ['e16', '2026-09-07', '2026-09-09'],
  ['e17', '2026-10-05', '2026-10-07'],
  ['e24', '2026-07-14', '2026-07-16'],
  ['e4', '2026-06-08', '2026-06-10'],
  ['e7', '2026-05-11', '2026-05-13'],
  ['e19', '2026-04-15', '2026-04-18'],
  ['e25', '2026-03-02', '2026-03-04'],
  ['e31', '2026-10-08', '2026-10-10'],
]
const travelDaysByEmp = new Map()
for (const [emp, from, to] of tripRanges) {
  if (!travelDaysByEmp.has(emp)) travelDaysByEmp.set(emp, new Set())
  for (const d of eachDate(from, to)) travelDaysByEmp.get(emp).add(d)
}

// Golden check-ins Oct 12
const goldenCheckins = {
  e1: { in: '08:04', out: '' },
  e3: { in: '07:52', out: '' },
  e5: { in: '08:20', out: '' },
  e6: { in: '08:36', out: '' },
  e7: { in: '08:01', out: '' },
  e8: { in: '07:58', out: '' },
  e9: { in: '08:09', out: '' },
  e11: { in: '08:12', out: '' },
}

// --- attendance punches Sep + Oct (through 2026-10-12) ---
const punchRows = []
const activeForAtt = employees.filter((e) => {
  const status = e[14]
  const left = e[16]
  // include left employees only for days before left_on
  return true
})

let punchIdx = 1
for (const e of employees) {
  const id = e[0]
  const joined = e[15]
  const left = e[16]
  const status = e[14]
  const days = workdays('2026-09-01', '2026-10-12')
  for (const d of days) {
    if (d < joined) continue
    if (left && d > left) continue
    if (status === 'left' && left && d > left) continue
    if (leaveDaysByEmp.get(id)?.has(d)) continue
    if (travelDaysByEmp.get(id)?.has(d)) continue

    let pin, pout, source
    if (d === '2026-10-12' && goldenCheckins[id]) {
      pin = goldenCheckins[id].in
      pout = goldenCheckins[id].out || null
      source = 'app'
    } else {
      const seed = punchIdx + id.charCodeAt(1)
      pin = timeVar(seed, 8, 0, 28)
      // occasional late
      if (seed % 19 === 0) pin = '09:' + pad(10 + (seed % 40))
      pout = timeVar(seed + 7, 17, 30, 40)
      if (seed % 23 === 0) pout = '18:' + pad(seed % 50)
      // mix sources
      source = seed % 5 === 0 ? 'import' : 'app'
      // incomplete day rare
      if (d === '2026-10-12' && !goldenCheckins[id] && seed % 11 === 0) {
        pout = null
      }
    }
    punchRows.push([`ap${punchIdx++}`, id, d, pin, pout, source])
  }
}

push(`INSERT OR REPLACE INTO attendance_punches (
  id, organization_id, employee_id, work_date, punch_in, punch_out, source, note
) VALUES`)
const punchSql = punchRows.map(([id, emp, d, pin, pout, source]) => {
  count('attendance_punches')
  return ` (${esc(id)},${esc(ORG)},${esc(emp)},${esc(d)},${esc(pin)},${pout ? esc(pout) : 'NULL'},${esc(source)},NULL)`
})
push(punchSql.join(',\n') + ';\n')

// attendance adjustments
const attAdj = [
  ['aa1', 'e2', '2026-09-04', 'P', 'Quên chấm công — xác nhận có mặt cả ngày', 'u_hr_admin'],
  ['aa2', 'e6', '2026-09-15', 'P', 'Máy chấm công lỗi — điều chỉnh thủ công', 'u_hr_admin'],
  ['aa3', 'e14', '2026-10-02', 'P', 'Làm việc tại khách hàng cả ngày', 'u_hr_admin'],
  ['aa4', 'e18', '2026-09-18', 'Nửa ngày', 'Về sớm có phép nửa ngày', 'u_hr_admin'],
  ['aa5', 'e25', '2026-10-09', 'P', 'Import thiếu dòng — bổ sung', 'u_pay'],
]
push(`INSERT OR REPLACE INTO attendance_adjustments (id, organization_id, employee_id, work_date, code, reason, created_by) VALUES`)
push(
  attAdj
    .map(([id, emp, d, code, reason, by]) => {
      count('attendance_adjustments')
      return ` (${esc(id)},${esc(ORG)},${esc(emp)},${esc(d)},${esc(code)},${esc(reason)},${esc(by)})`
    })
    .join(',\n') + ';\n',
)

// --- travel policy ---
const travelPolicyJson = JSON.stringify({
  zones: {
    dn1: { name: 'Hà Nội, TP.HCM', intl: false, perDiem: [200000, 250000, 300000, 400000], hotel: [800000, 1000000, 1500000, 2500000] },
    dn2: { name: 'Thành phố loại I/II khác', intl: false, perDiem: [180000, 220000, 270000, 350000], hotel: [600000, 800000, 1200000, 2000000] },
    dn3: { name: 'Tỉnh, địa phương còn lại', intl: false, perDiem: [150000, 200000, 250000, 300000], hotel: [500000, 650000, 1000000, 1500000] },
    qt1: { name: 'Quốc tế · Châu Á (USD)', intl: true, perDiem: [50, 60, 80, 100], hotel: [70, 90, 130, 200] },
    qt2: { name: 'Quốc tế · Âu, Mỹ, Úc (USD)', intl: true, perDiem: [70, 85, 110, 140], hotel: [100, 130, 180, 280] },
  },
  fx: 25500,
  fullHours: 12,
  halfHours: 4,
  minKm: 15,
  flatRatio: 0.6,
  localDom: 100000,
  localIntl: 300000,
  mealPartial: 0.3,
  mealFull: 0.7,
  settleDays: 7,
})
push(`INSERT OR REPLACE INTO travel_policy_versions (
  id, organization_id, version, effective_from, effective_to, policy_json, approved_by, approved_at
) VALUES (
  'trippol_v1', ${esc(ORG)}, 1, '2026-01-01', NULL, ${esc(travelPolicyJson)}, 'u_hr_admin', '2026-01-05T03:00:00Z'
);
`)
count('travel_policy_versions')

const estimateT1 = JSON.stringify({
  days: 3.5,
  nights: 3,
  perDiem: 770000,
  hotel: 2100000,
  local: 400000,
  transport: 3200000,
  other: 400000,
  total: 6870000,
})
const actualT1 = JSON.stringify({
  start: '2026-09-14T07:30',
  end: '2026-09-17T18:00',
  hotel: 2250000,
  transport: 3050000,
  other: 520000,
  receipts: 6,
  note: 'Giá phòng thực tế thấp hơn dự toán.',
  days: 3.5,
  nights: 3,
  perDiem: 770000,
  local: 400000,
  total: 6990000,
})

// ~12 trips with statuses ok/ap/pm/ph/draft/rj
const trips = [
  {
    id: 't1',
    code: 'CT-2026-0001',
    emp: 'e1',
    origin: 'Hà Nội',
    dest: 'Đà Nẵng',
    zone: 'dn2',
    purpose: 'Gặp khách hàng chiến lược — triển khai hợp đồng Q3',
    start: '2026-09-14T07:30',
    end: '2026-09-17T19:00',
    km: 770,
    transport: 'Máy bay',
    tEst: 3200000,
    oEst: 400000,
    hotelMode: 'actual',
    hotelPrice: 700000,
    meal: 'none',
    advance: 6000000,
    status: 'ok',
    est: estimateT1,
    act: actualT1,
  },
  {
    id: 't2',
    code: 'CT-2026-0002',
    emp: 'e2',
    origin: 'Hà Nội',
    dest: 'Hải Phòng',
    zone: 'dn2',
    purpose: 'Triển khai hạ tầng tại site khách hàng',
    start: '2026-09-23T06:00',
    end: '2026-09-26T21:00',
    km: 120,
    transport: 'Ô tô công ty',
    tEst: 800000,
    oEst: 200000,
    hotelMode: 'flat',
    hotelPrice: 0,
    meal: 'partial',
    advance: 3000000,
    status: 'ap',
    est: JSON.stringify({ days: 3.5, nights: 3, total: 4200000 }),
    act: null,
  },
  {
    id: 't3',
    code: 'CT-2026-0003',
    emp: 'e15',
    origin: 'Hà Nội',
    dest: 'TP. Hồ Chí Minh',
    zone: 'dn1',
    purpose: 'Demo sản phẩm cho đối tác miền Nam',
    start: '2026-08-10T06:30',
    end: '2026-08-12T20:00',
    km: 1150,
    transport: 'Máy bay',
    tEst: 2800000,
    oEst: 300000,
    hotelMode: 'actual',
    hotelPrice: 900000,
    meal: 'none',
    advance: 5000000,
    status: 'ok',
    est: JSON.stringify({ days: 2.5, nights: 2, total: 5800000 }),
    act: JSON.stringify({ hotel: 1800000, transport: 2700000, other: 350000, total: 5950000 }),
  },
  {
    id: 't4',
    code: 'CT-2026-0004',
    emp: 'e16',
    origin: 'TP. Hồ Chí Minh',
    dest: 'Cần Thơ',
    zone: 'dn2',
    purpose: 'Thăm khách hàng Đồng bằng sông Cửu Long',
    start: '2026-09-07T07:00',
    end: '2026-09-09T18:30',
    km: 170,
    transport: 'Xe khách / taxi',
    tEst: 600000,
    oEst: 150000,
    hotelMode: 'actual',
    hotelPrice: 650000,
    meal: 'partial',
    advance: 2500000,
    status: 'st',
    est: JSON.stringify({ days: 2.5, nights: 2, total: 3100000 }),
    act: JSON.stringify({ hotel: 1300000, transport: 580000, other: 200000 }),
  },
  {
    id: 't5',
    code: 'CT-2026-0005',
    emp: 'e17',
    origin: 'Hà Nội',
    dest: 'Đà Nẵng',
    zone: 'dn2',
    purpose: 'Họp kỹ thuật với đội vận hành',
    start: '2026-10-05T08:00',
    end: '2026-10-07T19:00',
    km: 770,
    transport: 'Máy bay',
    tEst: 3000000,
    oEst: 250000,
    hotelMode: 'actual',
    hotelPrice: 750000,
    meal: 'none',
    advance: 4500000,
    status: 'pm',
    est: JSON.stringify({ days: 2.5, nights: 2, total: 5200000 }),
    act: null,
  },
  {
    id: 't6',
    code: 'CT-2026-0006',
    emp: 'e24',
    origin: 'Hà Nội',
    dest: 'Nha Trang',
    zone: 'dn2',
    purpose: 'Workshop onboarding khách hàng lớn',
    start: '2026-07-14T07:00',
    end: '2026-07-16T20:00',
    km: 1280,
    transport: 'Máy bay',
    tEst: 3500000,
    oEst: 400000,
    hotelMode: 'actual',
    hotelPrice: 800000,
    meal: 'full',
    advance: 5500000,
    status: 'ok',
    est: JSON.stringify({ days: 2.5, nights: 2, total: 6200000 }),
    act: JSON.stringify({ hotel: 1600000, transport: 3400000, other: 380000, total: 6100000 }),
  },
  {
    id: 't7',
    code: 'CT-2026-0007',
    emp: 'e4',
    origin: 'Hà Nội',
    dest: 'Huế',
    zone: 'dn3',
    purpose: 'Ký kết hợp đồng khu vực miền Trung',
    start: '2026-06-08T06:00',
    end: '2026-06-10T21:00',
    km: 650,
    transport: 'Máy bay',
    tEst: 2600000,
    oEst: 500000,
    hotelMode: 'actual',
    hotelPrice: 1000000,
    meal: 'none',
    advance: 7000000,
    status: 'ok',
    est: JSON.stringify({ days: 2.5, nights: 2, total: 7500000 }),
    act: JSON.stringify({ hotel: 2000000, transport: 2500000, other: 480000, total: 7400000 }),
  },
  {
    id: 't8',
    code: 'CT-2026-0008',
    emp: 'e7',
    origin: 'Hà Nội',
    dest: 'Singapore',
    zone: 'qt1',
    purpose: 'Tham dự hội thảo cloud khu vực',
    start: '2026-05-11T05:00',
    end: '2026-05-13T22:00',
    km: 2200,
    transport: 'Máy bay',
    tEst: 8500000,
    oEst: 1000000,
    hotelMode: 'actual',
    hotelPrice: 0,
    meal: 'none',
    advance: 15000000,
    status: 'ok',
    est: JSON.stringify({ days: 2.5, nights: 2, total: 18500000, currencyNote: 'USD converted @ fx 25500' }),
    act: JSON.stringify({ hotel: 4500000, transport: 8200000, other: 900000, total: 17800000 }),
  },
  {
    id: 't9',
    code: 'CT-2026-0009',
    emp: 'e19',
    origin: 'TP. Hồ Chí Minh',
    dest: 'Đà Lạt',
    zone: 'dn3',
    purpose: 'Kiểm tra hạ tầng DC dự phòng',
    start: '2026-04-15T07:30',
    end: '2026-04-18T18:00',
    km: 300,
    transport: 'Ô tô',
    tEst: 1200000,
    oEst: 300000,
    hotelMode: 'flat',
    hotelPrice: 0,
    meal: 'partial',
    advance: 4000000,
    status: 'ph',
    est: JSON.stringify({ days: 3.5, nights: 3, total: 4800000 }),
    act: null,
  },
  {
    id: 't10',
    code: 'CT-2026-0010',
    emp: 'e25',
    origin: 'Hà Nội',
    dest: 'Vinh',
    zone: 'dn3',
    purpose: 'Hỗ trợ triển khai khách hàng tỉnh',
    start: '2026-03-02T06:00',
    end: '2026-03-04T19:00',
    km: 300,
    transport: 'Tàu / xe',
    tEst: 900000,
    oEst: 200000,
    hotelMode: 'actual',
    hotelPrice: 550000,
    meal: 'none',
    advance: 2500000,
    status: 'ok',
    est: JSON.stringify({ days: 2.5, nights: 2, total: 3200000 }),
    act: JSON.stringify({ hotel: 1100000, transport: 850000, other: 180000, total: 3150000 }),
  },
  {
    id: 't11',
    code: 'CT-2026-0011',
    emp: 'e31',
    origin: 'TP. Hồ Chí Minh',
    dest: 'Hà Nội',
    zone: 'dn1',
    purpose: 'Họp pre-sales với đội sản phẩm',
    start: '2026-10-08T07:00',
    end: '2026-10-10T18:00',
    km: 1150,
    transport: 'Máy bay',
    tEst: 2900000,
    oEst: 250000,
    hotelMode: 'actual',
    hotelPrice: 850000,
    meal: 'partial',
    advance: 0,
    status: 'draft',
    est: JSON.stringify({ days: 2.5, nights: 2, total: 5100000 }),
    act: null,
  },
  {
    id: 't12',
    code: 'CT-2026-0012',
    emp: 'e6',
    origin: 'Hà Nội',
    dest: 'Hạ Long',
    zone: 'dn3',
    purpose: 'Quay nội dung marketing sự kiện',
    start: '2026-08-20T08:00',
    end: '2026-08-21T17:00',
    km: 160,
    transport: 'Xe công ty',
    tEst: 400000,
    oEst: 500000,
    hotelMode: 'none',
    hotelPrice: 0,
    meal: 'full',
    advance: 1000000,
    status: 'rj',
    est: JSON.stringify({ days: 1.5, nights: 0, total: 1500000 }),
    act: null,
    reject: 'Sự kiện đã chuyển sang online — không cần công tác',
  },
]

push(`INSERT OR REPLACE INTO trips (
  id, organization_id, code, employee_id, origin, destination, zone, purpose,
  start_at, end_at, distance_km, transport, transport_est, other_est, other_note,
  hotel_mode, hotel_price, meal, advance, status, reject_note, policy_version_id,
  estimate_json, actual_json, created_by
) VALUES`)
push(
  trips
    .map((t) => {
      count('trips')
      return ` (${esc(t.id)},${esc(ORG)},${esc(t.code)},${esc(t.emp)},${esc(t.origin)},${esc(t.dest)},${esc(t.zone)},${esc(t.purpose)},${esc(t.start)},${esc(t.end)},${t.km},${esc(t.transport)},${t.tEst},${t.oEst},NULL,${esc(t.hotelMode)},${t.hotelPrice},${esc(t.meal)},${t.advance},${esc(t.status)},${t.reject ? esc(t.reject) : 'NULL'},'trippol_v1',${esc(t.est)},${t.act ? esc(t.act) : 'NULL'},'u_hr_admin')`
    })
    .join(',\n') + ';\n',
)

const tripHist = [
  ['th1', 't1', '2026-09-10T08:00:00Z', 'employee', null, 'Tạo đề nghị công tác CT-2026-0001'],
  ['th2', 't1', '2026-09-10T14:00:00Z', 'manager', null, 'Quản lý phê duyệt'],
  ['th3', 't1', '2026-09-11T09:00:00Z', 'hr', 'u_hr_admin', 'Nhân sự xác nhận'],
  ['th4', 't1', '2026-09-11T15:00:00Z', 'finance', 'u_pay', 'Tài chính duyệt tạm ứng'],
  ['th5', 't1', '2026-09-18T10:00:00Z', 'employee', null, 'Nộp quyết toán — 6 hóa đơn'],
  ['th6', 't1', '2026-09-19T11:00:00Z', 'finance', 'u_pay', 'Quyết toán hoàn tất (6.990.000 ₫)'],
  ['th7', 't2', '2026-09-20T09:00:00Z', 'employee', null, 'Tạo đề nghị công tác Hải Phòng'],
  ['th8', 't2', '2026-09-21T10:00:00Z', 'manager', null, 'Quản lý phê duyệt — chờ tài chính'],
  ['th9', 't5', '2026-10-01T08:00:00Z', 'employee', null, 'Tạo nháp / gửi quản lý'],
  ['th10', 't12', '2026-08-18T09:00:00Z', 'manager', null, 'Từ chối — sự kiện chuyển online'],
  ['th11', 't8', '2026-05-01T08:00:00Z', 'employee', null, 'Đăng ký công tác Singapore'],
  ['th12', 't8', '2026-05-14T16:00:00Z', 'finance', 'u_pay', 'Quyết toán quốc tế hoàn tất'],
  ['th13', 't4', '2026-09-10T09:00:00Z', 'employee', null, 'Nộp chứng từ quyết toán'],
  ['th14', 't11', '2026-10-06T08:00:00Z', 'employee', null, 'Lưu nháp — chưa gửi'],
]
push(`INSERT OR REPLACE INTO trip_history (id, trip_id, at, actor_role, actor_user_id, text) VALUES`)
push(
  tripHist
    .map(([id, trip, at, role, uid, text]) => {
      count('trip_history')
      return ` (${esc(id)},${esc(trip)},${esc(at)},${esc(role)},${uid ? esc(uid) : 'NULL'},${esc(text)})`
    })
    .join(',\n') + ';\n',
)

// --- payroll policy (pending legal review) + earnings ---
const payPolicy = JSON.stringify({
  ref: 2340000,
  capMult: 20,
  bhEmp: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 },
  bhEr: { bhxh: 0.14, om: 0.03, tnld: 0.005, bhyt: 0.03, bhtn: 0.01 },
  selfDed: 15500000,
  depDed: 6200000,
  mealExempt: 730000,
  brackets: [
    [10000000, 0.05],
    [30000000, 0.1],
    [60000000, 0.2],
    [100000000, 0.3],
    [1e15, 0.35],
  ],
})
push(`INSERT OR REPLACE INTO payroll_policy_versions (
  id, organization_id, version, effective_from, effective_to, policy_json, source_citations_json, legal_review_status
) VALUES (
  'paypol_v1', ${esc(ORG)}, 1, '2026-01-01', NULL, ${esc(payPolicy)},
  ${esc(JSON.stringify([{ code: 'handoff-sample', note: 'Compatibility sample — pending legal approval' }]))},
  'pending'
);
`)
count('payroll_policy_versions')

// Golden allowances + bonuses; plus a few for new employees (won't be in closed run)
const earnings = [
  ['a1', null, '*', 'allowance', 'Ăn trưa', 730000, 1],
  ['a2', 'e4', '*', 'allowance', 'Điện thoại', 500000, 1],
  ['a3', 'e5', '*', 'allowance', 'Điện thoại', 800000, 1],
  ['a4', 'e10', '*', 'allowance', 'Điện thoại', 500000, 1],
  ['a5', 'e3', '*', 'allowance', 'Trách nhiệm', 2000000, 1],
  ['a6', 'e7', '*', 'allowance', 'Trách nhiệm', 2000000, 1],
  ['a7', 'e10', '*', 'allowance', 'Trách nhiệm', 3000000, 1],
  ['a8', 'e4', '*', 'allowance', 'Trách nhiệm', 5000000, 1],
  ['a9', 'e1', '2026-09', 'bonus', 'Thưởng KPI quý 3', 6000000, 1],
  ['a10', 'e2', '2026-09', 'bonus', 'Thưởng dự án', 3000000, 1],
  ['a11', 'e7', '2026-09', 'bonus', 'Thưởng dự án', 4000000, 1],
  ['a12', 'e4', '2026-09', 'bonus', 'Thưởng KPI quý 3', 15000000, 1],
  // Extra for expanded org (calc later — no closed run)
  ['a13', 'e13', '*', 'allowance', 'Điện thoại', 800000, 1],
  ['a14', 'e24', '*', 'allowance', 'Trách nhiệm', 2500000, 1],
  ['a15', 'e29', '*', 'allowance', 'Trách nhiệm', 3000000, 1],
  ['a16', 'e16', '*', 'allowance', 'Điện thoại', 400000, 1],
  ['a17', 'e15', '2026-09', 'bonus', 'Thưởng doanh số', 5000000, 1],
  ['a18', 'e24', '2026-09', 'bonus', 'Thưởng CSAT quý 3', 4000000, 1],
]
push(`INSERT OR REPLACE INTO earnings (id, organization_id, employee_id, year_month, kind, title, amount, taxable, note) VALUES`)
push(
  earnings
    .map(([id, emp, ym, kind, title, amount, taxable]) => {
      count('earnings')
      return ` (${esc(id)},${esc(ORG)},${emp ? esc(emp) : 'NULL'},${esc(ym)},${esc(kind)},${esc(title)},${amount},${taxable},NULL)`
    })
    .join(',\n') + ';\n',
)

push(`
-- No closed payroll_run: company Sep 2026 golden totals (375.420.909 gross) are for the
-- original 12-employee set. Expanded headcount would diverge. Earnings + policy are seeded
-- so payroll can be calculated in-app after legal review approval.
`)

// --- recruiting ---
const jobs = [
  ['job1', 'Kỹ sư Frontend', 'Kỹ thuật', 2, 'Mid', 'Hà Nội', '18–28 triệu', 'open', '2026-09-01', '2026-10-31', 'Tuyển Frontend cho đội sản phẩm HRM.', '["Phát triển UI React","Tối ưu hiệu năng","Phối hợp với thiết kế"]', '["2+ năm React/TypeScript","Hiểu REST API","Tiếng Anh đọc tài liệu"]', '["BHXH đầy đủ","Làm việc hybrid","Thưởng quý"]'],
  ['job2', 'Chuyên viên kinh doanh', 'Kinh doanh', 1, 'Junior–Mid', 'Hà Nội / TP.HCM', '15–22 triệu + hoa hồng', 'open', '2026-08-15', '2026-11-15', 'Mở rộng đội bán hàng cloud B2B.', '["Chăm sóc pipeline","Demo sản phẩm","Đạt KPI doanh số"]', '["1+ năm sales B2B SaaS","Giao tiếp tốt","Sẵn sàng đi công tác"]', '["Hoa hồng hấp dẫn","Laptop","Du lịch team"]'],
  ['job3', 'Chuyên viên Customer Success', 'Customer Success', 1, 'Junior', 'Hà Nội', '13–18 triệu', 'open', '2026-09-20', '2026-11-30', 'Hỗ trợ khách hàng onboarding và gia hạn.', '["Onboarding khách","Theo dõi health score","Phối hợp kỹ thuật"]', '["Kinh nghiệm CS/support","CRM","Giao tiếp"]', '["Đào tạo nội bộ","Lộ trình thăng tiến"]'],
  ['job4', 'Thực tập sinh Marketing', 'Marketing', 2, 'Intern', 'Hà Nội', '5–7 triệu', 'closed', '2026-06-01', '2026-07-31', 'Kỳ thực tập hè — đã đóng.', '["Hỗ trợ content","Báo cáo chiến dịch"]', '["Sinh viên năm 3–4","Yêu thích digital"]', '["Mentor","Certificate"]'],
  ['job5', 'Kế toán tổng hợp', 'Kế toán', 1, 'Mid', 'Hà Nội', '16–22 triệu', 'draft', null, null, 'Dự phòng tuyển khi hết hạn HĐLĐ.', '["Hạch toán","Báo cáo tháng"]', '["Chứng chỉ kế toán","2+ năm kinh nghiệm"]', '["BHXH","Thưởng Tết"]'],
]
push(`INSERT OR REPLACE INTO job_requisitions (
  id, organization_id, title, department, headcount, level, location, salary_display, status, posted_on, deadline, summary, duties_json, requirements_json, benefits_json
) VALUES`)
push(
  jobs
    .map((j) => {
      count('job_requisitions')
      const [id, title, dept, hc, level, loc, sal, status, posted, deadline, summary, duties, reqs, bens] = j
      return ` (${esc(id)},${esc(ORG)},${esc(title)},${esc(dept)},${hc},${esc(level)},${esc(loc)},${esc(sal)},${esc(status)},${posted ? esc(posted) : 'NULL'},${deadline ? esc(deadline) : 'NULL'},${esc(summary)},${esc(duties)},${esc(reqs)},${esc(bens)})`
    })
    .join(',\n') + ';\n',
)

const candidates = [
  ['c1', 'job1', 'Nguyễn Văn Phong', 'LinkedIn', 'interview', 4.2, 'phong.nv.demo@example.com', '0902 111 001', '2026-10-14T09:30:00+07:00', 'Vòng kỹ thuật tốt'],
  ['c2', 'job1', 'Trần Mỹ Anh', 'TopCV', 'screen', 3.5, 'myanh.tran.demo@example.com', '0902 111 002', null, 'CV phù hợp React'],
  ['c3', 'job1', 'Lê Đức Thịnh', 'Giới thiệu', 'offer', 4.6, 'thinh.ld.demo@example.com', '0902 111 003', '2026-10-08T14:00:00+07:00', 'Đề xuất offer 24tr'],
  ['c4', 'job2', 'Phạm Thu Hà', 'VietnamWorks', 'new', 0, 'thuha.ph.demo@example.com', '0902 111 004', null, null],
  ['c5', 'job2', 'Hoàng Minh Quân', 'LinkedIn', 'interview', 3.8, 'quan.hm.demo@example.com', '0902 111 005', '2026-10-16T10:00:00+07:00', 'Kinh nghiệm SaaS 2 năm'],
  ['c6', 'job3', 'Đỗ Lan Anh', 'Fanpage', 'screen', 3.2, 'lananh.do.demo@example.com', '0902 111 006', null, 'CS ngân hàng trước đây'],
  ['c7', 'job3', 'Vũ Thành Công', 'TopCV', 'rejected', 2.1, 'cong.vt.demo@example.com', '0902 111 007', null, 'Thiếu kinh nghiệm SaaS'],
  ['c8', 'job4', 'Ngô Bảo Ngọc', 'University', 'hired', 4.0, 'ngoc.nb.demo@example.com', '0902 111 008', null, 'Đã onboard thực tập 7/2026'],
  ['c9', 'job1', 'Bùi Khánh Vy', 'LinkedIn', 'new', 0, 'vy.bk.demo@example.com', '0902 111 009', null, null],
  ['c10', 'job2', 'Mai Xuân Bắc', 'Giới thiệu', 'screen', 3.0, 'bac.mx.demo@example.com', '0902 111 010', null, 'Giới thiệu từ e15'],
]
push(`INSERT OR REPLACE INTO candidates (
  id, organization_id, job_id, full_name, source, stage, score, email, phone, interview_at, note
) VALUES`)
push(
  candidates
    .map(([id, job, name, src, stage, score, email, phone, iv, note]) => {
      count('candidates')
      return ` (${esc(id)},${esc(ORG)},${esc(job)},${esc(name)},${esc(src)},${esc(stage)},${score},${esc(email)},${esc(phone)},${iv ? esc(iv) : 'NULL'},${note ? esc(note) : 'NULL'})`
    })
    .join(',\n') + ';\n',
)

const onboardTasks = (items) => JSON.stringify(items)
const ob1Tasks = onboardTasks([
  { title: 'Ký HĐLĐ & nhận thiết bị', done: false, due: '2026-11-03' },
  { title: 'Tạo tài khoản email / SSO', done: false, due: '2026-11-03' },
  { title: 'Orientation văn hóa Orange Cloud', done: false, due: '2026-11-04' },
  { title: 'Gặp mentor kỹ thuật (e7)', done: false, due: '2026-11-05' },
])
const ob2Tasks = onboardTasks([
  { title: 'Hoàn tất hồ sơ nhân sự', done: true, due: '2026-08-03' },
  { title: 'Đào tạo nội quy & ATĐ', done: true, due: '2026-08-04' },
  { title: 'Setup máy & repo', done: true, due: '2026-08-05' },
  { title: 'Buddy check-in tuần 2', done: false, due: '2026-08-17' },
])
const ob3Tasks = onboardTasks([
  { title: 'Ký HĐ thử việc', done: true, due: '2025-09-01' },
  { title: 'Bàn giao sổ sách từ e12', done: true, due: '2025-09-05' },
  { title: 'Đào tạo quy trình lương', done: false, due: '2025-10-01' },
])
push(`INSERT OR REPLACE INTO onboarding_plans (
  id, organization_id, candidate_id, employee_id, full_name, role_title, department, start_date, tasks_json
) VALUES
 ('ob1',${esc(ORG)},'c3',NULL,${esc('Lê Đức Thịnh')},${esc('Kỹ sư Frontend')},${esc('Kỹ thuật')},'2026-11-03',${esc(ob1Tasks)}),
 ('ob2',${esc(ORG)},NULL,'e11',${esc('Lý Hải Nam')},${esc('Kỹ sư phần mềm')},${esc('Kỹ thuật')},'2026-08-03',${esc(ob2Tasks)}),
 ('ob3',${esc(ORG)},NULL,'e21',${esc('Nguyễn Đức Anh')},${esc('Kế toán viên')},${esc('Kế toán')},'2025-09-01',${esc(ob3Tasks)});
`)
count('onboarding_plans', 3)

// --- performance ---
push(`INSERT OR REPLACE INTO review_cycles (id, organization_id, name, start_date, end_date, status) VALUES
 ('rc1',${esc(ORG)},${esc('Đánh giá năm 2025')},'2025-12-01','2026-01-31','closed'),
 ('rc2',${esc(ORG)},${esc('Đánh giá giữa năm 2026')},'2026-06-01','2026-07-15','closed'),
 ('rc3',${esc(ORG)},${esc('Đánh giá cuối năm 2026')},'2026-11-01','2026-12-20','planned');
`)
count('review_cycles', 3)

const ratingEmps = ['e1', 'e2', 'e3', 'e4', 'e6', 'e7', 'e8', 'e9', 'e10', 'e14', 'e15', 'e17', 'e20', 'e24', 'e25']
push(`INSERT OR REPLACE INTO ratings (id, organization_id, cycle_id, employee_id, self_score, manager_score, final_score) VALUES`)
const ratingRows = []
let ri = 1
for (const cycle of ['rc1', 'rc2']) {
  for (const emp of ratingEmps) {
    const self = 3.2 + ((ri * 7) % 15) / 10
    const mgr = 3.0 + ((ri * 11) % 18) / 10
    const fin = Math.round(((self + mgr) / 2) * 10) / 10
    ratingRows.push(` ('rt${ri++}',${esc(ORG)},${esc(cycle)},${esc(emp)},${self.toFixed(1)},${mgr.toFixed(1)},${fin.toFixed(1)})`)
    count('ratings')
  }
}
push(ratingRows.join(',\n') + ';\n')

const objectives = [
  ['obj1', 'e1', '2026-H2', 'Đạt tiền doanh số cá nhân 2,4 tỷ', '[{"kr":"Chốt 8 hợp đồng mới","progress":0.6},{"kr":"Upsell 5 khách hiện hữu","progress":0.4}]'],
  ['obj2', 'e7', '2026-H2', 'Ổn định nền tảng HRM trên Cloudflare', '[{"kr":"Uptime >= 99.9%","progress":0.85},{"kr":"Giảm P1 còn < 2/tháng","progress":0.7}]'],
  ['obj3', 'e9', '2026-H2', 'Tuyển đủ headcount kỹ thuật & CS', '[{"kr":"Đóng 3 vị trí open","progress":0.5},{"kr":"Time-to-hire trung bình <= 35 ngày","progress":0.4}]'],
  ['obj4', 'e10', '2026-H2', 'Tăng nhận diện thương hiệu Orange Cloud', '[{"kr":"+30% organic traffic","progress":0.55},{"kr":"2 chiến dịch lớn Q4","progress":0.3}]'],
  ['obj5', 'e24', '2026-H2', 'Nâng CSAT trung bình lên 4.5/5', '[{"kr":"CSAT quý >= 4.5","progress":0.65},{"kr":"Giảm churn < 3%","progress":0.5}]'],
  ['obj6', 'e8', '2026-H2', 'Chuẩn hóa quy trình lương & quyết toán', '[{"kr":"Đóng lương đúng hạn 12/12 tháng","progress":0.75},{"kr":"0 sai sót PIT nghiêm trọng","progress":0.9}]'],
  ['obj7', 'e4', '2026-H2', 'Doanh thu phòng Kinh doanh vượt 120% kế hoạch', '[{"kr":"Pipeline >= 15 tỷ","progress":0.7},{"kr":"Win-rate >= 28%","progress":0.45}]'],
  ['obj8', 'e17', '2026-H2', 'Hoàn thành module API v2', '[{"kr":"Ship 100% epic Q4","progress":0.5},{"kr":"Coverage unit >= 80%","progress":0.6}]'],
]
push(`INSERT OR REPLACE INTO objectives (id, organization_id, employee_id, period, objective, key_results_json) VALUES`)
push(
  objectives
    .map(([id, emp, period, obj, krs]) => {
      count('objectives')
      return ` (${esc(id)},${esc(ORG)},${esc(emp)},${esc(period)},${esc(obj)},${esc(krs)})`
    })
    .join(',\n') + ';\n',
)

const fb360 = [
  ['fb1', 'e1', '2026-H1', '["Giao tiếp","Làm việc nhóm","Chuyên môn","Chủ động"]', '{"peer":4.1,"manager":4.3,"self":4.0}'],
  ['fb2', 'e7', '2026-H1', '["Lãnh đạo","Chuyên môn","Mentoring","Giao tiếp"]', '{"peer":4.4,"manager":4.5,"self":4.2}'],
  ['fb3', 'e3', '2026-H1', '["Luật lao động","Giao tiếp","Công bằng","Lãnh đạo"]', '{"peer":4.6,"manager":4.7,"self":4.4}'],
  ['fb4', 'e24', '2026-H1', '["CSM","Đồng cảm","Giải quyết vấn đề","Làm việc nhóm"]', '{"peer":4.2,"manager":4.0,"self":4.1}'],
  ['fb5', 'e10', '2026-H1', '["Sáng tạo","Chiến lược","Giao tiếp","Quản lý nhóm"]', '{"peer":3.9,"manager":4.1,"self":4.0}'],
]
push(`INSERT OR REPLACE INTO feedback_360 (id, organization_id, employee_id, period, competencies_json, scores_json) VALUES`)
push(
  fb360
    .map(([id, emp, period, comps, scores]) => {
      count('feedback_360')
      return ` (${esc(id)},${esc(ORG)},${esc(emp)},${esc(period)},${esc(comps)},${esc(scores)})`
    })
    .join(',\n') + ';\n',
)

// --- learning ---
const courses = [
  ['course1', 'An toàn thông tin bắt buộc 2026', 'Bắt buộc', 4, 1, 'Bảo mật', 'Nội bộ', 'Khóa bắt buộc hàng năm cho toàn bộ nhân viên.'],
  ['course2', 'Kỹ năng bán hàng B2B Cloud', 'Chuyên môn', 8, 0, 'Bán hàng B2B', 'Orange Academy', 'Pipeline, demo, đàm phán hợp đồng SaaS.'],
  ['course3', 'Cloudflare Workers & D1 thực chiến', 'Chuyên môn', 12, 0, 'Cloud', 'Orange Academy', 'Xây dựng ứng dụng trên Cloudflare.'],
  ['course4', 'Luật lao động cập nhật 2026', 'Tuân thủ', 6, 1, 'Luật lao động', 'Đối tác pháp lý', 'Dành cho HR và quản lý.'],
  ['course5', 'Customer Success playbook', 'Chuyên môn', 6, 0, 'CSM', 'Orange Academy', 'Onboarding, QBR, chống churn.'],
  ['course6', 'Excel & báo cáo lương', 'Chuyên môn', 5, 0, 'Payroll', 'Nội bộ', 'Công thức, đối soát BHXH/PIT.'],
]
push(`INSERT OR REPLACE INTO courses (id, organization_id, title, course_type, hours, mandatory, skill, provider, description) VALUES`)
push(
  courses
    .map(([id, title, type, hours, mand, skill, provider, desc]) => {
      count('courses')
      return ` (${esc(id)},${esc(ORG)},${esc(title)},${esc(type)},${hours},${mand},${esc(skill)},${esc(provider)},${esc(desc)})`
    })
    .join(',\n') + ';\n',
)

const enrollments = [
  ['en1', 'e1', 'course1', 100, '2026-03-31'],
  ['en2', 'e1', 'course2', 80, '2026-10-31'],
  ['en3', 'e2', 'course1', 100, '2026-03-31'],
  ['en4', 'e2', 'course3', 60, '2026-11-30'],
  ['en5', 'e3', 'course1', 100, '2026-03-31'],
  ['en6', 'e3', 'course4', 100, '2026-06-30'],
  ['en7', 'e7', 'course3', 90, '2026-09-30'],
  ['en8', 'e8', 'course6', 70, '2026-10-31'],
  ['en9', 'e9', 'course1', 100, '2026-03-31'],
  ['en10', 'e11', 'course1', 40, '2026-10-31'],
  ['en11', 'e24', 'course5', 85, '2026-10-15'],
  ['en12', 'e25', 'course5', 50, '2026-11-15'],
  ['en13', 'e4', 'course2', 100, '2026-08-31'],
  ['en14', 'e17', 'course3', 75, '2026-12-15'],
  ['en15', 'e20', 'course4', 60, '2026-11-30'],
  ['en16', 'e6', 'course1', 100, '2026-03-31'],
  ['en17', 'e29', 'course6', 100, '2026-05-31'],
  ['en18', 'e15', 'course2', 55, '2026-11-30'],
]
push(`INSERT OR REPLACE INTO enrollments (id, organization_id, employee_id, course_id, progress, due_on) VALUES`)
push(
  enrollments
    .map(([id, emp, course, prog, due]) => {
      count('enrollments')
      return ` (${esc(id)},${esc(ORG)},${esc(emp)},${esc(course)},${prog},${esc(due)})`
    })
    .join(',\n') + ';\n',
)

const certs = [
  ['cert1', 'e7', 'AWS Solutions Architect Associate', 'Amazon', '2024-05-12', '2027-05-12'],
  ['cert2', 'e19', 'CKA — Certified Kubernetes Administrator', 'CNCF', '2025-02-20', '2028-02-20'],
  ['cert3', 'e3', 'SHRM-CP', 'SHRM', '2023-11-01', '2026-11-01'],
  ['cert4', 'e8', 'Chứng chỉ kế toán viên', 'Bộ Tài chính', '2022-08-15', null],
  ['cert5', 'e29', 'Chứng chỉ kế toán trưởng', 'Bộ Tài chính', '2020-03-10', null],
  ['cert6', 'e10', 'Google Analytics Individual Qualification', 'Google', '2025-09-01', '2026-09-01'],
]
push(`INSERT OR REPLACE INTO certificates (id, organization_id, employee_id, name, issuer, issued_on, expires_on) VALUES`)
push(
  certs
    .map(([id, emp, name, issuer, issued, exp]) => {
      count('certificates')
      return ` (${esc(id)},${esc(ORG)},${esc(emp)},${esc(name)},${esc(issuer)},${esc(issued)},${exp ? esc(exp) : 'NULL'})`
    })
    .join(',\n') + ';\n',
)

push(`INSERT OR REPLACE INTO career_paths (id, organization_id, name, levels_json) VALUES
 ('cp_eng',${esc(ORG)},${esc('Lộ trình Kỹ thuật')},${esc(JSON.stringify(['Junior','Mid','Senior','Tech Lead','Engineering Manager']))}),
 ('cp_sales',${esc(ORG)},${esc('Lộ trình Kinh doanh')},${esc(JSON.stringify(['AE','Senior AE','Team Lead','Sales Manager','Sales Director']))}),
 ('cp_hr',${esc(ORG)},${esc('Lộ trình Nhân sự')},${esc(JSON.stringify(['HR Exec','HR Specialist','HRBP','HR Manager','HR Director']))}),
 ('cp_cs',${esc(ORG)},${esc('Lộ trình Customer Success')},${esc(JSON.stringify(['CS Associate','CSM','Senior CSM','CS Manager','Head of CS']))});
`)
count('career_paths', 4)

const careers = [
  ['e2', 'cp_eng', 1],
  ['e7', 'cp_eng', 3],
  ['e11', 'cp_eng', 0],
  ['e17', 'cp_eng', 2],
  ['e1', 'cp_sales', 1],
  ['e15', 'cp_sales', 2],
  ['e4', 'cp_sales', 4],
  ['e9', 'cp_hr', 1],
  ['e3', 'cp_hr', 3],
  ['e20', 'cp_hr', 1],
  ['e25', 'cp_cs', 1],
  ['e24', 'cp_cs', 3],
  ['e26', 'cp_cs', 0],
  ['e27', 'cp_cs', 2],
]
push(`INSERT OR REPLACE INTO employee_careers (employee_id, organization_id, path_id, level_index) VALUES`)
push(
  careers
    .map(([emp, path, idx]) => {
      count('employee_careers')
      return ` (${esc(emp)},${esc(ORG)},${esc(path)},${idx})`
    })
    .join(',\n') + ';\n',
)

// --- policy documents ---
const policies = [
  [
    'pol1',
    'Quy định',
    'QD-NS-01',
    'Nội quy lao động',
    'v3.1',
    '2026-01-01',
    'Nội quy làm việc, kỷ luật, giờ giấc tại Orange Cloud.',
    JSON.stringify({
      sections: [
        { h: 'Giờ làm việc', b: '08:00–17:30, nghỉ trưa 12:00–13:00, Thứ Hai–Thứ Sáu.' },
        { h: 'Chấm công', b: 'Chấm công qua ứng dụng hoặc máy tại văn phòng; giải trình trong 48 giờ.' },
      ],
    }),
  ],
  [
    'pol2',
    'Quy định',
    'QD-NS-02',
    'Quy định nghỉ phép',
    'v2.0',
    '2026-01-01',
    'Phép năm, ốm đau, việc riêng và không lương.',
    JSON.stringify({
      sections: [
        { h: 'Phép năm', b: '12 ngày/năm + thâm niên; đăng ký trước tối thiểu 3 ngày làm việc.' },
      ],
    }),
  ],
  [
    'pol3',
    'Quy trình',
    'QT-CT-01',
    'Quy trình công tác phí',
    'v1.4',
    '2026-01-01',
    'Đề nghị → duyệt QL → HR → tạm ứng → quyết toán trong 7 ngày.',
    JSON.stringify({
      sections: [
        { h: 'Quyết toán', b: 'Nộp chứng từ trong settleDays=7 kể từ ngày về.' },
      ],
    }),
  ],
  [
    'pol4',
    'Quy trình',
    'QT-LUONG-01',
    'Quy trình tính và chi trả lương',
    'v1.2',
    '2026-01-01',
    'Khóa công → tính lương → duyệt → chi trả trước ngày 5 tháng sau.',
    JSON.stringify({
      sections: [
        { h: 'Pháp lý', b: 'Tham số BHXH/PIT chỉ áp dụng sau khi legal_review_status=approved.' },
      ],
    }),
  ],
  [
    'pol5',
    'Pháp lý',
    'PL-01',
    'Thông báo bảo vệ dữ liệu cá nhân',
    'v1.0',
    '2026-03-01',
    'Cam kết xử lý dữ liệu nhân sự theo quy định hiện hành.',
    JSON.stringify({
      sections: [
        { h: 'Phạm vi', b: 'Dữ liệu hồ sơ, lương, chấm công chỉ dùng cho mục đích nhân sự.' },
      ],
    }),
  ],
  [
    'pol6',
    'Pháp lý',
    'PL-02',
    'Cam kết tuân thủ Luật An ninh mạng',
    'v1.0',
    '2026-01-15',
    'Trách nhiệm bảo mật thông tin của người lao động.',
    JSON.stringify({
      sections: [{ h: 'Trách nhiệm', b: 'Không chia sẻ mật khẩu; báo cáo sự cố trong 24 giờ.' }],
    }),
  ],
]
push(`INSERT OR REPLACE INTO policy_documents (
  id, organization_id, category, code, title, version, effective_from, summary, body_json
) VALUES`)
push(
  policies
    .map(([id, cat, code, title, ver, from, summary, body]) => {
      count('policy_documents')
      return ` (${esc(id)},${esc(ORG)},${esc(cat)},${esc(code)},${esc(title)},${esc(ver)},${esc(from)},${esc(summary)},${esc(body)})`
    })
    .join(',\n') + ';\n',
)

// --- permission matrix (legacy roles) ---
const modules = ['dash', 'emp', 'rec', 'leave', 'trip', 'pay', 'perf', 'learn', 'pol', 'sys']
const matrix = {
  admin: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  hr: [2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  manager: [1, 1, 1, 2, 2, 0, 2, 1, 1, 0],
  finance: [1, 1, 0, 1, 2, 2, 0, 0, 1, 0],
  employee: [1, 1, 0, 2, 2, 1, 1, 1, 1, 0],
}
const matrixRows = []
for (const [role, levels] of Object.entries(matrix)) {
  levels.forEach((level, i) => {
    matrixRows.push(` (${esc(ORG)},${esc(role)},${esc(modules[i])},${level})`)
    count('permission_matrix')
  })
}
push(`INSERT OR REPLACE INTO permission_matrix (organization_id, role, module_key, level) VALUES`)
push(matrixRows.join(',\n') + ';\n')

// --- audit + notifications ---
const audits = [
  ['ae1', '2026-10-12T02:05:00Z', 'u_hr_admin', 'admin', 'admin@orangecloud.vn', 'login', 'session', null, 'Đăng nhập thành công', '14.241.0.1'],
  ['ae2', '2026-10-12T02:10:00Z', 'u_hr_admin', 'hr', 'admin@orangecloud.vn', 'employee.update', 'employee', 'e11', 'Cập nhật ghi chú thử việc', '14.241.0.1'],
  ['ae3', '2026-10-11T08:22:00Z', 'u_rec', 'employee', 'user.tuyendung@orangecloud.vn', 'candidate.stage', 'candidate', 'c3', 'Chuyển giai đoạn → offer', '14.241.0.2'],
  ['ae4', '2026-10-10T04:15:00Z', 'u_pay', 'employee', 'user.luong@orangecloud.vn', 'earnings.create', 'earning', 'a17', 'Thêm thưởng doanh số e15 tháng 09/2026', '14.241.0.3'],
  ['ae5', '2026-09-19T11:00:00Z', 'u_pay', 'finance', 'user.luong@orangecloud.vn', 'trip.settle', 'trip', 't1', 'Quyết toán CT-2026-0001 = 6.990.000 ₫', '14.241.0.3'],
  ['ae6', '2026-09-13T09:00:00Z', 'u_hr_admin', 'hr', 'admin@orangecloud.vn', 'leave.approve', 'leave_request', 'l8', 'Duyệt nghỉ việc riêng e9', '14.241.0.1'],
  ['ae7', '2026-10-01T01:00:00Z', 'u_super', 'admin', 'super@orangecloud.vn', 'security.update', 'security_settings', 'org_demo', 'session_minutes=480', '10.0.0.1'],
  ['ae8', '2026-08-15T10:30:00Z', 'u_hr_admin', 'hr', 'admin@orangecloud.vn', 'employee.leave', 'employee', 'e12', 'Xác nhận nghỉ việc Trịnh Mỹ Duyên', '14.241.0.1'],
]
push(`INSERT OR REPLACE INTO audit_events (
  id, organization_id, at, actor_user_id, actor_role, actor_email, action, entity_type, entity_id, detail, ip, request_id
) VALUES`)
push(
  audits
    .map(([id, at, uid, role, email, action, et, eid, detail, ip]) => {
      count('audit_events')
      return ` (${esc(id)},${esc(ORG)},${esc(at)},${esc(uid)},${esc(role)},${esc(email)},${esc(action)},${esc(et)},${eid ? esc(eid) : 'NULL'},${esc(detail)},${esc(ip)},${esc('req_' + id)})`
    })
    .join(',\n') + ';\n',
)

const notifs = [
  ['no1', 'email', 'thi.thao@orangecloud.vn', 'Nhắc phỏng vấn ứng viên Lê Đức Thịnh', 'Lịch phỏng vấn vòng cuối 14:00 08/10/2026. Vui lòng chuẩn bị đề xuất offer.', 'pending'],
  ['no2', 'email', 'phuong.linh@orangecloud.vn', 'Nhắc quyết toán công tác CT-2026-0004', 'Công tác Cần Thơ đang ở trạng thái quyết toán (st). Hạn còn 2 ngày.', 'pending'],
  ['no3', 'email', 'gia.huy@orangecloud.vn', 'Yêu cầu nghỉ phép chờ duyệt', 'Trần Quốc Bảo đã hủy l34; có yêu cầu mới từ Đinh Công Thành (l32).', 'pending'],
  ['no4', 'email', 'thu.ha@orangecloud.vn', 'Ứng viên chuyển offer', 'Pipeline Frontend: Lê Đức Thịnh ở giai đoạn offer — cần duyệt lương đề xuất.', 'pending'],
  ['no5', 'email', 'minh.anh@orangecloud.vn', 'Quyết toán CT-2026-0001 đã hoàn tất', 'Số tiền quyết toán: 6.990.000 ₫. Tạm ứng 6.000.000 ₫ — chênh lệch sẽ chi cùng kỳ lương.', 'sent'],
]
push(`INSERT OR REPLACE INTO notification_outbox (
  id, organization_id, channel, recipient, subject, body_text, body_html, status, error, sent_at
) VALUES`)
push(
  notifs
    .map(([id, ch, to, sub, body, status]) => {
      count('notification_outbox')
      const sent = status === 'sent' ? "'2026-09-19T11:05:00Z'" : 'NULL'
      return ` (${esc(id)},${esc(ORG)},${esc(ch)},${esc(to)},${esc(sub)},${esc(body)},NULL,${esc(status)},NULL,${sent})`
    })
    .join(',\n') + ';\n',
)

// Mark pending count correctly — 4 pending + 1 sent
// Fix no5 status already sent

push(`INSERT OR REPLACE INTO app_meta(key, value) VALUES
 ('seeded_demo', 'true'),
 ('seeded_demo_brand', 'Orange Cloud'),
 ('seeded_demo_at', '2026-10-12T09:00:00Z');
`)
count('app_meta', 3)

push(`
-- =============================================================================
-- Row count summary (generator): see stderr / scripts note after run.
-- Golden notes:
--   * e1–e12 base/deps/join/leave match shared/fixtures/golden.ts
--   * CT-2026-0001 estimate 6.870.000 / settlement 6.990.000 in estimate_json/actual_json
--   * Sep 2026 earnings a1–a12 match GOLDEN_ALLOW; no closed payroll_run (expanded headcount)
--   * Holidays = GOLDEN_HOLIDAYS; leaves l1/l8/l9 preserved
-- =============================================================================
`)

writeFileSync(outPath, lines.join('\n'), 'utf8')

const summary = Object.entries(counts)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([k, v]) => `  ${k}: ${v}`)
  .join('\n')
console.log(`Wrote ${outPath}`)
console.log('Counts:\n' + summary)
console.log(`attendance_punches: ${counts.attendance_punches}`)
console.log(`employees: ${counts.employees}`)
console.log(`leave_requests: ${counts.leave_requests}`)
console.log(`trips: ${counts.trips}`)
