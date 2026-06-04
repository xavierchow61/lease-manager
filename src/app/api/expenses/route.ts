import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { tierLimits } from "@/lib/tiers";
import { dateStr } from "@/lib/services";

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;
  if (!tierLimits(owner.tier).expenses)
    return fail("財務支出為旗艦版 Max 功能，請升級方案。", 403);

  const b = await req.json();
  const expense = await prisma.expense.create({
    data: {
      ownerId: owner.id,
      date: b.date || dateStr(),
      category: b.category || "其他",
      item: b.item || "",
      amount: num(b.amount),
      relatedUnit: b.relatedUnit || "",
      remark: b.remark || "",
    },
  });
  return ok({ expense });
}
