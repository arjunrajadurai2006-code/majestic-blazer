-- ==============================================================================
-- Migration: database/migrations/20261123_create_webhook_events.sql
-- Description: Fenced durable webhook event claiming, merchant-scoped uniqueness,
--              and lossless integer minor currency accounting (Version 3.5)
-- Status: PROPOSED — Strictly requires user approval before execution
-- ==============================================================================

CREATE TABLE IF NOT EXISTS webhook_events (
  account_id VARCHAR(100) NOT NULL,
  environment VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'processing',
  claim_token UUID NULL,
  entity_id VARCHAR(100) NULL,
  order_id VARCHAR(100) NULL,
  amount_minor BIGINT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  attempts INTEGER NOT NULL DEFAULT 1,
  locked_until TIMESTAMP WITH TIME ZONE NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE NULL,

  CONSTRAINT pk_webhook_events 
    PRIMARY KEY (account_id, environment, event_id),

  CONSTRAINT chk_webhook_events_status 
    CHECK (status IN ('processing', 'completed', 'failed')),

  CONSTRAINT chk_webhook_events_attempts 
    CHECK (attempts >= 1),

  CONSTRAINT chk_webhook_events_currency 
    CHECK (currency = 'INR'),

  CONSTRAINT chk_webhook_events_processing_fields 
    CHECK (status != 'processing' OR (claim_token IS NOT NULL AND locked_until IS NOT NULL)),

  CONSTRAINT chk_webhook_events_completed_fields 
    CHECK (status != 'completed' OR completed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status 
  ON webhook_events (status);

CREATE INDEX IF NOT EXISTS idx_webhook_events_lease 
  ON webhook_events (locked_until) 
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_webhook_events_entity 
  ON webhook_events (account_id, environment, entity_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_order 
  ON webhook_events (account_id, environment, order_id);
