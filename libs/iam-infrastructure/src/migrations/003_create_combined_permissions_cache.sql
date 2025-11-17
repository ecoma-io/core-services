-- Migration: Create combined_permissions_cache table
-- Purpose: Store merged permission trees from 3 latest major versions per service
-- Reference: ADR-5 in docs/iam/architecture.md

CREATE TABLE IF NOT EXISTS combined_permissions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Service identifier (e.g., 'billing-service', 'resource-service')
  service_name VARCHAR(255) NOT NULL UNIQUE,

  -- Merged permission tree (JSONB for flexible querying)
  -- Structure: PermissionNode[] with nested children
  combined_tree JSONB NOT NULL,

  -- Metadata about which versions were merged
  -- Array of { version, priority, major }
  merged_versions JSONB NOT NULL,

  -- Audit metadata: track which version's nodes won conflicts
  -- Map of path -> { version, reason }
  resolution_metadata JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Index for service lookup (primary use case)
  CONSTRAINT pk_combined_permissions_cache PRIMARY KEY (service_name)
);

-- Index for timestamp queries (rebuilding, monitoring)
CREATE INDEX idx_combined_permissions_cache_updated_at
  ON combined_permissions_cache(updated_at DESC);

-- GIN index for JSONB querying (if we need to search permission keys)
CREATE INDEX idx_combined_permissions_cache_tree
  ON combined_permissions_cache USING GIN (combined_tree);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_combined_permissions_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_combined_permissions_cache_updated_at
  BEFORE UPDATE ON combined_permissions_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_combined_permissions_cache_updated_at();

COMMENT ON TABLE combined_permissions_cache IS
  'Stores merged permission trees from 3 latest major versions per service (ADR-5)';
COMMENT ON COLUMN combined_permissions_cache.combined_tree IS
  'Merged PermissionNode[] tree with resolved conflicts';
COMMENT ON COLUMN combined_permissions_cache.merged_versions IS
  'Array of version metadata: { version, priority, major }';
COMMENT ON COLUMN combined_permissions_cache.resolution_metadata IS
  'Audit trail: which version won at each path conflict';
