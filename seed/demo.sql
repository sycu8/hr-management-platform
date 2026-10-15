-- Fictional demo organization only. No real personal data.

INSERT OR REPLACE INTO organizations (id, name, legal_name)
VALUES ('org_demo', 'Công ty TNHH Ví Dụ', 'Công ty TNHH Ví Dụ');

INSERT OR REPLACE INTO security_settings (organization_id, mask_salary, require_2fa, session_minutes, log_exports)
VALUES ('org_demo', 1, 0, 60, 1);

INSERT OR REPLACE INTO users (id, organization_id, email, display_name, role, employee_id, is_active)
VALUES
 ('u_admin', 'org_demo', 'quan.tri@vidu.vn', 'Quản trị hệ thống', 'admin', NULL, 1),
 ('u_hr', 'org_demo', 'thu.ha@vidu.vn', 'Lê Thu Hà', 'hr', 'e3', 1),
 ('u_mgr', 'org_demo', 'duc.long@vidu.vn', 'Phạm Đức Long', 'manager', 'e4', 1),
 ('u_fin', 'org_demo', 'phuong.linh@vidu.vn', 'Hoàng Phương Linh', 'finance', 'e8', 1),
 ('u_emp', 'org_demo', 'quoc.bao@vidu.vn', 'Trần Quốc Bảo', 'employee', 'e2', 1);

INSERT OR REPLACE INTO employees (
  id, organization_id, code, full_name, email, phone, gender, birth_date, address,
  department, title, level, manager_id, base_salary, dependents, status, joined_on, left_on,
  contract_type, contract_start, contract_end, skills_json
) VALUES
 ('e1','org_demo','NV001','Nguyễn Minh Anh','minh.anh@vidu.vn','0901 234 501','Nữ','1994-03-18','Cầu Giấy, Hà Nội','Kinh doanh','Chuyên viên kinh doanh',1,'e4',18000000,1,'active','2022-03-01',NULL,'Không xác định thời hạn','2025-03-01',NULL,'["Bán hàng B2B"]'),
 ('e2','org_demo','NV002','Trần Quốc Bảo','quoc.bao@vidu.vn','0901 234 502','Nam','1997-07-09','Thanh Xuân, Hà Nội','Kỹ thuật','Kỹ sư triển khai',0,'e7',14000000,0,'active','2023-06-15',NULL,'Không xác định thời hạn','2026-06-15',NULL,'["Cloud"]'),
 ('e3','org_demo','NV003','Lê Thu Hà','thu.ha@vidu.vn','0901 234 503','Nữ','1989-12-02','Hai Bà Trưng, Hà Nội','Nhân sự','Trưởng phòng nhân sự',2,'e5',38000000,2,'active','2019-09-01',NULL,'Không xác định thời hạn','2022-09-01',NULL,'["Luật lao động","Quản lý nhóm","Giao tiếp"]'),
 ('e4','org_demo','NV004','Phạm Đức Long','duc.long@vidu.vn','0901 234 504','Nam','1986-05-27','Tây Hồ, Hà Nội','Kinh doanh','Giám đốc kinh doanh',2,'e5',45000000,2,'active','2018-02-12',NULL,'Không xác định thời hạn','2021-02-12',NULL,'["Bán hàng B2B","Quản lý nhóm","Giao tiếp"]'),
 ('e5','org_demo','NV005','Võ Thanh Tùng','thanh.tung@vidu.vn','0901 234 505','Nam','1980-01-14','Ba Đình, Hà Nội','Ban giám đốc','Giám đốc khối',3,NULL,85000000,2,'active','2016-01-04',NULL,'Không xác định thời hạn','2019-01-04',NULL,'["Quản lý nhóm","Giao tiếp","Luật lao động"]'),
 ('e6','org_demo','NV006','Đặng Ngọc Mai','ngoc.mai@vidu.vn','0901 234 506','Nữ','1996-10-20','Đống Đa, Hà Nội','Marketing','Chuyên viên marketing',1,'e10',17000000,0,'active','2022-11-07',NULL,'Không xác định thời hạn','2025-11-07',NULL,'["Digital Marketing"]'),
 ('e7','org_demo','NV007','Bùi Gia Huy','gia.huy@vidu.vn','0901 234 507','Nam','1991-09-30','Nam Từ Liêm, Hà Nội','Kỹ thuật','Trưởng nhóm kỹ thuật',1,'e5',28000000,1,'active','2020-08-17',NULL,'Không xác định thời hạn','2023-08-17',NULL,'["Cloud","Quản lý nhóm"]'),
 ('e8','org_demo','NV008','Hoàng Phương Linh','phuong.linh@vidu.vn','0901 234 508','Nữ','1993-04-11','Hà Đông, Hà Nội','Kế toán','Kế toán tổng hợp',1,'e5',22000000,0,'active','2021-05-10',NULL,'Xác định thời hạn 24 tháng','2025-01-01','2026-12-31','["Excel nâng cao"]'),
 ('e9','org_demo','NV009','Ngô Thị Thảo','thi.thao@vidu.vn','0901 234 509','Nữ','1998-10-15','Long Biên, Hà Nội','Nhân sự','Chuyên viên tuyển dụng',0,'e3',13000000,0,'active','2024-02-01',NULL,'Xác định thời hạn 36 tháng','2026-02-01','2029-01-31','["Giao tiếp"]'),
 ('e10','org_demo','NV010','Đỗ Anh Khoa','anh.khoa@vidu.vn','0901 234 510','Nam','1988-08-05','Cầu Giấy, Hà Nội','Marketing','Trưởng phòng marketing',2,'e5',40000000,1,'active','2019-04-08',NULL,'Không xác định thời hạn','2022-04-08',NULL,'["Digital Marketing","Quản lý nhóm","Giao tiếp"]'),
 ('e11','org_demo','NV011','Lý Hải Nam','hai.nam@vidu.vn','0901 234 511','Nam','2000-11-22','Hoàng Mai, Hà Nội','Kỹ thuật','Kỹ sư phần mềm',0,'e7',12000000,0,'active','2026-08-03',NULL,'Thử việc','2026-08-03','2026-10-31','[]'),
 ('e12','org_demo','NV012','Trịnh Mỹ Duyên','my.duyen@vidu.vn','0901 234 512','Nữ','1999-06-03','Hà Đông, Hà Nội','Kế toán','Kế toán viên',0,'e8',11000000,0,'left','2023-01-09','2026-08-15','Xác định thời hạn 24 tháng','2025-01-09','2027-01-08','["Excel nâng cao"]');

