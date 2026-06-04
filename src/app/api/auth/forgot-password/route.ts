import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { hashPassword, randomPassword } from "@/lib/passwords";
import { sendMail } from "@/lib/email";

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

// Security improvement over the original: we never email an existing password.
// Instead we generate a temporary password, store its hash, and flag the
// account so the user is forced to reset on next login.
export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return fail("請輸入 Email");

  const account = await prisma.account.findUnique({
    where: { email: norm(email) },
  });
  if (!account) return fail("找不到此信箱對應的帳號");

  const tempPw = randomPassword(10);
  await prisma.account.update({
    where: { id: account.id },
    data: { passwordHash: await hashPassword(tempPw), mustChangePassword: true },
  });

  await sendMail({
    to: account.email,
    subject: "[物業管理系統] 密碼重設通知",
    body:
      `親愛的 ${account.name} 您好：\n\n` +
      `您申請了密碼重設。以下是您的臨時密碼：\n\n` +
      `臨時密碼：${tempPw}\n\n` +
      `請使用此臨時密碼登入，登入後系統將立即要求您設定新密碼。\n` +
      `若非本人操作，請忽略此郵件。\n\n-- 系統自動發送 --`,
  });

  return ok();
}
