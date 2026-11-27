-- Migration 001: Baseline CardWise Schema
-- See database/schema.sql for full initial table definitions.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('001_initial') ON CONFLICT (version) DO NOTHING;
