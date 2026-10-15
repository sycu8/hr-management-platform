-- HR Management Platform — initial schema
-- Money is stored as integer VND. Business dates use YYYY-MM-DD text.
-- Effective-dated configuration is versioned; closed payroll runs are immutable snapshots.

PRAGMA foreign_keys = ON;

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  locale TEXT NOT NULL DEFAULT 'vi-VN',
  currency TEXT NOT NULL DEFAULT 'VND',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','hr','manager','finance','employee')),
  employee_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organization_id, email)
);

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender TEXT,
  birth_date TEXT,
  address TEXT,
  department TEXT NOT NULL,
  title TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 3),
  manager_id TEXT REFERENCES employees(id),
  base_salary INTEGER NOT NULL DEFAULT 0,
  dependents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','left')),
  joined_on TEXT NOT NULL,
  left_on TEXT,
  contract_type TEXT NOT NULL,
  contract_start TEXT,
  contract_end TEXT,
  skills_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organization_id, code)
);

CREATE INDEX idx_employees_org_status ON employees(organization_id, status);
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_employees_dept ON employees(organization_id, department);

-- users.employee_id is validated in application code (SQLite FK added after employees exist via later migration if needed).
CREATE INDEX idx_users_employee ON users(employee_id);

CREATE TABLE employment_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  event_date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE document_types (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, name)
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  type_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT,
  issued_on TEXT,
  expires_on TEXT,
  uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE holidays (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  holiday_date TEXT NOT NULL,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  UNIQUE (organization_id, holiday_date)
);

CREATE TABLE leave_types (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  paid INTEGER NOT NULL DEFAULT 1,
  quota_days REAL,
  UNIQUE (organization_id, code)
);

CREATE TABLE leave_adjustments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  year INTEGER NOT NULL,
  days REAL NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organization_id, employee_id, year)
);

CREATE TABLE leave_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  working_days REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled')),
  reason TEXT NOT NULL,
  reject_note TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_leave_emp_dates ON leave_requests(employee_id, start_date, end_date);

CREATE TABLE attendance_punches (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  work_date TEXT NOT NULL,
  punch_in TEXT,
  punch_out TEXT,
  source TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app','import','device','adjustment')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organization_id, employee_id, work_date)
);

CREATE TABLE attendance_adjustments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  work_date TEXT NOT NULL,
  code TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE travel_policy_versions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  version INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  policy_json TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organization_id, version)
);

CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  zone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  distance_km REAL NOT NULL DEFAULT 0,
  transport TEXT NOT NULL,
  transport_est INTEGER NOT NULL DEFAULT 0,
  other_est INTEGER NOT NULL DEFAULT 0,
  other_note TEXT,
  hotel_mode TEXT NOT NULL CHECK (hotel_mode IN ('actual','flat','none')),
  hotel_price INTEGER NOT NULL DEFAULT 0,
  meal TEXT NOT NULL CHECK (meal IN ('none','partial','full')),
  advance INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('draft','pm','ph','ap','st','ok','rj')),
  reject_note TEXT,
  policy_version_id TEXT REFERENCES travel_policy_versions(id),
  estimate_json TEXT,
  actual_json TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organization_id, code)
);

CREATE TABLE trip_history (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  at TEXT NOT NULL,
  actor_role TEXT,
  actor_user_id TEXT,
  text TEXT NOT NULL
);

CREATE TABLE trip_receipts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  trip_id TEXT NOT NULL REFERENCES trips(id),
  file_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL,
  uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE payroll_policy_versions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  version INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  policy_json TEXT NOT NULL,
  source_citations_json TEXT NOT NULL DEFAULT '[]',
  legal_review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (legal_review_status IN ('pending','approved','rejected')),
  legal_reviewed_by TEXT,
  legal_reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organization_id, version)
);

CREATE TABLE earnings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT,
  year_month TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('allowance','bonus')),
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  taxable INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE payroll_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  year_month TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','closed')),
  policy_version_id TEXT NOT NULL REFERENCES payroll_policy_versions(id),
  totals_json TEXT NOT NULL,
  closed_by TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organization_id, year_month)
);

