import type { Profile } from "@/lib/catalog";
import { createChildSession, verifyChildPin } from "@/lib/child-auth";
import { appEnv, ensureSchema, ownerKey } from "@/lib/db";
import { validProfile } from "@/lib/points";

type AuthSubmission = { profile?: unknown; pin?: unknown };

export async function POST(request: Request): Promise<Response> {
  const body = await request.json<AuthSubmission>().catch(() => null);
  if (!body || !validProfile(body.profile)) {
    return Response.json({ error: "请选择要解锁的孩子档案。" }, { status: 400 });
  }

  const profile: Profile = body.profile;
  const { DB } = appEnv();
  await ensureSchema(DB);
  const owner = ownerKey(request);
  const result = await verifyChildPin(DB, owner, profile, body.pin);
  if (result === "not-configured") {
    return Response.json({ error: "家长还没有为这个档案设置孩子 PIN。", code: "CHILD_PIN_NOT_CONFIGURED" }, { status: 428 });
  }
  if (result === "locked") {
    return Response.json({ error: "尝试次数太多，请 5 分钟后再试，或请家长重设 PIN。", code: "CHILD_PIN_LOCKED" }, { status: 429 });
  }
  if (result !== "allowed") {
    return Response.json({ error: "孩子 PIN 不正确。", code: "CHILD_PIN_INVALID" }, { status: 401 });
  }

  const token = await createChildSession(DB, owner, profile);
  return Response.json({ ok: true, token, profile });
}
