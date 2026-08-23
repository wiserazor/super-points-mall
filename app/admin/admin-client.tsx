"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AdminOverviewPayload, CustomRequest } from "@/lib/api-types";
import { PROFILES, RULE_CATEGORIES, STORE_CATEGORIES, type Profile } from "@/lib/catalog";
import type { EditableItem, EditableRule } from "@/lib/catalog-store";

type AdminTab = "requests" | "rules" | "items" | "balance";

const newRule = (): EditableRule => ({ id: "", label: "", points: 20, icon: "⭐", category: "成长", kind: "reward", active: true, custom: true });
const newItem = (): EditableItem => ({ id: "", label: "", cost: 100, icon: "🎁", category: "礼物", unit: "1 个", active: true, custom: true });

function messageFromPayload(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  if ("error" in payload && typeof payload.error === "string") return payload.error;
  if ("message" in payload && typeof payload.message === "string") return payload.message;
  return fallback;
}

function todayLocal(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function AdminClient() {
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [data, setData] = useState<AdminOverviewPayload | null>(null);
  const [tab, setTab] = useState<AdminTab>("requests");
  const [ruleDraft, setRuleDraft] = useState<EditableRule | null>(null);
  const [itemDraft, setItemDraft] = useState<EditableItem | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [adjustProfile, setAdjustProfile] = useState<Profile>("luke");
  const [adjustMode, setAdjustMode] = useState<"set" | "delta">("set");
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const adminFetch = useCallback(async (activePin: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set("x-parent-pin", activePin);
    if (init?.body) headers.set("Content-Type", "application/json");
    return fetch("/api/admin", { ...init, headers });
  }, []);

  const load = useCallback(async (activePin: string) => {
    const response = await adminFetch(activePin);
    const payload: unknown = await response.json();
    if (!response.ok || !payload || typeof payload !== "object" || !("balances" in payload)) {
      throw new Error(messageFromPayload(payload, "家长后台暂时没有加载成功。"));
    }
    setData(payload as AdminOverviewPayload);
  }, [adminFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.sessionStorage.getItem("mall-parent-pin");
      if (!saved) return;
      setPin(saved);
      void load(saved).catch(() => {
        window.sessionStorage.removeItem("mall-parent-pin");
        setPin("");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function login() {
    if (!pinInput.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await load(pinInput.trim());
      setPin(pinInput.trim());
      window.sessionStorage.setItem("mall-parent-pin", pinInput.trim());
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "家长 PIN 不正确。");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await adminFetch(pin, { method: "POST", body: JSON.stringify(body) });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(messageFromPayload(payload, "这次修改没有保存成功。"));
      setNotice(messageFromPayload(payload, "修改已保存。"));
      await load(pin);
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "这次修改没有保存成功。");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveRule() {
    if (!ruleDraft) return;
    const ok = await runAction({
      action: "save-rule",
      requestId,
      entry: { ...ruleDraft, points: Math.abs(Number(ruleDraft.points)) },
    });
    if (ok) { setRuleDraft(null); setRequestId(null); }
  }

  async function saveItem() {
    if (!itemDraft) return;
    const ok = await runAction({ action: "save-item", requestId, entry: { ...itemDraft, cost: Number(itemDraft.cost) } });
    if (ok) { setItemDraft(null); setRequestId(null); }
  }

  function prepareRequest(request: CustomRequest) {
    setRequestId(request.id);
    if (request.requestType === "rule") {
      setRuleDraft({ ...newRule(), label: request.label });
      setTab("rules");
    } else {
      setItemDraft({ ...newItem(), label: request.label });
      setTab("items");
    }
  }

  const pendingRequests = useMemo(() => data?.requests.filter((request) => request.status === "pending") || [], [data?.requests]);

  if (!pin || !data) {
    return (
      <main className="admin-login-shell">
        <section className="admin-login-card">
          <Link href="/" className="admin-back">← 返回孩子页面</Link>
          <span className="admin-lock">🔐</span>
          <p className="admin-eyebrow">PARENT SPACE</p>
          <h1>家长后台</h1>
          <p>请输入家长 PIN，管理积分、奖励、惩罚和礼物。</p>
          <label>家长 PIN<input inputMode="numeric" type="password" value={pinInput} onChange={(event) => setPinInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void login()} placeholder="请输入 6 位 PIN" /></label>
          {error && <div className="admin-alert error">{error}</div>}
          <button type="button" disabled={busy || !pinInput.trim()} onClick={() => void login()}>{busy ? "正在验证…" : "进入后台"}</button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><Link href="/" className="admin-back">← 返回积分商城</Link><h1>家长控制台</h1><p>每一次修改都会保存到家庭账户。</p></div>
        <button type="button" className="admin-logout" onClick={() => { window.sessionStorage.removeItem("mall-parent-pin"); setPin(""); setData(null); }}>退出</button>
      </header>

      <section className="admin-balance-grid">
        {(Object.keys(PROFILES) as Profile[]).map((profile) => (
          <article key={profile} className={`admin-balance-card ${profile}`}>
            <span>{PROFILES[profile].avatar}</span><div><small>{PROFILES[profile].name} 当前积分</small><strong>{data.balances[profile].balance.toLocaleString("zh-CN")}</strong><p>商城 {data.balances[profile].mallPoints} · 知识平台 {data.balances[profile].knowledgePoints}</p></div>
          </article>
        ))}
        <article className="admin-balance-card pending"><span>📨</span><div><small>待审核申请</small><strong>{pendingRequests.length}</strong><p>来自孩子的自定义项目</p></div></article>
      </section>

      <nav className="admin-tabs" aria-label="后台管理栏目">
        <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")} type="button">📨 待审核 <b>{pendingRequests.length}</b></button>
        <button className={tab === "rules" ? "active" : ""} onClick={() => setTab("rules")} type="button">⭐ 奖励与惩罚</button>
        <button className={tab === "items" ? "active" : ""} onClick={() => setTab("items")} type="button">🎁 礼物</button>
        <button className={tab === "balance" ? "active" : ""} onClick={() => setTab("balance")} type="button">⚖️ 积分调整</button>
      </nav>

      {error && <div className="admin-alert error">{error}</div>}
      {notice && <div className="admin-alert success"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>×</button></div>}

      <section className="admin-panel">
        {tab === "requests" && (
          <>
            <AdminPanelTitle eyebrow="CUSTOM REQUESTS" title="孩子的新申请" action={null} />
            {!pendingRequests.length && <div className="admin-empty"><span>🌿</span><h2>暂时没有待审核申请</h2><p>孩子提交的新积分项目或礼物会出现在这里。</p></div>}
            <div className="request-list">
              {pendingRequests.map((request) => (
                <article className="request-row" key={request.id}>
                  <span>{request.requestType === "rule" ? "💡" : "🎁"}</span>
                  <div><small>{PROFILES[request.profile].avatar} {PROFILES[request.profile].name} · {request.requestType === "rule" ? "积分项目" : "礼物"}</small><h3>{request.label}</h3><p>{request.note || "没有补充说明"}</p></div>
                  <div className="request-actions"><button type="button" onClick={() => prepareRequest(request)}>设置并加入</button><button className="quiet" type="button" disabled={busy} onClick={() => void runAction({ action: "resolve-request", requestId: request.id, status: "rejected" })}>暂不采用</button></div>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "rules" && (
          <>
            <AdminPanelTitle eyebrow="POINT RULES" title="奖励与惩罚项目" action={<button type="button" onClick={() => { setRuleDraft(newRule()); setRequestId(null); }}>＋ 新建项目</button>} />
            <div className="admin-table-list">
              {data.rules.map((rule) => (
                <article className={`admin-catalog-row ${rule.active ? "" : "inactive"}`} key={rule.id}>
                  <span className="admin-entry-icon">{rule.icon}</span><div><h3>{rule.label}</h3><p>{rule.category} · {rule.daily ? "每天一次" : rule.unit || "每次"}{rule.custom ? " · 自定义" : ""}</p></div>
                  <strong className={rule.points >= 0 ? "positive" : "negative"}>{rule.points >= 0 ? "+" : ""}{rule.points}</strong>
                  <button type="button" onClick={() => { setRuleDraft({ ...rule, points: Math.abs(rule.points) }); setRequestId(null); }}>编辑</button>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "items" && (
          <>
            <AdminPanelTitle eyebrow="STORE ITEMS" title="礼物列表" action={<button type="button" onClick={() => { setItemDraft(newItem()); setRequestId(null); }}>＋ 新建礼物</button>} />
            <div className="admin-table-list">
              {data.items.map((item) => (
                <article className={`admin-catalog-row ${item.active ? "" : "inactive"}`} key={item.id}>
                  <span className="admin-entry-icon">{item.icon}</span><div><h3>{item.label}</h3><p>{item.category} · {item.unit}{item.custom ? " · 自定义" : ""}</p></div>
                  <strong>{item.cost} 分</strong>
                  <button type="button" onClick={() => { setItemDraft({ ...item }); setRequestId(null); }}>编辑</button>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "balance" && (
          <>
            <AdminPanelTitle eyebrow="BALANCE CONTROL" title="调整孩子积分" action={null} />
            <div className="adjust-card">
              <div className="admin-segmented">{(Object.keys(PROFILES) as Profile[]).map((profile) => <button type="button" className={adjustProfile === profile ? "active" : ""} key={profile} onClick={() => setAdjustProfile(profile)}>{PROFILES[profile].avatar} {PROFILES[profile].name}</button>)}</div>
              <div className="current-balance-note">当前积分 <strong>{data.balances[adjustProfile].balance.toLocaleString("zh-CN")}</strong></div>
              <div className="admin-segmented small"><button type="button" className={adjustMode === "set" ? "active" : ""} onClick={() => setAdjustMode("set")}>校准到指定分数</button><button type="button" className={adjustMode === "delta" ? "active" : ""} onClick={() => setAdjustMode("delta")}>直接增加或扣除</button></div>
              <label>{adjustMode === "set" ? "目标积分" : "变动分数（扣分请输入负数）"}<input type="number" step="0.5" value={adjustValue} onChange={(event) => setAdjustValue(event.target.value)} placeholder={adjustMode === "set" ? "例如 2000" : "例如 50 或 -50"} /></label>
              <label>调整原因<input maxLength={120} value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} placeholder="例如：补录学校奖励 / 修正误操作" /></label>
              <p>修改会生成一条“家长调整积分”流水，旧历史不会被删除。</p>
              <button className="admin-primary" type="button" disabled={busy || !adjustValue || !adjustReason.trim()} onClick={() => void runAction({ action: "adjust-balance", profile: adjustProfile, mode: adjustMode, value: Number(adjustValue), reason: adjustReason, eventDate: todayLocal(), idempotencyKey: crypto.randomUUID() }).then((ok) => { if (ok) { setAdjustValue(""); setAdjustReason(""); } })}>{busy ? "正在保存…" : "确认调整"}</button>
            </div>
          </>
        )}
      </section>

      {ruleDraft && <RuleEditor draft={ruleDraft} requestId={requestId} busy={busy} onChange={setRuleDraft} onClose={() => { setRuleDraft(null); setRequestId(null); }} onSave={() => void saveRule()} />}
      {itemDraft && <ItemEditor draft={itemDraft} requestId={requestId} busy={busy} onChange={setItemDraft} onClose={() => { setItemDraft(null); setRequestId(null); }} onSave={() => void saveItem()} />}
    </main>
  );
}

function AdminPanelTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action: React.ReactNode }) {
  return <div className="admin-panel-title"><div><small>{eyebrow}</small><h2>{title}</h2></div>{action}</div>;
}

function RuleEditor({ draft, requestId, busy, onChange, onClose, onSave }: { draft: EditableRule; requestId: string | null; busy: boolean; onChange: (value: EditableRule) => void; onClose: () => void; onSave: () => void }) {
  return <div className="modal-backdrop"><section className="admin-editor" role="dialog" aria-modal="true"><button className="modal-close" type="button" onClick={onClose}>×</button><small>{requestId ? "审核并加入" : draft.id ? "编辑项目" : "新建项目"}</small><h2>奖励与惩罚项目</h2><div className="admin-form-grid"><label className="icon-input">图标<input value={draft.icon} maxLength={8} onChange={(e) => onChange({ ...draft, icon: e.target.value })} /></label><label className="wide">名称<input value={draft.label} maxLength={60} onChange={(e) => onChange({ ...draft, label: e.target.value })} /></label><label>类型<select value={draft.kind} onChange={(e) => onChange({ ...draft, kind: e.target.value as "reward" | "penalty", category: e.target.value === "penalty" ? "勇敢纠正" : draft.category === "勇敢纠正" ? "成长" : draft.category })}><option value="reward">奖励</option><option value="penalty">惩罚</option></select></label><label>分值<input type="number" min="0.5" step="0.5" value={Math.abs(draft.points)} onChange={(e) => onChange({ ...draft, points: Number(e.target.value) })} /></label><label>分类<select value={draft.category} disabled={draft.kind === "penalty"} onChange={(e) => onChange({ ...draft, category: e.target.value as EditableRule["category"] })}>{RULE_CATEGORIES.filter((category) => draft.kind === "penalty" ? category === "勇敢纠正" : category !== "勇敢纠正").map((category) => <option key={category}>{category}</option>)}</select></label><label>单位说明<input value={draft.unit || ""} maxLength={30} onChange={(e) => onChange({ ...draft, unit: e.target.value || undefined })} placeholder="例如：每题" /></label></div><div className="admin-checks"><label><input type="checkbox" checked={Boolean(draft.daily)} onChange={(e) => onChange({ ...draft, daily: e.target.checked })} /> 每天只能记录一次</label><label><input type="checkbox" checked={draft.active} onChange={(e) => onChange({ ...draft, active: e.target.checked })} /> 在孩子页面显示</label></div><button className="admin-primary" type="button" disabled={busy || !draft.label.trim() || !draft.icon.trim() || !draft.points} onClick={onSave}>{busy ? "正在保存…" : "保存项目"}</button></section></div>;
}

function ItemEditor({ draft, requestId, busy, onChange, onClose, onSave }: { draft: EditableItem; requestId: string | null; busy: boolean; onChange: (value: EditableItem) => void; onClose: () => void; onSave: () => void }) {
  return <div className="modal-backdrop"><section className="admin-editor" role="dialog" aria-modal="true"><button className="modal-close" type="button" onClick={onClose}>×</button><small>{requestId ? "审核并加入" : draft.id ? "编辑礼物" : "新建礼物"}</small><h2>礼物设置</h2><div className="admin-form-grid"><label className="icon-input">图标<input value={draft.icon} maxLength={8} onChange={(e) => onChange({ ...draft, icon: e.target.value })} /></label><label className="wide">礼物名称<input value={draft.label} maxLength={60} onChange={(e) => onChange({ ...draft, label: e.target.value })} /></label><label>基础积分<input type="number" min="1" step="1" value={draft.cost} onChange={(e) => onChange({ ...draft, cost: Number(e.target.value) })} /></label><label>分类<select value={draft.category} onChange={(e) => onChange({ ...draft, category: e.target.value as EditableItem["category"] })}>{STORE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="wide">兑换单位<input value={draft.unit} maxLength={30} onChange={(e) => onChange({ ...draft, unit: e.target.value })} placeholder="例如：30 分钟 / 1 个" /></label></div><div className="admin-checks"><label><input type="checkbox" checked={Boolean(draft.pending)} onChange={(e) => onChange({ ...draft, pending: e.target.checked })} /> 兑换前需要家长再次确认</label><label><input type="checkbox" checked={draft.active} onChange={(e) => onChange({ ...draft, active: e.target.checked })} /> 在孩子页面显示</label></div><button className="admin-primary" type="button" disabled={busy || !draft.label.trim() || !draft.icon.trim() || !draft.cost || !draft.unit.trim()} onClick={onSave}>{busy ? "正在保存…" : "保存礼物"}</button></section></div>;
}
