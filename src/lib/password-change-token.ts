import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { PASSWORD_CHANGE_TOKEN_TTL_SECONDS } from "./password-policy";
import { getSessionSecret } from "./secret";

export const PASSWORD_CHANGE_PURPOSE = "password-change";

export function passwordFingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url");
}

export function fingerprintMatches(passwordHash: string, fingerprint: string): boolean {
  const actual = Buffer.from(passwordFingerprint(passwordHash));
  const claimed = Buffer.from(fingerprint);
  if (actual.length !== claimed.length) return false;
  return timingSafeEqual(actual, claimed);
}

/**
 * Short-lived bearer token for the forced reset screen.
 * Issued only after the current password has been verified. Bound to the
 * current password hash so it dies as soon as the password changes.
 * The password hash itself is never placed in the token.
 */
export async function createPasswordChangeToken(
  accountId: string,
  passwordHash: string
): Promise<string> {
  return new SignJWT({
    purpose: PASSWORD_CHANGE_PURPOSE,
    pf: passwordFingerprint(passwordHash),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accountId)
    .setIssuer("lease-manager")
    .setAudience(PASSWORD_CHANGE_PURPOSE)
    .setIssuedAt()
    .setExpirationTime(`${PASSWORD_CHANGE_TOKEN_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

export type PasswordChangeClaims = {
  accountId: string;
  passwordFingerprint: string;
};

export async function readPasswordChangeToken(
  token: string
): Promise<PasswordChangeClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
      issuer: "lease-manager",
      audience: PASSWORD_CHANGE_PURPOSE,
    });
    if (payload.purpose !== PASSWORD_CHANGE_PURPOSE) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (typeof payload.pf !== "string" || !payload.pf) return null;
    return { accountId: payload.sub, passwordFingerprint: payload.pf };
  } catch {
    return null;
  }
}