INSERT OR REPLACE INTO payroll_policy_versions (
  id, organization_id, version, effective_from, policy_json, source_citations_json, legal_review_status
) VALUES (
  'paypol_v1', 'org_demo', 1, '2026-01-01',
  '{"ref":2340000,"capMult":20,"bhEmp":{"bhxh":0.08,"bhyt":0.015,"bhtn":0.01},"bhEr":{"bhxh":0.14,"om":0.03,"tnld":0.005,"bhyt":0.03,"bhtn":0.01},"selfDed":15500000,"depDed":6200000,"mealExempt":730000,"brackets":[[10000000,0.05],[30000000,0.10],[60000000,0.20],[100000000,0.30],[1e15,0.35]]}',
  '[{"code":"handoff-sample","note":"Compatibility sample — pending legal approval"}]',
  'pending'
);

INSERT OR REPLACE INTO travel_policy_versions (
  id, organization_id, version, effective_from, policy_json
) VALUES (
  'trippol_v1', 'org_demo', 1, '2026-10-01',
  '{"zones":{"dn1":{"name":"Hà Nội, TP.HCM","intl":false,"perDiem":[200000,250000,300000,400000],"hotel":[800000,1000000,1500000,2500000]},"dn2":{"name":"Thành phố loại I/II khác","intl":false,"perDiem":[180000,220000,270000,350000],"hotel":[600000,800000,1200000,2000000]},"dn3":{"name":"Tỉnh, địa phương còn lại","intl":false,"perDiem":[150000,200000,250000,300000],"hotel":[500000,650000,1000000,1500000]},"qt1":{"name":"Quốc tế · Châu Á (USD)","intl":true,"perDiem":[50,60,80,100],"hotel":[70,90,130,200]},"qt2":{"name":"Quốc tế · Âu, Mỹ, Úc (USD)","intl":true,"perDiem":[70,85,110,140],"hotel":[100,130,180,280]}},"fx":25500,"fullHours":12,"halfHours":4,"minKm":15,"flatRatio":0.6,"localDom":100000,"localIntl":300000,"mealPartial":0.3,"mealFull":0.7,"settleDays":7}'
);

INSERT OR REPLACE INTO permission_matrix (organization_id, role, module_key, level) VALUES
 ('org_demo','admin','dash',2),('org_demo','admin','emp',2),('org_demo','admin','rec',2),('org_demo','admin','leave',2),('org_demo','admin','trip',2),('org_demo','admin','pay',2),('org_demo','admin','perf',2),('org_demo','admin','learn',2),('org_demo','admin','pol',2),('org_demo','admin','sys',2),
 ('org_demo','hr','dash',2),('org_demo','hr','emp',2),('org_demo','hr','rec',2),('org_demo','hr','leave',2),('org_demo','hr','trip',2),('org_demo','hr','pay',2),('org_demo','hr','perf',2),('org_demo','hr','learn',2),('org_demo','hr','pol',2),('org_demo','hr','sys',1),
 ('org_demo','manager','dash',1),('org_demo','manager','emp',1),('org_demo','manager','rec',1),('org_demo','manager','leave',2),('org_demo','manager','trip',2),('org_demo','manager','pay',0),('org_demo','manager','perf',2),('org_demo','manager','learn',1),('org_demo','manager','pol',1),('org_demo','manager','sys',0),
 ('org_demo','finance','dash',1),('org_demo','finance','emp',1),('org_demo','finance','rec',0),('org_demo','finance','leave',1),('org_demo','finance','trip',2),('org_demo','finance','pay',2),('org_demo','finance','perf',0),('org_demo','finance','learn',0),('org_demo','finance','pol',1),('org_demo','finance','sys',0),
 ('org_demo','employee','dash',1),('org_demo','employee','emp',1),('org_demo','employee','rec',0),('org_demo','employee','leave',2),('org_demo','employee','trip',2),('org_demo','employee','pay',1),('org_demo','employee','perf',1),('org_demo','employee','learn',1),('org_demo','employee','pol',1),('org_demo','employee','sys',0);

INSERT OR REPLACE INTO app_meta(key, value) VALUES ('seeded_demo', 'true');
