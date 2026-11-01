import { hashPassword, verifyPassword } from "./passwords";
import { MIN_PASSWORD_LENGTH } from "./password-policy";
import { fingerprintMatches, readPasswordChangeToken } from "./password-change-token";

export type PasswordChangeAccount = {
  id: string;
  passwordHash: string;
  mustChangePassword: boolean;
};

export type PasswordUpdate = {
  id: string;
  passwordHash: string;
  mustChangePassword: false;
};

export type PasswordChangeDeps = {
  findAccount: (id: string) => Promise<PasswordChangeAccount | null>;
  save: (update: PasswordUpdate) => Promise<void>;
};

export type PasswordChangeResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

/**
 * Forced password reset (first login / post forgot-password).
 * Email is intentionally not an input: knowing an address must not select an account.
 * A valid call needs a short-lived token from login plus the current password.
 */
export async function changePasswordWithToken(
  body: unknown,
  deps: PasswordChangeDeps
): Promise<PasswordChangeResult> {
  const record = asRecord(body);
  if (!record) return { ok: false, status: 400, message: "缺少必要參數" };

  const token = typeof record.passwordChangeToken === "string" ? record.passwordChangeToken.trim() : "";
  const currentPassword = typeof record.currentPassword === "string" ? record.currentPassword : "";
  const newPassword = typeof record.newPassword === "string" ? record.newPassword : "";

  if (!token) return { ok: false, status: 401, message: "需要有效的密碼重設憑證" };

  const claims = await readPasswordChangeToken(token);
  if (!claims) return { ok: false, status: 401, message: "密碼重設憑證無效或已過期" };

  if (!currentPassword || !newPassword) {
    return { ok: false, status: 400, message: "請填寫目前密碼與新密碼" };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, status: 400, message: `新密碼至少需 ${MIN_PASSWORD_LENGTH} 個字元` };
  }

  const account = await deps.findAccount(claims.accountId);
  if (!account) return { ok: false, status: 404, message: "找不到帳號" };
  // Hash binding is checked first so a used or superseded token is rejected
  // even if the forced-reset flag was already cleared.
  if (!fingerprintMatches(account.passwordHash, claims.passwordFingerprint)) {
    return { ok: false, status: 401, message: "密碼重設憑證已失效" };
  }
  if (!account.mustChangePassword) {
    return { ok: false, status: 403, message: "此憑證無法用於變更密碼" };
  }
  if (!(await verifyPassword(currentPassword, account.passwordHash))) {
    return { ok: false, status: 401, message: "目前密碼不正確" };
  }

  await deps.save({
    id: account.id,
    passwordHash: await hashPassword(newPassword),
    mustChangePassword: false,
  });
  return { ok: true };
}
