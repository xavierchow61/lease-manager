import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { createSession } from "@/lib/session";
import { hashPassword } from "@/lib/passwords";

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export async function POST(req: Request) {
  const { name, email, password, currency } = await req.json();
  if (!email || !password || !name) return fail("請填寫姓名、Email 與密碼");
  if (String(password).length < 4) return fail("密碼至少需 4 個字元");

  const existing = await prisma.account.findUnique({
    where: { email: norm(email) },
  });
  if (existing) return fail("此 Email 已經註冊過囉！");

  const account = await prisma.account.create({
    data: {
      email: norm(email),
      passwordHash: await hashPassword(password),
      name: String(name).trim(),
      role: "admin",
      tier: "Free",
      currency: currency || "HK$",
      note: "業主自行註冊",
    },
  });

  const user = {
    id: account.id,
    email: account.email,
    name: account.name,
    role: "admin" as const,
    tier: account.tier,
    currency: account.currency,
  };
  await createSession(user);
  return ok({ user });
}
