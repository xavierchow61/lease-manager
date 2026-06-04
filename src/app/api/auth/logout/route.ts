import { ok } from "@/lib/api";
import { clearSession } from "@/lib/session";

export async function POST() {
  clearSession();
  return ok();
}
