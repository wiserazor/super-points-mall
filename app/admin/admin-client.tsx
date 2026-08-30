"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminOverviewPayload, CustomRequest } from "@/lib/api-types";
import { PROFILES, RULE_CATEGORIES, STORE_CATEGORIES, type Profile } from "@/lib/catalog";
import type { EditableItem, EditableRule } from "@/lib/catalog-store";
import { readJsonResponse } from "@/lib/http-client";

type AdminTab = "requests" | "rules" | "items" | "balance" | "security";

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
  const [knowledgeMode, setKnowledgeMode] = useState<"set" | "delta">("set");
  const [knowledgeValue, setKnowledgeValue] = useState("");
  const [knowledgeReason, setKnowledgeReason] = useState("");
  const [childPinDrafts, setChildPinDrafts] = useState<Record<Profile, string>>({ luke: "", lilian: "" });
  const [childPinConfirms, setChildPinConfirms] = useState<Record<Profile, string>>({ luke: "", lilian: "" });
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
    const payload = await readJsonResponse(response);
    if (!response.ok || !payload || typeof payload !== "object" || !("balances" in payload)) {
      throw new Error(messageFromPayload(payload, `家长后台暂时没有加载成功（HTTP ${response.status}）。`));
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
      const payload = await readJsonResponse(response);
      if (!response.ok || !payload || typeof payload !== "object") {
        throw new Error(messageFromPayload(payload, `这次修改没有保存成功（HTTP ${response.status}）。`));
      }
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

  async function saveChildPin(profile: Profile) {
    const nextPin = childPinDrafts[profile];
    if (!/^\d{4,12}$/.test(nextPin)) {
      setError("孩子 PIN 必须是 4 到 12 位数字。");
      return;
    }
    if (nextPin !== childPinConfirms[profile]) {
      setError("两次输入的孩子 PIN 不一致。");
      return;
    }
    const ok = await runAction({ action: "set-child-pin", profile, pin: nextPin });
    if (ok) {
      setChildPinDrafts((old) => ({ ...old, [profile]: "" }));
      setChildPinConfirms((old) => ({ ...old, [profile]: "" }));
    }
  }

  const pendingRequests = useMemo(() => data?.requests.filter((request) => request.status === "pending") || [], [data?.requests]);

  if (!pin || !data) {
    return (
      <main className="admin-login-shell">
        <section className="admin-login-card">
          <button type="button" className="admin-back" onClick={() => window.location.assign("/")}>← 返回孩子页面</button>
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
        <div><button type="button" className="admin-back" onClick={() => window.location.assign("/")}>← 返回积分商城</button><h1>家长控制台</h1><p>每一次修改都会保存到家庭账户。</p></div>
        <button type="button" className="admin-logout" onClick={() => { window.sessionStorage.removeItem("mall-parent-pin"); setPin(""); setData(null); }}>退出</button>
      </header>

      <section className="admin-balance-grid">
        {(Object.keys(PROFILES) as Profile[]).map((profile) => (
          <article key={profile} className={`admin-balance-card ${profile}`}>
            <span>{PROFILES[profile].avatar}</span><div><small>{PROFILES[profile].name} 当前积分</small><strong>{data.balances[profile].balance.toLocaleString("zh-CN")}</strong><p>商城 {data.balances[profile].mallPoints} · 知识原始 {data.balances[profile].knowledgePoints}{data.balances[profile].knowledgeAdjustment !== 0 ? ` · 修正 ${data.balances[profile].knowledgeAdjustment > 0 ? "+" : ""}${data.balances[profile].knowledgeAdjustment}` : ""}</p></div>
          </article>
        ))}
        <article className="admin-balance-card pending"><span>📨</span><div><small>待审核申请</small><strong>{pendingRequests.length}</strong><p>来自孩子的自定义项目</p></div></article>
      </section>

      <nav className="admin-tabs" aria-label="后台管理栏目">
        <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")} type="button">📨 待审核 <b>{pendingRequests.length}</b></button>
        <button className={tab === "rules" ? "active" : ""} onClick={() => setTab("rules")} type="button">⭐ 奖励与惩罚</button>
        <button className={tab === "items" ? "active" : ""} onClick={() => setTab("items")} type="button">🎁 礼物</button>
        <button className={tab === "balance" ? "active" : ""} onClick={() => setTab("balance")} type="button">⚖️ 积分调整</button>
        <button className={tab === "security" ? "active" : ""} onClick={() => setTab("security")} type="button">🔐 孩子 PIN</button>
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
            <div className="admin-segmented profile-control">{(Object.keys(PROFILES) as Profile[]).map((profile) => <button type="button" className={adjustProfile === profile ? "active" : ""} key={profile} onClick={() => setAdjustProfile(profile)}>{PROFILES[profile].avatar} {PROFILES[profile].name}</button>)}</div>
            <div className="adjust-grid">
              <div className="adjust-card">
                <span className="adjust-kicker">TOTAL BALANCE</span>
                <h3>总积分 / 商城流水</h3>
                <div className="current-balance-note">当前总积分 <strong>{data.balances[adjustProfile].balance.toLocaleString("zh-CN")}</strong></div>
                <div className="admin-segmented small"><button type="button" className={adjustMode === "set" ? "active" : ""} onClick={() => setAdjustMode("set")}>校准到指定分数</button><button type="button" className={adjustMode === "delta" ? "active" : ""} onClick={() => setAdjustMode("delta")}>直接增加或扣除</button></div>
                <label>{adjustMode === "set" ? "目标总积分" : "变动分数（扣分请输入负数）"}<input type="number" step="0.5" value={adjustValue} onChange={(event) => setAdjustValue(event.target.value)} placeholder={adjustMode === "set" ? "例如 2000" : "例如 50 或 -50"} /></label>
                <label>调整原因<input maxLength={120} value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} placeholder="例如：补录学校奖励 / 修正误操作" /></label>
                <p>生成“家长调整积分”商城流水，适合普通补录和校准。</p>
                <button className="admin-primary" type="button" disabled={busy || !adjustValue || !adjustReason.trim()} onClick={() => void runAction({ action: "adjust-balance", profile: adjustProfile, mode: adjustMode, value: Number(adjustValue), reason: adjustReason, eventDate: todayLocal(), idempotencyKey: crypto.randomUUID() }).then((ok) => { if (ok) { setAdjustValue(""); setAdjustReason(""); } })}>{busy ? "正在保存…" : "确认调整总积分"}</button>
              </div>

              <div className="adjust-card knowledge-card">
                <span className="adjust-kicker">KNOWLEDGE SOURCE</span>
                <h3>知识平台同步积分</h3>
                <div className="knowledge-breakdown"><span>原始同步 <b>{data.balances[adjustProfile].knowledgePoints}</b></span><span>家长修正 <b>{data.balances[adjustProfile].knowledgeAdjustment > 0 ? "+" : ""}{data.balances[adjustProfile].knowledgeAdjustment}</b></span><span>当前有效 <b>{data.balances[adjustProfile].effectiveKnowledgePoints}</b></span></div>
                <div className="admin-segmented small"><button type="button" className={knowledgeMode === "set" ? "active" : ""} onClick={() => setKnowledgeMode("set")}>设为指定知识分</button><button type="button" className={knowledgeMode === "delta" ? "active" : ""} onClick={() => setKnowledgeMode("delta")}>增加或扣除修正</button></div>
                <label>{knowledgeMode === "set" ? "目标有效知识积分" : "修正分数（扣分请输入负数）"}<input type="number" step="0.5" value={knowledgeValue} onChange={(event) => setKnowledgeValue(event.target.value)} placeholder={knowledgeMode === "set" ? "例如 1200" : "例如 -100"} /></label>
                <label>修正原因<input maxLength={120} value={knowledgeReason} onChange={(event) => setKnowledgeReason(event.target.value)} placeholder="例如：撤销知识平台误加分" /></label>
                <p>不覆盖知识平台原始值；修正会单独记录，可随时撤销。</p>
                <button className="admin-primary" type="button" disabled={busy || !knowledgeValue || !knowledgeReason.trim()} onClick={() => void runAction({ action: "adjust-knowledge", profile: adjustProfile, mode: knowledgeMode, value: Number(knowledgeValue), reason: knowledgeReason, idempotencyKey: crypto.randomUUID() }).then((ok) => { if (ok) { setKnowledgeValue(""); setKnowledgeReason(""); } })}>{busy ? "正在保存…" : "保存知识积分修正"}</button>
              </div>
            </div>
            <div className="adjustment-history">
              <h3>知识积分修正记录</h3>
              {!data.knowledgeAdjustments.filter((item) => item.profile === adjustProfile).length && <p className="quiet-copy">这个孩子还没有知识积分修正。</p>}
              {data.knowledgeAdjustments.filter((item) => item.profile === adjustProfile).map((item) => <article className={item.undone ? "undone" : ""} key={item.id}><div><strong>{item.note}</strong><small>{new Date(item.createdAt).toLocaleString("zh-CN")}</small></div><b className={item.points >= 0 ? "positive" : "negative"}>{item.points >= 0 ? "+" : ""}{item.points}</b>{item.undone ? <span>已撤销</span> : <button type="button" disabled={busy} onClick={() => void runAction({ action: "undo-knowledge-adjustment", profile: item.profile, adjustmentId: item.id, idempotencyKey: crypto.randomUUID() })}>撤销</button>}</article>)}
            </div>
          </>
        )}

        {tab === "security" && (
          <>
            <AdminPanelTitle eyebrow="CHILD SECURITY" title="设置孩子独立 PIN" action={null} />
            <p className="security-intro">每个孩子只能用自己的 PIN 解锁自己的档案。查看积分、记录、兑换、申请和撤销都需要先解锁。</p>
            <div className="security-grid">
              {(Object.keys(PROFILES) as Profile[]).map((profile) => (
                <article className={`security-card ${profile}`} key={profile}>
                  <div className="security-title"><span>{PROFILES[profile].avatar}</span><div><h3>{PROFILES[profile].name}</h3><p>{data.childPins[profile].configured ? "✅ PIN 已设置" : "⚠️ 尚未设置 PIN"}</p></div></div>
                  <label>新 PIN<input inputMode="numeric" type="password" value={childPinDrafts[profile]} onChange={(event) => setChildPinDrafts((old) => ({ ...old, [profile]: event.target.value.replace(/\D/g, "").slice(0, 12) }))} placeholder="4 到 12 位数字" /></label>
                  <label>再次输入<input inputMode="numeric" type="password" value={childPinConfirms[profile]} onChange={(event) => setChildPinConfirms((old) => ({ ...old, [profile]: event.target.value.replace(/\D/g, "").slice(0, 12) }))} placeholder="再次输入确认" /></label>
                  <p>重设后，这个孩子之前已解锁的设备会立即重新要求 PIN。</p>
                  <button className="admin-primary" type="button" disabled={busy || childPinDrafts[profile].length < 4 || childPinDrafts[profile] !== childPinConfirms[profile]} onClick={() => void saveChildPin(profile)}>{data.childPins[profile].configured ? "重设 PIN" : "设置 PIN"}</button>
                </article>
              ))}
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
