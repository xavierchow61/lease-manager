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

  const deposit = unit.deposit;
  const deduction = num(b.depositDeduction);
  const refund = deposit - deduction;
  const cur = owner.currency;
  const moveOut = b.moveOutDate || new Date().toISOString().split("T")[0];
  const name = unit.tenantName || b.tenantCode;
  const note =
    deduction > 0 && b.deductionReason
      ? `【扣除明細】${b.deductionReason}：${cur}${deduction.toFixed(2)}`
      : deduction > 0
        ? `押金扣除：${cur}${deduction.toFixed(2)}`
        : "";

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
    remark: note,
  });
  return ok({ payment, deposit, deduction, refund, currency: cur });
}
