import type { Profile } from "@/lib/catalog";

export type ExcelHistoryEvent = {
  id: string;
  profile: Profile;
  source: "rule" | "redemption";
  kind: "reward" | "penalty" | "purchase";
  label: string;
  points: number;
  eventDate: string;
  note: string;
};

const julyLuke: ExcelHistoryEvent[] = [
  { id: "202607-luke-r3", profile: "luke", source: "rule", kind: "reward", label: "Excel 7 月期初积分", points: 516.5, eventDate: "2026-07-01", note: "来自 Excel「积分202607」的期初余额" },
  { id: "202607-luke-r4", profile: "luke", source: "rule", kind: "penalty", label: "打架", points: -600, eventDate: "2026-07-05", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r5", profile: "luke", source: "rule", kind: "penalty", label: "成绩低于平均分", points: -500, eventDate: "2026-07-05", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r6", profile: "luke", source: "rule", kind: "reward", label: "喝水/天", points: 200, eventDate: "2026-07-08", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r7", profile: "luke", source: "rule", kind: "reward", label: "看书20分钟English（RAZ）", points: 500, eventDate: "2026-07-08", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r8", profile: "luke", source: "rule", kind: "reward", label: "看书20分钟", points: 120, eventDate: "2026-07-09", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r9", profile: "luke", source: "rule", kind: "reward", label: "看书20分钟", points: 180, eventDate: "2026-07-15", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r10", profile: "luke", source: "rule", kind: "reward", label: "隐藏奖励（GPA进步奖）", points: 800, eventDate: "2026-07-15", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r11", profile: "luke", source: "rule", kind: "reward", label: "讲上海话", points: 20, eventDate: "2026-07-15", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r12", profile: "luke", source: "redemption", kind: "purchase", label: "兑换：Switch", points: -150, eventDate: "2026-07-15", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r13", profile: "luke", source: "rule", kind: "reward", label: "知识问答/每题", points: 150, eventDate: "2026-07-17", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r14", profile: "luke", source: "redemption", kind: "purchase", label: "兑换：Switch", points: -150, eventDate: "2026-07-16", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r15", profile: "luke", source: "rule", kind: "reward", label: "帮助他人", points: 40, eventDate: "2026-07-17", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r16", profile: "luke", source: "redemption", kind: "purchase", label: "兑换：宝可梦卡", points: -680, eventDate: "2026-07-18", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r17", profile: "luke", source: "rule", kind: "reward", label: "知识问答/每题", points: 210, eventDate: "2026-07-18", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r18", profile: "luke", source: "redemption", kind: "purchase", label: "兑换：Switch", points: -150, eventDate: "2026-07-18", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r19", profile: "luke", source: "redemption", kind: "purchase", label: "兑换：皇室战争", points: -150, eventDate: "2026-07-25", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r20", profile: "luke", source: "rule", kind: "reward", label: "看书20分钟", points: 150, eventDate: "2026-07-29", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r21", profile: "luke", source: "rule", kind: "reward", label: "完成多邻国练习", points: 150, eventDate: "2026-07-01", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r22", profile: "luke", source: "rule", kind: "reward", label: "篮球课表现良好/跑步", points: 50, eventDate: "2026-07-29", note: "从 Excel「积分202607」导入" },
  { id: "202607-luke-r23", profile: "luke", source: "rule", kind: "reward", label: "独立早起", points: 20, eventDate: "2026-07-27", note: "从 Excel「积分202607」导入" },
];

const julyLilian: ExcelHistoryEvent[] = [
  { id: "202607-lilian-r3", profile: "lilian", source: "rule", kind: "reward", label: "Excel 7 月期初积分", points: 1206, eventDate: "2026-07-01", note: "来自 Excel「积分202607」的期初余额" },
  { id: "202607-lilian-r4", profile: "lilian", source: "rule", kind: "penalty", label: "打架", points: -600, eventDate: "2026-07-05", note: "从 Excel「积分202607」导入" },
  { id: "202607-lilian-r5", profile: "lilian", source: "rule", kind: "reward", label: "神秘奖励", points: 500, eventDate: "2026-07-06", note: "从 Excel「积分202607」导入" },
];

