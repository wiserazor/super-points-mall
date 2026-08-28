import type { AdminOverviewPayload, CustomRequest, MutationPayload } from "@/lib/api-types";
import {
  POINT_RULES,
  RULE_CATEGORIES,
  STORE_CATEGORIES,
  STORE_ITEMS,
  type Profile,
  type RuleCategory,
  type StoreItem,
} from "@/lib/catalog";
import { childPinConfigured, setChildPin, validChildPin } from "@/lib/child-auth";
import { loadCatalog } from "@/lib/catalog-store";
import { appEnv, currentBalance, ensureSchema, ownerKey } from "@/lib/db";
import { ensureExcelHistory } from "@/lib/excel-history";
import { syncKnowledgePoints } from "@/lib/knowledge-integration";
import { isParentRequest, parentUnauthorized } from "@/lib/parent-auth";
import { validDate, validProfile } from "@/lib/points";

type AdminAction = {
  action?: unknown;
  entry?: unknown;
  profile?: unknown;
  mode?: unknown;
  value?: unknown;
  reason?: unknown;
  eventDate?: unknown;
  idempotencyKey?: unknown;
  requestId?: unknown;
  status?: unknown;
  pin?: unknown;
  adjustmentId?: unknown;
};

type RequestRow = {
  id: string;
  profile: Profile;
  request_type: "rule" | "item";
  label: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type AdjustmentRow = {
  id: string;
  profile: Profile;
  points: number;
  note: string;
  created_at: string;
  reversed_by: string | null;
};

type EntryInput = Record<string, unknown>;

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, maxLength);
  return text || null;
}

function safeNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function asEntry(value: unknown): EntryInput | null {
  return value && typeof value === "object" ? value as EntryInput : null;
}

function isRuleCategory(value: unknown): value is RuleCategory {
  return typeof value === "string" && RULE_CATEGORIES.includes(value as RuleCategory);
}

function isStoreCategory(value: unknown): value is StoreItem["category"] {
  return typeof value === "string" && STORE_CATEGORIES.includes(value as StoreItem["category"]);
}

async function prepare(request: Request): Promise<{ db: D1Database; owner: string } | Response> {
  if (!await isParentRequest(request)) return parentUnauthorized();
  const { DB } = appEnv();
  await ensureSchema(DB);
  const owner = ownerKey(request);
  await ensureExcelHistory(DB, owner);
  return { db: DB, owner };
}

async function overview(request: Request, db: D1Database, owner: string): Promise<AdminOverviewPayload> {
  const [catalog, lukeSync, lilianSync, requestResult, adjustmentResult, lukePin, lilianPin] = await Promise.all([
    loadCatalog(db, owner, true),
    syncKnowledgePoints(request, "luke", db),
    syncKnowledgePoints(request, "lilian", db),
    db.prepare(`
      SELECT id, profile, request_type, label, note, status, created_at
      FROM custom_requests
      WHERE owner_key = ?
      ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC
      LIMIT 100
    `).bind(owner).all<RequestRow>(),
    db.prepare(`
      SELECT adjustment.id, adjustment.profile, adjustment.points, adjustment.note, adjustment.created_at,
             reversal.id AS reversed_by
      FROM knowledge_adjustments adjustment
      LEFT JOIN knowledge_adjustments reversal ON reversal.reverses_adjustment_id = adjustment.id
      WHERE adjustment.owner_key = ? AND adjustment.reverses_adjustment_id IS NULL
      ORDER BY adjustment.created_at DESC
      LIMIT 100
    `).bind(owner).all<AdjustmentRow>(),
    childPinConfigured(db, owner, "luke"),
    childPinConfigured(db, owner, "lilian"),
  ]);
  const [lukeBalance, lilianBalance, localResults] = await Promise.all([
    currentBalance(db, owner, "luke"),
    currentBalance(db, owner, "lilian"),
    db.batch([
      db.prepare("SELECT COALESCE(SUM(points), 0) AS points FROM mall_events WHERE owner_key = ? AND profile = 'luke'").bind(owner),
      db.prepare("SELECT COALESCE(SUM(points), 0) AS points FROM mall_events WHERE owner_key = ? AND profile = 'lilian'").bind(owner),
      db.prepare("SELECT COALESCE(SUM(points), 0) AS points FROM knowledge_adjustments WHERE owner_key = ? AND profile = 'luke'").bind(owner),
      db.prepare("SELECT COALESCE(SUM(points), 0) AS points FROM knowledge_adjustments WHERE owner_key = ? AND profile = 'lilian'").bind(owner),
    ]),
  ]);
  const localLuke = Number((localResults[0].results[0] as { points: number } | undefined)?.points || 0);
  const localLilian = Number((localResults[1].results[0] as { points: number } | undefined)?.points || 0);
  const adjustmentLuke = Number((localResults[2].results[0] as { points: number } | undefined)?.points || 0);
  const adjustmentLilian = Number((localResults[3].results[0] as { points: number } | undefined)?.points || 0);
  const requests: CustomRequest[] = requestResult.results.map((row) => ({
    id: row.id,
    profile: row.profile,
    requestType: row.request_type,
    label: row.label,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
  }));

  return {
    balances: {
      luke: {
        balance: lukeBalance,
        knowledgePoints: lukeSync.points,
        knowledgeAdjustment: adjustmentLuke,
        effectiveKnowledgePoints: lukeSync.points + adjustmentLuke,
        mallPoints: localLuke,
      },
      lilian: {
        balance: lilianBalance,
        knowledgePoints: lilianSync.points,
        knowledgeAdjustment: adjustmentLilian,
        effectiveKnowledgePoints: lilianSync.points + adjustmentLilian,
        mallPoints: localLilian,
      },
    },
    childPins: { luke: { configured: lukePin }, lilian: { configured: lilianPin } },
    knowledgeAdjustments: adjustmentResult.results.map((row) => ({
      id: row.id,
      profile: row.profile,
      points: Number(row.points),
      note: row.note,
      createdAt: row.created_at,
      undone: Boolean(row.reversed_by),
    })),
    rules: catalog.rules,
    items: catalog.items,
    requests,
  };
}

