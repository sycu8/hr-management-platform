-- 360 feedback: free-text comments + cached AI analysis.
ALTER TABLE feedback_360 ADD COLUMN comments_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE feedback_360 ADD COLUMN ai_analysis TEXT;
ALTER TABLE feedback_360 ADD COLUMN ai_analyzed_at TEXT;
ALTER TABLE feedback_360 ADD COLUMN updated_at TEXT;
ALTER TABLE feedback_360 ADD COLUMN updated_by TEXT;
