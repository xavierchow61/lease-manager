import { prisma } from "@/lib/db";
import { ok, fail, authed } from "@/lib/api";
import { createSession } from "@/lib/session";
import { CURRENCY_OPTIONS } from "@/lib/money";

// Update the logged-in user's profile (display name + default currency).
// Refreshes the session cookie so the change is reflected immediately.
export async function PUT(req: Request) {
  const a = await authed();
  if ("response" in a) return a.response;
  const user = a.user;
  const b = await req.json();

  const data: { name?: string; currency?: string } = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (typeof b.currency === "string") {
    const valid = CURRENCY_OPTIONS.some((c) => c.symbol === b.currency);
    if (!valid) return fail("不支援的貨幣單位");
    // currency is only meaningful for owners (tenants inherit the owner's)
    if (user.role === "admin") data.currency = b.currency;
  }
  if (!data.name && !data.currency) return fail("沒有要更新的內容");

  const account = await prisma.account.update({ where: { id: user.id }, data });

  const updated = {
    ...user,
    name: account.name,
    currency: user.role === "admin" ? account.currency : user.currency,
  };
  await createSession(updated);
  return ok({ user: updated });
}
