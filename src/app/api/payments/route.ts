import { ok, fail, adminOnly } from "@/lib/api";
import { createPayment } from "@/lib/services";

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

// Generic add: a single bill or receipt.
export async function POST(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;
  const b = await req.json();

  if (!b.tenantCode) return fail("請選擇租客");
  if (!b.title) return fail("請填寫項目標題");

  const isReceipt = b.docCategory === "收據";
  const total = num(b.totalAmount);
  const paid = isReceipt ? num(b.paidAmount) || total : num(b.paidAmount);
  const status =
    paid >= total && total > 0 ? "已繳費" : paid > 0 ? "部分繳費" : "未繳費";

  const payment = await createPayment({
    ownerId: owner.id,
    tenantCode: b.tenantCode,
    period: b.period,
    docCategory: b.docCategory || "帳單",
    title: b.title,
    totalAmount: total,
    paidAmount: paid,
    receiptDate: isReceipt ? b.receiptDate || "" : "",
    status: isReceipt ? "已繳費" : status,
    currency: b.currency || owner.currency,
    needEmail: !!b.sendEmail,
    remark: b.remark || "",
  });
  return ok({ payment });
}
