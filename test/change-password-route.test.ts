import assert from "node:assert/strict";
import { test } from "node:test";

process.env.SESSION_SECRET ||= "test-session-secret-at-least-32-characters-long";
process.env.DATABASE_URL ||= "postgresql://user:pass@127.0.0.1:1/lease?connect_timeout=1";
process.env.DIRECT_URL ||= process.env.DATABASE_URL;

async function post(body: unknown) {
  const { POST } = await import("../src/app/api/auth/change-password/route");
  return POST(
    new Request("http://localhost/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

test("POST /api/auth/change-password rejects email + newPassword with 401", async () => {
  const res = await post({ email: "owner@demo.com", newPassword: "hacked-password" });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const json = await res.json();
  assert.equal(json.success, false);
  assert.equal(json.message, "需要有效的密碼重設憑證");
});

test("POST /api/auth/change-password rejects a forged token before any account lookup", async () => {
  const res = await post({
    email: "tenant@demo.com",
    passwordChangeToken: "forged",
    currentPassword: "demo1234",
    newPassword: "hacked-password",
  });
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.success, false);
  assert.equal(json.message, "密碼重設憑證無效或已過期");
});

test("POST /api/auth/change-password rejects a body that is not JSON", async () => {
  const { POST } = await import("../src/app/api/auth/change-password/route");
  const res = await POST(
    new Request("http://localhost/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    })
  );
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.success, false);
});
