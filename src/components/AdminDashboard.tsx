"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard, Building2, Wallet, Wrench, TrendingDown, BarChart3, Crown,
  Lock, Plus, Receipt, Wand2, RotateCw, Droplets, Banknote, ShieldCheck,
  LogOut, Bell, Clock, AlertTriangle, FileText, Trash2, Pencil, Settings, KeyRound,
  Download, TrendingUp, Award,
} from "lucide-react";
import { api, type User, type AllData, type Unit, type Payment } from "@/lib/client";
import { fmtMoney, fmtNum, todayISO, currentYM, incomeCategory, CURRENCY_OPTIONS } from "@/lib/money";
import { downloadCSV } from "@/lib/csv";
import { tierLimits, PLAN_INFO, type Tier } from "@/lib/tiers";
import { useToast, Modal, Stat, Field } from "./ui";
import Shell, { type Tab } from "./Shell";

const payBadge = (s: string) =>
  s === "已繳費" ? "badge-emerald" : s === "未繳費" ? "badge-red" : s === "部分繳費" ? "badge-amber" : "badge-slate";
const repBadge = (s: string) =>
  s === "完成" ? "badge-emerald" : s === "處理中" ? "badge-blue" : s === "已安排" ? "badge-indigo" : "badge-amber";

function isExpiringSoon(d: string) {
  if (!d) return false;
  const diff = (new Date(d).getTime() - Date.now()) / 86400000;
  return diff >= 0 && diff <= 60;
}

type Props = {
  user: User;
  data: AllData;
  refresh: () => Promise<void>;
  onLogout: () => void;
  onTierChange: (tier: string) => void;
  onUserChange: (patch: Partial<User>) => void;
};

