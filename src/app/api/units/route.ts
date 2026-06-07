import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { ensureTenantAccount } from "@/lib/services";
import { tierLimits } from "@/lib/tiers";

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;
  const body = await req.json();

  // Tier gate: limit active tenants.
  if (body.tenantCode) {
    const limit = tierLimits(owner.tier).maxTenants;
    const current = await prisma.unit.count({
      where: { ownerId: owner.id, tenantCode: { not: "" } },
    });
    if (current >= limit) {
      return fail(
        `您目前的方案最多可管理 ${limit} 位租客，請升級方案以新增更多租客。`,
        403
      );
    }
  }

  const unit = await prisma.unit.create({
    data: {
      ownerId: owner.id,
      status: body.status || (body.tenantCode ? "出租中" : "空置中"),
      tenantCode: body.tenantCode || "",
      tenantName: body.tenantName || "",
      address: body.address || "",
      email: body.email || "",
      monthlyRent: num(body.monthlyRent),
      managementFee: num(body.managementFee),
      deposit: num(body.deposit),
      leaseEndDate: body.leaseEndDate || "",
      memo: body.memo || "",
      waterRate: num(body.waterRate),
      electricRate: num(body.electricRate),
      waterUsage: num(body.waterUsage),
      electricUsage: num(body.electricUsage),
      waterReading: num(body.waterReading),
      electricReading: num(body.electricReading),
      contractFileUrl: body.contractFileUrl || "",
    },
  });

  if (body.email && body.tenantCode) {
    await ensureTenantAccount({
      ownerId: owner.id,
      email: body.email,
      tenantName: body.tenantName || "",
      tenantCode: body.tenantCode,
      currency: owner.currency,
    });
  }

  return ok({ unit });
}
