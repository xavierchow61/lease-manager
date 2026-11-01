/** Shared HMAC key for session cookies and short-lived auth tokens. */
export function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is not set (or too short). Check your .env file.");
  }
  return new TextEncoder().encode(secret);
}
