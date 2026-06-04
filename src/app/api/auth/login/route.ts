import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { createSession } from "@/lib/session";
import { verifyPassword } from "@/lib/passwords";

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export async function POST(req: Request) {
  const { role, id, password } = await req.json();
  if (!id || !password) return fail("請輸入帳號與密碼");

  if (role === "admin") {
    const account = await prisma.account.findFirst({
      where: { email: norm(id), role: "admin" },
    });
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      return fail("業主帳號或密碼錯誤");
    }
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

  if (role === "tenant") {
    // Tenants may log in with either their email or their tenant code.
    const idNorm = norm(id);
    let account = await prisma.account.findFirst({
      where: { email: idNorm, role: "tenant" },
    });
    if (!account) {
      account = await prisma.account.findFirst({
        where: { role: "tenant", linkedTenantId: String(id).trim() },
      });
    }
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      return fail("租客 ID / Email 或密碼錯誤");
    }

    if (account.mustChangePassword) {
      return ok({ requirePasswordChange: true, tempEmail: account.email });
    }

    // Inherit the owner's currency so the tenant view matches the bills.
    let currency = account.currency;
    if (account.ownerId) {
      const owner = await prisma.account.findUnique({
        where: { id: account.ownerId },
      });
      if (owner) currency = owner.currency;
    }

    const user = {
      id: account.id,
      email: account.email,
      name: account.name,
      role: "tenant" as const,
      tier: "Free",
      currency,
      ownerId: account.ownerId ?? undefined,
      tenantCode: account.linkedTenantId ?? undefined,
    };
    await createSession(user);
    return ok({ user });
  }

  return fail("未知的角色");
}
