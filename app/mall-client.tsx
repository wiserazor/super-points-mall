"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DashboardPayload, MutationPayload } from "@/lib/api-types";
import {
  PROFILES,
  type PointRule,
  type Profile,
  type RuleCategory,
  type StoreItem,
} from "@/lib/catalog";
import { discountedCost } from "@/lib/points";

type Tab = "earn" | "store" | "history";
type AccessState = "checking" | "required" | "unconfigured" | "unlocked";
type Selection =
  | { type: "rule"; value: PointRule }
  | { type: "item"; value: StoreItem }
  | null;

const rewardCategories: RuleCategory[] = ["健康", "学习", "成长", "运动", "比赛"];
const storeCategories = ["全部", "游戏时间", "快乐体验", "礼物", "零花钱"] as const;

function todayLocal(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function messageFromPayload(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  if ("error" in payload && typeof payload.error === "string") return payload.error;
  if ("message" in payload && typeof payload.message === "string") return payload.message;
  return fallback;
}

function isDashboardPayload(value: unknown): value is DashboardPayload {
  return Boolean(value && typeof value === "object" && "balance" in value && "history" in value);
}

function isMutationPayload(value: unknown): value is MutationPayload {
  return Boolean(value && typeof value === "object" && "ok" in value && "balance" in value && "message" in value);
}

function isChildAuthPayload(value: unknown): value is { ok: true; token: string; profile: Profile } {
  return Boolean(value && typeof value === "object" && "ok" in value && "token" in value && "profile" in value);
}

export default function MallClient({ initialProfile }: { initialProfile: Profile }) {
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [tab, setTab] = useState<Tab>("earn");
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [rewardCategory, setRewardCategory] = useState<RuleCategory>("健康");
  const [storeCategory, setStoreCategory] = useState<(typeof storeCategories)[number]>("全部");
  const [selection, setSelection] = useState<Selection>(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [customRequestType, setCustomRequestType] = useState<"rule" | "item" | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [childSession, setChildSession] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [childPinInput, setChildPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const learner = PROFILES[profile];
  const balance = dashboard?.balance ?? 0;

  const loadDashboard = useCallback(async (signal?: AbortSignal, sessionToken = childSession): Promise<boolean> => {
    try {
      const response = await fetch(`/api/dashboard?profile=${profile}`, {
        signal,
        cache: "no-store",
        headers: sessionToken ? { "x-child-session": sessionToken } : undefined,
      });
      const payload: unknown = await response.json();
      if (response.status === 401 || response.status === 428) {
        window.sessionStorage.removeItem(`mall-child-session-${profile}`);
        setChildSession("");
        setDashboard(null);
        setAccessState(response.status === 428 ? "unconfigured" : "required");
        setPinError(response.status === 428 ? null : messageFromPayload(payload, "请输入自己的 PIN 解锁档案。"));
        return false;
      }
      if (!response.ok || !isDashboardPayload(payload)) throw new Error(messageFromPayload(payload, "积分暂时没有加载成功。"));
      setDashboard(payload);
      setAccessState("unlocked");
      setPinError(null);
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      setDashboard(null);
      setAccessState("required");
      setPinError(error instanceof Error ? error.message : "积分暂时没有加载成功。");
      return false;
    } finally {
      setLoading(false);
    }
  }, [childSession, profile]);

  useEffect(() => {
    if (!sessionReady) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadDashboard(controller.signal), 0);
    window.history.replaceState(null, "", `/?profile=${profile}`);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadDashboard, profile, sessionReady]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setChildSession(window.sessionStorage.getItem(`mall-child-session-${profile}`) || "");
      setSessionReady(true);
      setChildPinInput("");
      setPinError(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleRewards = useMemo(
    () => (dashboard?.rules || []).filter((rule) => rule.kind === "reward" && rule.category === rewardCategory),
    [dashboard?.rules, rewardCategory],
  );
  const penalties = useMemo(() => (dashboard?.rules || []).filter((rule) => rule.kind === "penalty"), [dashboard?.rules]);
  const visibleStore = useMemo(
    () => (dashboard?.items || []).filter((item) => storeCategory === "全部" || item.category === storeCategory),
    [dashboard?.items, storeCategory],
  );

  function choose(next: Selection) {
    setSelection(next);
    setQuantity(1);
    setNote("");
  }

  function changeProfile(next: Profile) {
    if (next === profile) return;
    setDashboard(null);
    setLoading(true);
    setSessionReady(false);
    setAccessState("checking");
    setSelection(null);
    setCustomRequestType(null);
    setProfile(next);
  }

  function lockProfile() {
    window.sessionStorage.removeItem(`mall-child-session-${profile}`);
    setChildSession("");
    setDashboard(null);
    setLoading(false);
    setAccessState("required");
    setPinError(null);
  }

  function requireChildSession(): string | null {
    if (!childSession) {
      setDashboard(null);
      setAccessState("required");
      return null;
    }
    return childSession;
  }

  async function unlockProfile() {
    if (!/^\d{4,12}$/.test(childPinInput)) {
      setPinError("请输入 4 到 12 位数字 PIN。");
      return;
    }
    setSubmitting(true);
    setPinError(null);
    try {
      const response = await fetch("/api/child-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, pin: childPinInput }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isChildAuthPayload(payload)) {
        throw new Error(messageFromPayload(payload, "PIN 验证没有成功。"));
      }
      window.sessionStorage.setItem(`mall-child-session-${profile}`, payload.token);
      setChildSession(payload.token);
      setChildPinInput("");
      setLoading(true);
      setToast({ tone: "success", text: `${learner.name} 的档案已解锁，可以自己管理积分啦！` });
    } catch (error) {
      setPinError(error instanceof Error ? error.message : "PIN 验证没有成功。");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSelection() {
    if (!selection) return;
    const activeSession = requireChildSession();
    if (!activeSession) return;
    setSubmitting(true);
    const endpoint = selection.type === "rule" ? "/api/events" : "/api/redeem";
    const body = selection.type === "rule"
      ? {
          profile,
          ruleId: selection.value.id,
          quantity: selection.value.daily ? 1 : quantity,
          note,
          eventDate: todayLocal(),
          idempotencyKey: crypto.randomUUID(),
        }
      : {
          profile,
          itemId: selection.value.id,
          quantity,
          eventDate: todayLocal(),
          idempotencyKey: crypto.randomUUID(),
        };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-child-session": activeSession },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();
      if (response.status === 401) {
        lockProfile();
      }
      if (!response.ok || !isMutationPayload(payload)) throw new Error(messageFromPayload(payload, "这次操作没有成功，请再试一次。"));
      setSelection(null);
      setToast({ tone: "success", text: payload.message });
      await loadDashboard();
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "这次操作没有成功，请再试一次。" });
    } finally {
      setSubmitting(false);
    }
  }

  async function undoEvent(eventId: string) {
    const activeSession = requireChildSession();
    if (!activeSession) return;
    if (!window.confirm("确定要撤销这条记录吗？积分会一起恢复。")) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-child-session": activeSession },
        body: JSON.stringify({ profile, eventId, eventDate: todayLocal(), idempotencyKey: crypto.randomUUID() }),
      });
      const payload: unknown = await response.json();
      if (response.status === 401) {
        lockProfile();
      }
      if (!response.ok || !isMutationPayload(payload)) throw new Error(messageFromPayload(payload, "撤销没有成功。"));
      setToast({ tone: "success", text: payload.message });
      await loadDashboard();
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "撤销没有成功。" });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCustomRequest() {
    if (!customRequestType || !customLabel.trim()) return;
    const activeSession = requireChildSession();
    if (!activeSession) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-child-session": activeSession },
        body: JSON.stringify({
          profile,
          requestType: customRequestType,
          label: customLabel,
          note: customNote,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload: unknown = await response.json();
      if (response.status === 401) {
        lockProfile();
      }
      if (!response.ok) throw new Error(messageFromPayload(payload, "申请暂时没有保存成功。"));
      setCustomRequestType(null);
      setCustomLabel("");
      setCustomNote("");
      setToast({ tone: "success", text: messageFromPayload(payload, "申请已经送到家长后台啦！") });
      await loadDashboard();
    } catch (error) {
      setToast({ tone: "error", text: error instanceof Error ? error.message : "申请暂时没有保存成功。" });
    } finally {
      setSubmitting(false);
    }
  }

  const modalPoints = selection?.type === "rule"
    ? selection.value.points * (selection.value.daily ? 1 : quantity)
    : selection?.type === "item"
      ? -discountedCost(selection.value.cost, balance) * quantity
      : 0;

  const levelProgress = dashboard?.level.nextAt
    ? Math.max(0, Math.min(100, ((balance - dashboard.level.min) / (dashboard.level.nextAt - dashboard.level.min)) * 100))
    : 100;

  if (!dashboard) {
    return (
      <main className={`access-shell profile-${profile}`}>
        <header className="access-topbar">
          <span className="brand" aria-label="超级无敌积分大商场">
            <span className="brand-orb">S!</span>
            <span><strong>超级无敌</strong><small>积分大商场</small></span>
          </span>
          <Link className="parent-link" href="/admin" aria-label="进入家长后台">⚙️<strong>家长</strong></Link>
        </header>
        <section className="access-card" aria-live="polite">
          <span className="access-stars">✦　⭐　✦</span>
          <div className="access-avatar">{learner.avatar}</div>
          <span className="modal-kicker">MY PRIVATE GROWTH ISLAND</span>
          <h1>{learner.name} 的成长岛</h1>
          <p>先确认是你本人，积分、礼物和成长足迹才会打开。</p>
          <div className="access-profile-switch" aria-label="选择儿童档案">
            {(Object.keys(PROFILES) as Profile[]).map((key) => (
              <button className={key === profile ? "active" : ""} key={key} type="button" onClick={() => changeProfile(key)} aria-pressed={key === profile}>
                <span>{PROFILES[key].avatar}</span><strong>{PROFILES[key].name}</strong>
              </button>
            ))}
          </div>
          {(accessState === "checking" || loading) ? (
            <div className="access-loading"><span />正在检查安全钥匙…</div>
          ) : accessState === "unconfigured" ? (
            <div className="access-parent-needed">
              <strong>🔐 还差家长设置 PIN</strong>
              <p>请家长先到后台的“孩子 PIN”页面，为 {learner.name} 设置一个专属 PIN。</p>
              <Link href="/admin">前往家长后台 →</Link>
            </div>
          ) : (
            <div className="access-form">
              <label>我的 PIN
                <input autoFocus inputMode="numeric" type="password" value={childPinInput} onChange={(event) => setChildPinInput(event.target.value.replace(/\D/g, "").slice(0, 12))} onKeyDown={(event) => event.key === "Enter" && void unlockProfile()} placeholder="输入 4–12 位数字" />
              </label>
              {pinError && <p className="pin-error">{pinError}</p>}
              <button className="confirm-button" type="button" disabled={submitting || childPinInput.length < 4} onClick={() => void unlockProfile()}>{submitting ? "正在验证…" : `打开 ${learner.name} 的档案`}</button>
            </div>
          )}
          <small className="access-privacy-note">🛡️ 每个孩子只能用自己的 PIN 查看和管理自己的积分</small>
        </section>
        {toast && <div className={`toast ${toast.tone}`} role="status" aria-live="polite"><span>{toast.tone === "success" ? "✓" : "!"}</span>{toast.text}</div>}
      </main>
    );
  }

  return (
    <main className={`mall-shell profile-${profile}`}>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setTab("earn")} aria-label="返回积分首页">
          <span className="brand-orb">S!</span>
          <span><strong>超级无敌</strong><small>积分大商场</small></span>
        </button>
        <nav className="desktop-nav" aria-label="主导航">
          <button className={tab === "earn" ? "active" : ""} onClick={() => setTab("earn")} type="button">✨ 赚积分</button>
          <button className={tab === "store" ? "active" : ""} onClick={() => setTab("store")} type="button">🎁 逛商店</button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")} type="button">👣 足迹</button>
        </nav>
        <div className="profile-switch" aria-label="选择儿童档案">
          {(Object.keys(PROFILES) as Profile[]).map((key) => (
            <button
              className={key === profile ? "active" : ""}
              key={key}
              type="button"
              onClick={() => changeProfile(key)}
              aria-pressed={key === profile}
            >
              <span>{PROFILES[key].avatar}</span><strong>{PROFILES[key].name}</strong>
            </button>
          ))}
          <Link className="parent-link" href="/admin" aria-label="进入家长后台">⚙️<strong>家长</strong></Link>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-chip-row">
            <span className="hello-chip">{learner.avatar} {learner.name} 的成长岛</span>
            <button
              className={`child-auth-chip ${childSession ? "unlocked" : "locked"}`}
              type="button"
              onClick={lockProfile}
            >
              🔓 已解锁 · 点击锁定
            </button>
          </div>
          <h1>今天也让自己<br /><em>闪闪发光</em>吧！</h1>
          <p>完成一件小事，收集一颗成长星。你可以自己记录、自己兑换，也可以随时撤销误操作。</p>
          <div className="hero-actions">
            <button type="button" onClick={() => setTab("earn")} className="primary-action">记录新成就 <span>＋</span></button>
            <button type="button" onClick={() => setTab("store")} className="secondary-action">去看看礼物 →</button>
          </div>
        </div>
        <div className="points-card" aria-live="polite">
          <span className="spark spark-one">✦</span><span className="spark spark-two">✦</span>
          <div className="points-title"><span>⭐</span><span>我的可用积分</span></div>
          <strong className="points-number">{loading ? "…" : balance.toLocaleString("zh-CN")}</strong>
          <div className="sync-row">
            <span className={`sync-dot ${dashboard?.integration.state || "loading"}`} />
            {dashboard?.integration.state === "live" && <>知识平台已同步 <b>+{dashboard.knowledgePoints}</b></>}
            {dashboard?.integration.state === "stale" && <>使用最近一次知识积分 <b>+{dashboard.knowledgePoints}</b></>}
            {dashboard?.integration.state === "unavailable" && <>等待知识平台首次同步</>}
            {!dashboard && <>正在整理积分…</>}
            {dashboard && dashboard.knowledgeAdjustment !== 0 && <em>家长修正 {dashboard.knowledgeAdjustment > 0 ? "+" : ""}{dashboard.knowledgeAdjustment}</em>}
          </div>
          <div className="level-box">
            <div><span>{dashboard?.level.icon || "🥉"}</span><strong>{dashboard?.level.name || "青铜"}会员</strong><small>{dashboard?.level.discountLabel || "原价"}兑换</small></div>
            <div className="level-track"><span style={{ width: `${levelProgress}%` }} /></div>
            {!dashboard ? <p>正在计算升级进度…</p> : dashboard.level.nextAt ? <p>再收集 <b>{Math.max(0, dashboard.level.nextAt - balance)}</b> 分升级</p> : <p>已经到达最高等级啦！</p>}
          </div>
        </div>
      </section>

      <section className="main-content">
        {tab === "earn" && (
          <>
            <div className="section-title">
              <div><span className="eyebrow">TODAY&apos;S QUEST</span><h2>今天完成了什么？</h2><p>点一下卡片就能把成长记录下来。</p></div>
              <span className="gentle-note">每次记录都会进入足迹，可撤销误操作{dashboard?.pendingRequestCount ? ` · ${dashboard.pendingRequestCount} 条申请待审核` : ""}</span>
            </div>
            <div className="filter-row" role="tablist" aria-label="奖励分类">
              {rewardCategories.map((category) => (
                <button key={category} type="button" className={rewardCategory === category ? "active" : ""} onClick={() => setRewardCategory(category)}>{category}</button>
              ))}
            </div>
            <div className="rules-grid">
              {visibleRewards.map((rule) => <RuleCard rule={rule} key={rule.id} onChoose={() => choose({ type: "rule", value: rule })} />)}
              <button className="custom-request-card" type="button" onClick={() => setCustomRequestType("rule")}><span>＋</span><strong>没有找到这个项目？</strong><small>申请一个新的积分项目</small></button>
            </div>
            <details className="correction-panel">
              <summary><span>🛟</span><div><strong>勇敢纠正</strong><small>诚实记录需要改进的事，也是一种了不起的成长</small></div><b>展开</b></summary>
              <div className="penalty-grid">
                {penalties.map((rule) => <RuleCard rule={rule} key={rule.id} onChoose={() => choose({ type: "rule", value: rule })} />)}
              </div>
            </details>
          </>
        )}

        {tab === "store" && (
          <>
            <div className="section-title store-heading">
              <div><span className="eyebrow">WISH MARKET</span><h2>愿望礼物商店</h2><p>你的 {dashboard?.level.name || "青铜"} 等级现在享受 <b>{dashboard?.level.discountLabel || "原价"}</b>。</p></div>
              <div className="wallet-chip"><span>⭐</span><div><small>可用积分</small><strong>{balance.toLocaleString("zh-CN")}</strong></div></div>
            </div>
            <div className="filter-row" role="tablist" aria-label="礼物分类">
              {storeCategories.map((category) => (
                <button key={category} type="button" className={storeCategory === category ? "active" : ""} onClick={() => setStoreCategory(category)}>{category}</button>
              ))}
            </div>
            <div className="store-grid">
              {visibleStore.map((item) => {
                const cost = discountedCost(item.cost, balance);
                const canAfford = balance >= cost;
                return (
                  <article className={`store-card ${canAfford ? "" : "locked"}`} key={item.id}>
                    {item.pending && <span className="pending-badge">先和爸爸妈妈确认</span>}
                    <span className="store-icon">{item.icon}</span>
                    <div className="store-copy"><small>{item.category}</small><h3>{item.label}</h3><p>{item.unit}</p></div>
                    <div className="price-row">
                      <div><strong>⭐ {cost}</strong>{cost !== item.cost && <del>{item.cost}</del>}</div>
                      <button type="button" disabled={!canAfford} onClick={() => choose({ type: "item", value: item })}>{canAfford ? "兑换" : "积分不足"}</button>
                    </div>
                  </article>
                );
              })}
              <button className="custom-request-card store-request" type="button" onClick={() => setCustomRequestType("item")}><span>＋</span><strong>想要别的礼物？</strong><small>告诉家长你想加入什么</small></button>
            </div>
          </>
        )}

        {tab === "history" && (
          <>
            <div className="section-title">
              <div><span className="eyebrow">MY JOURNEY</span><h2>{learner.name} 的成长足迹</h2><p>这里保存商城里的每一次奖励、纠正和兑换。</p></div>
              <div className="history-summary"><span>知识平台原始 <b>+{dashboard?.knowledgePoints || 0}</b></span>{Boolean(dashboard?.knowledgeAdjustment) && <span>家长修正 <b>{(dashboard?.knowledgeAdjustment || 0) > 0 ? "+" : ""}{dashboard?.knowledgeAdjustment}</b></span>}<span>商城记录 <b>{(dashboard?.mallPoints || 0) >= 0 ? "+" : ""}{dashboard?.mallPoints || 0}</b></span></div>
            </div>
            <div className="history-list">
              {!dashboard?.history.length && <div className="empty-state"><span>🌱</span><h3>第一颗成长星还在等你</h3><p>去“赚积分”记录今天完成的第一件事吧。</p></div>}
              {dashboard?.history.map((event) => (
                <article className={`history-row ${event.undone ? "undone" : ""}`} key={event.id}>
                  <span className={`history-icon ${event.kind}`}>{event.kind === "purchase" ? "🎁" : event.points >= 0 ? "⭐" : "🛟"}</span>
                  <div className="history-copy"><strong>{event.label}</strong><small>{event.eventDate} · {event.quantity > 1 ? `${event.quantity} 次 · ` : ""}{event.note || (event.source === "redemption" ? "愿望已兑换" : "自主记录")}</small></div>
                  <strong className={event.points >= 0 ? "plus" : "minus"}>{event.points >= 0 ? "+" : ""}{event.points}</strong>
                  {event.undone ? <span className="undone-label">已撤销</span> : event.canUndo ? <button type="button" disabled={submitting} onClick={() => void undoEvent(event.id)}>撤销</button> : <span className="undone-label">Excel</span>}
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <nav className="mobile-nav" aria-label="移动端主导航">
        <button className={tab === "earn" ? "active" : ""} onClick={() => setTab("earn")} type="button"><span>✨</span>赚积分</button>
        <button className={tab === "store" ? "active" : ""} onClick={() => setTab("store")} type="button"><span>🎁</span>商店</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")} type="button"><span>👣</span>足迹</button>
      </nav>

      {selection && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelection(null)}>
          <section className={`action-modal ${modalPoints < 0 ? "negative" : "positive"}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="modal-close" type="button" onClick={() => setSelection(null)} aria-label="关闭">×</button>
            <span className="modal-icon">{selection.value.icon}</span>
            <span className="modal-kicker">{selection.type === "item" ? "确认兑换" : selection.value.kind === "reward" ? "记录成长" : "勇敢纠正"}</span>
            <h2 id="modal-title">{selection.value.label}</h2>
            <p className="modal-unit">{selection.value.unit || (selection.type === "rule" && selection.value.daily ? "每日一次" : "每次")}</p>
            {!(selection.type === "rule" && selection.value.daily) && (
              <div className="quantity-control" aria-label="选择数量">
                <button type="button" onClick={() => setQuantity((old) => Math.max(1, old - 1))} disabled={quantity <= 1}>−</button>
                <span><strong>{quantity}</strong><small>数量</small></span>
                <button type="button" onClick={() => setQuantity((old) => Math.min(50, old + 1))} disabled={quantity >= 50}>＋</button>
              </div>
            )}
            {selection.type === "rule" && (
              <label className="note-field">想补充一句吗？<input value={note} maxLength={80} onChange={(event) => setNote(event.target.value)} placeholder="例如：今天主动帮忙收拾了餐桌" /></label>
            )}
            {selection.type === "item" && selection.value.pending && <p className="parent-note">💬 这份礼物在原规则中标记为“待定”，兑换前记得先和爸爸妈妈确认。</p>}
            {selection.type === "rule" && selection.value.kind === "penalty" && <p className="parent-note">诚实面对并记录下来，就是重新开始的第一步。</p>}
            <div className="modal-total"><span>{modalPoints >= 0 ? "本次获得" : selection.type === "item" ? "本次花费" : "本次扣除"}</span><strong>{modalPoints >= 0 ? "+" : "−"}{Math.abs(modalPoints)} ⭐</strong></div>
            <button className="confirm-button" type="button" disabled={submitting} onClick={() => void submitSelection()}>{submitting ? "正在保存…" : selection.type === "item" ? "确认兑换" : "确认记录"}</button>
          </section>
        </div>
      )}

      {customRequestType && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCustomRequestType(null)}>
          <section className="action-modal request-modal" role="dialog" aria-modal="true" aria-labelledby="request-title">
            <button className="modal-close" type="button" onClick={() => setCustomRequestType(null)} aria-label="关闭">×</button>
            <span className="modal-icon">{customRequestType === "rule" ? "💡" : "🎁"}</span>
            <span className="modal-kicker">自定义申请</span>
            <h2 id="request-title">{customRequestType === "rule" ? "想新增什么积分项目？" : "想新增什么礼物？"}</h2>
            <p className="modal-unit">先提交给家长，审核后就会出现在列表里。</p>
            <label className="note-field">名称<input value={customLabel} maxLength={40} onChange={(event) => setCustomLabel(event.target.value)} placeholder={customRequestType === "rule" ? "例如：自己整理好书桌" : "例如：周末去滑冰"} /></label>
            <label className="note-field">为什么想加入？（选填）<input value={customNote} maxLength={120} onChange={(event) => setCustomNote(event.target.value)} placeholder="可以告诉爸爸妈妈你的想法" /></label>
            <p className="parent-note">🔒 申请不会直接增加或扣除积分，家长确认分值后才会加入。</p>
            <button className="confirm-button" type="button" disabled={submitting || !customLabel.trim()} onClick={() => void submitCustomRequest()}>{submitting ? "正在提交…" : "提交给家长"}</button>
          </section>
        </div>
      )}

      {toast && <div className={`toast ${toast.tone}`} role="status" aria-live="polite"><span>{toast.tone === "success" ? "✓" : "!"}</span>{toast.text}</div>}
    </main>
  );
}

function RuleCard({ rule, onChoose }: { rule: PointRule; onChoose: () => void }) {
  return (
    <button className={`rule-card ${rule.kind}`} type="button" onClick={onChoose}>
      <span className="rule-icon">{rule.icon}</span>
      <span className="rule-copy"><strong>{rule.label}</strong><small>{rule.unit || (rule.daily ? "每天一次" : "每次")}</small></span>
      <span className="rule-points">{rule.points >= 0 ? "+" : ""}{rule.points}<small>积分</small></span>
    </button>
  );
}
