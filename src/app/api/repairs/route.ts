import { prisma } from "@/lib/db";
import { ok, fail, authed } from "@/lib/api";
import { dateStr } from "@/lib/services";

// Create a repair request. Tenants file for their own unit; admins may file on
// behalf of a tenant by passing tenantCode.
export async function POST(req: Request) {
  const a = await authed();
  if ("response" in a) return a.response;
  const user = a.user;
  const body = await req.json();

  let ownerId: string;
  let tenantCode: string;

  if (user.role === "tenant") {
    ownerId = user.ownerId ?? "";
    tenantCode = user.tenantCode ?? "";
  } else {
    ownerId = user.id;
    tenantCode = body.tenantCode || "";
    // Resolve ownerId from the unit if filing on behalf.
    if (tenantCode) {
      const unit = await prisma.unit.findFirst({
        where: { ownerId: user.id, tenantCode },
      });
      if (unit) ownerId = unit.ownerId;
    }
  }

  if (!body.description) return fail("請填寫維修事項描述");

  // Photo (optional) is stored inline as a data URL — fine for local use.
  const photoUrl =
    typeof body.photoDataUrl === "string" && body.photoDataUrl.startsWith("data:")
      ? body.photoDataUrl
      : "";

  const repair = await prisma.repair.create({
    data: {
      ownerId,
      tenantCode,
      applyDate: body.applyDate || dateStr(),
      description: body.description,
      photoUrl,
      status: "處理中",
    },
  });
  return ok({ repair });
}
