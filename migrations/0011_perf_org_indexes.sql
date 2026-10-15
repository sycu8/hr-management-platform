-- Speed org-scoped list / dashboard / search filters.
CREATE INDEX IF NOT EXISTS idx_leave_requests_org_status
  ON leave_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_org_emp
  ON leave_requests(organization_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org_date
  ON attendance_punches(organization_id, work_date);
CREATE INDEX IF NOT EXISTS idx_trips_org_status
  ON trips(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_job_requisitions_org_status
  ON job_requisitions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_org_updated
  ON candidates(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_org_status
  ON onboarding_plans(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_courses_org
  ON courses(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_org_emp
  ON enrollments(organization_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_certificates_org
  ON certificates(organization_id);
CREATE INDEX IF NOT EXISTS idx_policy_documents_org_cat
  ON policy_documents(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_objectives_org_emp
  ON objectives(organization_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_org_emp
  ON ratings(organization_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_feedback360_org_emp
  ON feedback_360(organization_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_earnings_org_emp
  ON earnings(organization_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_emp
  ON documents(organization_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_employment_events_org
  ON employment_events(organization_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_leave_adjustments_org_year
  ON leave_adjustments(organization_id, year);