const augustLuke: ExcelHistoryEvent[] = [
  { id: "202608-luke-r3", profile: "luke", source: "rule", kind: "reward", label: "8月初始化", points: 726.5, eventDate: "2026-08-01", note: "Excel 月度结转行；展示历史但不重复计入余额" },
  { id: "202608-luke-r4", profile: "luke", source: "rule", kind: "reward", label: "篮球课命中投篮", points: 200, eventDate: "2026-08-07", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r5", profile: "luke", source: "rule", kind: "reward", label: "篮球课表现良好", points: 40, eventDate: "2026-08-07", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r6", profile: "luke", source: "rule", kind: "reward", label: "完成多邻国练习", points: 155, eventDate: "2026-08-01", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r7", profile: "luke", source: "rule", kind: "reward", label: "完成背单词", points: 930, eventDate: "2026-08-01", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r8", profile: "luke", source: "rule", kind: "reward", label: "喝水/天", points: 250, eventDate: "2026-08-07", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r9", profile: "luke", source: "rule", kind: "reward", label: "独立早起", points: 20, eventDate: "2026-08-05", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r10", profile: "luke", source: "redemption", kind: "purchase", label: "兑换：代打黑神话", points: -200, eventDate: "2026-08-06", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r11", profile: "luke", source: "redemption", kind: "purchase", label: "兑换：皇室战争", points: -750, eventDate: "2026-08-07", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r12", profile: "luke", source: "redemption", kind: "purchase", label: "兑换：看电视", points: -120, eventDate: "2026-08-07", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r13", profile: "luke", source: "redemption", kind: "purchase", label: "兑换：黑神话", points: -150, eventDate: "2026-08-07", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r14", profile: "luke", source: "redemption", kind: "purchase", label: "兑换：Miniso盲盒", points: -240, eventDate: "2026-08-08", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r15", profile: "luke", source: "redemption", kind: "purchase", label: "兑换：黑神话", points: -150, eventDate: "2026-08-11", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r16", profile: "luke", source: "rule", kind: "reward", label: "看书20分钟", points: 240, eventDate: "2026-08-11", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r17", profile: "luke", source: "rule", kind: "reward", label: "喝水/天", points: 250, eventDate: "2026-08-12", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r18", profile: "luke", source: "rule", kind: "reward", label: "篮球课命中投篮", points: 100, eventDate: "2026-08-12", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r19", profile: "luke", source: "rule", kind: "reward", label: "篮球课表现良好", points: 10, eventDate: "2026-08-12", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r20", profile: "luke", source: "rule", kind: "reward", label: "喝水/天", points: 200, eventDate: "2026-08-17", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r21", profile: "luke", source: "rule", kind: "reward", label: "看书20分钟", points: 40, eventDate: "2026-08-17", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r22", profile: "luke", source: "rule", kind: "reward", label: "独立早起", points: 60, eventDate: "2026-08-17", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r23", profile: "luke", source: "redemption", kind: "purchase", label: "兑换：黑化神悟空", points: -150, eventDate: "2026-08-18", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r24", profile: "luke", source: "rule", kind: "reward", label: "独立早起", points: 40, eventDate: "2026-08-22", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r25", profile: "luke", source: "rule", kind: "reward", label: "看书20分钟English（RAZ）", points: 300, eventDate: "2026-08-21", note: "从 Excel「积分202608」导入" },
  { id: "202608-luke-r26", profile: "luke", source: "rule", kind: "reward", label: "帮助他人", points: 200, eventDate: "2026-08-22", note: "从 Excel「积分202608」导入" },
];

const augustLilian: ExcelHistoryEvent[] = [
  { id: "202608-lilian-r3", profile: "lilian", source: "rule", kind: "reward", label: "8月初始化", points: 1106, eventDate: "2026-08-01", note: "Excel 月度结转行；展示历史但不重复计入余额" },
  { id: "202608-lilian-r4", profile: "lilian", source: "redemption", kind: "purchase", label: "兑换：Miniso盲盒", points: -240, eventDate: "2026-08-08", note: "从 Excel「积分202608」导入" },
];

export const excelHistory = [...julyLuke, ...julyLilian, ...augustLuke, ...augustLilian] as const;

export const excelCurrentBalances: Record<Profile, number> = {
  luke: 2001.5,
  lilian: 866,
};

export function importedDisplayPoints(eventId: string, storedPoints: number): number {
  const sourceId = eventId.split(":").at(-1);
  return excelHistory.find((event) => event.id === sourceId)?.points ?? storedPoints;
}

const IMPORT_ID = "excel-202607-202608-v1";

export async function ensureExcelHistory(db: D1Database, owner: string): Promise<void> {
  const imported = await db.prepare("SELECT 1 AS imported FROM data_imports WHERE owner_key = ? AND import_id = ?")
    .bind(owner, IMPORT_ID)
    .first<{ imported: number }>();
  if (imported) return;

  const statements = excelHistory.map((event, index) => {
    const countsTowardBalance = !event.id.startsWith("202608-") || !event.id.endsWith("-r3");
    const points = countsTowardBalance ? event.points : 0;
    const createdAt = `${event.eventDate}T08:${String(index).padStart(2, "0")}:00.000Z`;
    const stableKey = `excel-import:${owner}:${event.id}`;
    return db.prepare(`
      INSERT OR IGNORE INTO mall_events (
        id, owner_key, profile, source, kind, label, points, quantity, note,
        event_date, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).bind(
      stableKey,
      owner,
      event.profile,
      event.source,
      event.kind,
      event.label,
      points,
      event.note,
      event.eventDate,
      stableKey,
      createdAt,
    );
  });

  statements.push(
    db.prepare("INSERT OR IGNORE INTO data_imports (owner_key, import_id) VALUES (?, ?)")
      .bind(owner, IMPORT_ID),
  );
  await db.batch(statements);
}
