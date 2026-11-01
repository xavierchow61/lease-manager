import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getSessionSecret } from "./secret";

const COOKIE_NAME = "lease_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: string; // Account.id
  email: string;
  name: string;
  role: "admin" | "tenant";
  tier: string;
  currency: string;
  ownerId?: string; // tenant: owning admin's Account.id
  tenantCode?: string; // tenant: business tenant code
};

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSessionSecret());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return (payload.user as SessionUser) ?? null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  cookies().delete(COOKIE_NAME);
}

/** Throws-style helper for API routes: returns the user or null. */
export async function requireUser(): Promise<SessionUser | null> {
  return getSession();
}
