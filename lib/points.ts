export type Level = {
  name: "青铜" | "白银" | "黄金" | "钻石" | "铂金";
  icon: string;
  min: number;
  discountRate: number;
  discountLabel: string;
  nextAt: number | null;
};

export function levelFor(points: number): Level {
  if (points >= 7500) return { name: "铂金", icon: "💠", min: 7500, discountRate: 0.6, discountLabel: "六折", nextAt: null };
  if (points >= 5000) return { name: "钻石", icon: "💎", min: 5000, discountRate: 0.7, discountLabel: "七折", nextAt: 7500 };
  if (points >= 3000) return { name: "黄金", icon: "🏆", min: 3000, discountRate: 0.8, discountLabel: "八折", nextAt: 5000 };
  if (points >= 1500) return { name: "白银", icon: "🥈", min: 1500, discountRate: 0.9, discountLabel: "九折", nextAt: 3000 };
  return { name: "青铜", icon: "🥉", min: 0, discountRate: 1, discountLabel: "原价", nextAt: 1500 };
}

export function discountedCost(baseCost: number, points: number): number {
  return Math.round(baseCost * levelFor(points).discountRate);
}

export function validProfile(value: unknown): value is "luke" | "lilian" {
  return value === "luke" || value === "lilian";
}

export function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function safeQuantity(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 50 ? value : null;
}
