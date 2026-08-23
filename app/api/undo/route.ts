import type { MutationPayload } from "@/lib/api-types";
import { appEnv, currentBalance, ensureSchema, ownerKey } from "@/lib/db";
import { ensureExcelHistory } from "@/lib/excel-history";
import { validDate, validProfile } from "@/lib/points";

type UndoSubmission = {
  profile?: unknown;
  eventId?: unknown;
  eventDate?: unknown;
  idempotencyKey?: unknown;
};

function asSubmission(value: unknown): UndoSubmission | null {
  return value && typeof value === "object" ? value as UndoSubmission : null;
}

export async function POST(request: Request): Promise<Response> {
  const body = asSubmission(await request.json().catch(() => null));
  if (
    !body || !validProfile(body.profile) || typeof body.eventId !== "string" ||
    !validDate(body.eventDate) || typeof body.idempotencyKey !== "string" || body.idempotencyKey.length > 80
  ) {
    return Response.json({ error: "找不到要撤销的记录。" }, { status: 400 });
  }

  const { DB } = appEnv();
  await ensureSchema(DB);
  const owner = ownerKey(request);
  await ensureExcelHistory(DB, owner);

  const result = await DB.prepare(`
    INSERT INTO mall_events (
      id, owner_key, profile, source, kind, label, points, quantity, event_date,
      idempotency_key, reverses_event_id
    )
    SELECT ?, owner_key, profile, 'reversal', 'reversal', '撤销：' || label, -points, quantity, ?, ?, id
    FROM mall_events original
    WHERE original.id = ? AND original.owner_key = ? AND original.profile = ?
      AND original.source != 'reversal'
      AND original.idempotency_key NOT LIKE 'excel-import:%'
      AND NOT EXISTS (SELECT 1 FROM mall_events r WHERE r.reverses_event_id = original.id)
  `).bind(
    crypto.randomUUID(), body.eventDate, body.idempotencyKey, body.eventId, owner, body.profile,
  ).run();

  if (Number(result.meta.changes || 0) === 0) {
    return Response.json({ error: "这条记录已经撤销，或不属于当前档案。" }, { status: 409 });
  }

  const balance = await currentBalance(DB, owner, body.profile);
  return Response.json({ ok: true, balance, message: "已经撤销，积分也恢复好了。" } satisfies MutationPayload);
}
