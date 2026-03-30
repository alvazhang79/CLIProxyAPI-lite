-- CLIProxyAPI Lite — D1 Database Initialization
-- Run with: wrangler d1 execute <db-name> --file=scripts/init-d1.sql

-- ============================================================
-- API Keys
-- ============================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id              TEXT PRIMARY KEY,
    api_key         TEXT NOT NULL UNIQUE,
    key_prefix      TEXT NOT NULL,
    name            TEXT NOT NULL,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    allowed_models  TEXT DEFAULT '[]',
    api_secret      TEXT NOT NULL,
    embeddings_model TEXT,
    embeddings_provider TEXT,
    excluded_models     TEXT DEFAULT '[]',
    rate_limit      INTEGER DEFAULT 60,
    enabled         INTEGER DEFAULT 1,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_keys_api_key ON api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider);

-- ============================================================
-- Embeddings Index ✨
-- ============================================================
CREATE TABLE IF NOT EXISTS embeddings_index (
    id          TEXT PRIMARY KEY,
    api_key_id  TEXT NOT NULL,
    text        TEXT NOT NULL,
    vector      BLOB NOT NULL,
    model       TEXT NOT NULL,
    metadata    TEXT,
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_api_key_id ON embeddings_index(api_key_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON embeddings_index(created_at);

-- ============================================================
-- Admin Sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_sessions (
    id          TEXT PRIMARY KEY,
    token_hash  TEXT NOT NULL,
    expires_at  INTEGER NOT NULL,
    created_at  INTEGER NOT NULL
);

-- ============================================================
-- Request Logs
-- ============================================================
CREATE TABLE IF NOT EXISTS request_logs (
    id          TEXT PRIMARY KEY,
    api_key_id  TEXT NOT NULL,
    endpoint    TEXT NOT NULL,
    provider    TEXT NOT NULL,
    model       TEXT NOT NULL,
    tokens_used INTEGER,
    latency_ms  INTEGER,
    status_code INTEGER,
    error_msg   TEXT,
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
);

CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_id ON request_logs(api_key_id);

-- ============================================================
-- Custom Providers ✨
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_providers (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    base_url        TEXT NOT NULL,
    auth_type       TEXT NOT NULL DEFAULT 'bearer',
    auth_header     TEXT NOT NULL DEFAULT 'Authorization',
    headers         TEXT,
    proxy_url       TEXT,
    enabled         INTEGER DEFAULT 1,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_providers_name ON custom_providers(name);

-- ============================================================
-- Custom Models (Aliases) ✨
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_models (
    id              TEXT PRIMARY KEY,
    provider_id     TEXT NOT NULL,
    model           TEXT NOT NULL,
    alias           TEXT NOT NULL UNIQUE,
    display_name   TEXT,
    api_format     TEXT NOT NULL DEFAULT 'openai',
    supports_streaming INTEGER DEFAULT 1,
    supports_functions INTEGER DEFAULT 0,
    context_window  INTEGER,
    enabled         INTEGER DEFAULT 1,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    FOREIGN KEY (provider_id) REFERENCES custom_providers(id)
);

CREATE INDEX IF NOT EXISTS idx_custom_models_alias ON custom_models(alias);
CREATE INDEX IF NOT EXISTS idx_custom_models_provider ON custom_models(provider_id);

-- ============================================================
-- System Settings
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES
    ('default_rate_limit', '60', CAST(strftime('%s', 'now') AS INTEGER)),
    ('maintenance_mode', 'false', CAST(strftime('%s', 'now') AS INTEGER)),
    ('enabled_providers', 'openai,gemini,claude,qwen,cohere', CAST(strftime('%s', 'now') AS INTEGER)),
    ('default_language', 'en', CAST(strftime('%s', 'now') AS INTEGER));

-- ============================================================
-- Provider API Keys (for multi-key load balancing) ✨
-- ============================================================
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
