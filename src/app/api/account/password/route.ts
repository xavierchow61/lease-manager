import { prisma } from "@/lib/db";
import { ok, fail, authed } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/passwords";

// Change the logged-in user's password. Requires the current password —
// safer than the first-login forced reset endpoint.
export async function POST(req: Request) {
  const a = await authed();
  if ("response" in a) return a.response;
  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) return fail("請填寫目前密碼與新密碼");
  if (String(newPassword).length < 4) return fail("新密碼至少需 4 個字元");

  const account = await prisma.account.findUnique({ where: { id: a.user.id } });
  if (!account) return fail("找不到帳號", 404);

  if (!(await verifyPassword(currentPassword, account.passwordHash))) {
    return fail("目前密碼不正確");
  }

  await prisma.account.update({
    where: { id: account.id },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });
  return ok();
}
