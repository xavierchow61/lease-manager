import { prisma } from "@/lib/db";
import { ok, authed } from "@/lib/api";
import type { Prisma } from "@prisma/client";

// 維修列表不撈笨重的 base64 照片，只標記 hasPhoto；照片點開才另外載入。
const REPAIR_SELECT = {
  id: true, ownerId: true, tenantCode: true, applyDate: true,
  description: true, status: true, ownerReply: true, createdAt: true,
} as const;

async function loadRepairs(where: Prisma.RepairWhereInput) {
  const [repairs, withPhoto] = await Promise.all([
    prisma.repair.findMany({ where, orderBy: { createdAt: "desc" }, select: REPAIR_SELECT }),
    prisma.repair.findMany({ where: { ...where, photoUrl: { not: "" } }, select: { id: true } }),
  ]);
  const photoIds = new Set(withPhoto.map((r) => r.id));
  return repairs.map((r) => ({ ...r, photoUrl: "", hasPhoto: photoIds.has(r.id) }));
}

// Returns every record the current user is allowed to see, scoped by role.
export async function GET() {
  const a = await authed();
  if ("response" in a) return a.response;
  const user = a.user;

  if (user.role === "admin") {
    const [units, repairs, payments, expenses] = await Promise.all([
      prisma.unit.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" } }),
      loadRepairs({ ownerId: user.id }),
      prisma.payment.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.expense.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } }),
    ]);
    return ok({ units, repairs, payments, expenses });
  }

  // tenant: only their own unit(s) and related records
  const where = {
    ownerId: user.ownerId ?? undefined,
    tenantCode: user.tenantCode ?? "",
  };
  const [units, repairs, payments] = await Promise.all([
    prisma.unit.findMany({ where }),
    loadRepairs(where),
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" } }),
  ]);
  return ok({ units, repairs, payments, expenses: [] });
}
