-- Migration: Add missing columns to api_keys table
-- Run with: wrangler d1 execute cliproxyapi-lite-db --file=scripts/migrate-002.sql --env production

-- Add embeddings_provider column ( TEXT, nullable )
ALTER TABLE api_keys ADD COLUMN embeddings_provider TEXT;

-- Add excluded_models column ( TEXT DEFAULT '[]' )
ALTER TABLE api_keys ADD COLUMN excluded_models TEXT DEFAULT '[]';
