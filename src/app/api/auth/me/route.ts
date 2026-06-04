import { prisma } from "@/lib/db";
import { ok } from "@/lib/api";
import { getSession } from "@/lib/session";

// Returns the current session user, re-reading the live tier from the DB so an
// upgrade is reflected without forcing a re-login.
export async function GET() {
  const user = await getSession();
  if (!user) return ok({ user: null });

  if (user.role === "admin") {
    const account = await prisma.account.findUnique({ where: { id: user.id } });
    if (account) user.tier = account.tier;
  }
  return ok({ user });
}
