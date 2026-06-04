"use client";

import { Building2, Lock, LogOut, type LucideIcon } from "lucide-react";
import { type User } from "@/lib/client";

export type Tab = { key: string; label: string; icon: LucideIcon; locked?: boolean };

export default function Shell({
  user,
  tabs,
  active,
  setActive,
  onLogout,
  children,
}: {
  user: User;
  tabs: Tab[];
  active: string;
  setActive: (k: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 bg-white border-r border-slate-200 p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-2 mb-7">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
            <Building2 size={18} />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm leading-tight">物業管理 Pro</div>
            <div className="text-[11px] text-slate-500">{user.role === "admin" ? "業主後台" : "租客中心"}</div>
          </div>
        </div>
        <nav className="space-y-1 flex-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                active === t.key ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <t.icon size={18} strokeWidth={active === t.key ? 2.4 : 2} />
              {t.label}
              {t.locked && <Lock size={12} className="ml-auto text-slate-400" />}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-200 pt-3 mt-3">
          <div className="px-2 text-xs text-slate-600 truncate font-medium">{user.name || user.email}</div>
          {user.role === "admin" && (
            <div className="px-2 mt-1">
              <span className="badge badge-indigo">{user.tier} 方案</span>
            </div>
          )}
          <button onClick={onLogout} className="btn-ghost btn-sm w-full mt-3 justify-start gap-2">
            <LogOut size={15} /> 登出
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-24 md:pb-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Building2 size={16} />
            </div>
            <span className="font-bold text-slate-800">{tabs.find((t) => t.key === active)?.label}</span>
          </div>
          <button onClick={onLogout} className="text-sm text-slate-500 flex items-center gap-1">
            <LogOut size={15} /> 登出
          </button>
        </header>

        <div className="max-w-5xl mx-auto">{children}</div>
      </main>

      {/* Mobile bottom nav (horizontally scrollable so all tabs stay reachable) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex overflow-x-auto hide-scrollbar pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`flex-1 min-w-[60px] py-2 flex flex-col items-center gap-1 text-[11px] ${
              active === t.key ? "text-indigo-600" : "text-slate-400"
            }`}
          >
            <t.icon size={20} strokeWidth={active === t.key ? 2.4 : 2} />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
