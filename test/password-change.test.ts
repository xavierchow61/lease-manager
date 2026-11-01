import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeJwt, SignJWT } from "jose";
import { hashPassword, verifyPassword } from "../src/lib/passwords";
import { MIN_PASSWORD_LENGTH, PASSWORD_CHANGE_TOKEN_TTL_SECONDS } from "../src/lib/password-policy";
import { changePasswordWithToken, type PasswordUpdate } from "../src/lib/password-change";
import {
  createPasswordChangeToken,
  fingerprintMatches,
  passwordFingerprint,
  readPasswordChangeToken,
} from "../src/lib/password-change-token";
import { getSessionSecret } from "../src/lib/secret";

process.env.SESSION_SECRET ||= "test-session-secret-at-least-32-characters-long";

const ACCOUNT_ID = "acc_victim";
const CURRENT = "Temp1234";
const EMAIL = "owner@demo.com";

async function issue(passwordHash: string, accountId = ACCOUNT_ID) {
  return createPasswordChangeToken(accountId, passwordHash);
}

test("password policy stays at least 4 characters", () => {
  assert.ok(MIN_PASSWORD_LENGTH >= 4);
  assert.equal(PASSWORD_CHANGE_TOKEN_TTL_SECONDS, 10 * 60);
});

test("token is short-lived, bound to the password hash, and does not contain the hash", async () => {
  const passwordHash = await hashPassword(CURRENT);
  const token = await issue(passwordHash);
  const decoded = decodeJwt(token);

  assert.equal(decoded.sub, ACCOUNT_ID);
  assert.equal(decoded.purpose, "password-change");
  const ttl = decoded.exp! - decoded.iat!;
  assert.ok(ttl >= PASSWORD_CHANGE_TOKEN_TTL_SECONDS - 1 && ttl <= PASSWORD_CHANGE_TOKEN_TTL_SECONDS + 1);
  assert.equal(decoded.pf, passwordFingerprint(passwordHash));
  assert.equal(token.includes(passwordHash), false);
  assert.equal(token.includes("$"), false);

  const claims = await readPasswordChangeToken(token);
  assert.equal(claims?.accountId, ACCOUNT_ID);
  assert.equal(fingerprintMatches(passwordHash, claims!.passwordFingerprint), true);
  assert.equal(fingerprintMatches(passwordHash + "x", claims!.passwordFingerprint), false);
});

