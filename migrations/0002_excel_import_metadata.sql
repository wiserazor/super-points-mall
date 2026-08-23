CREATE TABLE IF NOT EXISTS data_imports (
  owner_key TEXT NOT NULL,
  import_id TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_key, import_id)
);
