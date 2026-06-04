import { prisma } from "@/lib/db";
import { ok, fail, authed } from "@/lib/api";

// Returns everything needed to render a printable invoice / receipt,
// scoped so a tenant can only fetch their own documents.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const a = await authed();
  if ("response" in a) return a.response;
  const user = a.user;

  const payment = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!payment) return fail("找不到單據", 404);

  // Access control
  if (user.role === "admin") {
    if (payment.ownerId !== user.id) return fail("無權檢視此單據", 403);
  } else {
    if (payment.ownerId !== user.ownerId || payment.tenantCode !== user.tenantCode)
      return fail("無權檢視此單據", 403);
  }

  const [issuer, unit] = await Promise.all([
    prisma.account.findUnique({ where: { id: payment.ownerId } }),
    prisma.unit.findFirst({
      where: { ownerId: payment.ownerId, tenantCode: payment.tenantCode },
    }),
  ]);

  return ok({
    payment,
    issuer: { name: issuer?.name || "業主", email: issuer?.email || "" },
    tenant: {
      name: unit?.tenantName || payment.tenantCode,
      address: unit?.address || "",
      code: payment.tenantCode,
    },
  });
}
