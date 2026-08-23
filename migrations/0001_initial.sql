CREATE TABLE IF NOT EXISTS mall_events (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  profile TEXT NOT NULL CHECK (profile IN ('luke', 'lilian')),
  source TEXT NOT NULL CHECK (source IN ('rule', 'redemption', 'reversal')),
  kind TEXT NOT NULL CHECK (kind IN ('reward', 'penalty', 'purchase', 'reversal')),
  rule_id TEXT,
  catalog_id TEXT,
  label TEXT NOT NULL,
  points INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  note TEXT,
  event_date TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  reverses_event_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_snapshots (
  owner_key TEXT NOT NULL,
  profile TEXT NOT NULL CHECK (profile IN ('luke', 'lilian')),
  points INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (owner_key, profile)
);

CREATE INDEX IF NOT EXISTS idx_mall_events_owner_profile_created
  ON mall_events(owner_key, profile, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mall_events_owner_profile_rule
  ON mall_events(owner_key, profile, rule_id, event_date);
