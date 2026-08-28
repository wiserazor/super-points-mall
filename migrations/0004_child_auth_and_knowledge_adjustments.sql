CREATE TABLE IF NOT EXISTS child_credentials (
  owner_key TEXT NOT NULL,
  profile TEXT NOT NULL CHECK (profile IN ('luke', 'lilian')),
  pin_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_key, profile)
);

CREATE TABLE IF NOT EXISTS child_sessions (
  token_hash TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  profile TEXT NOT NULL CHECK (profile IN ('luke', 'lilian')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_child_sessions_owner_profile
  ON child_sessions(owner_key, profile, expires_at);

CREATE TABLE IF NOT EXISTS knowledge_adjustments (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  profile TEXT NOT NULL CHECK (profile IN ('luke', 'lilian')),
  points REAL NOT NULL,
  note TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  reverses_adjustment_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_adjustments_owner_profile_created
  ON knowledge_adjustments(owner_key, profile, created_at DESC);
