import { prisma } from "@/lib/db";
import { ok, authed } from "@/lib/api";

// Returns every record the current user is allowed to see, scoped by role.
export async function GET() {
  const a = await authed();
  if ("response" in a) return a.response;
  const user = a.user;

  if (user.role === "admin") {
    const [units, repairs, payments, expenses] = await Promise.all([
      prisma.unit.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" } }),
      prisma.repair.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } }),
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
    prisma.repair.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" } }),
  ]);
  return ok({ units, repairs, payments, expenses: [] });
}
