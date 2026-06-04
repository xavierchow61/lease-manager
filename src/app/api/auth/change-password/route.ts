import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { hashPassword } from "@/lib/passwords";

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

// Used both for the first-login forced reset (no session yet) and voluntary
// password changes. Identified by email.
export async function POST(req: Request) {
  const { email, newPassword } = await req.json();
  if (!email || !newPassword) return fail("缺少必要參數");
  if (String(newPassword).length < 4) return fail("新密碼至少需 4 個字元");

  const account = await prisma.account.findUnique({
    where: { email: norm(email) },
  });
  if (!account) return fail("找不到該帳號，無法更新密碼");

  await prisma.account.update({
    where: { id: account.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
    },
  });
  return ok();
}
