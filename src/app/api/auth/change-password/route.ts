import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { changePasswordWithToken } from "@/lib/password-change";

function noStore<T extends Response>(res: T): T {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// Forced reset after first login or forgot-password.
// Requires the short-lived token from POST /api/auth/login (issued only after
// the current password was verified) plus that current password.
// Email alone is not accepted. Logged-in voluntary changes use
// POST /api/account/password (session + current password).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return noStore(fail("缺少必要參數"));
  }

  const result = await changePasswordWithToken(body, {
    findAccount: (id) => prisma.account.findUnique({ where: { id } }),
    save: ({ id, passwordHash, mustChangePassword }) =>
      prisma.account
        .update({
          where: { id },
          data: { passwordHash, mustChangePassword },
        })
        .then(() => undefined),
  });

  if (!result.ok) return noStore(fail(result.message, result.status));
  return noStore(ok());
}
