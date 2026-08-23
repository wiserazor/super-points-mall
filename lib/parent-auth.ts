import { appEnv } from "@/lib/db";
import { timingSafeEqual } from "node:crypto";

async function hash(value: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function isParentRequest(request: Request): Promise<boolean> {
  const provided = request.headers.get("x-parent-pin") || "";
  const expected = appEnv().PARENT_PIN;
  if (!provided || !expected) return false;
  const [providedHash, expectedHash] = await Promise.all([hash(provided), hash(expected)]);
  return timingSafeEqual(providedHash, expectedHash);
}

export function parentUnauthorized(): Response {
  return Response.json({ error: "家长 PIN 不正确。" }, { status: 401 });
}
