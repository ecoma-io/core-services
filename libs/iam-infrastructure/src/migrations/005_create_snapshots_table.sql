-- Migration: Create snapshots table for aggregate state snapshots
-- Reduces event replay overhead for large aggregates

CREATE TABLE IF NOT EXISTS snapshots (
  aggregate_id VARCHAR(255) PRIMARY KEY,
  aggregate_type VARCHAR(100) NOT NULL,
  version INT NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying by aggregate type
CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate_type
  ON snapshots(aggregate_type);

-- Index for finding stale snapshots (for cleanup or refresh)
CREATE INDEX IF NOT EXISTS idx_snapshots_updated_at
  ON snapshots(updated_at);

COMMENT ON TABLE snapshots IS 'Aggregate state snapshots for performance optimization';
COMMENT ON COLUMN snapshots.aggregate_id IS 'Unique aggregate identifier (matches stream name)';
COMMENT ON COLUMN snapshots.version IS 'Stream version at which this snapshot was taken';
COMMENT ON COLUMN snapshots.state IS 'Serialized aggregate state';
COMMENT ON COLUMN snapshots.updated_at IS 'Last time snapshot was updated';
