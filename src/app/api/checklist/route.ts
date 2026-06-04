import { prisma } from "@/lib/db";
import { ok, adminOnly } from "@/lib/api";
import { dateStr } from "@/lib/services";

// GET ?tenantCode=&type=入住|退住  → fetch a saved checklist
export async function GET(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const { searchParams } = new URL(req.url);
  const tenantCode = searchParams.get("tenantCode") || "";
  const type = searchParams.get("type") || "入住";
  const row = await prisma.checklist.findUnique({
    where: {
      ownerId_tenantCode_type: { ownerId: a.user.id, tenantCode, type },
    },
  });
  return ok({
    items: row ? JSON.parse(row.itemsJson) : null,
    savedDate: row?.savedDate ?? null,
  });
}

// POST { tenantCode, type, items } → upsert a checklist
export async function POST(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const { tenantCode, type, items } = await req.json();
  const itemsJson = JSON.stringify(items ?? []);
  await prisma.checklist.upsert({
    where: {
      ownerId_tenantCode_type: { ownerId: a.user.id, tenantCode, type },
    },
    create: { ownerId: a.user.id, tenantCode, type, itemsJson, savedDate: dateStr() },
    update: { itemsJson, savedDate: dateStr() },
  });
  return ok();
}