test("session cookies and expired or tampered tokens are not password-change tokens", async () => {
  const passwordHash = await hashPassword(CURRENT);
  const sessionToken = await new SignJWT({
    user: { id: ACCOUNT_ID, email: EMAIL, role: "admin" },
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());
  assert.equal(await readPasswordChangeToken(sessionToken), null);

  const expired = await new SignJWT({
    purpose: "password-change",
    pf: passwordFingerprint(passwordHash),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(ACCOUNT_ID)
    .setIssuer("lease-manager")
    .setAudience("password-change")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(getSessionSecret());
  assert.equal(await readPasswordChangeToken(expired), null);

  const token = await issue(passwordHash);
  const flipped = token.slice(0, -2) + (token.endsWith("a") ? "b" : "a");
  assert.equal(await readPasswordChangeToken(flipped), null);
});

test("email and newPassword alone cannot change any password", async () => {
  let finds = 0;
  let saves = 0;
  const result = await changePasswordWithToken(
    { email: EMAIL, newPassword: "hacked-password" },
    {
      findAccount: async () => {
        finds += 1;
        return { id: ACCOUNT_ID, passwordHash: "hash", mustChangePassword: true };
      },
      save: async () => {
        saves += 1;
      },
    }
  );

  assert.deepEqual(result, { ok: false, status: 401, message: "需要有效的密碼重設憑證" });
  assert.equal(finds, 0);
  assert.equal(saves, 0);
});

test("a valid token changes only that account and clears the forced-reset flag", async () => {
  let passwordHash = await hashPassword(CURRENT);
  const token = await issue(passwordHash);
  const saves: PasswordUpdate[] = [];
  const lookedUp: string[] = [];

  const deps = {
    findAccount: async (id: string) => {
      lookedUp.push(id);
      return { id, passwordHash, mustChangePassword: true as const };
    },
    save: async (update: PasswordUpdate) => {
      saves.push(update);
      passwordHash = update.passwordHash;
    },
  };

  const result = await changePasswordWithToken(
    {
      email: "someone-else@example.com",
      passwordChangeToken: token,
      currentPassword: CURRENT,
      newPassword: "New1234",
    },
    deps
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(lookedUp, [ACCOUNT_ID]);
  assert.equal(saves.length, 1);
  assert.equal(saves[0].id, ACCOUNT_ID);
  assert.equal(saves[0].mustChangePassword, false);
  assert.equal(await verifyPassword("New1234", saves[0].passwordHash), true);
  assert.equal(await verifyPassword(CURRENT, saves[0].passwordHash), false);

  const replay = await changePasswordWithToken(
    {
      email: EMAIL,
      passwordChangeToken: token,
      currentPassword: CURRENT,
      newPassword: "Other1234",
    },
    deps
  );
  assert.deepEqual(replay, { ok: false, status: 401, message: "密碼重設憑證已失效" });
  assert.equal(saves.length, 1);
});

test("wrong current password, disabled flag, or a short new password does not save", async () => {
  const passwordHash = await hashPassword(CURRENT);
  const token = await issue(passwordHash);
  let saves = 0;
  const save = async () => {
    saves += 1;
  };

  const wrong = await changePasswordWithToken(
    { passwordChangeToken: token, currentPassword: "nope-nope", newPassword: "New1234" },
    {
      findAccount: async (id) => ({ id, passwordHash, mustChangePassword: true }),
      save,
    }
  );
  assert.deepEqual(wrong, { ok: false, status: 401, message: "目前密碼不正確" });

  const notForced = await changePasswordWithToken(
    { passwordChangeToken: token, currentPassword: CURRENT, newPassword: "New1234" },
    {
      findAccount: async (id) => ({ id, passwordHash, mustChangePassword: false }),
      save,
    }
  );
  assert.deepEqual(notForced, { ok: false, status: 403, message: "此憑證無法用於變更密碼" });

  let finds = 0;
  const tooShort = await changePasswordWithToken(
    { passwordChangeToken: token, currentPassword: CURRENT, newPassword: "abc" },
    {
      findAccount: async () => {
        finds += 1;
        return { id: ACCOUNT_ID, passwordHash, mustChangePassword: true };
      },
      save,
    }
  );
  assert.equal(tooShort.ok, false);
  if (!tooShort.ok) assert.equal(tooShort.status, 400);
  assert.equal(finds, 0);
  assert.equal(saves, 0);
});

test("a 4 character password is still accepted", async () => {
  const passwordHash = await hashPassword(CURRENT);
  const token = await issue(passwordHash, "acc_min");
  let saved = false;
  const result = await changePasswordWithToken(
    { passwordChangeToken: token, currentPassword: CURRENT, newPassword: "abcd" },
    {
      findAccount: async (id) => ({ id, passwordHash, mustChangePassword: true }),
      save: async (update) => {
        saved = update.mustChangePassword === false && update.id === "acc_min";
        assert.equal(await verifyPassword("abcd", update.passwordHash), true);
      },
    }
  );
  assert.deepEqual(result, { ok: true });
  assert.equal(saved, true);
});

test("unknown account and junk token do not write", async () => {
  const passwordHash = await hashPassword(CURRENT);
  const token = await issue(passwordHash, "missing_account");
  let saves = 0;

  const missing = await changePasswordWithToken(
    { passwordChangeToken: token, currentPassword: CURRENT, newPassword: "New1234" },
    {
      findAccount: async () => null,
      save: async () => {
        saves += 1;
      },
    }
  );
  assert.deepEqual(missing, { ok: false, status: 404, message: "找不到帳號" });

  let finds = 0;
  const junk = await changePasswordWithToken(
    { email: EMAIL, passwordChangeToken: "not-a-token", newPassword: "hacked-password" },
    {
      findAccount: async () => {
        finds += 1;
        return null;
      },
      save: async () => {
        saves += 1;
      },
    }
  );
  assert.deepEqual(junk, { ok: false, status: 401, message: "密碼重設憑證無效或已過期" });
  assert.equal(finds, 0);
  assert.equal(saves, 0);
});
