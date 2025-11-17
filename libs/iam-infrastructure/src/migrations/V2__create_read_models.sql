-- V2: Create Read Model Tables for IAM
-- This migration creates denormalized read models projected from Event Store.
-- See ADR-2: Technology Selection (PostgreSQL for Read Model)

-- Users Read Model
CREATE TABLE IF NOT EXISTS users_read_model (
    user_id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'PendingVerification',
    social_links JSONB,
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    password_changed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users_read_model(email);
CREATE INDEX idx_users_status ON users_read_model(status);

-- Tenants Read Model
CREATE TABLE IF NOT EXISTS tenants_read_model (
    tenant_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    namespace VARCHAR(100) NOT NULL UNIQUE,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_namespace ON tenants_read_model(namespace);

-- Roles Read Model
CREATE TABLE IF NOT EXISTS roles_read_model (
    role_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permission_keys JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (tenant_id) REFERENCES tenants_read_model(tenant_id) ON DELETE CASCADE
);

CREATE INDEX idx_roles_tenant ON roles_read_model(tenant_id);
CREATE INDEX idx_roles_tenant_name ON roles_read_model(tenant_id, name);

-- Memberships Read Model
CREATE TABLE IF NOT EXISTS memberships_read_model (
    membership_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    role_ids JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users_read_model(user_id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants_read_model(tenant_id) ON DELETE CASCADE,
    UNIQUE (user_id, tenant_id)
);

CREATE INDEX idx_memberships_user ON memberships_read_model(user_id);
CREATE INDEX idx_memberships_tenant ON memberships_read_model(tenant_id);
CREATE UNIQUE INDEX idx_memberships_user_tenant ON memberships_read_model(user_id, tenant_id);

-- Service Definitions Read Model (Permission Registry)
CREATE TABLE IF NOT EXISTS service_definitions_read_model (
    service_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    versions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_definitions_name ON service_definitions_read_model(name);
