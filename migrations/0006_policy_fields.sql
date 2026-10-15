-- Policies module: enriched management fields + primary R2 file metadata.
-- Binary bytes live in R2 (DOCUMENTS); D1 stores keys/metadata only.
-- Additional files: see 0007_policy_attachments.sql

ALTER TABLE policy_documents ADD COLUMN policy_type TEXT;
ALTER TABLE policy_documents ADD COLUMN effective_to TEXT;
ALTER TABLE policy_documents ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE policy_documents ADD COLUMN applicable_departments TEXT;
ALTER TABLE policy_documents ADD COLUMN content_text TEXT;
ALTER TABLE policy_documents ADD COLUMN file_name TEXT;
ALTER TABLE policy_documents ADD COLUMN content_type TEXT;
ALTER TABLE policy_documents ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE policy_documents ADD COLUMN r2_key TEXT;
ALTER TABLE policy_documents ADD COLUMN owner_name TEXT;
ALTER TABLE policy_documents ADD COLUMN owner_user_id TEXT;
ALTER TABLE policy_documents ADD COLUMN last_reviewed_at TEXT;
