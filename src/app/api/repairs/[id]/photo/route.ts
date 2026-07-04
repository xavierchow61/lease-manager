import { prisma } from "@/lib/db";
import { ok, fail, authed } from "@/lib/api";

// Lazy-load a single repair's photo (kept out of the main /api/data payload).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const a = await authed();
  if ("response" in a) return a.response;
  const user = a.user;

  const repair = await prisma.repair.findUnique({
    where: { id: params.id },
    select: { ownerId: true, tenantCode: true, photoUrl: true },
  });
  if (!repair) return fail("找不到記錄", 404);

  const allowed =
    user.role === "admin"
      ? repair.ownerId === user.id
      : repair.ownerId === user.ownerId && repair.tenantCode === user.tenantCode;
  if (!allowed) return fail("無權檢視", 403);

  return ok({ photoUrl: repair.photoUrl || "" });
}
