import type { MutationPayload } from "@/lib/api-types";
import { findItem } from "@/lib/catalog-store";
import { appEnv, currentBalance, ensureSchema, ownerKey } from "@/lib/db";
import { ensureExcelHistory } from "@/lib/excel-history";
import { syncKnowledgePoints } from "@/lib/knowledge-integration";
import { discountedCost, levelFor, safeQuantity, validDate, validProfile } from "@/lib/points";

type RedemptionSubmission = {
  profile?: unknown;
  itemId?: unknown;
  quantity?: unknown;
  eventDate?: unknown;
  idempotencyKey?: unknown;
};

function asSubmission(value: unknown): RedemptionSubmission | null {
  return value && typeof value === "object" ? value as RedemptionSubmission : null;
}

export async function POST(request: Request): Promise<Response> {
  const body = asSubmission(await request.json().catch(() => null));
  const quantity = safeQuantity(body?.quantity);
  if (
    !body || !validProfile(body.profile) || typeof body.itemId !== "string" || !quantity || !validDate(body.eventDate) ||
    typeof body.idempotencyKey !== "string" || body.idempotencyKey.length > 80
  ) {
    return Response.json({ error: "兑换信息不完整，请重新选择礼物。" }, { status: 400 });
  }

  const { DB } = appEnv();
  await ensureSchema(DB);
  const owner = ownerKey(request);
  await ensureExcelHistory(DB, owner);
  const item = await findItem(DB, owner, body.itemId);
  if (!item) return Response.json({ error: "这份礼物已停用或不存在。" }, { status: 404 });
  const integration = await syncKnowledgePoints(request, body.profile, DB);
  const balanceBefore = await currentBalance(DB, owner, body.profile);
  const unitCost = discountedCost(item.cost, balanceBefore);
  const totalCost = unitCost * quantity;
  const tier = levelFor(balanceBefore);

  try {
    const result = await DB.prepare(`
      INSERT INTO mall_events (
        id, owner_key, profile, source, kind, catalog_id, label, points, quantity,
        note, event_date, idempotency_key
      )
      SELECT ?, ?, ?, 'redemption', 'purchase', ?, ?, ?, ?, ?, ?, ?
      WHERE (
        COALESCE((SELECT points FROM knowledge_snapshots WHERE owner_key = ? AND profile = ?), 0) +
        COALESCE((SELECT SUM(points) FROM mall_events WHERE owner_key = ? AND profile = ?), 0)
      ) >= ?
    `).bind(
      crypto.randomUUID(), owner, body.profile, item.id, `兑换：${item.label}`,
      -totalCost, quantity, `${tier.name}${tier.discountLabel} · ${item.unit}`,
      body.eventDate, body.idempotencyKey,
      owner, body.profile, owner, body.profile, totalCost,
    ).run();

    if (Number(result.meta.changes || 0) === 0) {
      return Response.json({ error: `还差 ${Math.max(0, totalCost - balanceBefore)} 积分，再完成几个任务就能兑换啦！` }, { status: 409 });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      const balance = await currentBalance(DB, owner, body.profile);
      return Response.json({ ok: true, balance, message: "这份礼物已经兑换过了。" } satisfies MutationPayload);
    }
    throw error;
  }

  const balance = await currentBalance(DB, owner, body.profile);
  const syncNote = integration.state === "live" ? "知识积分已同步" : "按最近积分计算";
  return Response.json({
    ok: true,
    balance,
    message: `${item.icon} 兑换成功！花费 ${totalCost} 积分 · ${syncNote}`,
  } satisfies MutationPayload, { status: 201 });
}
