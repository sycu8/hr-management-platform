-- Learning / L&D catalog & tracking fields (corporate VN đào tạo)

ALTER TABLE courses ADD COLUMN code TEXT;
ALTER TABLE courses ADD COLUMN level TEXT;
ALTER TABLE courses ADD COLUMN delivery_mode TEXT;
ALTER TABLE courses ADD COLUMN audience TEXT;
ALTER TABLE courses ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE courses ADD COLUMN start_date TEXT;
ALTER TABLE courses ADD COLUMN end_date TEXT;

ALTER TABLE enrollments ADD COLUMN score REAL;
ALTER TABLE enrollments ADD COLUMN enrolled_on TEXT;
ALTER TABLE enrollments ADD COLUMN completed_on TEXT;

ALTER TABLE certificates ADD COLUMN course_id TEXT;
ALTER TABLE certificates ADD COLUMN cert_number TEXT;
ALTER TABLE certificates ADD COLUMN file_name TEXT;
ALTER TABLE certificates ADD COLUMN file_url TEXT;
