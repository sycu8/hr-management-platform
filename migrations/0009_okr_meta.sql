-- OKR update tracking (user progress updates; manager completeness views).
ALTER TABLE objectives ADD COLUMN updated_at TEXT;
ALTER TABLE objectives ADD COLUMN updated_by TEXT;
