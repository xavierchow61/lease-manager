import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { ensureTenantAccount } from "@/lib/services";

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

async function ownUnit(ownerId: string, id: string) {
  const unit = await prisma.unit.findUnique({ where: { id } });
  if (!unit || unit.ownerId !== ownerId) return null;
  return unit;
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;

  const existing = await ownUnit(owner.id, params.id);
  if (!existing) return fail("找不到對應的單位資料", 404);

  const body = await req.json();
  const unit = await prisma.unit.update({
    where: { id: params.id },
    data: {
      tenantCode: body.tenantCode ?? existing.tenantCode,
      tenantName: body.tenantName ?? existing.tenantName,
      address: body.address ?? existing.address,
      email: body.email ?? existing.email,
      monthlyRent: body.monthlyRent !== undefined ? num(body.monthlyRent) : existing.monthlyRent,
      managementFee: body.managementFee !== undefined ? num(body.managementFee) : existing.managementFee,
      deposit: body.deposit !== undefined ? num(body.deposit) : existing.deposit,
      leaseEndDate: body.leaseEndDate ?? existing.leaseEndDate,
      memo: body.memo ?? existing.memo,
      waterRate: body.waterRate !== undefined ? num(body.waterRate) : existing.waterRate,
      electricRate: body.electricRate !== undefined ? num(body.electricRate) : existing.electricRate,
      waterUsage: body.waterUsage !== undefined ? num(body.waterUsage) : existing.waterUsage,
      electricUsage: body.electricUsage !== undefined ? num(body.electricUsage) : existing.electricUsage,
      waterReading: body.waterReading !== undefined ? num(body.waterReading) : existing.waterReading,
      electricReading: body.electricReading !== undefined ? num(body.electricReading) : existing.electricReading,
      contractFileUrl: body.contractFileUrl ?? existing.contractFileUrl,
    },
  });

  // If an email was newly added to this unit, provision a tenant account.
  if (body.email && body.email !== existing.email && unit.tenantCode) {
    await ensureTenantAccount({
      ownerId: owner.id,
      email: body.email,
      tenantName: unit.tenantName,
      tenantCode: unit.tenantCode,
      currency: owner.currency,
    });
  }

  return ok({ unit });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const existing = await ownUnit(a.user.id, params.id);
  if (!existing) return fail("找不到對應的單位資料", 404);
  await prisma.unit.delete({ where: { id: params.id } });
  return ok();
}
