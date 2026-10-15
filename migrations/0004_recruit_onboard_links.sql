-- Candidate recruitment content + CV / social links
ALTER TABLE candidates ADD COLUMN linkedin_url TEXT;
ALTER TABLE candidates ADD COLUMN facebook_url TEXT;
ALTER TABLE candidates ADD COLUMN cv_url TEXT;
ALTER TABLE candidates ADD COLUMN cv_file_name TEXT;
ALTER TABLE candidates ADD COLUMN recruitment_note TEXT;

-- Onboarding: probation window + convert-to-employee reminder
ALTER TABLE onboarding_plans ADD COLUMN probation_end TEXT;
ALTER TABLE onboarding_plans ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress';
ALTER TABLE onboarding_plans ADD COLUMN notes TEXT;
ALTER TABLE onboarding_plans ADD COLUMN requirements_json TEXT NOT NULL DEFAULT '[]';
