CREATE TABLE IF NOT EXISTS catalog_entries (
  owner_key TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('rule', 'item')),
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  value REAL NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT,
  kind TEXT CHECK (kind IN ('reward', 'penalty')),
  daily INTEGER NOT NULL DEFAULT 0 CHECK (daily IN (0, 1)),
  pending INTEGER NOT NULL DEFAULT 0 CHECK (pending IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_key, entry_type, id)
);

CREATE TABLE IF NOT EXISTS custom_requests (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  profile TEXT NOT NULL CHECK (profile IN ('luke', 'lilian')),
  request_type TEXT NOT NULL CHECK (request_type IN ('rule', 'item')),
  label TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_catalog_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_entries_owner_type_active
  ON catalog_entries(owner_key, entry_type, active);

CREATE INDEX IF NOT EXISTS idx_custom_requests_owner_status_created
  ON custom_requests(owner_key, status, created_at DESC);