export default function AdminDashboard({ user, data, refresh, onLogout, onTierChange, onUserChange }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState("home");
  const limits = tierLimits(user.tier);
  const cur = user.currency;

  const tabs: Tab[] = [
    { key: "home", label: "首頁", icon: LayoutDashboard },
    { key: "units", label: "單位", icon: Building2 },
    { key: "payments", label: "收款", icon: Wallet },
    { key: "repairs", label: "維修", icon: Wrench, locked: !limits.repairs },
    { key: "expenses", label: "支出", icon: TrendingDown, locked: !limits.expenses },
    { key: "reports", label: "報表", icon: BarChart3 },
    { key: "plan", label: "方案", icon: Crown },
    { key: "settings", label: "設定", icon: Settings },
  ];

  const { units, repairs, payments, expenses } = data;
  const occupied = units.filter((u) => u.tenantName);
  const tenantCount = units.filter((u) => u.tenantCode).length;
  const pendingPay = payments.filter((p) => p.status === "未繳費" || p.status === "部分繳費").length;
  const pendingRep = repairs.filter((r) => r.status !== "完成").length;
  const totalRent = occupied.reduce((s, u) => s + (u.monthlyRent || 0), 0);
  const expiring = occupied.filter((u) => isExpiringSoon(u.leaseEndDate));

  // ── dashboard analytics ──
  const realPays = payments.filter((p) => !["預付款", "預付款抵扣"].includes(p.docCategory));
  const thisMonth = currentYM();
  const now = new Date();
  const trend = Array.from({ length: 12 }, (_, i) => {
    const dt = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    return { ym, label: `${dt.getMonth() + 1}月`, received: realPays.filter((p) => p.period === ym).reduce((s, p) => s + p.paidAmount, 0) };
  });
  const trendMax = Math.max(1, ...trend.map((t) => t.received));
  const monthBills = realPays.filter((p) => p.period === thisMonth);
  const billed = monthBills.reduce((s, p) => s + p.totalAmount, 0);
  const collected = monthBills.reduce((s, p) => s + p.paidAmount, 0);
  const collectionRate = billed > 0 ? Math.round((collected / billed) * 100) : 0;
  const tenantScores = units
    .filter((u) => u.tenantCode)
    .map((u) => {
      const ps = realPays.filter((p) => p.tenantCode === u.tenantCode);
      const total = ps.length;
      const paid = ps.filter((p) => p.status === "已繳費").length;
      const rate = total > 0 ? Math.round((paid / total) * 100) : 0;
      const grade = rate >= 90 ? "A" : rate >= 70 ? "B" : rate >= 50 ? "C" : "D";
      return { code: u.tenantCode, name: u.tenantName || u.tenantCode, total, paid, rate, grade };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.rate - a.rate);

  async function call(path: string, method: "POST" | "PUT" | "DELETE", body?: unknown, okMsg?: string) {
    const r = await api(path, method, body);
    if (!r.success) {
      toast(r.message || "操作失敗", "error");
      return false;
    }
    if (okMsg) toast(okMsg, "success");
    await refresh();
    return true;
  }

  return (
    <Shell user={user} tabs={tabs} active={tab} setActive={setTab} onLogout={onLogout}>
      {tab === "home" && (
        <div className="p-4 md:p-8 space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              你好，{user.name || "業主"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">這是你的物業總覽</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="出租中單位" value={occupied.length} sub={`共 ${units.length} 個單位`} />
            <Stat label="預計月收租金" value={fmtMoney(totalRent, cur)} valueClass="text-emerald-600" />
            <Stat label="待收款項" value={pendingPay} valueClass="text-red-600" sub="未繳 / 部分繳費" />
            <Stat label="待處理維修" value={pendingRep} valueClass="text-amber-600" />
          </div>

          {expiring.length > 0 && (
            <div className="card border border-amber-200 bg-amber-50">
              <div className="font-semibold text-amber-800 mb-2 flex items-center gap-1.5"><Clock size={16} /> 即將到期的合約（60 天內）</div>
              <div className="space-y-1.5">
                {expiring.map((u) => (
                  <div key={u.id} className="flex justify-between text-sm">
                    <span className="text-slate-700">{u.tenantName} · {u.address}</span>
                    <span className="text-amber-700 font-medium">{u.leaseEndDate}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="font-semibold text-slate-800 mb-3">快速操作</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button className="btn-ghost gap-1.5" onClick={() => setTab("units")}><Plus size={16} /> 新增單位</button>
              <button className="btn-ghost gap-1.5" onClick={() => setTab("payments")}><Receipt size={16} /> 開立帳單</button>
              <button
                className="btn-ghost gap-1.5"
                onClick={() => call("payments/generate-rent", "POST", undefined, "已生成本月租金帳單")}
              >
                <RotateCw size={16} /> 一鍵生成租金
              </button>
              <button className="btn-ghost gap-1.5" onClick={() => setTab("plan")}><Crown size={16} /> 升級方案</button>
            </div>
          </div>

          {/* 收入趨勢 + 本月收款率 */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card md:col-span-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-3"><TrendingUp size={16} /> 近 12 個月收入趨勢</div>
              <div className="flex items-end gap-1.5 h-36">
                {trend.map((t) => (
                  <div key={t.ym} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all ${t.ym === thisMonth ? "bg-indigo-600" : "bg-indigo-200 group-hover:bg-indigo-300"}`}
                        style={{ height: `${Math.max((t.received / trendMax) * 100, t.received > 0 ? 4 : 0)}%` }}
                        title={`${t.label}：${fmtMoney(t.received, cur)}`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card flex flex-col justify-center items-center text-center">
              <div className="text-xs text-slate-500 mb-1">本月收款率</div>
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#4f46e5" strokeWidth="3.5" strokeLinecap="round"
                    strokeDasharray={`${collectionRate}, 100`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-indigo-600 tnum">{collectionRate}%</div>
              </div>
              <div className="text-xs text-slate-400 mt-2 tnum">已收 {fmtMoney(collected, cur)} / {fmtMoney(billed, cur)}</div>
            </div>
          </div>

          {/* 租客繳費評分 */}
          {tenantScores.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-3"><Award size={16} /> 租客繳費評分</div>
              <div className="space-y-2">
                {tenantScores.map((s) => {
                  const gradeColor = s.grade === "A" ? "bg-emerald-100 text-emerald-700" : s.grade === "B" ? "bg-blue-100 text-blue-700" : s.grade === "C" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
                  const barColor = s.grade === "A" ? "bg-emerald-400" : s.grade === "B" ? "bg-blue-400" : s.grade === "C" ? "bg-amber-400" : "bg-red-400";
                  return (
                    <div key={s.code} className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm ${gradeColor}`}>{s.grade}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-700 truncate">{s.name}</span>
                          <span className="text-slate-400 text-xs tnum">{s.paid}/{s.total} 準時 · {s.rate}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${s.rate}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-3">＊ 評分 = 已繳清單據 / 全部單據；A≥90% · B≥70% · C≥50% · D&lt;50%</p>
            </div>
          )}
        </div>
      )}

      {tab === "units" && <UnitsTab user={user} units={units} payments={payments} call={call} refresh={refresh} />}
      {tab === "payments" && <PaymentsTab user={user} units={units} payments={payments} call={call} />}
      {tab === "repairs" && (
        limits.repairs ? <RepairsTab units={units} repairs={repairs} call={call} /> : <Locked feature="維修管理" need="Pro" />
      )}
      {tab === "expenses" && (
        limits.expenses ? <ExpensesTab cur={cur} expenses={expenses} call={call} /> : <Locked feature="財務支出" need="Max" />
      )}
      {tab === "reports" && <ReportsTab cur={cur} payments={payments} expenses={expenses} />}
      {tab === "plan" && (
        <PlanTab user={user} tenantCount={tenantCount} call={call} onTierChange={onTierChange} toast={toast} />
      )}
      {tab === "settings" && <SettingsTab user={user} onUserChange={onUserChange} toast={toast} />}
    </Shell>
  );
}

// ── Settings ──────────────────────────────────────────────────────
function SettingsTab({ user, onUserChange, toast }: {
  user: User;
  onUserChange: (patch: Partial<User>) => void;
  toast: (m: string, t?: "info" | "success" | "error") => void;
}) {
  const [name, setName] = useState(user.name);
  const [currency, setCurrency] = useState(user.currency);
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  const profileDirty = name.trim() !== user.name || currency !== user.currency;

  async function saveProfile() {
    if (!name.trim()) return toast("姓名不可空白", "error");
    setSavingProfile(true);
    const r = await api<{ user?: User }>("account", "PUT", { name, currency });
    setSavingProfile(false);
    if (!r.success) return toast(r.message || "儲存失敗", "error");
    onUserChange({ name: name.trim(), currency });
    toast("已儲存設定", "success");
  }

  async function changePw() {
    if (!pwForm.current) return toast("請輸入目前密碼", "error");
    if (pwForm.next.length < 4) return toast("新密碼至少 4 個字元", "error");
    if (pwForm.next !== pwForm.confirm) return toast("兩次新密碼不一致", "error");
    setSavingPw(true);
    const r = await api("account/password", "POST", { currentPassword: pwForm.current, newPassword: pwForm.next });
    setSavingPw(false);
    if (!r.success) return toast(r.message || "變更失敗", "error");
    setPwForm({ current: "", next: "", confirm: "" });
    toast("密碼已更新", "success");
  }

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-2xl">
      <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">設定</h1>

      {/* Account info */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3 text-slate-800 font-semibold"><Settings size={16} /> 帳號資訊</div>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-500">登入 Email</dt><dd className="text-right font-medium">{user.email}</dd>
          <dt className="text-slate-500">角色</dt><dd className="text-right font-medium">業主</dd>
          <dt className="text-slate-500">目前方案</dt><dd className="text-right"><span className="badge badge-indigo">{user.tier}</span></dd>
        </dl>
      </div>

      {/* Profile */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-semibold"><Building2 size={16} /> 個人 / 公司設定</div>
        <Field label="顯示名稱 / 公司名稱"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="預設貨幣單位">
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCY_OPTIONS.map((c) => <option key={c.symbol} value={c.symbol}>{c.symbol} · {c.name}（{c.desc}）</option>)}
          </select>
        </Field>
        <p className="text-xs text-slate-500">＊ 變更貨幣只影響日後新開立的單據與全站顯示，既有單據維持原幣別。</p>
        <button className="btn-primary" disabled={!profileDirty || savingProfile} onClick={saveProfile}>
          {savingProfile ? "儲存中…" : "儲存設定"}
        </button>
      </div>

      {/* Password */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-semibold"><KeyRound size={16} /> 重設密碼</div>
        <Field label="目前密碼"><input className="input" type="password" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="新密碼"><input className="input" type="password" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} /></Field>
          <Field label="確認新密碼"><input className="input" type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} /></Field>
        </div>
        <button className="btn-primary" disabled={savingPw} onClick={changePw}>
          {savingPw ? "更新中…" : "更新密碼"}
        </button>
      </div>
    </div>
  );
}

function Locked({ feature, need }: { feature: string; need: string }) {
  return (
    <div className="p-12 text-center">
      <div className="inline-flex w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 items-center justify-center mb-4">
        <Lock size={28} />
      </div>
      <h2 className="text-lg font-bold text-slate-800">{feature}</h2>
      <p className="text-sm text-slate-500 mt-1">此功能需要 {need} 方案，請至「方案」分頁升級。</p>
    </div>
  );
}

// ── Units ─────────────────────────────────────────────────────────
const blankUnit = (cur: string) => ({
  id: "",
  tenantCode: "",
  tenantName: "",
  address: "",
  email: "",
  monthlyRent: "",
  managementFee: "",
  deposit: "",
  leaseEndDate: "",
  memo: "",
  waterRate: "",
  electricRate: "",
  waterReading: "",
  electricReading: "",
});

function UnitsTab({
  user,
  units,
  payments,
  call,
  refresh,
}: {
  user: User;
  units: Unit[];
  payments: Payment[];
  call: (p: string, m: "POST" | "PUT" | "DELETE", b?: unknown, ok?: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("全部");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>(blankUnit(user.currency));
  const [archiveTarget, setArchiveTarget] = useState<Unit | null>(null);
  const [checklistTarget, setChecklistTarget] = useState<Unit | null>(null);

  const filtered = units.filter((u) => {
    if (filter === "出租中" && !u.tenantName) return false;
    if (filter === "空置中" && u.tenantName) return false;
    if (filter === "即將到期" && !(u.tenantName && isExpiringSoon(u.leaseEndDate))) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (u.address || "").toLowerCase().includes(q) || (u.tenantName || "").toLowerCase().includes(q);
    }
    return true;
  });

  function openAdd() {
    setForm(blankUnit(user.currency));
    setModal(true);
  }
  function openEdit(u: Unit) {
    setForm({ ...u });
    setModal(true);
  }
  async function save() {
    const editing = !!form.id;
    const ok = await call(
      editing ? `units/${form.id}` : "units",
      editing ? "PUT" : "POST",
      form,
      editing ? "已更新單位" : "已新增單位"
    );
    if (ok) setModal(false);
  }

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-800">單位與租客</h1>
        <button className="btn-primary" onClick={openAdd}>＋ 新增單位</button>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <input className="input md:max-w-xs" placeholder="搜尋地址 / 租客…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-1">
          {["全部", "出租中", "空置中", "即將到期"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filter === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map((u) => (
          <div key={u.id} className="card">
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800">{u.address || "（未填地址）"}</div>
                <div className="text-sm text-slate-500 mt-0.5">
                  {u.tenantName ? `${u.tenantName} · ${u.tenantCode}` : "空置中"}
                </div>
              </div>
              <span className={`badge ${u.tenantName ? "badge-emerald" : "badge-slate"}`}>
                {u.tenantName ? "出租中" : "空置"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="bg-slate-50 rounded-lg py-2">
                <div className="text-[11px] text-slate-400">月租</div>
                <div className="text-sm font-semibold">{fmtMoney(u.monthlyRent, user.currency)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg py-2">
                <div className="text-[11px] text-slate-400">押金</div>
                <div className="text-sm font-semibold">{fmtNum(u.deposit)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg py-2">
                <div className="text-[11px] text-slate-400">到期</div>
                <div className={`text-sm font-semibold ${isExpiringSoon(u.leaseEndDate) ? "text-amber-600" : ""}`}>
                  {u.leaseEndDate || "—"}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn-ghost flex-1 !py-2 text-sm" onClick={() => openEdit(u)}>編輯</button>
              {u.tenantName && (
                <>
                  <button className="btn-ghost flex-1 !py-2 text-sm" onClick={() => setChecklistTarget(u)}>入退住清單</button>
                  <button className="btn-ghost flex-1 !py-2 text-sm" onClick={() => setArchiveTarget(u)}>退租封存</button>
                </>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-12">尚無單位資料，點「新增單位」開始。</div>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={form.id ? "編輯單位" : "新增單位"}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModal(false)}>取消</button>
            <button className="btn-primary" onClick={save}>儲存</button>
          </>
        }
      >
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="單位地址"><input className="input" value={String(form.address ?? "")} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="租客 ID（租客登入用）"><input className="input" value={String(form.tenantCode ?? "")} onChange={(e) => setForm({ ...form, tenantCode: e.target.value })} /></Field>
          <Field label="租客姓名"><input className="input" value={String(form.tenantName ?? "")} onChange={(e) => setForm({ ...form, tenantName: e.target.value })} /></Field>
          <Field label="租客 Email（自動開通帳號）"><input className="input" value={String(form.email ?? "")} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="每月租金"><input className="input" type="number" value={String(form.monthlyRent ?? "")} onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })} /></Field>
          <Field label="管理費 / 月"><input className="input" type="number" value={String(form.managementFee ?? "")} onChange={(e) => setForm({ ...form, managementFee: e.target.value })} /></Field>
          <Field label="押金"><input className="input" type="number" value={String(form.deposit ?? "")} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></Field>
          <Field label="合約終止日"><input className="input" type="date" value={String(form.leaseEndDate ?? "")} onChange={(e) => setForm({ ...form, leaseEndDate: e.target.value })} /></Field>
          <Field label="水費單價"><input className="input" type="number" value={String(form.waterRate ?? "")} onChange={(e) => setForm({ ...form, waterRate: e.target.value })} /></Field>
          <Field label="電費單價"><input className="input" type="number" value={String(form.electricRate ?? "")} onChange={(e) => setForm({ ...form, electricRate: e.target.value })} /></Field>
          <Field label="上期水錶讀數（起始底數）"><input className="input" type="number" value={String(form.waterReading ?? "")} onChange={(e) => setForm({ ...form, waterReading: e.target.value })} /></Field>
          <Field label="上期電錶讀數（起始底數）"><input className="input" type="number" value={String(form.electricReading ?? "")} onChange={(e) => setForm({ ...form, electricReading: e.target.value })} /></Field>
          <div className="md:col-span-2">
            <p className="text-xs text-slate-500 mb-2">＊ 第一次抄表前，可在此填入目前水/電錶讀數作為「上期讀數」起點；之後每次開水電費單會自動更新。</p>
            <Field label="備忘 / 待辦事項"><textarea className="input" rows={2} value={String(form.memo ?? "")} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      <ArchiveModal target={archiveTarget} onClose={() => setArchiveTarget(null)} call={call} />
      <ChecklistModal target={checklistTarget} onClose={() => setChecklistTarget(null)} />
    </div>
  );
}

// ── Move-in / move-out checklist ──────────────────────────────────
const DEFAULT_CHECKLIST = [
  "鑰匙 / 門禁卡交付",
  "水錶讀數記錄",
  "電錶讀數記錄",
  "煤氣錶讀數記錄",
  "傢俱 / 電器清點",
  "牆面 / 地板狀況拍照",
  "押金收訖",
  "合約簽署",
];

type CheckItem = { text: string; done: boolean };

function ChecklistModal({ target, onClose }: { target: Unit | null; onClose: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<"入住" | "退住">("入住");
  const [items, setItems] = useState<CheckItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [savedDate, setSavedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(t: "入住" | "退住", code: string) {
    setLoading(true);
    const r = await api<{ items: CheckItem[] | null; savedDate: string | null }>(
      `checklist?tenantCode=${encodeURIComponent(code)}&type=${encodeURIComponent(t)}`
    );
    setLoading(false);
    if (r.success && r.items && r.items.length) {
      setItems(r.items);
      setSavedDate(r.savedDate);
    } else {
      setItems(DEFAULT_CHECKLIST.map((text) => ({ text, done: false })));
      setSavedDate(null);
    }
  }

  // (re)load whenever target or type changes
  useEffect(() => {
    if (target) load(type, target.tenantCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, type]);

  if (!target) return null;

  async function save() {
    const r = await api("checklist", "POST", { tenantCode: target!.tenantCode, type, items });
    if (r.success) {
      toast("清單已儲存", "success");
      onClose();
    } else toast(r.message || "儲存失敗", "error");
  }

  const doneCount = items.filter((i) => i.done).length;

  return (
    <Modal open={!!target} onClose={onClose} title={`入退住清單 — ${target.tenantName}`} footer={
      <>
        <button className="btn-ghost" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={save}>儲存清單</button>
      </>
    }>
      <div className="flex gap-2 mb-3 p-1 bg-slate-100 rounded-xl">
        {(["入住", "退住"] as const).map((t) => (
          <button key={t} onClick={() => setType(t)} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${type === t ? "bg-white shadow text-indigo-600" : "text-slate-500"}`}>
            {t}清單
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-slate-400 mb-2">
        <span>完成 {doneCount} / {items.length}</span>
        {savedDate && <span>上次儲存：{savedDate}</span>}
      </div>
      {loading ? (
        <div className="text-center text-slate-400 py-8">載入中…</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <input type="checkbox" checked={it.done} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, done: e.target.checked } : x))} />
              <span className={`flex-1 text-sm ${it.done ? "line-through text-slate-400" : "text-slate-700"}`}>{it.text}</span>
              <button className="text-slate-300 hover:text-red-500" onClick={() => setItems(items.filter((_, i) => i !== idx))}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <input className="input" placeholder="新增項目…" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newItem.trim()) { setItems([...items, { text: newItem.trim(), done: false }]); setNewItem(""); } }} />
        <button className="btn-ghost" onClick={() => { if (newItem.trim()) { setItems([...items, { text: newItem.trim(), done: false }]); setNewItem(""); } }}>新增</button>
      </div>
    </Modal>
  );
}

function ArchiveModal({
  target,
  onClose,
  call,
}: {
  target: Unit | null;
  onClose: () => void;
  call: (p: string, m: "POST" | "PUT" | "DELETE", b?: unknown, ok?: string) => Promise<boolean>;
}) {
  const [form, setForm] = useState({ moveOutDate: todayISO(), depositStatus: "已退還", notes: "" });
  if (!target) return null;
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={`退租封存 — ${target.tenantName}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button
            className="btn-danger"
            onClick={async () => {
              const ok = await call("archive", "POST", { unitId: target.id, ...form }, "已封存，單位轉為空置");
              if (ok) onClose();
            }}
          >
            確認封存
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-500 mb-3">封存後此單位將清空租客資訊並轉為空置，歷史記錄保留於「方案」說明中可查。</p>
      <div className="space-y-3">
        <Field label="退租日期"><input className="input" type="date" value={form.moveOutDate} onChange={(e) => setForm({ ...form, moveOutDate: e.target.value })} /></Field>
        <Field label="押金狀態">
          <select className="input" value={form.depositStatus} onChange={(e) => setForm({ ...form, depositStatus: e.target.value })}>
            <option>已退還</option><option>部分退還</option><option>未退還</option><option>未確認</option>
          </select>
        </Field>
        <Field label="備註"><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

// ── Payments ──────────────────────────────────────────────────────
function PaymentsTab({
  user,
  units,
  payments,
  call,
}: {
  user: User;
  units: Unit[];
  payments: Payment[];
  call: (p: string, m: "POST" | "PUT" | "DELETE", b?: unknown, ok?: string) => Promise<boolean>;
}) {
  const toast = useToast();
  const cur = user.currency;
  // 依租客編號自然排序（T101 < T201 < T202 < … 數字感知，T2 不會排在 T10 後）
  const tenants = units
    .filter((u) => u.tenantCode)
    .sort((a, b) => a.tenantCode.localeCompare(b.tenantCode, undefined, { numeric: true, sensitivity: "base" }));
  const [filter, setFilter] = useState("全部");
  const [tenantFilter, setTenantFilter] = useState("全部");
  const [view, setView] = useState<"bills" | "ledger">("bills");
  const [billModal, setBillModal] = useState(false);
  const [toolsModal, setToolsModal] = useState(false);
  const [partial, setPartial] = useState<Payment | null>(null);
  const [editing, setEditing] = useState<Payment | null>(null);

  const filtered = payments.filter((p) => {
    if (filter !== "全部" && p.status !== filter) return false;
    if (tenantFilter !== "全部" && p.tenantCode !== tenantFilter) return false;
    return true;
  });

  const tenantName = (code: string) => units.find((u) => u.tenantCode === code)?.tenantName || code;

  // Prepayment balance per tenant = Σ預付款 − Σ預付款抵扣.
  const prepayBalance = (code: string) => {
    const pays = payments.filter((p) => p.tenantCode === code);
    const added = pays.filter((p) => p.docCategory === "預付款").reduce((s, p) => s + p.paidAmount, 0);
    const used = pays.filter((p) => p.docCategory === "預付款抵扣").reduce((s, p) => s + p.paidAmount, 0);
    return Math.max(added - used, 0);
  };

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">收款管理</h1>
        <div className="flex gap-2">
          <button className="btn-ghost gap-1.5" onClick={() => setToolsModal(true)}><Wand2 size={16} /> 帳務工具</button>
          <button className="btn-primary gap-1.5" onClick={() => setBillModal(true)}><Plus size={16} /> 開立單據</button>
        </div>
      </div>

      <div className="inline-flex p-1 bg-slate-100 rounded-xl text-sm">
        {([["bills", "帳單清單"], ["ledger", "收款明細"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} className={`px-4 py-1.5 rounded-lg font-medium transition ${view === k ? "bg-white shadow text-indigo-600" : "text-slate-500"}`}>
            {label}
          </button>
        ))}
      </div>

      {view === "ledger" && <LedgerView payments={payments} tenants={tenants} cur={cur} />}

      {view === "bills" && (<>
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 flex-wrap">
          {["全部", "未繳費", "部分繳費", "已繳費"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm ${filter === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
              {f}
            </button>
          ))}
        </div>
        <select className="input md:max-w-[200px] !py-1.5" value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}>
          <option value="全部">全部租客</option>
          {tenants.map((t) => <option key={t.id} value={t.tenantCode}>{t.tenantName}（{t.tenantCode}）</option>)}
        </select>
      </div>

      {tenantFilter !== "全部" && prepayBalance(tenantFilter) > 0 && (
        <div className="card !p-3 bg-violet-50 border border-violet-100 flex flex-wrap items-center gap-2 text-sm text-violet-800">
          <Banknote size={16} />
          <span className="flex-1 min-w-[180px]">{tenantName(tenantFilter)} 可用預付款餘額 <b className="tnum">{fmtMoney(prepayBalance(tenantFilter), cur)}</b></span>
          <button
            className="pill bg-violet-600 text-white hover:bg-violet-700"
            onClick={() => {
              const owing = payments
                .filter((p) => p.tenantCode === tenantFilter && p.status !== "已繳費" && !["預付款", "預付款抵扣"].includes(p.docCategory))
                .reduce((s, p) => s + Math.max(p.totalAmount - p.paidAmount, 0), 0);
              if (owing <= 0) { toast("此租客沒有未繳帳單", "info"); return; }
              if (confirm(`將用預付款餘額由最舊的未繳帳單開始逐張抵扣，最多抵 ${fmtMoney(Math.min(prepayBalance(tenantFilter), owing), cur)}。確定？`))
                call("payments/offset-all", "POST", { tenantCode: tenantFilter }, "已用預付款抵扣未繳帳單");
            }}
          >
            一鍵抵扣全部未繳
          </button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((p) => (
          <div key={p.id} className="card !p-4">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 truncate">{p.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {tenantName(p.tenantCode)} · {p.invoiceNumber || p.docCategory} · {p.period || p.createdDate}
                </div>
                {p.remark && <div className="text-xs text-slate-400 mt-0.5 whitespace-pre-line">{p.remark}</div>}
              </div>
              <span className={`badge ${payBadge(p.status)} shrink-0`}>{p.status}</span>
            </div>
            <div className="flex items-end justify-between mt-2">
              <div className="text-sm">
                <span className="font-bold text-slate-800">{fmtMoney(p.totalAmount, p.currency)}</span>
                {p.paidAmount > 0 && p.status !== "已繳費" && (
                  <span className="text-xs text-slate-400 ml-2">已付 {fmtNum(p.paidAmount)}</span>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end">
                <button className="pill bg-indigo-50 text-indigo-700 hover:bg-indigo-100" onClick={() => window.open(`/doc/${p.id}`, "_blank")}><FileText size={13} /> 單據</button>
                {p.status !== "已繳費" && (
                  <>
                    <button className="pill bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => call(`payments/${p.id}`, "PUT", { action: "status", status: "已繳費" }, "已標記繳清")}>標記繳清</button>
                    <button className="pill bg-amber-50 text-amber-700 hover:bg-amber-100" onClick={() => setPartial(p)}>部分收款</button>
                    {prepayBalance(p.tenantCode) > 0 && !["預付款", "預付款抵扣"].includes(p.docCategory) && (
                      <button className="pill bg-violet-50 text-violet-700 hover:bg-violet-100" title={`可用餘額 ${fmtMoney(prepayBalance(p.tenantCode), p.currency)}`} onClick={() => call(`payments/${p.id}/offset`, "POST", {}, "已用預付款抵扣")}><Banknote size={13} /> 預付款抵扣</button>
                    )}
                  </>
                )}
                <button className="pill bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="編輯單據" onClick={() => setEditing(p)}><Pencil size={13} /></button>
                <button className="pill bg-red-50 text-red-600 hover:bg-red-100" aria-label="刪除單據" onClick={() => { if (confirm("確定刪除此單據？")) call(`payments/${p.id}`, "DELETE", undefined, "已刪除"); }}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center text-slate-400 py-12">沒有符合的單據。</div>}
      </div>
      </>)}

      <BillModal open={billModal} onClose={() => setBillModal(false)} tenants={tenants} cur={cur} call={call} />
      <ToolsModal open={toolsModal} onClose={() => setToolsModal(false)} tenants={tenants} cur={cur} call={call} toast={toast} />
      <PartialModal target={partial} onClose={() => setPartial(null)} call={call} />
      <EditPaymentModal target={editing} onClose={() => setEditing(null)} tenants={tenants} call={call} />
    </div>
  );
}

// 收款明細流水帳 — 所有「實際收到的款項」（排除預付款抵扣以免重複計算）
function LedgerView({ payments, tenants, cur }: { payments: Payment[]; tenants: Unit[]; cur: string }) {
  const [lMonth, setLMonth] = useState("全部");
  const [lTenant, setLTenant] = useState("全部");
  const tenantName = (code: string) => tenants.find((t) => t.tenantCode === code)?.tenantName || code;
  const toYM = (d: string) => {
    const m = (d || "").match(/(\d{4})\D(\d{1,2})/);
    return m ? `${m[1]}-${m[2].padStart(2, "0")}` : "";
  };
  const catBadge = (c: string) =>
    c === "預付款" ? "badge-indigo" : c === "收據" ? "badge-emerald" : c.includes("退租") ? "badge-amber" : "badge-slate";

  const received = payments.filter((p) => p.paidAmount > 0 && p.docCategory !== "預付款抵扣");
  const months = Array.from(new Set(received.map((p) => toYM(p.receiptDate || p.createdDate)).filter(Boolean))).sort().reverse();

  const entries = received
    .map((p) => ({ id: p.id, date: p.receiptDate || p.createdDate || "", tenantCode: p.tenantCode, title: p.title, cat: p.docCategory, amount: p.paidAmount, currency: p.currency }))
    .filter((e) => lMonth === "全部" || toYM(e.date) === lMonth)
    .filter((e) => lTenant === "全部" || e.tenantCode === lTenant)
    .sort((a, b) => toYM(b.date).localeCompare(toYM(a.date)) || (b.date || "").localeCompare(a.date || ""));

  const total = entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <select className="input md:max-w-[160px] !py-1.5" value={lMonth} onChange={(e) => setLMonth(e.target.value)}>
          <option value="全部">全部月份</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="input md:max-w-[200px] !py-1.5" value={lTenant} onChange={(e) => setLTenant(e.target.value)}>
          <option value="全部">全部租客</option>
          {tenants.map((t) => <option key={t.id} value={t.tenantCode}>{t.tenantName}（{t.tenantCode}）</option>)}
        </select>
        <button
          className="btn-ghost btn-sm gap-1.5 ml-auto"
          disabled={entries.length === 0}
          onClick={() => downloadCSV(
            `收款明細_${lMonth === "全部" ? "全部" : lMonth}.csv`,
            ["收款日期", "租客編號", "租客", "類別", "項目", "幣別", "已收金額"],
            entries.map((e) => [e.date, e.tenantCode, tenantName(e.tenantCode), e.cat, e.title, e.currency, e.amount])
          )}
        >
          <Download size={15} /> 匯出 CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="收款筆數" value={entries.length} valueClass="text-slate-700" />
        <Stat label="收款合計" value={fmtMoney(total, cur)} valueClass="text-emerald-600" />
      </div>

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-100">
              <th className="text-left px-4 py-2.5 font-medium">收款日期</th>
              <th className="text-left px-3 py-2.5 font-medium">租客</th>
              <th className="text-left px-3 py-2.5 font-medium">項目</th>
              <th className="text-right px-4 py-2.5 font-medium">已收金額</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-slate-50">
                <td className="px-4 py-2.5 text-slate-600 tnum">{e.date || "—"}</td>
                <td className="px-3 py-2.5 text-slate-700">{tenantName(e.tenantCode)}</td>
                <td className="px-3 py-2.5">
                  <span className={`badge ${catBadge(e.cat)} mr-1.5`}>{e.cat}</span>
                  <span className="text-slate-700">{e.title}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 tnum">{fmtMoney(e.amount, e.currency)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={4} className="text-center text-slate-400 py-10">沒有符合的收款記錄。</td></tr>
            )}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 font-bold">
                <td className="px-4 py-2.5 text-slate-700" colSpan={3}>合計</td>
                <td className="px-4 py-2.5 text-right text-emerald-700 tnum">{fmtMoney(total, cur)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-slate-500">＊ 顯示所有實際收到的款項（含部分收款、收據、預付款）；「預付款抵扣」為使用既有餘額，不重複計入。</p>
    </div>
  );
}

function BillModal({ open, onClose, tenants, cur, call }: {
  open: boolean; onClose: () => void; tenants: Unit[]; cur: string;
  call: (p: string, m: "POST" | "PUT" | "DELETE", b?: unknown, ok?: string) => Promise<boolean>;
}) {
  const [form, setForm] = useState({ tenantCode: "", docCategory: "帳單", title: "", totalAmount: "", paidAmount: "", receiptDate: todayISO(), period: currentYM(), sendEmail: false });
  async function submit() {
    if (!form.tenantCode) return;
    const ok = await call("payments", "POST", { ...form, currency: cur }, "已開立單據");
    if (ok) onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="開立帳單 / 收據" footer={
      <>
        <button className="btn-ghost" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={submit}>建立</button>
      </>
    }>
      <div className="space-y-3">
        <Field label="租客">
          <select className="input" value={form.tenantCode} onChange={(e) => setForm({ ...form, tenantCode: e.target.value })}>
            <option value="">請選擇…</option>
            {tenants.map((t) => <option key={t.id} value={t.tenantCode}>{t.tenantName}（{t.tenantCode}）</option>)}
          </select>
        </Field>
        <Field label="文件類別">
          <select className="input" value={form.docCategory} onChange={(e) => setForm({ ...form, docCategory: e.target.value })}>
            <option value="帳單">帳單（未繳）</option>
            <option value="收據">收據（已收款）</option>
          </select>
        </Field>
        <Field label="項目標題"><input className="input" placeholder="例：2026年6月租金" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="總金額"><input className="input" type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} /></Field>
          <Field label="款項期間"><input className="input" type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} /></Field>
        </div>
        {form.docCategory === "收據" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="實收金額"><input className="input" type="number" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} /></Field>
            <Field label="收款日期"><input className="input" type="date" value={form.receiptDate} onChange={(e) => setForm({ ...form, receiptDate: e.target.value })} /></Field>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.sendEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} />
          寄送 Email 通知租客
        </label>
      </div>
    </Modal>
  );
}

function PartialModal({ target, onClose, call }: {
  target: Payment | null; onClose: () => void;
  call: (p: string, m: "POST" | "PUT" | "DELETE", b?: unknown, ok?: string) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  if (!target) return null;
  const owing = Math.max(target.totalAmount - target.paidAmount, 0);
  return (
    <Modal open={!!target} onClose={onClose} title="記錄部分收款" footer={
      <>
        <button className="btn-ghost" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={async () => {
          const ok = await call(`payments/${target.id}`, "PUT", { action: "partial", amount, date }, "已記錄收款");
          if (ok) { setAmount(""); onClose(); }
        }}>確認</button>
      </>
    }>
      <p className="text-sm text-slate-500 mb-3">{target.title} · 尚欠 {fmtMoney(owing, target.currency)}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="本次收款金額"><input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="收款日期"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function EditPaymentModal({ target, onClose, tenants, call }: {
  target: Payment | null; onClose: () => void; tenants: Unit[];
  call: (p: string, m: "POST" | "PUT" | "DELETE", b?: unknown, ok?: string) => Promise<boolean>;
}) {
  const [f, setF] = useState({ tenantCode: "", docCategory: "帳單", title: "", period: "", totalAmount: "", paidAmount: "", receiptDate: "", remark: "" });
  useEffect(() => {
    if (target) setF({
      tenantCode: target.tenantCode,
      docCategory: target.docCategory,
      title: target.title,
      period: target.period,
      totalAmount: String(target.totalAmount),
      paidAmount: String(target.paidAmount),
      receiptDate: target.receiptDate,
      remark: target.remark,
    });
  }, [target]);
  if (!target) return null;
  return (
    <Modal open={!!target} onClose={onClose} title="編輯單據" footer={
      <>
        <button className="btn-ghost" onClick={onClose}>取消</button>
        <button className="btn-primary" onClick={async () => {
          const ok = await call(`payments/${target.id}`, "PUT", { action: "edit", ...f }, "已更新單據");
          if (ok) onClose();
        }}>儲存</button>
      </>
    }>
      <div className="space-y-3">
        <Field label="租客">
          <select className="input" value={f.tenantCode} onChange={(e) => setF({ ...f, tenantCode: e.target.value })}>
            {tenants.map((t) => <option key={t.id} value={t.tenantCode}>{t.tenantName}（{t.tenantCode}）</option>)}
          </select>
        </Field>
        <Field label="項目標題"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="文件類別">
            <select className="input" value={f.docCategory} onChange={(e) => setF({ ...f, docCategory: e.target.value })}>
              {["帳單", "收據", "預付款", "退租收據", "退租帳單"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="款項期間"><input className="input" type="month" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="總金額"><input className="input" type="number" value={f.totalAmount} onChange={(e) => setF({ ...f, totalAmount: e.target.value })} /></Field>
          <Field label="已付金額"><input className="input" type="number" value={f.paidAmount} onChange={(e) => setF({ ...f, paidAmount: e.target.value })} /></Field>
        </div>
        <Field label="收款日期"><input className="input" type="date" value={f.receiptDate} onChange={(e) => setF({ ...f, receiptDate: e.target.value })} /></Field>
        <Field label="備註"><input className="input" value={f.remark} onChange={(e) => setF({ ...f, remark: e.target.value })} /></Field>
        <p className="text-xs text-slate-500">＊ 繳費狀態會依「已付 / 總金額」自動判定。</p>
      </div>
    </Modal>
  );
}

function ToolsModal({ open, onClose, tenants, cur, call, toast }: {
  open: boolean; onClose: () => void; tenants: Unit[]; cur: string;
  call: (p: string, m: "POST" | "PUT" | "DELETE", b?: unknown, ok?: string) => Promise<boolean>;
  toast: (m: string, t?: "info" | "success" | "error") => void;
}) {
  const [view, setView] = useState<"menu" | "utility" | "prepay" | "deposit" | "termination">("menu");
  // current meter readings keyed by tenantCode
  const [util, setUtil] = useState<Record<string, { water: string; elec: string }>>({});
  const [prepay, setPrepay] = useState({ tenantCode: "", amount: "", date: todayISO(), remark: "" });
  const [deposit, setDeposit] = useState({ tenantCode: "", docType: "收據", receiptDate: todayISO() });
  const [term, setTerm] = useState({ tenantCode: "", moveOutDate: todayISO(), depositDeduction: "", deductionReason: "" });

  function back() { setView("menu"); }

  return (
    <Modal open={open} onClose={() => { setView("menu"); onClose(); }} title="帳務工具" wide>
      {view === "menu" && (
        <div className="grid md:grid-cols-2 gap-3">
          <ToolBtn icon={RotateCw} title="一鍵生成本月租金" desc="為所有出租中單位建立租金帳單" onClick={() => call("payments/generate-rent", "POST", undefined, "已生成本月租金帳單")} />
          <ToolBtn icon={Droplets} title="批量水電費（抄表）" desc="輸入今期讀數自動計費" onClick={() => setView("utility")} />
          <ToolBtn icon={Banknote} title="登記預付款" desc="記錄租客預先繳交的款項" onClick={() => setView("prepay")} />
          <ToolBtn icon={ShieldCheck} title="押金收據 / 發票" desc="依單位押金生成單據" onClick={() => setView("deposit")} />
          <ToolBtn icon={LogOut} title="退租結算單" desc="押金扣除與退還計算" onClick={() => setView("termination")} />
        </div>
      )}

      {view === "utility" && (
        <div className="space-y-3">
          <button className="text-sm text-indigo-600" onClick={back}>← 返回</button>
          <p className="text-sm text-slate-500">系統已記錄上期錶讀數，只需輸入本期讀數，用量與金額自動計算。生成後本期讀數會自動存為下期的上期讀數。</p>
          {tenants.map((t) => {
            const cw = parseFloat(util[t.tenantCode]?.water ?? "");
            const ce = parseFloat(util[t.tenantCode]?.elec ?? "");
            const wu = isNaN(cw) ? 0 : Math.max(cw - t.waterReading, 0);
            const eu = isNaN(ce) ? 0 : Math.max(ce - t.electricReading, 0);
            const amt = Math.round(wu * t.waterRate + eu * t.electricRate);
            const setR = (k: "water" | "elec", v: string) =>
              setUtil({ ...util, [t.tenantCode]: { water: util[t.tenantCode]?.water ?? "", elec: util[t.tenantCode]?.elec ?? "", [k]: v } });
            return (
              <div key={t.id} className="border border-slate-100 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-medium text-sm">{t.tenantName}</div>
                  <div className="text-xs text-slate-400">單價 水 {fmtNum(t.waterRate)} / 電 {fmtNum(t.electricRate)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={`水錶今期讀數（上期 ${fmtNum(t.waterReading)}）`}>
                    <input className="input" type="number" value={util[t.tenantCode]?.water ?? ""} onChange={(e) => setR("water", e.target.value)} />
                  </Field>
                  <Field label={`電錶今期讀數（上期 ${fmtNum(t.electricReading)}）`}>
                    <input className="input" type="number" value={util[t.tenantCode]?.elec ?? ""} onChange={(e) => setR("elec", e.target.value)} />
                  </Field>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  用水 <b>{wu.toFixed(1)}</b> · 用電 <b>{eu.toFixed(1)}</b> · 本期費用 <b className="text-indigo-600">{cur} {fmtNum(amt)}</b>
                </div>
              </div>
            );
          })}
          <button className="btn-primary w-full" onClick={async () => {
            const rows = tenants
              .filter((t) => util[t.tenantCode]?.water || util[t.tenantCode]?.elec)
              .map((t) => ({ tenantCode: t.tenantCode, waterCurrent: util[t.tenantCode]?.water || t.waterReading, electricCurrent: util[t.tenantCode]?.elec || t.electricReading }));
            if (rows.length === 0) { toast("請至少輸入一位租客的讀數", "error"); return; }
            const ok = await call("payments/utility", "POST", { rows }, "已生成水電費帳單並更新錶讀數");
            if (ok) { setUtil({}); setView("menu"); onClose(); }
          }}>生成水電費帳單</button>
        </div>
      )}

      {view === "prepay" && (
        <div className="space-y-3">
          <button className="text-sm text-indigo-600" onClick={back}>← 返回</button>
          <TenantSelect tenants={tenants} value={prepay.tenantCode} onChange={(v) => setPrepay({ ...prepay, tenantCode: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="金額"><input className="input" type="number" value={prepay.amount} onChange={(e) => setPrepay({ ...prepay, amount: e.target.value })} /></Field>
            <Field label="日期"><input className="input" type="date" value={prepay.date} onChange={(e) => setPrepay({ ...prepay, date: e.target.value })} /></Field>
          </div>
          <Field label="備註"><input className="input" value={prepay.remark} onChange={(e) => setPrepay({ ...prepay, remark: e.target.value })} /></Field>
          <button className="btn-primary w-full" onClick={async () => {
            const ok = await call("payments/prepay", "POST", { ...prepay, currency: cur }, "已登記預付款");
            if (ok) { setView("menu"); onClose(); }
          }}>登記預付款</button>
        </div>
      )}

      {view === "deposit" && (
        <div className="space-y-3">
          <button className="text-sm text-indigo-600" onClick={back}>← 返回</button>
          <TenantSelect tenants={tenants} value={deposit.tenantCode} onChange={(v) => setDeposit({ ...deposit, tenantCode: v })} />
          <Field label="單據類型">
            <select className="input" value={deposit.docType} onChange={(e) => setDeposit({ ...deposit, docType: e.target.value })}>
              <option value="收據">押金收據（已收）</option>
              <option value="帳單">押金發票（待收）</option>
            </select>
          </Field>
          <Field label="收款日期"><input className="input" type="date" value={deposit.receiptDate} onChange={(e) => setDeposit({ ...deposit, receiptDate: e.target.value })} /></Field>
          <button className="btn-primary w-full" onClick={async () => {
            const ok = await call("payments/deposit", "POST", deposit, "已生成押金單據");
            if (ok) { setView("menu"); onClose(); }
          }}>生成押金單據</button>
        </div>
      )}

      {view === "termination" && (
        <div className="space-y-3">
          <button className="text-sm text-indigo-600" onClick={back}>← 返回</button>
          <TenantSelect tenants={tenants} value={term.tenantCode} onChange={(v) => setTerm({ ...term, tenantCode: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="退租日期"><input className="input" type="date" value={term.moveOutDate} onChange={(e) => setTerm({ ...term, moveOutDate: e.target.value })} /></Field>
            <Field label="押金扣除"><input className="input" type="number" value={term.depositDeduction} onChange={(e) => setTerm({ ...term, depositDeduction: e.target.value })} /></Field>
          </div>
          <Field label="扣除原因"><input className="input" value={term.deductionReason} onChange={(e) => setTerm({ ...term, deductionReason: e.target.value })} /></Field>
          <button className="btn-primary w-full" onClick={async () => {
            const ok = await call("payments/termination", "POST", term, "已生成退租結算單");
            if (ok) { setView("menu"); onClose(); }
          }}>生成退租結算單</button>
        </div>
      )}
    </Modal>
  );
}

function ToolBtn({ icon: Icon, title, desc, onClick }: { icon: import("lucide-react").LucideIcon; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition">
      <div className="inline-flex w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 items-center justify-center"><Icon size={18} /></div>
      <div className="font-semibold text-slate-800 mt-2 text-sm">{title}</div>
      <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
    </button>
  );
}

function TenantSelect({ tenants, value, onChange }: { tenants: Unit[]; value: string; onChange: (v: string) => void }) {
  return (
    <Field label="租客">
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">請選擇…</option>
        {tenants.map((t) => <option key={t.id} value={t.tenantCode}>{t.tenantName}（{t.tenantCode}）</option>)}
      </select>
    </Field>
  );
}

// ── Repairs ───────────────────────────────────────────────────────
function RepairsTab({ units, repairs, call }: {
  units: Unit[]; repairs: import("@/lib/client").Repair[];
  call: (p: string, m: "POST" | "PUT" | "DELETE", b?: unknown, ok?: string) => Promise<boolean>;
}) {
  const [sel, setSel] = useState<import("@/lib/client").Repair | null>(null);
  const [status, setStatus] = useState("處理中");
  const [reply, setReply] = useState("");
  const name = (code: string) => units.find((u) => u.tenantCode === code)?.tenantName || code;

  return (
    <div className="p-4 md:p-8 space-y-4">
      <h1 className="text-xl font-bold text-slate-800">維修管理</h1>
      <div className="space-y-2">
        {repairs.map((r) => (
          <div key={r.id} className="card !p-4">
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800">{name(r.tenantCode)}</div>
                <div className="text-sm text-slate-600 mt-1">{r.description}</div>
                <div className="text-xs text-slate-400 mt-1">{r.applyDate}</div>
                {r.ownerReply && <div className="text-xs text-indigo-600 mt-1">回覆：{r.ownerReply}</div>}
              </div>
              <span className={`badge ${repBadge(r.status)}`}>{r.status}</span>
            </div>
            {r.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.photoUrl} alt="維修照片" className="mt-2 rounded-lg max-h-40 object-cover" />
            )}
            <button className="btn-ghost mt-2 !py-2 text-sm" onClick={() => { setSel(r); setStatus(r.status); setReply(r.ownerReply); }}>處理 / 回覆</button>
          </div>
        ))}
        {repairs.length === 0 && <div className="text-center text-slate-400 py-12">目前沒有維修申請。</div>}
      </div>

      <Modal open={!!sel} onClose={() => setSel(null)} title="處理維修申請" footer={
        <>
          <button className="btn-ghost" onClick={() => setSel(null)}>取消</button>
          <button className="btn-primary" onClick={async () => {
            const ok = await call(`repairs/${sel!.id}`, "PUT", { status, reply }, "已更新並通知租客");
            if (ok) setSel(null);
          }}>儲存</button>
        </>
      }>
        {sel && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">{sel.description}</p>
            <Field label="處理狀態">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option>處理中</option><option>已安排</option><option>完成</option>
              </select>
            </Field>
            <Field label="業主回覆"><textarea className="input" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Expenses ──────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = ["維修保養", "管理費", "稅費", "保險", "水電雜費", "裝修", "仲介佣金", "其他"];
const CAT_BADGE: Record<string, string> = {
  維修保養: "badge-amber",
  管理費: "badge-blue",
  稅費: "badge-red",
  保險: "badge-indigo",
  水電雜費: "badge-emerald",
  裝修: "badge-amber",
  仲介佣金: "badge-blue",
  其他: "badge-slate",
};
const CAT_BAR: Record<string, string> = {
  維修保養: "bg-amber-400",
  管理費: "bg-blue-400",
  稅費: "bg-red-400",
  保險: "bg-indigo-400",
  水電雜費: "bg-emerald-400",
  裝修: "bg-amber-300",
  仲介佣金: "bg-blue-300",
  其他: "bg-slate-300",
};

type ExpenseRow = import("@/lib/client").Expense;
const emptyExpense = () => ({ id: "", date: todayISO(), category: "維修保養", item: "", amount: "", relatedUnit: "", remark: "" });

function ExpensesTab({ cur, expenses, call }: {
  cur: string; expenses: ExpenseRow[];
  call: (p: string, m: "POST" | "PUT" | "DELETE", b?: unknown, ok?: string) => Promise<boolean>;
}) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>(emptyExpense());
  const [monthFilter, setMonthFilter] = useState("全部");
  const [catFilter, setCatFilter] = useState("全部");

  const ym = currentYM();
  const year = ym.slice(0, 4);
  const thisMonthTotal = expenses.filter((e) => (e.date || "").startsWith(ym)).reduce((s, e) => s + e.amount, 0);
  const thisYearTotal = expenses.filter((e) => (e.date || "").startsWith(year)).reduce((s, e) => s + e.amount, 0);
  const allTotal = expenses.reduce((s, e) => s + e.amount, 0);

  // distinct months present (desc)
  const months = Array.from(new Set(expenses.map((e) => (e.date || "").slice(0, 7)).filter(Boolean))).sort().reverse();

  const filtered = expenses
    .filter((e) => (monthFilter === "全部" ? true : (e.date || "").startsWith(monthFilter)))
    .filter((e) => (catFilter === "全部" ? true : (e.category || "其他") === catFilter))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);

  // category breakdown for the current month/category filter scope (ignores catFilter so the bars show all cats)
  const scope = expenses.filter((e) => (monthFilter === "全部" ? true : (e.date || "").startsWith(monthFilter)));
  const scopeTotal = scope.reduce((s, e) => s + e.amount, 0);
  const breakdown = EXPENSE_CATEGORIES
    .map((c) => ({ cat: c, amount: scope.filter((e) => (e.category || "其他") === c).reduce((s, e) => s + e.amount, 0) }))
    .filter((b) => b.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  function openAdd() { setForm(emptyExpense()); setModal(true); }
  function openEdit(e: ExpenseRow) { setForm({ ...e, amount: String(e.amount) }); setModal(true); }
  async function save() {
    if (!form.item) return;
    const editing = !!form.id;
    const ok = await call(editing ? `expenses/${form.id}` : "expenses", editing ? "PUT" : "POST", form, editing ? "已更新支出" : "已新增支出");
    if (ok) setModal(false);
  }

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">財務支出</h1>
        <button className="btn-primary gap-1.5" onClick={openAdd}><Plus size={16} /> 新增支出</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="本月支出" value={fmtMoney(thisMonthTotal, cur)} valueClass="text-red-600" />
        <Stat label={`${year} 年支出`} value={fmtMoney(thisYearTotal, cur)} valueClass="text-orange-600" />
        <Stat label="全部合計" value={fmtMoney(allTotal, cur)} valueClass="text-slate-700" />
      </div>

      {breakdown.length > 0 && (
        <div className="card">
          <div className="text-sm font-semibold text-slate-800 mb-3">分類佔比{monthFilter !== "全部" ? `（${monthFilter}）` : ""}</div>
          <div className="space-y-2.5">
            {breakdown.map((b) => {
              const pct = scopeTotal > 0 ? Math.round((b.amount / scopeTotal) * 100) : 0;
              return (
                <div key={b.cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{b.cat}</span>
                    <span className="text-slate-500 tnum">{fmtMoney(b.amount, cur)} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${CAT_BAR[b.cat] || "bg-slate-300"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select className="input !py-1.5 max-w-[150px]" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          <option value="全部">全部月份</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap">
          {["全部", ...EXPENSE_CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCatFilter(c)} className={`px-2.5 py-1.5 rounded-lg text-xs ${catFilter === c ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length > 0 && (
          <div className="flex justify-between text-xs text-slate-500 px-1">
            <span>{filtered.length} 筆</span>
            <span className="tnum">小計 {fmtMoney(filteredTotal, cur)}</span>
          </div>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="card !p-4 flex justify-between items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`badge ${CAT_BADGE[e.category] || "badge-slate"}`}>{e.category || "其他"}</span>
                <span className="font-semibold text-slate-800 truncate">{e.item}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">{e.date}{e.relatedUnit ? ` · ${e.relatedUnit}` : ""}{e.remark ? ` · ${e.remark}` : ""}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-red-600 tnum">-{fmtMoney(e.amount, cur)}</span>
              <button className="pill bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="編輯" onClick={() => openEdit(e)}><Pencil size={13} /></button>
              <button className="pill bg-red-50 text-red-600 hover:bg-red-100" aria-label="刪除" onClick={() => { if (confirm("刪除此支出？")) call(`expenses/${e.id}`, "DELETE", undefined, "已刪除"); }}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 items-center justify-center mb-3"><TrendingDown size={24} /></div>
            <p className="text-sm text-slate-500">{expenses.length === 0 ? "尚無支出記錄，點「新增支出」開始記帳。" : "沒有符合篩選條件的支出。"}</p>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? "編輯支出" : "新增支出"} footer={
        <>
          <button className="btn-ghost" onClick={() => setModal(false)}>取消</button>
          <button className="btn-primary" onClick={save}>儲存</button>
        </>
      }>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="分類">
              <select className="input" value={String(form.category ?? "其他")} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="日期"><input className="input" type="date" value={String(form.date ?? "")} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          </div>
          <Field label="支出項目"><input className="input" placeholder="例：更換熱水爐" value={String(form.item ?? "")} onChange={(e) => setForm({ ...form, item: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="金額"><input className="input" type="number" value={String(form.amount ?? "")} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="關聯單位（選填）"><input className="input" value={String(form.relatedUnit ?? "")} onChange={(e) => setForm({ ...form, relatedUnit: e.target.value })} /></Field>
          </div>
          <Field label="備註（選填）"><input className="input" value={String(form.remark ?? "")} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ── Reports ───────────────────────────────────────────────────────
function ReportsTab({ cur, payments, expenses }: {
  cur: string; payments: Payment[]; expenses: import("@/lib/client").Expense[];
}) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const years = Array.from({ length: 5 }, (_, i) => thisYear - i);

  const realPays = payments.filter((p) => !["預付款", "預付款抵扣"].includes(p.docCategory));

  // 12-month breakdown
  const rows = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    const ym = `${year}-${m}`;
    const mp = realPays.filter((p) => p.period === ym);
    const byCat = (c: string, paid = false) =>
      mp.filter((p) => incomeCategory(p) === c).reduce((s, p) => s + (paid ? p.paidAmount : p.totalAmount), 0);
    const rent = byCat("租金");
    const deposit = byCat("押金", true);
    const mgmt = byCat("管理費");
    const utility = byCat("水電費");
    const repairFee = byCat("維修費");
    const paid = mp.reduce((s, p) => s + p.paidAmount, 0);
    const expense = expenses.filter((e) => (e.date || "").startsWith(ym)).reduce((s, e) => s + e.amount, 0);
    return { month: `${parseInt(m)}月`, rent, deposit, mgmt, utility, repairFee, paid, expense, net: paid - expense };
  });

  // annual summary (paid basis)
  const yp = realPays.filter((p) => (p.period || "").startsWith(`${year}-`));
  const sum = (c: string) => yp.filter((p) => incomeCategory(p) === c).reduce((s, p) => s + p.paidAmount, 0);
  const rent = sum("租金"), deposit = sum("押金"), mgmt = sum("管理費"), utility = sum("水電費"), repairFee = sum("維修費");
  const totalIncome = rent + deposit + mgmt + utility + repairFee;
  const yearExpenses = expenses.filter((e) => (e.date || "").startsWith(String(year)));
  const totalExpense = yearExpenses.reduce((s, e) => s + e.amount, 0);
  const net = totalIncome - totalExpense;

  // 支出按性質（分類）
  const expByCat = EXPENSE_CATEGORIES
    .map((c) => ({ cat: c, amount: yearExpenses.filter((e) => (e.category || "其他") === c).reduce((s, e) => s + e.amount, 0) }))
    .filter((b) => b.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const cards: { label: string; value: number; cls: string }[] = [
    { label: "租金", value: rent, cls: "text-indigo-600" },
    { label: "押金", value: deposit, cls: "text-teal-600" },
    { label: "管理費", value: mgmt, cls: "text-amber-600" },
    { label: "水電費", value: utility, cls: "text-sky-600" },
    { label: "維修費", value: repairFee, cls: "text-orange-600" },
    { label: "支出", value: -totalExpense, cls: "text-red-500" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">財務報表</h1>
        <div className="flex gap-2">
          <button
            className="btn-ghost btn-sm gap-1.5"
            onClick={() => downloadCSV(
              `財務報表_${year}.csv`,
              ["月份", "租金", "管理費", "押金", "水電費", "維修費", "支出", "淨額"],
              rows.filter((r) => r.rent || r.mgmt || r.deposit || r.utility || r.repairFee || r.expense)
                .map((r) => [r.month, r.rent, r.mgmt, r.deposit, r.utility, r.repairFee, r.expense, r.net])
            )}
          >
            <Download size={15} /> 匯出 CSV
          </button>
          <select className="input !py-1.5 max-w-[120px]" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y} 年</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="card !p-3 text-center">
            <div className="text-[11px] text-slate-400">{c.label}</div>
            <div className={`text-base font-bold mt-1 ${c.cls}`}>{cur} {fmtNum(c.value)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label={`${year} 年總收入`} value={fmtMoney(totalIncome, cur)} valueClass="text-emerald-600" />
        <Stat label={`${year} 年淨利`} value={fmtMoney(net, cur)} valueClass={net >= 0 ? "text-indigo-600" : "text-red-600"} />
      </div>

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-100">
              <th className="text-left px-4 py-2.5 font-medium">月份</th>
              <th className="text-right px-3 py-2.5 font-medium">租金</th>
              <th className="text-right px-3 py-2.5 font-medium">管理費</th>
              <th className="text-right px-3 py-2.5 font-medium">押金</th>
              <th className="text-right px-3 py-2.5 font-medium">水電</th>
              <th className="text-right px-3 py-2.5 font-medium">維修</th>
              <th className="text-right px-3 py-2.5 font-medium">支出</th>
              <th className="text-right px-4 py-2.5 font-medium">淨額</th>
            </tr>
          </thead>
          <tbody>
            {rows.filter((r) => r.rent || r.mgmt || r.deposit || r.utility || r.repairFee || r.expense).map((r) => (
              <tr key={r.month} className="border-b border-slate-50">
                <td className="px-4 py-2.5 text-slate-600">{r.month}</td>
                <td className="px-3 py-2.5 text-right text-indigo-600">{r.rent ? fmtNum(r.rent) : "—"}</td>
                <td className="px-3 py-2.5 text-right text-amber-600">{r.mgmt ? fmtNum(r.mgmt) : "—"}</td>
                <td className="px-3 py-2.5 text-right text-teal-600">{r.deposit ? fmtNum(r.deposit) : "—"}</td>
                <td className="px-3 py-2.5 text-right text-sky-600">{r.utility ? fmtNum(r.utility) : "—"}</td>
                <td className="px-3 py-2.5 text-right text-orange-600">{r.repairFee ? fmtNum(r.repairFee) : "—"}</td>
                <td className="px-3 py-2.5 text-right text-red-500">{r.expense ? fmtNum(r.expense) : "—"}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${r.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtNum(r.net)}</td>
              </tr>
            ))}
            {rows.every((r) => !(r.rent || r.mgmt || r.deposit || r.utility || r.repairFee || r.expense)) && (
              <tr><td colSpan={8} className="text-center text-slate-400 py-10">{year} 年尚無財務記錄</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">＊ 收入卡片與年度淨利以「已收金額」計算；月度表的收入欄位顯示「應收總額」、淨額以「實收−支出」計算（與原系統一致）。</p>

      {/* 支出按性質（分類） */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-slate-800">支出分類（{year} 年）</div>
          {expByCat.length > 0 && (
            <button
              className="btn-ghost btn-sm gap-1.5"
              onClick={() => downloadCSV(
                `支出分類_${year}.csv`,
                ["分類", "金額", "佔比%"],
                expByCat.map((b) => [b.cat, b.amount, totalExpense > 0 ? Math.round((b.amount / totalExpense) * 100) : 0])
              )}
            >
              <Download size={15} /> 匯出
            </button>
          )}
        </div>
        {expByCat.length === 0 ? (
          <div className="text-center text-slate-400 py-6 text-sm">{year} 年尚無支出記錄</div>
        ) : (
          <div className="space-y-2.5">
            {expByCat.map((b) => {
              const pct = totalExpense > 0 ? Math.round((b.amount / totalExpense) * 100) : 0;
              return (
                <div key={b.cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{b.cat}</span>
                    <span className="text-slate-500 tnum">{fmtMoney(b.amount, cur)} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${CAT_BAR[b.cat] || "bg-slate-300"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-100">
              <span className="text-slate-700">支出合計</span>
              <span className="text-red-600 tnum">{fmtMoney(totalExpense, cur)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Plan ──────────────────────────────────────────────────────────
function PlanTab({ user, tenantCount, call, onTierChange, toast }: {
  user: User; tenantCount: number;
  call: (p: string, m: "POST" | "PUT" | "DELETE", b?: unknown, ok?: string) => Promise<boolean>;
  onTierChange: (t: string) => void;
  toast: (m: string, t?: "info" | "success" | "error") => void;
}) {
  async function upgrade(tier: Tier) {
    const r = await api<{ tier?: string }>("account/upgrade", "POST", { tier });
    if (!r.success) return toast(r.message || "升級失敗", "error");
    onTierChange(tier);
    toast(`已切換至 ${tier} 方案`, "success");
  }
  async function remind(action: string, label: string) {
    const r = await api<{ sent?: number }>("reminders", "POST", { action });
    if (!r.success) return toast(r.message || "失敗", "error");
    toast(`${label}：已寄出 ${r.sent ?? 0} 封（本機模式請看終端機）`, "success");
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">方案與工具</h1>
        <p className="text-sm text-slate-500 mt-0.5">目前方案：<span className="badge badge-indigo">{user.tier}</span> · 已管理 {tenantCount} 位租客</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {(Object.keys(PLAN_INFO) as Tier[]).map((t) => {
          const info = PLAN_INFO[t];
          const isCurrent = user.tier === t;
          return (
            <div key={t} className={`card border-2 ${isCurrent ? "border-indigo-500" : "border-transparent"}`}>
              <div className="font-bold text-slate-800">{info.name}</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">{info.price}</div>
              <div className="text-xs text-slate-500 mt-1">{info.tenants}</div>
              <ul className="text-sm text-slate-600 mt-3 space-y-1.5">
                {info.features.map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
              <button
                className={`w-full mt-4 ${isCurrent ? "btn-ghost" : "btn-primary"}`}
                disabled={isCurrent}
                onClick={() => upgrade(t)}
              >
                {isCurrent ? "目前方案" : `切換至 ${t}`}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">＊ 本機示範版以一鍵切換模擬升級；接上 Stripe 金鑰後可改為真實結帳。</p>

      <div className="card">
        <div className="font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><Bell size={16} /> 通知與催收工具</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button className="btn-ghost gap-1.5" onClick={() => remind("expiry", "合約到期提醒")}><Clock size={16} /> 合約到期提醒</button>
          <button className="btn-ghost gap-1.5" onClick={() => remind("overdue", "逾期催款")}><AlertTriangle size={16} /> 逾期催款通知</button>
          <button className="btn-ghost gap-1.5" onClick={() => remind("monthly", "月結單")}><FileText size={16} /> 寄送本月月結單</button>
        </div>
      </div>
    </div>
  );
}
