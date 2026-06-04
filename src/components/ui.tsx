"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";

// ── Toast ────────────────────────────────────────────────────────
type ToastType = "info" | "success" | "error";
type ToastCtx = (msg: string, type?: ToastType) => void;
const ToastContext = createContext<ToastCtx>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const show = useCallback((msg: string, type: ToastType = "info") => {
    setToast({ msg, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const color =
    toast?.type === "success"
      ? "bg-emerald-600"
      : toast?.type === "error"
        ? "bg-red-600"
        : "bg-slate-800";

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] ${color} text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg max-w-[90vw]`}
        >
          {toast.msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// ── Modal ────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full ${wide ? "md:max-w-3xl" : "md:max-w-lg"} rounded-t-2xl md:rounded-2xl shadow-xl max-h-[92vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="text-slate-400 hover:text-slate-700 w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-slate-100 flex gap-2 justify-end shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── small helpers ─────────────────────────────────────────────────
export function Stat({
  label,
  value,
  sub,
  valueClass = "text-indigo-600",
}: {
  label: string;
  value: string | number;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 tnum ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
