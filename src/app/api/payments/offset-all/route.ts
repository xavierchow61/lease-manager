import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { dateStr } from "@/lib/services";

// Apply a tenant's prepayment balance across ALL their outstanding bills,
// oldest first, until the balance runs out.
// Body: { tenantCode }
export async function POST(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;
  const { tenantCode } = await req.json();
  if (!tenantCode) return fail("缺少租客");

  // current balance
  const ledger = await prisma.payment.findMany({
    where: { ownerId: owner.id, tenantCode, docCategory: { in: ["預付款", "預付款抵扣"] } },
    select: { docCategory: true, paidAmount: true },
  });
  const added = ledger.filter((p) => p.docCategory === "預付款").reduce((s, p) => s + p.paidAmount, 0);
  const used = ledger.filter((p) => p.docCategory === "預付款抵扣").reduce((s, p) => s + p.paidAmount, 0);
  let balance = Math.max(added - used, 0);
  if (balance <= 0) return fail("此租客沒有可用的預付款餘額");

  // outstanding bills, oldest first
  const bills = await prisma.payment.findMany({
    where: {
      ownerId: owner.id,
      tenantCode,
      status: { not: "已繳費" },
      docCategory: { notIn: ["預付款", "預付款抵扣"] },
    },
    orderBy: [{ period: "asc" }, { createdAt: "asc" }],
  });
  if (bills.length === 0) return fail("此租客目前沒有未繳的帳單");

  let totalApplied = 0,
    count = 0;
  for (const bill of bills) {
    if (balance <= 0) break;
    const owing = Math.max(bill.totalAmount - bill.paidAmount, 0);
    if (owing <= 0) continue;
    const apply = Math.min(balance, owing);

    await prisma.payment.create({
      data: {
        ownerId: owner.id,
        tenantCode,
        createdDate: dateStr(),
        period: bill.period,
        docCategory: "預付款抵扣",
        title: `預付款抵扣 — ${bill.title}`,
        totalAmount: apply,
        paidAmount: apply,
        receiptDate: dateStr(),
        status: "已繳費",
        currency: bill.currency,
        relatedDocId: bill.id,
        remark: `自預付款餘額抵扣 ${bill.currency}${apply}`,
      },
    });
    const newPaid = bill.paidAmount + apply;
    await prisma.payment.update({
      where: { id: bill.id },
      data: {
        paidAmount: newPaid,
        status: newPaid >= bill.totalAmount ? "已繳費" : "部分繳費",
        receiptDate: bill.receiptDate || dateStr(),
      },
    });
    balance -= apply;
    totalApplied += apply;
    count++;
  }

  return ok({ count, totalApplied, remaining: balance });
}