export async function GET(request: Request): Promise<Response> {
  const context = await prepare(request);
  if (context instanceof Response) return context;
  return Response.json(await overview(request, context.db, context.owner));
}

async function saveRule(db: D1Database, owner: string, input: EntryInput, requestId: string | null): Promise<Response> {
  const catalog = await loadCatalog(db, owner, true);
  const requestedId = safeText(input.id, 100);
  const existing = requestedId ? catalog.rules.find((rule) => rule.id === requestedId) : undefined;
  if (requestedId && !existing) return Response.json({ error: "找不到要修改的积分项目。" }, { status: 404 });

  const label = safeText(input.label, 60);
  const icon = safeText(input.icon, 8);
  const unit = safeText(input.unit, 30);
  const magnitude = safeNumber(input.points, 0.5, 100000);
  const kind = input.kind === "reward" || input.kind === "penalty" ? input.kind : null;
  if (!label || !icon || !magnitude || !kind || !isRuleCategory(input.category)) {
    return Response.json({ error: "积分项目的信息不完整。" }, { status: 400 });
  }

  const id = existing?.id || `custom-${crypto.randomUUID()}`;
  const points = kind === "reward" ? Math.abs(magnitude) : -Math.abs(magnitude);
  const isCustom = existing ? Boolean(existing.custom) : !POINT_RULES.some((rule) => rule.id === id);
  await db.prepare(`
    INSERT INTO catalog_entries (
      owner_key, entry_type, id, label, value, icon, category, unit, kind,
      daily, pending, active, is_custom, updated_at
    ) VALUES (?, 'rule', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_key, entry_type, id) DO UPDATE SET
      label = excluded.label, value = excluded.value, icon = excluded.icon,
      category = excluded.category, unit = excluded.unit, kind = excluded.kind,
      daily = excluded.daily, active = excluded.active, updated_at = CURRENT_TIMESTAMP
  `).bind(
    owner, id, label, points, icon, input.category, unit, kind,
    input.daily === true ? 1 : 0, input.active === false ? 0 : 1, isCustom ? 1 : 0,
  ).run();

  if (requestId) {
    await db.prepare(`
      UPDATE custom_requests SET status = 'approved', resolved_catalog_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND owner_key = ? AND status = 'pending'
    `).bind(id, requestId, owner).run();
  }
  return Response.json({ ok: true, message: existing ? "积分项目已更新。" : "新的积分项目已加入列表。", id });
}

