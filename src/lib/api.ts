import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "./session";

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ success: true, ...data });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

/** Returns the logged-in user, or a 401 response if not authenticated. */
export async function authed(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const user = await getSession();
  if (!user) return { response: fail("尚未登入或登入已逾時", 401) };
  return { user };
}

/** Returns the logged-in admin, or an error response. */
export async function adminOnly(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const result = await authed();
  if ("response" in result) return result;
  if (result.user.role !== "admin") {
    return { response: fail("僅限業主操作", 403) };
  }
  return result;
}
