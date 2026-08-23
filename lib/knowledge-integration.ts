import type { Profile } from "@/lib/catalog";
import { appEnv, forwardedAuthHeaders, ownerKey } from "@/lib/db";

type ProgressPayload = { points: number };
type SnapshotRow = { points: number; synced_at: string };

export type KnowledgeSync = {
  points: number;
  state: "live" | "stale" | "unavailable";
  syncedAt: string | null;
};

function isProgressPayload(value: unknown): value is ProgressPayload {
  if (!value || typeof value !== "object" || !("points" in value)) return false;
  return typeof value.points === "number" && Number.isFinite(value.points);
}

async function savedSnapshot(db: D1Database, owner: string, profile: Profile): Promise<SnapshotRow | null> {
  return db.prepare("SELECT points, synced_at FROM knowledge_snapshots WHERE owner_key = ? AND profile = ?")
    .bind(owner, profile)
    .first<SnapshotRow>();
}

export async function syncKnowledgePoints(request: Request, profile: Profile, db: D1Database): Promise<KnowledgeSync> {
  const owner = ownerKey(request);

  try {
    const response = await appEnv().KNOWLEDGE_PLATFORM.fetch(
      `https://knowledge-platform/api/progress?profile=${profile}`,
      {
        headers: forwardedAuthHeaders(request),
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!response.ok) throw new Error(`knowledge platform returned ${response.status}`);

    const payload: unknown = await response.json();
    if (!isProgressPayload(payload)) throw new Error("knowledge platform returned an invalid progress payload");

    const points = Math.trunc(payload.points);
    const syncedAt = new Date().toISOString();
    await db.prepare(`
      INSERT INTO knowledge_snapshots (owner_key, profile, points, synced_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(owner_key, profile) DO UPDATE SET points = excluded.points, synced_at = excluded.synced_at
    `).bind(owner, profile, points, syncedAt).run();

    return { points, state: "live", syncedAt };
  } catch (error) {
    console.error(JSON.stringify({
      message: "knowledge points sync failed",
      profile,
      error: error instanceof Error ? error.message : String(error),
    }));
    const snapshot = await savedSnapshot(db, owner, profile);
    if (snapshot) return { points: Number(snapshot.points), state: "stale", syncedAt: snapshot.synced_at };
    return { points: 0, state: "unavailable", syncedAt: null };
  }
}