async function saveItem(db: D1Database, owner: string, input: EntryInput, requestId: string | null): Promise<Response> {
  const catalog = await loadCatalog(db, owner, true);
  const requestedId = safeText(input.id, 100);
  const existing = requestedId ? catalog.items.find((item) => item.id === requestedId) : undefined;
  if (requestedId && !existing) return Response.json({ error: "找不到要修改的礼物。" }, { status: 404 });

  const label = safeText(input.label, 60);
  const icon = safeText(input.icon, 8);
  const unit = safeText(input.unit, 30);
  const cost = safeNumber(input.cost, 1, 100000);
  if (!label || !icon || !unit || !cost || !isStoreCategory(input.category)) {
    return Response.json({ error: "礼物信息不完整。" }, { status: 400 });
  }

  const id = existing?.id || `custom-${crypto.randomUUID()}`;
  const isCustom = existing ? Boolean(existing.custom) : !STORE_ITEMS.some((item) => item.id === id);
  await db.prepare(`
    INSERT INTO catalog_entries (
      owner_key, entry_type, id, label, value, icon, category, unit, kind,
      daily, pending, active, is_custom, updated_at
    ) VALUES (?, 'item', ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_key, entry_type, id) DO UPDATE SET
      label = excluded.label, value = excluded.value, icon = excluded.icon,
      category = excluded.category, unit = excluded.unit, pending = excluded.pending,
      active = excluded.active, updated_at = CURRENT_TIMESTAMP
  `).bind(
    owner, id, label, cost, icon, input.category, unit,
    input.pending === true ? 1 : 0, input.active === false ? 0 : 1, isCustom ? 1 : 0,
  ).run();

  if (requestId) {
    await db.prepare(`
      UPDATE custom_requests SET status = 'approved', resolved_catalog_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND owner_key = ? AND status = 'pending'
    `).bind(id, requestId, owner).run();
  }
  return Response.json({ ok: true, message: existing ? "礼物已更新。" : "新的礼物已加入商店。", id });
}

async function adjustBalance(request: Request, db: D1Database, owner: string, body: AdminAction): Promise<Response> {
  if (
    !validProfile(body.profile) || (body.mode !== "delta" && body.mode !== "set") ||
    !validDate(body.eventDate) || typeof body.idempotencyKey !== "string" || body.idempotencyKey.length > 80
  ) {
    return Response.json({ error: "积分调整信息不完整。" }, { status: 400 });
  }
  const value = safeNumber(body.value, -1000000, 1000000);
  const reason = safeText(body.reason, 120);
  if (value === null || !reason) return Response.json({ error: "请输入分数和调整原因。" }, { status: 400 });

  await syncKnowledgePoints(request, body.profile, db);
  const before = await currentBalance(db, owner, body.profile);
  const delta = body.mode === "set" ? value - before : value;
  if (Math.abs(delta) < 0.0001) return Response.json({ ok: true, balance: before, message: "当前积分已经是这个数值。" } satisfies MutationPayload);

  const key = `admin-adjustment:${owner}:${body.idempotencyKey}`;
  try {
    await db.prepare(`
      INSERT INTO mall_events (
        id, owner_key, profile, source, kind, rule_id, label, points, quantity,
        note, event_date, idempotency_key
      ) VALUES (?, ?, ?, 'rule', ?, 'admin-adjustment', '家长调整积分', ?, 1, ?, ?, ?)
    `).bind(
      key, owner, body.profile, delta >= 0 ? "reward" : "penalty", delta,
      `${body.mode === "set" ? `校准到 ${value} 分` : `增减 ${delta} 分`} · ${reason}`,
      body.eventDate, key,
    ).run();
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("UNIQUE constraint failed"))) throw error;
  }
  const balance = await currentBalance(db, owner, body.profile);
  return Response.json({ ok: true, balance, message: `积分已调整为 ${balance}。` } satisfies MutationPayload);
}

