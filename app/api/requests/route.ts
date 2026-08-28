import { requireChildSession } from "@/lib/child-auth";
import { appEnv, ensureSchema, ownerKey } from "@/lib/db";
import { ensureExcelHistory } from "@/lib/excel-history";
import { validProfile } from "@/lib/points";

type RequestSubmission = {
  profile?: unknown;
  requestType?: unknown;
  label?: unknown;
  note?: unknown;
};

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, maxLength);
  return text || null;
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json<RequestSubmission>().catch(() => null);
  const label = safeText(body?.label, 40);
  const note = safeText(body?.note, 120);
  if (
    !body || !validProfile(body.profile) || (body.requestType !== "rule" && body.requestType !== "item") ||
    !label
  ) {
    return Response.json({ error: "请写下想新增的积分项目或礼物。" }, { status: 400 });
  }

  const { DB } = appEnv();
  await ensureSchema(DB);
  const owner = ownerKey(request);
  await ensureExcelHistory(DB, owner);
  const unauthorized = await requireChildSession(request, DB, owner, body.profile);
  if (unauthorized) return unauthorized;

  const duplicate = await DB.prepare(`
    SELECT id FROM custom_requests
    WHERE owner_key = ? AND profile = ? AND request_type = ? AND label = ? AND status = 'pending'
    LIMIT 1
  `).bind(owner, body.profile, body.requestType, label).first<{ id: string }>();
  if (duplicate) return Response.json({ ok: true, message: "这条申请已经送到家长后台啦！" });

  const id = crypto.randomUUID();
  try {
    await DB.prepare(`
      INSERT INTO custom_requests (id, owner_key, profile, request_type, label, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, owner, body.profile, body.requestType, label, note).run();
  } catch (error) {
    console.error(JSON.stringify({ message: "custom request failed", error: error instanceof Error ? error.message : String(error) }));
    return Response.json({ error: "申请暂时没有保存成功，请再试一次。" }, { status: 500 });
  }

  return Response.json({ ok: true, message: "申请已经送到家长后台啦！" }, { status: 201 });
}
