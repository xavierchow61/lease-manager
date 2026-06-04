import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { dateStr } from "@/lib/services";

// Apply a tenant's available prepayment balance against a specific bill.
// Balance = Σ(預付款 paidAmount) − Σ(預付款抵扣 paidAmount).
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;

  const bill = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!bill || bill.ownerId !== owner.id) return fail("找不到單據", 404);
  if (bill.status === "已繳費") return fail("此單據已繳清，無需抵扣");

  const owing = Math.max(bill.totalAmount - bill.paidAmount, 0);
  if (owing <= 0) return fail("此單據已無欠款");

  // Compute the tenant's current prepayment balance.
  const ledger = await prisma.payment.findMany({
    where: { ownerId: owner.id, tenantCode: bill.tenantCode, docCategory: { in: ["預付款", "預付款抵扣"] } },
    select: { docCategory: true, paidAmount: true },
  });
  const added = ledger.filter((p) => p.docCategory === "預付款").reduce((s, p) => s + p.paidAmount, 0);
  const used = ledger.filter((p) => p.docCategory === "預付款抵扣").reduce((s, p) => s + p.paidAmount, 0);
  const balance = Math.max(added - used, 0);
  if (balance <= 0) return fail("此租客沒有可用的預付款餘額");

  // Optional explicit amount; default to the most we can apply.
  const body = await req.json().catch(() => ({}));
  const requested = body?.amount != null ? Math.max(parseFloat(String(body.amount)) || 0, 0) : Infinity;
  const applied = Math.min(balance, owing, requested);
  if (applied <= 0) return fail("可抵扣金額為 0");

  // 1) record the deduction (consumes balance)
  await prisma.payment.create({
    data: {
      ownerId: owner.id,
      tenantCode: bill.tenantCode,
      createdDate: dateStr(),
      period: bill.period,
      docCategory: "預付款抵扣",
      title: `預付款抵扣 — ${bill.title}`,
      totalAmount: applied,
      paidAmount: applied,
      receiptDate: dateStr(),
      status: "已繳費",
      currency: bill.currency,
      relatedDocId: bill.id,
      remark: `自預付款餘額抵扣 ${bill.currency}${applied}`,
    },
  });

  // 2) credit the bill
  const newPaid = bill.paidAmount + applied;
  const status = newPaid >= bill.totalAmount ? "已繳費" : newPaid > 0 ? "部分繳費" : "未繳費";
  const updated = await prisma.payment.update({
    where: { id: bill.id },
    data: { paidAmount: newPaid, status, receiptDate: bill.receiptDate || dateStr() },
  });

  return ok({ payment: updated, applied, balance: balance - applied });
}
