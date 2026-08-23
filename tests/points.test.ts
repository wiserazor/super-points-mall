import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discountedCost, levelFor, safeQuantity, validProfile } from "../lib/points.ts";

describe("积分等级和兑换折扣", () => {
  it("按照表格边界切换等级", () => {
    assert.equal(levelFor(1499).name, "青铜");
    assert.equal(levelFor(1500).name, "白银");
    assert.equal(levelFor(3000).name, "黄金");
    assert.equal(levelFor(5000).name, "钻石");
    assert.equal(levelFor(7500).name, "铂金");
  });

  it("将等级折扣应用到单件礼物", () => {
    assert.equal(discountedCost(150, 2000), 135);
    assert.equal(discountedCost(500, 3100), 400);
    assert.equal(discountedCost(100, 8000), 60);
  });
});

describe("请求输入校验", () => {
  it("只接受两个儿童档案", () => {
    assert.equal(validProfile("luke"), true);
    assert.equal(validProfile("lilian"), true);
    assert.equal(validProfile("parent"), false);
  });

  it("限制批量操作，避免误触造成大量积分", () => {
    assert.equal(safeQuantity(1), 1);
    assert.equal(safeQuantity(50), 50);
    assert.equal(safeQuantity(51), null);
    assert.equal(safeQuantity(1.5), null);
  });
});
