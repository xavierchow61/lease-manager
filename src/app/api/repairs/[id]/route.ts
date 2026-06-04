import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { sendMail } from "@/lib/email";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;

  const repair = await prisma.repair.findUnique({ where: { id: params.id } });
  if (!repair || repair.ownerId !== owner.id)
    return fail("找不到該筆維修紀錄", 404);

  const { status, reply } = await req.json();
  const updated = await prisma.repair.update({
    where: { id: params.id },
    data: { status: status || repair.status, ownerReply: reply ?? repair.ownerReply },
  });

  // Notify the tenant by email (logged locally).
  if (repair.tenantCode) {
    const unit = await prisma.unit.findFirst({
      where: { ownerId: owner.id, tenantCode: repair.tenantCode },
    });
    if (unit?.email) {
      const label =
        status === "完成" ? "✅ 已完成" : status === "已安排" ? "🔧 已安排維修" : "🔄 處理中";
      await sendMail({
        to: unit.email,
        subject: "[物業系統通知] 您的維修申請狀態已更新",
        body:
          `親愛的 ${unit.tenantName} 您好：\n\n` +
          `您的維修申請狀態已更新為：${label}\n\n` +
          (reply ? `業主回覆：${reply}\n\n` : "") +
          `如有疑問，請直接聯絡您的業主。\n\n-- 物業管理系統自動發送 --`,
      });
    }
  }

  return ok({ repair: updated });
}
