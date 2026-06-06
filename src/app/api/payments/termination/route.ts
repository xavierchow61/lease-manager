import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { createPayment } from "@/lib/services";

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

// Lease termination settlement: refund = deposit − deductions.
// Body: { tenantCode, moveOutDate, depositDeduction, deductionReason }
export async function POST(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;
  const b = await req.json();

  const unit = await prisma.unit.findFirst({
    where: { ownerId: owner.id, tenantCode: b.tenantCode },
  });
  if (!unit) return fail("找不到租客資料");

  const cur = owner.currency;
  const deposit = unit.deposit;
  const extraDeduction = num(b.depositDeduction); // 額外扣除（清潔/維修/損壞等）

  // 該租客尚欠的帳款（未繳/部分繳費，排除預付款相關）
  const bills = await prisma.payment.findMany({
    where: {
      ownerId: owner.id,
      tenantCode: b.tenantCode,
      status: { not: "已繳費" },
      docCategory: { notIn: ["預付款", "預付款抵扣", "退租收據", "退租帳單"] },
    },
  });
  const owing = bills.reduce((s, p) => s + Math.max(p.totalAmount - p.paidAmount, 0), 0);

  // 應退押金 = 押金 − 尚欠欠款 − 額外扣除
  const totalDeduction = owing + extraDeduction;
  const refund = deposit - totalDeduction;
  const moveOut = b.moveOutDate || new Date().toISOString().split("T")[0];
  const name = unit.tenantName || b.tenantCode;

  const lines = [
    `押金：${cur}${deposit.toFixed(2)}`,
    owing > 0 ? `扣：尚欠帳款 ${cur}${owing.toFixed(2)}` : "",
    extraDeduction > 0 ? `扣：${b.deductionReason || "其他扣除"} ${cur}${extraDeduction.toFixed(2)}` : "",
    `${refund >= 0 ? "應退租客" : "租客尚需補繳"}：${cur}${Math.abs(refund).toFixed(2)}`,
  ].filter(Boolean);

  const payment = await createPayment({
    ownerId: owner.id,
    tenantCode: b.tenantCode,
    docCategory: refund >= 0 ? "退租收據" : "退租帳單",
    title: `${name} — 退租結算單`,
    totalAmount: deposit,
    paidAmount: refund > 0 ? refund : 0,
    receiptDate: moveOut,
    status: refund >= deposit ? "已繳費" : refund > 0 ? "部分繳費" : "未繳費",
    currency: cur,
    remark: lines.join("\n"),
  });
  return ok({ payment, deposit, owing, extraDeduction, refund, currency: cur });
}
