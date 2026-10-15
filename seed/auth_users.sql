-- Password-auth accounts for public HRM (hrm.orangecloud.vn).
-- Default passwords (change after first login):
--   super@orangecloud.vn              SuperAdmin!2026
--   admin@orangecloud.vn              Admin!2026
--   user.tuyendung@orangecloud.vn     User!2026
--   user.luong@orangecloud.vn         User!2026

INSERT OR REPLACE INTO organizations (id, name, legal_name)
VALUES ('org_demo', 'Công ty TNHH Ví Dụ', 'Công ty TNHH Ví Dụ');

INSERT OR REPLACE INTO security_settings (organization_id, mask_salary, require_2fa, session_minutes, log_exports)
VALUES ('org_demo', 1, 0, 480, 1);

INSERT OR REPLACE INTO users (
  id, organization_id, email, display_name, role, account_type, employee_id,
  is_active, password_hash, password_salt, must_reset_password
) VALUES
 (
  'u_super', 'org_demo', 'super@orangecloud.vn', 'Super Admin',
  'admin', 'super_admin', NULL, 1,
  'ad90220701d801a18921bf3ce6a1bc39c860172875fd69c04974b9e48c77d488',
  '9741be13e282c78307748515ad0dba12', 0
 ),
 (
  'u_hr_admin', 'org_demo', 'admin@orangecloud.vn', 'HR Manager',
  'hr', 'admin', 'e3', 1,
  '2232dcd56bfd1bf3d227ce35f1709f4753acca14716aa3e862b4ee1919d4f8cc',
  'c7e5e7b3d32a0186bffaa4fb0f114650', 0
 ),
 (
  'u_rec', 'org_demo', 'user.tuyendung@orangecloud.vn', 'Chuyên viên tuyển dụng',
  'employee', 'user', 'e9', 1,
  '34332c52fcdff0de6f30490454282150dc94263149027da2f3494c2c59e3f792',
  '9186ce1eecfc1153508c4fbfc80240dd', 0
 ),
 (
  'u_pay', 'org_demo', 'user.luong@orangecloud.vn', 'Chuyên viên lương thưởng',
  'employee', 'user', 'e8', 1,
  '7d32bc18a02f65b72787bb8ac90b837f3e1e85340b37d59b2a82c94004992f20',
  'eac5d1835b1382eb220c688d910db60e', 0
 );

INSERT OR REPLACE INTO user_capabilities (user_id, capability, level) VALUES
 ('u_rec', 'dashboard', 1),
 ('u_rec', 'recruiting', 2),
 ('u_rec', 'employees', 1),
 ('u_pay', 'dashboard', 1),
 ('u_pay', 'payroll', 2),
 ('u_pay', 'benefits', 2),
 ('u_pay', 'employees', 1);