async function adjustKnowledge(request: Request, db: D1Database, owner: string, body: AdminAction): Promise<Response> {
  if (
    !validProfile(body.profile) || (body.mode !== "delta" && body.mode !== "set") ||
    typeof body.idempotencyKey !== "string" || body.idempotencyKey.length > 80
  ) {
    return Response.json({ error: "知识积分修正信息不完整。" }, { status: 400 });
  }
  const value = safeNumber(body.value, -1000000, 1000000);
  const reason = safeText(body.reason, 120);
  if (value === null || !reason) return Response.json({ error: "请输入修正分数和原因。" }, { status: 400 });

  const sync = await syncKnowledgePoints(request, body.profile, db);
  const offsetRow = await db.prepare(`
    SELECT COALESCE(SUM(points), 0) AS points
    FROM knowledge_adjustments
    WHERE owner_key = ? AND profile = ?
  `).bind(owner, body.profile).first<{ points: number }>();
  const offsetBefore = Number(offsetRow?.points || 0);
  const effectiveBefore = sync.points + offsetBefore;
  const delta = body.mode === "set" ? value - effectiveBefore : value;
  if (Math.abs(delta) < 0.0001) {
    return Response.json({ ok: true, balance: await currentBalance(db, owner, body.profile), message: "知识平台积分已经是这个数值。" } satisfies MutationPayload);
  }

  const idempotencyKey = `knowledge-adjustment:${owner}:${body.idempotencyKey}`;
  try {
    await db.prepare(`
      INSERT INTO knowledge_adjustments (
        id, owner_key, profile, points, note, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), owner, body.profile, delta,
      `${body.mode === "set" ? `将知识积分校准为 ${value}` : `知识积分增减 ${delta}`} · ${reason}`,
      idempotencyKey,
    ).run();
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("UNIQUE constraint failed"))) throw error;
  }

  const balance = await currentBalance(db, owner, body.profile);
  return Response.json({
    ok: true,
    balance,
    message: `知识积分修正已保存，当前有效知识积分为 ${effectiveBefore + delta}。`,
  } satisfies MutationPayload);
}

async function undoKnowledgeAdjustment(db: D1Database, owner: string, body: AdminAction): Promise<Response> {
  const adjustmentId = safeText(body.adjustmentId, 100);
  if (
    !validProfile(body.profile) || !adjustmentId ||
    typeof body.idempotencyKey !== "string" || body.idempotencyKey.length > 80
  ) {
    return Response.json({ error: "找不到要撤销的知识积分修正。" }, { status: 400 });
  }

  const idempotencyKey = `knowledge-adjustment-undo:${owner}:${body.idempotencyKey}`;
  const result = await db.prepare(`
    INSERT INTO knowledge_adjustments (
      id, owner_key, profile, points, note, idempotency_key, reverses_adjustment_id
    )
    SELECT ?, owner_key, profile, -points, '撤销：' || note, ?, id
    FROM knowledge_adjustments original
    WHERE original.id = ? AND original.owner_key = ? AND original.profile = ?
      AND original.reverses_adjustment_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM knowledge_adjustments reversal
        WHERE reversal.reverses_adjustment_id = original.id
      )
  `).bind(crypto.randomUUID(), idempotencyKey, adjustmentId, owner, body.profile).run();

  if (Number(result.meta.changes || 0) === 0) {
    return Response.json({ error: "这条知识积分修正已经撤销，或不属于当前档案。" }, { status: 409 });
  }
  return Response.json({
    ok: true,
    balance: await currentBalance(db, owner, body.profile),
    message: "知识积分修正已撤销。",
  } satisfies MutationPayload);
}

export async function POST(request: Request): Promise<Response> {
  const context = await prepare(request);
  if (context instanceof Response) return context;
  const body = await request.json<AdminAction>().catch(() => null);
  if (!body || typeof body.action !== "string") return Response.json({ error: "管理操作不完整。" }, { status: 400 });

  if (body.action === "save-rule") {
    const entry = asEntry(body.entry);
    if (!entry) return Response.json({ error: "积分项目的信息不完整。" }, { status: 400 });
    return saveRule(context.db, context.owner, entry, safeText(body.requestId, 100));
  }
  if (body.action === "save-item") {
    const entry = asEntry(body.entry);
    if (!entry) return Response.json({ error: "礼物信息不完整。" }, { status: 400 });
    return saveItem(context.db, context.owner, entry, safeText(body.requestId, 100));
  }
  if (body.action === "set-child-pin") {
    if (!validProfile(body.profile) || !validChildPin(body.pin)) {
      return Response.json({ error: "孩子 PIN 必须是 4 到 12 位数字。" }, { status: 400 });
    }
    await setChildPin(context.db, context.owner, body.profile, body.pin);
    return Response.json({ ok: true, message: `${body.profile === "luke" ? "Luke" : "Lilian"} 的 PIN 已更新，旧的解锁会话已失效。` });
  }
  if (body.action === "adjust-balance") return adjustBalance(request, context.db, context.owner, body);
  if (body.action === "adjust-knowledge") return adjustKnowledge(request, context.db, context.owner, body);
  if (body.action === "undo-knowledge-adjustment") return undoKnowledgeAdjustment(context.db, context.owner, body);
  if (body.action === "resolve-request") {
    const id = safeText(body.requestId, 100);
    if (!id || body.status !== "rejected") return Response.json({ error: "审核操作不完整。" }, { status: 400 });
    await context.db.prepare(`
      UPDATE custom_requests SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND owner_key = ? AND status = 'pending'
    `).bind(id, context.owner).run();
    return Response.json({ ok: true, message: "这条申请已暂不采用。" });
  }
  return Response.json({ error: "不支持的管理操作。" }, { status: 400 });
}
