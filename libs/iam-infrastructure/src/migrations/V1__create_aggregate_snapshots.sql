-- Create aggregate_snapshots table for storing aggregate snapshots
-- See ADR-6: Snapshot Policy for Aggregates

CREATE TABLE IF NOT EXISTS aggregate_snapshots (
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    version INT NOT NULL,
    state JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (aggregate_id, version)
);

-- Create index for efficient lookup by aggregate_id and version
CREATE INDEX idx_aggregate_snapshots_id_version ON aggregate_snapshots (aggregate_id, version DESC);

-- Create index for cleanup queries
CREATE INDEX idx_aggregate_snapshots_created_at ON aggregate_snapshots (aggregate_id, created_at DESC);

COMMENT ON TABLE aggregate_snapshots IS 'Stores point-in-time snapshots of aggregates to optimize event sourcing rehydration';
COMMENT ON COLUMN aggregate_snapshots.aggregate_id IS 'Unique identifier of the aggregate (e.g., User-{uuid})';
COMMENT ON COLUMN aggregate_snapshots.aggregate_type IS 'Type of the aggregate (e.g., User, Tenant, Role)';
COMMENT ON COLUMN aggregate_snapshots.version IS 'Event stream version at the time of snapshot';
COMMENT ON COLUMN aggregate_snapshots.state IS 'JSON representation of the aggregate state';
COMMENT ON COLUMN aggregate_snapshots.created_at IS 'Timestamp when snapshot was created';
