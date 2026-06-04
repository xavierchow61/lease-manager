import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const exp = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!exp || exp.ownerId !== a.user.id) return fail("找不到記錄", 404);
  const b = await req.json();
  const expense = await prisma.expense.update({
    where: { id: params.id },
    data: {
      date: b.date ?? exp.date,
      category: b.category ?? exp.category,
      item: b.item ?? exp.item,
      amount: b.amount !== undefined ? num(b.amount) : exp.amount,
      relatedUnit: b.relatedUnit ?? exp.relatedUnit,
      remark: b.remark ?? exp.remark,
    },
  });
  return ok({ expense });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const exp = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!exp || exp.ownerId !== a.user.id) return fail("找不到記錄", 404);
  await prisma.expense.delete({ where: { id: params.id } });
  return ok();
}
