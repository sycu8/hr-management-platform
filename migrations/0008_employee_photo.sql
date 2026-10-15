-- Employee profile photo metadata (binary lives in R2 DOCUMENTS).
ALTER TABLE employees ADD COLUMN photo_r2_key TEXT;
ALTER TABLE employees ADD COLUMN photo_file_name TEXT;
ALTER TABLE employees ADD COLUMN photo_content_type TEXT;
ALTER TABLE employees ADD COLUMN photo_size_bytes INTEGER NOT NULL DEFAULT 0;
