import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { dateStr } from "@/lib/services";

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

async function ownPayment(ownerId: string, id: string) {
  const p = await prisma.payment.findUnique({ where: { id } });
  if (!p || p.ownerId !== ownerId) return null;
  return p;
}

// PUT handles both "mark status" and "record partial payment".
// Body: { action: "status", status } | { action: "partial", amount, date }
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const p = await ownPayment(a.user.id, params.id);
  if (!p) return fail("找不到記錄", 404);

  const body = await req.json();

  if (body.action === "edit") {
    // Full edit of a single document. Status is recomputed from amounts.
    const total = body.totalAmount !== undefined ? num(body.totalAmount) : p.totalAmount;
    // 已付永遠不超過總額，避免出現「已付 > 發票金額」
    const paid = Math.min(body.paidAmount !== undefined ? num(body.paidAmount) : p.paidAmount, total);
    const status = paid >= total && total > 0 ? "已繳費" : paid > 0 ? "部分繳費" : "未繳費";
    const updated = await prisma.payment.update({
      where: { id: p.id },
      data: {
        tenantCode: body.tenantCode ?? p.tenantCode,
        docCategory: body.docCategory ?? p.docCategory,
        title: body.title ?? p.title,
        period: body.period ?? p.period,
        totalAmount: total,
        paidAmount: paid,
        receiptDate: body.receiptDate ?? p.receiptDate,
        currency: body.currency ?? p.currency,
        remark: body.remark ?? p.remark,
        status,
      },
    });
    return ok({ payment: updated });
  }

  if (body.action === "partial") {
    // 本次收款最多補到「尚欠」為止，已付不超過總額
    const owing = Math.max(p.totalAmount - p.paidAmount, 0);
    const add = Math.min(num(body.amount), owing);
    const newPaid = p.paidAmount + add;
    const status =
      newPaid >= p.totalAmount ? "已繳費" : newPaid > 0 ? "部分繳費" : "未繳費";
    const updated = await prisma.payment.update({
      where: { id: p.id },
      data: { paidAmount: newPaid, status, receiptDate: body.date || dateStr() },
    });
    return ok({ payment: updated, applied: add });
  }

  // default: set status; 標記繳清 → 已付補到總額（即使原本已部分繳費），收齊餘額
  const status = body.status || p.status;
  const data: Record<string, unknown> = { status };
  if (status === "已繳費") {
    if (p.paidAmount < p.totalAmount) data.paidAmount = p.totalAmount;
    if (!p.receiptDate) data.receiptDate = dateStr();
  }
  const updated = await prisma.payment.update({ where: { id: p.id }, data });
  return ok({ payment: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const p = await ownPayment(a.user.id, params.id);
  if (!p) return fail("找不到記錄", 404);
  await prisma.payment.delete({ where: { id: p.id } });
  return ok();
}
