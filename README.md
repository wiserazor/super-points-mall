# 超级无敌积分大商场

Luke 和 Lilian 可以自主使用的家庭成长积分应用。规则来自 `超级无敌积分大商城(1).xlsx` 的最新积分规则与礼品页，Web UI 重新设计为儿童友好的“成长岛”。

## 已实现

- Luke / Lilian 独立档案切换
- 奖励、纠正（扣分）和批量计数
- 每日任务防重复记录
- 会员等级与兑换折扣：青铜、白银、黄金、钻石、铂金
- 礼物兑换时原子校验余额，避免并发重复兑换造成透支
- 流水足迹与可审计的撤销记录
- 已导入 Excel 2026 年 7–8 月历史：Luke 45 条、当前 2001.5 分；Lilian 5 条、当前 866 分
- Excel 历史为只读记录，8 月初始化行仅展示原值、不重复计入余额
- Cloudflare D1 持久化
- 通过 Cloudflare Service Binding 同步 knowledge platform 的答题积分
- knowledge platform 暂时不可用时使用最近一次快照，不阻断商城操作
- 孩子可提交列表中没有的积分项目或礼物申请，申请不会直接改变积分
- 家长后台可审核申请、新建/编辑/停用奖励惩罚与礼物，并通过审计流水调整当前分数

## 本地运行

```bash
npm ci
npm run cf-typegen
npm run db:local
npm run dev
```

打开 `http://localhost:3000`。

knowledge platform 也在本地运行时，Wrangler 会自动连接名为 `knowledge-platform` 的 Worker；未连接时页面会显示“等待首次同步”。

## 家长后台

打开 `http://localhost:3000/admin`，输入 `.dev.vars` 中的 `PARENT_PIN`。PIN 只保存在当前浏览器标签的会话中。

线上部署前使用 Secret 设置 PIN，不要把真实 PIN 写入 `wrangler.jsonc`：

```bash
npx wrangler secret put PARENT_PIN
```

后台的“校准到指定分数”和“直接增加或扣除”都会新增一条家长调整流水，不会覆盖或删除原历史。

## Knowledge platform 集成

商城在服务端调用：

```text
GET /api/progress?profile=luke|lilian
```

目标 Worker 通过 `KNOWLEDGE_PLATFORM` Service Binding 注入。商城只转发 `oai-authenticated-user-*` 身份头，不把知识平台接口暴露给浏览器，也不直接操作另一套 D1。

预期响应中至少包含：

```json
{ "points": 120 }
```

线上部署前先部署名为 `knowledge-platform` 的目标 Worker，再部署本项目。

## 验证

```bash
npm test
npm run lint
npm run typecheck
npm run build
```
