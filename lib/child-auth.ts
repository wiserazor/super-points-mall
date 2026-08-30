import type { Profile } from "@/lib/catalog";
import { isParentRequest } from "@/lib/parent-auth";

// Keep PIN hashing below the Workers Free 10 ms CPU budget. Online guessing is
// additionally limited by the failed-attempt lock below.
const PIN_ITERATIONS = 10_000;
const SESSION_HOURS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const encoder = new TextEncoder();

type CredentialRow = {
  pin_salt: string;
  pin_hash: string;
  iterations: number;
  failed_attempts: number;
  locked_until: string | null;
};

export type ChildPinCheck = "allowed" | "not-configured" | "denied" | "locked";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256(value: string): Promise<string> {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function derivePin(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function validChildPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4,12}$/.test(value);
}

export async function childPinConfigured(db: D1Database, owner: string, profile: Profile): Promise<boolean> {
  const row = await db.prepare(
    "SELECT 1 AS configured FROM child_credentials WHERE owner_key = ? AND profile = ?",
  ).bind(owner, profile).first<{ configured: number }>();
  return Boolean(row?.configured);
}

export async function setChildPin(db: D1Database, owner: string, profile: Profile, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePin(pin, salt, PIN_ITERATIONS);
  await db.batch([
    db.prepare(`
      INSERT INTO child_credentials (
        owner_key, profile, pin_salt, pin_hash, iterations, failed_attempts, locked_until, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, NULL, CURRENT_TIMESTAMP)
      ON CONFLICT(owner_key, profile) DO UPDATE SET
        pin_salt = excluded.pin_salt,
        pin_hash = excluded.pin_hash,
        iterations = excluded.iterations,
        failed_attempts = 0,
        locked_until = NULL,
        updated_at = CURRENT_TIMESTAMP
    `).bind(owner, profile, bytesToBase64Url(salt), bytesToBase64Url(hash), PIN_ITERATIONS),
    db.prepare("DELETE FROM child_sessions WHERE owner_key = ? AND profile = ?").bind(owner, profile),
  ]);
}

export async function verifyChildPin(
  db: D1Database,
  owner: string,
  profile: Profile,
  pin: unknown,
): Promise<ChildPinCheck> {
  const row = await db.prepare(`
    SELECT pin_salt, pin_hash, iterations, failed_attempts, locked_until
    FROM child_credentials
    WHERE owner_key = ? AND profile = ?
  `).bind(owner, profile).first<CredentialRow>();
  if (!row) return "not-configured";

  const now = Date.now();
  if (row.locked_until && Date.parse(row.locked_until) > now) return "locked";
  if (!validChildPin(pin)) return "denied";

  const actual = await derivePin(pin, base64UrlToBytes(row.pin_salt), Number(row.iterations));
  if (equalBytes(actual, base64UrlToBytes(row.pin_hash))) {
    await db.prepare(`
      UPDATE child_credentials SET failed_attempts = 0, locked_until = NULL
      WHERE owner_key = ? AND profile = ?
    `).bind(owner, profile).run();
    return "allowed";
  }

  const failures = Number(row.failed_attempts || 0) + 1;
  const lockedUntil = failures >= MAX_FAILED_ATTEMPTS
    ? new Date(now + LOCK_MINUTES * 60_000).toISOString()
    : null;
  await db.prepare(`
    UPDATE child_credentials SET failed_attempts = ?, locked_until = ?
    WHERE owner_key = ? AND profile = ?
  `).bind(failures, lockedUntil, owner, profile).run();
  return lockedUntil ? "locked" : "denied";
}

export async function createChildSession(db: D1Database, owner: string, profile: Profile): Promise<string> {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60_000).toISOString();
  await db.batch([
    db.prepare("DELETE FROM child_sessions WHERE expires_at <= ?").bind(new Date().toISOString()),
    db.prepare(`
      INSERT INTO child_sessions (token_hash, owner_key, profile, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(await sha256(token), owner, profile, expiresAt),
  ]);
  return token;
}

export async function isChildSession(
  request: Request,
  db: D1Database,
  owner: string,
  profile: Profile,
): Promise<boolean> {
  if (await isParentRequest(request)) return true;
  const token = request.headers.get("x-child-session") || "";
  if (token.length < 32 || token.length > 100) return false;
  const row = await db.prepare(`
    SELECT 1 AS valid
    FROM child_sessions
    WHERE token_hash = ? AND owner_key = ? AND profile = ? AND expires_at > ?
  `).bind(await sha256(token), owner, profile, new Date().toISOString()).first<{ valid: number }>();
  return Boolean(row?.valid);
}

export async function requireChildSession(
  request: Request,
  db: D1Database,
  owner: string,
  profile: Profile,
): Promise<Response | null> {
  if (!await childPinConfigured(db, owner, profile)) {
    return Response.json(
      { error: "家长还没有为这个档案设置孩子 PIN，请先到家长后台设置。", code: "CHILD_PIN_NOT_CONFIGURED" },
      { status: 428, headers: { "Cache-Control": "private, no-store", Vary: "x-child-session, x-parent-pin" } },
    );
  }
  if (await isChildSession(request, db, owner, profile)) return null;
  return Response.json(
    { error: "请先用当前孩子的 PIN 解锁，不能查看或修改其他人的档案。", code: "CHILD_SESSION_REQUIRED" },
    { status: 401, headers: { "Cache-Control": "private, no-store", Vary: "x-child-session, x-parent-pin" } },
  );
}
