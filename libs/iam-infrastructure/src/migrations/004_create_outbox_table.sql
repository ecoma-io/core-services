-- Migration: Create outbox_events table for transactional outbox pattern
-- Ensures at-least-once delivery guarantee for domain events

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY,
  aggregate_id VARCHAR(255) NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_version VARCHAR(20) NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  publish_attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficiently querying unpublished events
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished
  ON outbox_events(created_at)
  WHERE published_at IS NULL;

-- Index for cleanup of published events
CREATE INDEX IF NOT EXISTS idx_outbox_published
  ON outbox_events(published_at)
  WHERE published_at IS NOT NULL;

-- Index for retry logic (failed attempts)
CREATE INDEX IF NOT EXISTS idx_outbox_retry
  ON outbox_events(publish_attempts, created_at)
  WHERE published_at IS NULL AND publish_attempts > 0;

-- Index for aggregate tracking
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
  ON outbox_events(aggregate_id, aggregate_type);

COMMENT ON TABLE outbox_events IS 'Transactional outbox for at-least-once event delivery';
COMMENT ON COLUMN outbox_events.id IS 'Unique event ID (matches domain event ID)';
COMMENT ON COLUMN outbox_events.published_at IS 'Timestamp when event was successfully published to message bus';
COMMENT ON COLUMN outbox_events.publish_attempts IS 'Number of publish attempts (for retry tracking)';
COMMENT ON COLUMN outbox_events.last_error IS 'Last error message if publish failed';
