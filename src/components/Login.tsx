"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { api, type User } from "@/lib/client";
import { useToast, Field } from "./ui";
import { CURRENCY_OPTIONS } from "@/lib/money";

type Mode = "login" | "register" | "forgot" | "changePw";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<"admin" | "tenant">("admin");
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // register
  const [reg, setReg] = useState({ name: "", email: "", password: "", currency: "HK$" });
  // change password (forced)
  const [tempEmail, setTempEmail] = useState("");
  const [np1, setNp1] = useState("");
  const [np2, setNp2] = useState("");

  async function doLogin() {
    if (!id || !pw) return toast("請輸入帳號與密碼", "error");
    setLoading(true);
    const r = await api<{ user?: User; requirePasswordChange?: boolean; tempEmail?: string }>(
      "auth/login",
      "POST",
      { role, id, password: pw }
    );
    setLoading(false);
    if (!r.success) return toast(r.message || "登入失敗", "error");
    if (r.requirePasswordChange) {
      setTempEmail(r.tempEmail || "");
      setMode("changePw");
      toast("首次登入，請設定新密碼");
      return;
    }
    if (r.user) onLogin(r.user);
  }

  async function doRegister() {
    if (!reg.name || !reg.email || !reg.password)
      return toast("請填寫完整資料", "error");
    setLoading(true);
    const r = await api<{ user?: User }>("auth/register", "POST", reg);
    setLoading(false);
    if (!r.success) return toast(r.message || "註冊失敗", "error");
    if (r.user) {
      toast("註冊成功，歡迎！", "success");
      onLogin(r.user);
    }
  }

  async function doForgot() {
    if (!id) return toast("請輸入 Email", "error");
    setLoading(true);
    const r = await api("auth/forgot-password", "POST", { email: id });
    setLoading(false);
    if (!r.success) return toast(r.message || "失敗", "error");
    toast("臨時密碼已寄出（本機模式請看伺服器終端機）", "success");
    setMode("login");
  }

  async function doChangePw() {
    if (np1.length < 4) return toast("新密碼至少 4 字元", "error");
    if (np1 !== np2) return toast("兩次密碼不一致", "error");
    setLoading(true);
    const r = await api("auth/change-password", "POST", {
      email: tempEmail,
      newPassword: np1,
    });
    setLoading(false);
    if (!r.success) return toast(r.message || "失敗", "error");
    toast("密碼已更新，請重新登入", "success");
    setMode("login");
    setPw("");
    setNp1("");
    setNp2("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-slate-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-indigo-600 text-white items-center justify-center shadow-lg shadow-indigo-600/30">
            <Building2 size={26} />
          </div>
          <h1 className="text-2xl font-bold mt-3 text-slate-800">物業管理系統 Pro</h1>
          <p className="text-sm text-slate-500 mt-1">租客 · 收款 · 維修 一站式管理</p>
        </div>

        <div className="card !p-6">
          {mode === "login" && (
            <>
              <div className="flex gap-2 mb-5 p-1 bg-slate-100 rounded-xl">
                {(["admin", "tenant"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                      role === r ? "bg-white shadow text-indigo-600" : "text-slate-500"
                    }`}
                  >
                    {r === "admin" ? "業主登入" : "租客登入"}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <Field label={role === "admin" ? "Email" : "租客 ID 或 Email"}>
                  <input className="input" value={id} onChange={(e) => setId(e.target.value)} />
                </Field>
                <Field label="密碼">
                  <div className="relative">
                    <input
                      className="input pr-12"
                      type={showPw ? "text" : "password"}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && doLogin()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
                    >
                      {showPw ? "隱藏" : "顯示"}
                    </button>
                  </div>
                </Field>
                <button className="btn-primary w-full" disabled={loading} onClick={doLogin}>
                  {loading ? "登入中…" : "登入"}
                </button>
              </div>
              <div className="flex justify-between mt-4 text-sm">
                <button className="text-slate-500 hover:text-indigo-600" onClick={() => setMode("forgot")}>
                  忘記密碼？
                </button>
                {role === "admin" && (
                  <button className="text-indigo-600 font-medium" onClick={() => setMode("register")}>
                    註冊業主帳號
                  </button>
                )}
              </div>
            </>
          )}

          {mode === "register" && (
            <div className="space-y-3">
              <h2 className="font-bold text-slate-800 mb-1">註冊業主帳號</h2>
              <Field label="姓名 / 公司名稱">
                <input className="input" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} />
              </Field>
              <Field label="Email">
                <input className="input" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} />
              </Field>
              <Field label="密碼">
                <input className="input" type="password" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} />
              </Field>
              <Field label="預設幣別">
                <select className="input" value={reg.currency} onChange={(e) => setReg({ ...reg, currency: e.target.value })}>
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.symbol} value={c.symbol}>
                      {c.symbol} · {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button className="btn-primary w-full" disabled={loading} onClick={doRegister}>
                {loading ? "建立中…" : "建立帳號"}
              </button>
              <button className="text-sm text-slate-500 w-full text-center mt-1" onClick={() => setMode("login")}>
                ← 返回登入
              </button>
            </div>
          )}

          {mode === "forgot" && (
            <div className="space-y-3">
              <h2 className="font-bold text-slate-800 mb-1">忘記密碼</h2>
              <p className="text-sm text-slate-500">輸入註冊 Email，系統會寄送臨時密碼。</p>
              <Field label="Email">
                <input className="input" value={id} onChange={(e) => setId(e.target.value)} />
              </Field>
              <button className="btn-primary w-full" disabled={loading} onClick={doForgot}>
                {loading ? "處理中…" : "寄送臨時密碼"}
              </button>
              <button className="text-sm text-slate-500 w-full text-center mt-1" onClick={() => setMode("login")}>
                ← 返回登入
              </button>
            </div>
          )}

          {mode === "changePw" && (
            <div className="space-y-3">
              <h2 className="font-bold text-slate-800 mb-1">設定新密碼</h2>
              <p className="text-sm text-slate-500">帳號：{tempEmail}</p>
              <Field label="新密碼">
                <input className="input" type="password" value={np1} onChange={(e) => setNp1(e.target.value)} />
              </Field>
              <Field label="確認新密碼">
                <input className="input" type="password" value={np2} onChange={(e) => setNp2(e.target.value)} />
              </Field>
              <button className="btn-primary w-full" disabled={loading} onClick={doChangePw}>
                {loading ? "更新中…" : "更新密碼並返回登入"}
              </button>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">
          本機示範版 · 資料儲存於本機 SQLite
        </p>
      </div>
    </div>
  );
}
