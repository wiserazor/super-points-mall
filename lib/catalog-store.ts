import {
  POINT_RULES,
  RULE_CATEGORIES,
  STORE_CATEGORIES,
  STORE_ITEMS,
  type PointRule,
  type RuleCategory,
  type StoreItem,
} from "@/lib/catalog";

type CatalogRow = {
  entry_type: "rule" | "item";
  id: string;
  label: string;
  value: number;
  icon: string;
  category: string;
  unit: string | null;
  kind: "reward" | "penalty" | null;
  daily: number;
  pending: number;
  active: number;
  is_custom: number;
};

export type EditableRule = PointRule & { active: boolean; custom: boolean };
export type EditableItem = StoreItem & { active: boolean; custom: boolean };

function isRuleCategory(value: string): value is RuleCategory {
  return RULE_CATEGORIES.includes(value as RuleCategory);
}

function isStoreCategory(value: string): value is StoreItem["category"] {
  return STORE_CATEGORIES.includes(value as StoreItem["category"]);
}

function rowToRule(row: CatalogRow): EditableRule | null {
  if (!row.kind || !isRuleCategory(row.category)) return null;
  return {
    id: row.id,
    label: row.label,
    points: Number(row.value),
    icon: row.icon,
    category: row.category,
    unit: row.unit || undefined,
    kind: row.kind,
    daily: Boolean(row.daily),
    active: Boolean(row.active),
    custom: Boolean(row.is_custom),
  };
}

function rowToItem(row: CatalogRow): EditableItem | null {
  if (!isStoreCategory(row.category)) return null;
  return {
    id: row.id,
    label: row.label,
    cost: Number(row.value),
    icon: row.icon,
    category: row.category,
    unit: row.unit || "1 个",
    pending: Boolean(row.pending),
    active: Boolean(row.active),
    custom: Boolean(row.is_custom),
  };
}

export async function loadCatalog(
  db: D1Database,
  owner: string,
  includeInactive = false,
): Promise<{ rules: EditableRule[]; items: EditableItem[] }> {
  const result = await db.prepare(`
    SELECT entry_type, id, label, value, icon, category, unit, kind,
           daily, pending, active, is_custom
    FROM catalog_entries
    WHERE owner_key = ?
  `).bind(owner).all<CatalogRow>();

  const rows = result.results;
  const ruleRows = new Map(rows.filter((row) => row.entry_type === "rule").map((row) => [row.id, row]));
  const itemRows = new Map(rows.filter((row) => row.entry_type === "item").map((row) => [row.id, row]));

  const rules: EditableRule[] = POINT_RULES.map((base) => {
    const override = ruleRows.get(base.id);
    if (!override) return { ...base, active: true, custom: false };
    ruleRows.delete(base.id);
    return rowToRule(override) || { ...base, active: true, custom: false };
  });
  for (const row of ruleRows.values()) {
    const custom = rowToRule(row);
    if (custom) rules.push(custom);
  }

  const items: EditableItem[] = STORE_ITEMS.map((base) => {
    const override = itemRows.get(base.id);
    if (!override) return { ...base, active: true, custom: false };
    itemRows.delete(base.id);
    return rowToItem(override) || { ...base, active: true, custom: false };
  });
  for (const row of itemRows.values()) {
    const custom = rowToItem(row);
    if (custom) items.push(custom);
  }

  return {
    rules: includeInactive ? rules : rules.filter((rule) => rule.active),
    items: includeInactive ? items : items.filter((item) => item.active),
  };
}

export async function findRule(db: D1Database, owner: string, id: string): Promise<EditableRule | undefined> {
  return (await loadCatalog(db, owner)).rules.find((rule) => rule.id === id);
}

export async function findItem(db: D1Database, owner: string, id: string): Promise<EditableItem | undefined> {
  return (await loadCatalog(db, owner)).items.find((item) => item.id === id);
}
