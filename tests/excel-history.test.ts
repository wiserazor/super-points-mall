import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { excelCurrentBalances, excelHistory, importedDisplayPoints } from "../lib/excel-history.ts";

function importedBalance(profile: "luke" | "lilian"): number {
  return excelHistory
    .filter((event) => event.profile === profile)
    .filter((event) => !event.id.startsWith("202608-") || !event.id.endsWith("-r3"))
    .reduce((sum, event) => sum + event.points, 0);
}

describe("Excel 最近两个月历史导入", () => {
  it("与 Excel 当前积分完全一致", () => {
    assert.equal(importedBalance("luke"), excelCurrentBalances.luke);
    assert.equal(importedBalance("lilian"), excelCurrentBalances.lilian);
  });

  it("只包含 2026 年 7 月和 8 月记录", () => {
    assert.ok(excelHistory.length >= 50);
    assert.ok(excelHistory.every((event) => event.eventDate >= "2026-07-01" && event.eventDate <= "2026-08-22"));
  });

  it("保留奖励、惩罚和兑换三种历史", () => {
    assert.deepEqual(new Set(excelHistory.map((event) => event.kind)), new Set(["reward", "penalty", "purchase"]));
  });

  it("月度结转在历史中显示 Excel 原值但不重复计入余额", () => {
    assert.equal(importedDisplayPoints("excel-import:family-local:202608-luke-r3", 0), 726.5);
    assert.equal(importedDisplayPoints("excel-import:family-local:202608-lilian-r3", 0), 1106);
  });
});
