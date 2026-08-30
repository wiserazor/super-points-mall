import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readJsonResponse } from "../lib/http-client.ts";

describe("API 响应解析", () => {
  it("读取 JSON 响应", async () => {
    const payload = await readJsonResponse(Response.json({ ok: true }));
    assert.deepEqual(payload, { ok: true });
  });

  it("空响应不会抛出 JSON 解析错误", async () => {
    const payload = await readJsonResponse(new Response(null, { status: 500 }));
    assert.equal(payload, null);
  });

  it("非 JSON 错误页不会抛出解析错误", async () => {
    const payload = await readJsonResponse(new Response("Worker error", { status: 500 }));
    assert.equal(payload, null);
  });
});
