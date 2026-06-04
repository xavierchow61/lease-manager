import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { createPayment } from "@/lib/services";

// Generate a deposit receipt (收據, already paid) or deposit invoice (帳單).
// Body: { tenantCode, docType: "收據" | "帳單", receiptDate }
export async function POST(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;
  const b = await req.json();

  const unit = await prisma.unit.findFirst({
    where: { ownerId: owner.id, tenantCode: b.tenantCode },
  });
  if (!unit) return fail("找不到租客資料");
  if (unit.deposit <= 0)
    return fail("該單位未設定押金金額，請先在單位資料填寫押金");

  const isInvoice = b.docType === "帳單";
  const payment = await createPayment({
    ownerId: owner.id,
    tenantCode: b.tenantCode,
    docCategory: isInvoice ? "帳單" : "收據",
    title: `${unit.tenantName ? unit.tenantName + " — " : ""}${isInvoice ? "押金發票" : "押金收據"}`,
    totalAmount: unit.deposit,
    paidAmount: isInvoice ? 0 : unit.deposit,
    receiptDate: isInvoice ? "" : b.receiptDate || new Date().toISOString().split("T")[0],
    status: isInvoice ? "未繳費" : "已繳費",
    currency: owner.currency,
  });
  return ok({ payment });
}
