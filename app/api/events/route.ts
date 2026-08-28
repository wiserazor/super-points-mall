import type { MutationPayload } from "@/lib/api-types";
import { requireChildSession } from "@/lib/child-auth";
import { findRule } from "@/lib/catalog-store";
import { appEnv, currentBalance, ensureSchema, ownerKey } from "@/lib/db";
import { ensureExcelHistory } from "@/lib/excel-history";
import { safeQuantity, validDate, validProfile } from "@/lib/points";

type EventSubmission = {
  profile?: unknown;
  ruleId?: unknown;
  quantity?: unknown;
  note?: unknown;
  eventDate?: unknown;
  idempotencyKey?: unknown;
};

function safeNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const note = value.trim().slice(0, 80);
  return note || null;
}

function asSubmission(value: unknown): EventSubmission | null {
  return value && typeof value === "object" ? value as EventSubmission : null;
}

export async function POST(request: Request): Promise<Response> {
  const body = asSubmission(await request.json().catch(() => null));
  const quantity = safeQuantity(body?.quantity);
  if (
    !body || !validProfile(body.profile) || typeof body.ruleId !== "string" || !quantity || !validDate(body.eventDate) ||
    typeof body.idempotencyKey !== "string" || body.idempotencyKey.length > 80
  ) {
    return Response.json({ error: "这次记录的信息不完整，请再试一次。" }, { status: 400 });
  }

  const { DB } = appEnv();
  await ensureSchema(DB);
  const owner = ownerKey(request);
  await ensureExcelHistory(DB, owner);
  const unauthorized = await requireChildSession(request, DB, owner, body.profile);
  if (unauthorized) return unauthorized;
  const rule = await findRule(DB, owner, body.ruleId);
  if (!rule) return Response.json({ error: "这个积分项目已停用或不存在。" }, { status: 404 });

  if (rule.daily) {
    const previous = await DB.prepare(`
      SELECT e.id FROM mall_events e
      LEFT JOIN mall_events reverse_event ON reverse_event.reverses_event_id = e.id
      WHERE e.owner_key = ? AND e.profile = ? AND e.rule_id = ? AND e.event_date = ?
        AND e.source = 'rule' AND reverse_event.id IS NULL
      LIMIT 1
    `).bind(owner, body.profile, rule.id, body.eventDate).first<{ id: string }>();
    if (previous) return Response.json({ error: "这个每日任务今天已经记录过啦。" }, { status: 409 });
  }

  const points = rule.points * quantity;
  try {
    await DB.prepare(`
      INSERT INTO mall_events (
        id, owner_key, profile, source, kind, rule_id, label, points, quantity,
        note, event_date, idempotency_key
      ) VALUES (?, ?, ?, 'rule', ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), owner, body.profile, rule.kind, rule.id, rule.label,
      points, quantity, safeNote(body.note), body.eventDate, body.idempotencyKey,
    ).run();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      const balance = await currentBalance(DB, owner, body.profile);
      return Response.json({ ok: true, balance, message: "这条记录已经保存过了。" } satisfies MutationPayload);
    }
    throw error;
  }

  const balance = await currentBalance(DB, owner, body.profile);
  const verb = points >= 0 ? "获得" : "扣除";
  return Response.json({
    ok: true,
    balance,
    message: `${rule.icon} 已${verb} ${Math.abs(points)} 积分`,
  } satisfies MutationPayload, { status: 201 });
}
