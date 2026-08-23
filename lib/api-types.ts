import type { PointRule, Profile, StoreItem } from "@/lib/catalog";
import type { EditableItem, EditableRule } from "@/lib/catalog-store";
import type { Level } from "@/lib/points";

export type HistoryEvent = {
  id: string;
  label: string;
  points: number;
  quantity: number;
  kind: "reward" | "penalty" | "purchase";
  source: "rule" | "redemption";
  eventDate: string;
  note: string | null;
  createdAt: string;
  undone: boolean;
  canUndo: boolean;
};

export type DashboardPayload = {
  profile: Profile;
  balance: number;
  knowledgePoints: number;
  mallPoints: number;
  level: Level;
  integration: {
    state: "live" | "stale" | "unavailable";
    syncedAt: string | null;
  };
  history: HistoryEvent[];
  rules: PointRule[];
  items: StoreItem[];
  pendingRequestCount: number;
};

export type MutationPayload = {
  ok: true;
  balance: number;
  message: string;
};

export type CustomRequest = {
  id: string;
  profile: Profile;
  requestType: "rule" | "item";
  label: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type AdminOverviewPayload = {
  balances: Record<Profile, { balance: number; knowledgePoints: number; mallPoints: number }>;
  rules: EditableRule[];
  items: EditableItem[];
  requests: CustomRequest[];
};
