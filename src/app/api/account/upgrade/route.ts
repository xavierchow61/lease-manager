import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { createSession } from "@/lib/session";
import { TIERS } from "@/lib/tiers";

// Demo upgrade endpoint. With no Stripe key configured we simply set the tier
// directly (so the local app is fully usable). With a real Stripe key you would
// instead create a Checkout Session and verify via webhook.
export async function POST(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;
  const { tier } = await req.json();
  if (!TIERS.includes(tier)) return fail("無效方案");

  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
  if (stripeConfigured) {
    // Placeholder: in production, return a Stripe Checkout URL here.
    return fail("Stripe 結帳尚未在本機設定，請在 .env 補上金鑰後實作 Checkout。", 501);
  }

  await prisma.account.update({
    where: { id: owner.id },
    data: { tier },
  });
  await prisma.subscriptionLog.create({
    data: { email: owner.email, plan: tier, status: "demo-升級" },
  });

  // Refresh the session so the new tier is reflected immediately.
  await createSession({ ...owner, tier });
  return ok({ tier });
}
