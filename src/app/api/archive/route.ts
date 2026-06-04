import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { dateStr } from "@/lib/services";

// GET → list archived (moved-out) tenants for this owner
export async function GET() {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const records = await prisma.archivedTenant.findMany({
    where: { ownerId: a.user.id },
    orderBy: { archivedAt: "desc" },
  });
  return ok({ records });
}

// POST { unitId, moveOutDate, depositStatus, notes } → archive a tenant and
// clear their info from the unit (keeping the unit record).
export async function POST(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;
  const b = await req.json();

  const unit = await prisma.unit.findUnique({ where: { id: b.unitId } });
  if (!unit || unit.ownerId !== owner.id) return fail("找不到單位", 404);

  await prisma.archivedTenant.create({
    data: {
      ownerId: owner.id,
      tenantCode: unit.tenantCode,
      tenantName: unit.tenantName,
      address: unit.address,
      monthlyRent: unit.monthlyRent,
      deposit: unit.deposit,
      moveOutDate: b.moveOutDate || dateStr(),
      depositStatus: b.depositStatus || "未確認",
      notes: b.notes || "",
    },
  });

  await prisma.unit.update({
    where: { id: unit.id },
    data: {
      tenantCode: "",
      tenantName: "",
      email: "",
      leaseEndDate: "",
      deposit: 0,
    },
  });

  return ok();
}
