-- Policy document attachments: binary in R2 (DOCUMENTS), metadata only in D1.

CREATE TABLE policy_attachments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  policy_id TEXT NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL,
  uploaded_by TEXT,
  ocr_status TEXT NOT NULL DEFAULT 'none'
    CHECK (ocr_status IN ('none','pending','done','failed')),
  ocr_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_policy_attachments_policy
  ON policy_attachments(organization_id, policy_id);

CREATE INDEX idx_policy_attachments_r2
  ON policy_attachments(organization_id, r2_key);
