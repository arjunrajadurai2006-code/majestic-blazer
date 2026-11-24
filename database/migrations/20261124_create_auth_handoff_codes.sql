-- ==============================================================================
-- Migration: database/migrations/20261124_create_auth_handoff_codes.sql
-- Description: PostgreSQL-backed persistent storage for short-lived, single-use
--              cross-application handoff codes. Stores only SHA-256 hashes.
-- Status: PROPOSED / READY FOR REVIEW
-- ==============================================================================

CREATE TABLE IF NOT EXISTS auth_handoff_codes (
  id BIGSERIAL PRIMARY KEY,
  code_hash VARCHAR(64) NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_role VARCHAR(20) NOT NULL,
  target_app VARCHAR(20) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_auth_handoff_codes_hash
    UNIQUE (code_hash),

  CONSTRAINT chk_auth_handoff_codes_user_role
    CHECK (user_role IN ('admin', 'customer')),

  CONSTRAINT chk_auth_handoff_codes_target_app
    CHECK (target_app IN ('admin', 'customer')),

  CONSTRAINT chk_auth_handoff_codes_role_isolation
    CHECK (target_app != 'admin' OR user_role = 'admin')
);

CREATE INDEX IF NOT EXISTS idx_auth_handoff_codes_active
  ON auth_handoff_codes (code_hash)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_handoff_codes_expires
  ON auth_handoff_codes (expires_at)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_handoff_codes_user
  ON auth_handoff_codes (user_id);
