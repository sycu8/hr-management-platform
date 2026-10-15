-- External / internal data-source integrations (Super Admin only to manage).
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_data_sources_org ON data_sources(organization_id);
