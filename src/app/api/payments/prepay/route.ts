import { ok, fail, adminOnly } from "@/lib/api";
import { createPayment } from "@/lib/services";

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

// Record a prepayment (預付款) — a credit the tenant has paid in advance.
export async function POST(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;
  const b = await req.json();
  if (!b.tenantCode) return fail("請選擇租客");
  const amount = num(b.amount);
  if (amount <= 0) return fail("請輸入有效金額");

  const date = b.date || new Date().toISOString().split("T")[0];
  const payment = await createPayment({
    ownerId: owner.id,
    tenantCode: b.tenantCode,
    docCategory: "預付款",
    title: `${b.remark || "預付款"}（${date}）`,
    totalAmount: amount,
    paidAmount: amount,
    receiptDate: date,
    status: "已繳費",
    currency: b.currency || owner.currency,
  });
  return ok({ payment });
}
