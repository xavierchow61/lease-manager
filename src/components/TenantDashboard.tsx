"use client";

import { useState } from "react";
import { Home, Wallet, Wrench, Plus, Banknote } from "lucide-react";
import { api, type User, type AllData } from "@/lib/client";
import { fmtMoney, fmtNum, todayISO } from "@/lib/money";
import { useToast, Modal, Stat, Field } from "./ui";
import Shell, { type Tab } from "./Shell";

const payBadge = (s: string) =>
  s === "已繳費" ? "badge-emerald" : s === "未繳費" ? "badge-red" : s === "部分繳費" ? "badge-amber" : "badge-slate";
const repBadge = (s: string) =>
  s === "完成" ? "badge-emerald" : s === "處理中" ? "badge-blue" : s === "已安排" ? "badge-indigo" : "badge-amber";

export default function TenantDashboard({
  user,
  data,
  refresh,
  onLogout,
}: {
  user: User;
  data: AllData;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState("home");
  const cur = user.currency;
  const { units, repairs, payments } = data;
  const unit = units[0];

  const tabs: Tab[] = [
    { key: "home", label: "首頁", icon: Home },
    { key: "payments", label: "我的帳單", icon: Wallet },
    { key: "repairs", label: "維修報修", icon: Wrench },
  ];

  const unpaid = payments.filter((p) => p.status !== "已繳費");
  const owing = unpaid.reduce((s, p) => s + Math.max(p.totalAmount - p.paidAmount, 0), 0);
  const activeRepairs = repairs.filter((r) => r.status !== "完成").length;

  // 預付款餘額 = Σ預付款 − Σ預付款抵扣
  const prepayAdded = payments.filter((p) => p.docCategory === "預付款").reduce((s, p) => s + p.paidAmount, 0);
  const prepayUsed = payments.filter((p) => p.docCategory === "預付款抵扣").reduce((s, p) => s + p.paidAmount, 0);
  const prepayBalance = Math.max(prepayAdded - prepayUsed, 0);

  // file a repair
  const [repairModal, setRepairModal] = useState(false);
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState("");

  async function submitRepair() {
    if (!desc.trim()) return toast("請描述維修事項", "error");
    const r = await api("repairs", "POST", { description: desc, applyDate: todayISO(), photoDataUrl: photo });
    if (!r.success) return toast(r.message || "失敗", "error");
    toast("已送出維修申請", "success");
    setDesc(""); setPhoto(""); setRepairModal(false);
    await refresh();
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) return toast("圖片請小於 2MB", "error");
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <Shell user={user} tabs={tabs} active={tab} setActive={setTab} onLogout={onLogout}>
      {tab === "home" && (
        <div className="p-4 md:p-8 space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">你好，{user.name || "租客"}</h1>
            <p className="text-sm text-slate-500 mt-1">{unit ? `${unit.address}` : "歡迎使用租客中心"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="待繳金額" value={fmtMoney(owing, cur)} valueClass="text-red-600" sub={`${unpaid.length} 筆未繳`} />
            <Stat label="進行中維修" value={activeRepairs} valueClass="text-amber-600" />
            {prepayBalance > 0 && (
              <Stat label="預付款餘額" value={fmtMoney(prepayBalance, cur)} valueClass="text-violet-600" sub="可抵未來帳單" />
            )}
          </div>
          {unit && (
            <div className="card">
              <div className="font-semibold text-slate-800 mb-3">租約資訊</div>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-slate-400">月租金</dt><dd className="text-right font-medium">{fmtMoney(unit.monthlyRent, cur)}</dd>
                <dt className="text-slate-400">押金</dt><dd className="text-right font-medium">{fmtNum(unit.deposit)}</dd>
                <dt className="text-slate-400">合約終止日</dt><dd className="text-right font-medium">{unit.leaseEndDate || "—"}</dd>
              </dl>
            </div>
          )}
          <button className="btn-primary w-full gap-1.5" onClick={() => setRepairModal(true)}><Wrench size={16} /> 我要報修</button>
        </div>
      )}

      {tab === "payments" && (
        <div className="p-4 md:p-8 space-y-3">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">我的帳單</h1>
          {prepayBalance > 0 && (
            <div className="card !p-3 bg-violet-50 border border-violet-100 flex items-center gap-2 text-sm text-violet-800">
              <Banknote size={16} />
              <span>您目前有預付款餘額 <b className="tnum">{fmtMoney(prepayBalance, cur)}</b>，可由業主用於抵扣未繳帳單。</span>
            </div>
          )}
          {payments.map((p) => (
            <div key={p.id} className="card !p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-slate-800">{p.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{p.invoiceNumber || p.docCategory} · {p.period || p.createdDate}</div>
                </div>
                <span className={`badge ${payBadge(p.status)}`}>{p.status}</span>
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div className="text-sm">
                  <span className="font-bold text-slate-800">{fmtMoney(p.totalAmount, p.currency)}</span>
                  {p.paidAmount > 0 && p.status !== "已繳費" && <span className="text-xs text-slate-400 ml-2">已付 {fmtNum(p.paidAmount)}</span>}
                </div>
                <button className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700" onClick={() => window.open(`/doc/${p.id}`, "_blank")}>單據 / PDF</button>
              </div>
            </div>
          ))}
          {payments.length === 0 && <div className="text-center text-slate-400 py-12">目前沒有帳單。</div>}
        </div>
      )}

      {tab === "repairs" && (
        <div className="p-4 md:p-8 space-y-3">
          <div className="flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">維修報修</h1>
            <button className="btn-primary gap-1.5" onClick={() => setRepairModal(true)}><Plus size={16} /> 報修</button>
          </div>
          {repairs.map((r) => (
            <div key={r.id} className="card !p-4">
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <div className="text-sm text-slate-700">{r.description}</div>
                  <div className="text-xs text-slate-400 mt-1">{r.applyDate}</div>
                  {r.ownerReply && <div className="text-xs text-indigo-600 mt-1">業主回覆：{r.ownerReply}</div>}
                </div>
                <span className={`badge ${repBadge(r.status)}`}>{r.status}</span>
              </div>
              {r.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.photoUrl} alt="維修照片" className="mt-2 rounded-lg max-h-40 object-cover" />
              )}
            </div>
          ))}
          {repairs.length === 0 && <div className="text-center text-slate-400 py-12">尚無維修記錄。</div>}
        </div>
      )}

      <Modal open={repairModal} onClose={() => setRepairModal(false)} title="提交維修申請" footer={
        <>
          <button className="btn-ghost" onClick={() => setRepairModal(false)}>取消</button>
          <button className="btn-primary" onClick={submitRepair}>送出</button>
        </>
      }>
        <div className="space-y-3">
          <Field label="維修事項描述"><textarea className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="請描述需要維修的問題…" /></Field>
          <Field label="附上照片（選填，<2MB）"><input className="input" type="file" accept="image/*" onChange={onPhoto} /></Field>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="預覽" className="rounded-lg max-h-40 object-cover" />
          )}
        </div>
      </Modal>
    </Shell>
  );
}
