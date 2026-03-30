-- Migration: Add provider_api_keys table and encrypted_credentials column
-- Run with: wrangler d1 execute cliproxyapi-lite-db --file=scripts/migrate-001.sql --local

-- Add encrypted_credentials column to custom_providers (if not exists)
ALTER TABLE custom_providers ADD COLUMN encrypted_credentials TEXT DEFAULT '';

-- Create provider_api_keys table for multi-key load balancing
CREATE TABLE IF NOT EXISTS provider_api_keys (
    id              TEXT PRIMARY KEY,
    provider_id     TEXT NOT NULL,
    name            TEXT NOT NULL,
    api_key         TEXT NOT NULL,
    priority        INTEGER DEFAULT 100,
    enabled         INTEGER DEFAULT 1,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    FOREIGN KEY (provider_id) REFERENCES custom_providers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_provider_api_keys_provider ON provider_api_keys(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_api_keys_priority ON provider_api_keys(priority);
