import { env } from "cloudflare:workers";

const AUTH_HEADER_NAMES = [
  "oai-authenticated-user-id",
  "oai-authenticated-user-email",
  "oai-authenticated-user-full-name",
  "oai-authenticated-user-full-name-encoding",
] as const;

export function appEnv(): Cloudflare.Env {
  return env;
}

export function ownerKey(request: Request): string {
  return request.headers.get("oai-authenticated-user-id") || "family-local";
}

export function forwardedAuthHeaders(request: Request): Headers {
  const headers = new Headers({ Accept: "application/json" });
  for (const name of AUTH_HEADER_NAMES) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

export async function ensureSchema(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS mall_events (
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
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS knowledge_snapshots (
      owner_key TEXT NOT NULL,
      profile TEXT NOT NULL CHECK (profile IN ('luke', 'lilian')),
      points INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL,
      PRIMARY KEY (owner_key, profile)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS data_imports (
      owner_key TEXT NOT NULL,
      import_id TEXT NOT NULL,
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (owner_key, import_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS catalog_entries (
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
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS custom_requests (
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
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS child_credentials (
      owner_key TEXT NOT NULL,
      profile TEXT NOT NULL CHECK (profile IN ('luke', 'lilian')),
      pin_salt TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      iterations INTEGER NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (owner_key, profile)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS child_sessions (
      token_hash TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      profile TEXT NOT NULL CHECK (profile IN ('luke', 'lilian')),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS knowledge_adjustments (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      profile TEXT NOT NULL CHECK (profile IN ('luke', 'lilian')),
      points REAL NOT NULL,
      note TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      reverses_adjustment_id TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_mall_events_owner_profile_created ON mall_events(owner_key, profile, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_mall_events_owner_profile_rule ON mall_events(owner_key, profile, rule_id, event_date)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_catalog_entries_owner_type_active ON catalog_entries(owner_key, entry_type, active)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_custom_requests_owner_status_created ON custom_requests(owner_key, status, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_child_sessions_owner_profile ON child_sessions(owner_key, profile, expires_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_knowledge_adjustments_owner_profile_created ON knowledge_adjustments(owner_key, profile, created_at DESC)"),
  ]);
}

export async function currentBalance(db: D1Database, owner: string, profile: string): Promise<number> {
  const row = await db.prepare(`
    SELECT
      COALESCE((SELECT points FROM knowledge_snapshots WHERE owner_key = ? AND profile = ?), 0) +
      COALESCE((SELECT SUM(points) FROM knowledge_adjustments WHERE owner_key = ? AND profile = ?), 0) +
      COALESCE((SELECT SUM(points) FROM mall_events WHERE owner_key = ? AND profile = ?), 0) AS balance
  `).bind(owner, profile, owner, profile, owner, profile).first<{ balance: number }>();
  return Number(row?.balance || 0);
}
