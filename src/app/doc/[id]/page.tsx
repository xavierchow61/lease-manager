"use client";

import { useEffect, useState } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import { api } from "@/lib/client";
import { fmtNum } from "@/lib/money";

type DocData = {
  payment: {
    id: string;
    docCategory: string;
    title: string;
    totalAmount: number;
    paidAmount: number;
    status: string;
    period: string;
    createdDate: string;
    receiptDate: string;
    currency: string;
    invoiceNumber: string;
    remark: string;
  };
  issuer: { name: string; email: string };
  tenant: { name: string; address: string; code: string };
};

export default function DocPage({ params }: { params: { id: string } }) {
  const [doc, setDoc] = useState<DocData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const r = await api<DocData>(`payments/${params.id}/document`);
      if (r.success) setDoc({ payment: r.payment, issuer: r.issuer, tenant: r.tenant });
      else setError(r.message || "載入失敗");
    })();
  }, [params.id]);

  if (error)
    return <div className="min-h-screen flex items-center justify-center text-slate-500">{error}</div>;
  if (!doc)
    return <div className="min-h-screen flex items-center justify-center text-slate-400">載入中…</div>;

  const p = doc.payment;
  const cur = p.currency;
  const owing = Math.max(p.totalAmount - p.paidAmount, 0);
  const isReceipt = p.docCategory.includes("收據");
  const docLabel = isReceipt ? "收　據 RECEIPT" : "帳　單 INVOICE";

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Toolbar (hidden when printing) */}
      <div className="print:hidden sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => window.close()} className="btn-ghost btn-sm gap-1.5">
          <ArrowLeft size={15} /> 關閉
        </button>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-primary btn-sm gap-1.5">
            <Printer size={15} /> 列印 / 存成 PDF
          </button>
        </div>
      </div>

      {/* A4-ish paper */}
      <div className="mx-auto my-6 print:my-0 bg-white shadow-lg print:shadow-none max-w-[800px] p-10 md:p-14 print:p-10">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-5">
          <div>
            <div className="text-2xl font-bold text-slate-900">{doc.issuer.name}</div>
            {doc.issuer.email && <div className="text-sm text-slate-500 mt-1">{doc.issuer.email}</div>}
            <div className="text-xs text-slate-400 mt-2">物業管理系統</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold tracking-widest text-slate-800">{docLabel}</div>
            <div className="text-sm text-slate-500 mt-2">單號：{p.invoiceNumber || p.id.slice(-8).toUpperCase()}</div>
            <div className="text-sm text-slate-500">開立日期：{p.createdDate || "—"}</div>
            {isReceipt && p.receiptDate && (
              <div className="text-sm text-slate-500">收款日期：{p.receiptDate}</div>
            )}
          </div>
        </div>

        {/* Bill to */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div>
            <div className="text-xs text-slate-400 uppercase">收件人 / Bill To</div>
            <div className="font-semibold text-slate-800 mt-1">{doc.tenant.name}</div>
            <div className="text-sm text-slate-500">{doc.tenant.address}</div>
            <div className="text-sm text-slate-400">租客編號：{doc.tenant.code}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400 uppercase">款項期間 / Period</div>
            <div className="font-semibold text-slate-800 mt-1">{p.period || "—"}</div>
            <div className="mt-2">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  p.status === "已繳費"
                    ? "bg-emerald-100 text-emerald-700"
                    : p.status === "部分繳費"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {p.status}
              </span>
            </div>
          </div>
        </div>

        {/* Line items */}
        <table className="w-full mt-8 text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 text-slate-500">
              <th className="text-left py-2 font-medium">項目 Description</th>
              <th className="text-right py-2 font-medium">金額 Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-3 text-slate-800">{p.title}</td>
              <td className="py-3 text-right text-slate-800">{cur} {fmtNum(p.totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-6">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">總金額 Total</span>
              <span className="font-medium text-slate-800">{cur} {fmtNum(p.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">已付 Paid</span>
              <span className="font-medium text-slate-800">{cur} {fmtNum(p.paidAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-1">
              <span className="font-semibold text-slate-800">尚欠 Balance</span>
              <span className={`font-bold text-lg ${owing > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {cur} {fmtNum(owing)}
              </span>
            </div>
          </div>
        </div>

        {p.remark && (
          <div className="mt-8 text-sm text-slate-500 border-t border-slate-100 pt-4 whitespace-pre-line">
            <span className="font-medium text-slate-600">備註：</span>
            {p.remark}
          </div>
        )}

        <div className="mt-12 text-center text-xs text-slate-400 border-t border-slate-100 pt-4">
          本單據由物業管理系統產生 · 列印時間 {p.createdDate}
        </div>
      </div>
    </div>
  );
}
