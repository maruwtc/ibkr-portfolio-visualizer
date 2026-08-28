CREATE TABLE IF NOT EXISTS snaptrade_credentials (
  auth0_user_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  encrypted_consumer_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
