import type { DashboardPayload, HistoryEvent } from "@/lib/api-types";
import type { Profile } from "@/lib/catalog";
import { childPinConfigured } from "@/lib/child-auth";
import { appEnv, ensureSchema, ownerKey } from "@/lib/db";
import { ensureExcelHistory, importedDisplayPoints } from "@/lib/excel-history";
import { loadCatalog } from "@/lib/catalog-store";
import { syncKnowledgePoints } from "@/lib/knowledge-integration";
import { levelFor, validProfile } from "@/lib/points";

type LocalPointsRow = { points: number };
type HistoryRow = {
  id: string;
  label: string;
  points: number;
  quantity: number;
  kind: HistoryEvent["kind"];
  source: HistoryEvent["source"];
  event_date: string;
  note: string | null;
  created_at: string;
  idempotency_key: string;
  reversed_by: string | null;
};

export async function GET(request: Request): Promise<Response> {
  const profileValue = new URL(request.url).searchParams.get("profile");
  const profile: Profile = validProfile(profileValue) ? profileValue : "luke";
  const { DB } = appEnv();
  await ensureSchema(DB);
  const owner = ownerKey(request);
  await ensureExcelHistory(DB, owner);
  const integration = await syncKnowledgePoints(request, profile, DB);

  const [catalog, pinConfigured, batchResults] = await Promise.all([
    loadCatalog(DB, owner),
    childPinConfigured(DB, owner, profile),
    DB.batch([
    DB.prepare("SELECT COALESCE(SUM(points), 0) AS points FROM mall_events WHERE owner_key = ? AND profile = ?")
      .bind(owner, profile),
    DB.prepare(`
      SELECT e.id, e.label, e.points, e.quantity, e.kind, e.source, e.event_date, e.note, e.created_at,
             e.idempotency_key,
             reverse_event.id AS reversed_by
      FROM mall_events e
      LEFT JOIN mall_events reverse_event ON reverse_event.reverses_event_id = e.id
      WHERE e.owner_key = ? AND e.profile = ? AND e.source != 'reversal'
      ORDER BY e.created_at DESC
      LIMIT 100
    `).bind(owner, profile),
    DB.prepare("SELECT COUNT(*) AS count FROM custom_requests WHERE owner_key = ? AND profile = ? AND status = 'pending'")
      .bind(owner, profile),
    DB.prepare("SELECT COALESCE(SUM(points), 0) AS points FROM knowledge_adjustments WHERE owner_key = ? AND profile = ?")
      .bind(owner, profile),
    ]),
  ]);
  const [localResult, historyResult, requestResult, adjustmentResult] = batchResults;

  const mallPoints = Number((localResult.results[0] as LocalPointsRow | undefined)?.points || 0);
  const knowledgeAdjustment = Number((adjustmentResult.results[0] as LocalPointsRow | undefined)?.points || 0);
  const effectiveKnowledgePoints = integration.points + knowledgeAdjustment;
  const balance = effectiveKnowledgePoints + mallPoints;
  const history: HistoryEvent[] = (historyResult.results as HistoryRow[]).map((row) => ({
    id: row.id,
    label: row.label,
    points: importedDisplayPoints(row.id, Number(row.points)),
    quantity: Number(row.quantity),
    kind: row.kind,
    source: row.source,
    eventDate: row.event_date,
    note: row.note,
    createdAt: row.created_at,
    undone: Boolean(row.reversed_by),
    canUndo: !row.idempotency_key.startsWith("excel-import:") && !row.idempotency_key.startsWith("admin-adjustment:"),
  }));

  const payload: DashboardPayload = {
    profile,
    balance,
    knowledgePoints: integration.points,
    knowledgeAdjustment,
    effectiveKnowledgePoints,
    mallPoints,
    childPinConfigured: pinConfigured,
    level: levelFor(balance),
    integration: { state: integration.state, syncedAt: integration.syncedAt },
    history,
    rules: catalog.rules,
    items: catalog.items,
    pendingRequestCount: Number((requestResult.results[0] as { count: number } | undefined)?.count || 0),
  };
  return Response.json(payload);
}
