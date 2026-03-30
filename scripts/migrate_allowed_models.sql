-- Migration: Add allowed_models column to api_keys table
-- This is idempotent - safe to run multiple times
ALTER TABLE api_keys ADD COLUMN allowed_models TEXT DEFAULT '[]';