CREATE TABLE payroll_items (
  id TEXT PRIMARY KEY,
  payroll_run_id TEXT NOT NULL REFERENCES payroll_runs(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  snapshot_json TEXT NOT NULL,
  gross INTEGER NOT NULL,
  employee_insurance INTEGER NOT NULL,
  pit INTEGER NOT NULL,
  net INTEGER NOT NULL,
  employer_insurance INTEGER NOT NULL,
  UNIQUE (payroll_run_id, employee_id)
);

CREATE TABLE job_requisitions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  headcount INTEGER NOT NULL DEFAULT 1,
  level TEXT,
  location TEXT,
  salary_display TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft','open','closed')),
  posted_on TEXT,
  deadline TEXT,
  summary TEXT,
  duties_json TEXT NOT NULL DEFAULT '[]',
  requirements_json TEXT NOT NULL DEFAULT '[]',
  benefits_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE candidates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  job_id TEXT NOT NULL REFERENCES job_requisitions(id),
  full_name TEXT NOT NULL,
  source TEXT,
  stage TEXT NOT NULL,
  score REAL DEFAULT 0,
  email TEXT,
  phone TEXT,
  interview_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE onboarding_plans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  candidate_id TEXT,
  employee_id TEXT REFERENCES employees(id),
  full_name TEXT NOT NULL,
  role_title TEXT,
  department TEXT,
  start_date TEXT NOT NULL,
  tasks_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE review_cycles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned','open','closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE ratings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  cycle_id TEXT NOT NULL REFERENCES review_cycles(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  self_score REAL,
  manager_score REAL,
  final_score REAL,
  UNIQUE (cycle_id, employee_id)
);

CREATE TABLE objectives (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  period TEXT NOT NULL,
  objective TEXT NOT NULL,
  key_results_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE feedback_360 (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  period TEXT NOT NULL,
  competencies_json TEXT NOT NULL,
  scores_json TEXT NOT NULL,
  UNIQUE (organization_id, employee_id, period)
);

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  course_type TEXT NOT NULL,
  hours REAL NOT NULL DEFAULT 0,
  mandatory INTEGER NOT NULL DEFAULT 0,
  skill TEXT,
  provider TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE enrollments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  progress REAL NOT NULL DEFAULT 0,
  due_on TEXT,
  UNIQUE (employee_id, course_id)
);

CREATE TABLE certificates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  name TEXT NOT NULL,
  issuer TEXT,
  issued_on TEXT,
  expires_on TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE career_paths (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  levels_json TEXT NOT NULL
);

CREATE TABLE employee_careers (
  employee_id TEXT PRIMARY KEY REFERENCES employees(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  path_id TEXT NOT NULL REFERENCES career_paths(id),
  level_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE policy_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  category TEXT NOT NULL CHECK (category IN ('Quy định','Quy trình','Pháp lý')),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  version TEXT,
  effective_from TEXT,
  summary TEXT,
  body_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organization_id, code)
);

CREATE TABLE permission_matrix (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL,
  module_key TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level IN (0,1,2)),
  PRIMARY KEY (organization_id, role, module_key)
);

CREATE TABLE security_settings (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id),
  mask_salary INTEGER NOT NULL DEFAULT 1,
  require_2fa INTEGER NOT NULL DEFAULT 0,
  session_minutes INTEGER NOT NULL DEFAULT 60,
  log_exports INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  at TEXT NOT NULL,
  actor_user_id TEXT,
  actor_role TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail TEXT NOT NULL,
  ip TEXT,
  request_id TEXT
);

CREATE INDEX idx_audit_org_at ON audit_events(organization_id, at DESC);

CREATE TABLE notification_outbox (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  channel TEXT NOT NULL DEFAULT 'email',
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  sent_at TEXT
);

CREATE TABLE export_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  r2_key TEXT,
  requested_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT
);

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO app_meta(key, value) VALUES ('schema_version', '1');
