import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";

// 轉租：把租客從來源單位轉到目標（空置）單位。
// 押金、未繳帳單、維修、登入帳號全部跟隨；來源單位轉為空置。
// Body: { fromUnitId, toUnitId, newTenantCode?, carryDeposit }
export async function POST(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;
  const b = await req.json();

  const fromUnit = await prisma.unit.findUnique({ where: { id: b.fromUnitId } });
  const toUnit = await prisma.unit.findUnique({ where: { id: b.toUnitId } });
  if (!fromUnit || fromUnit.ownerId !== owner.id) return fail("找不到來源單位", 404);
  if (!toUnit || toUnit.ownerId !== owner.id) return fail("找不到目標單位", 404);
  if (fromUnit.id === toUnit.id) return fail("來源與目標不能是同一間");
  if (!fromUnit.tenantCode) return fail("來源單位目前沒有租客");
  if (toUnit.tenantCode) return fail("目標單位已有租客，請先選擇空置單位");

  const oldCode = fromUnit.tenantCode;
  const newCode = String(b.newTenantCode || oldCode).trim();
  const carryDeposit = b.carryDeposit !== false; // 預設攜帶押金

  // 若更改編號，確認不與其他在租單位衝突
  if (newCode !== oldCode) {
    const clash = await prisma.unit.findFirst({
      where: { ownerId: owner.id, tenantCode: newCode, id: { not: fromUnit.id } },
    });
    if (clash) return fail(`租客編號 ${newCode} 已被其他單位使用`);
  }

  const ops = [];

  // 重新編號：把所有相關記錄由 oldCode 改為 newCode
  if (newCode !== oldCode) {
    ops.push(
      prisma.payment.updateMany({ where: { ownerId: owner.id, tenantCode: oldCode }, data: { tenantCode: newCode } }),
      prisma.repair.updateMany({ where: { ownerId: owner.id, tenantCode: oldCode }, data: { tenantCode: newCode } }),
      prisma.account.updateMany({ where: { ownerId: owner.id, linkedTenantId: oldCode }, data: { linkedTenantId: newCode } }),
      // 入退住清單：刪掉目標可能殘留的，再把來源的改名（避免唯一鍵衝突）
      prisma.checklist.deleteMany({ where: { ownerId: owner.id, tenantCode: newCode } }),
      prisma.checklist.updateMany({ where: { ownerId: owner.id, tenantCode: oldCode }, data: { tenantCode: newCode } })
    );
  }

  // 目標單位接收租客（保留目標單位本身的地址/租金/管理費/水電錶）
  ops.push(
    prisma.unit.update({
      where: { id: toUnit.id },
      data: {
        tenantCode: newCode,
        tenantName: fromUnit.tenantName,
        email: fromUnit.email,
        leaseEndDate: fromUnit.leaseEndDate,
        deposit: carryDeposit ? fromUnit.deposit : toUnit.deposit,
        contractFileUrl: fromUnit.contractFileUrl,
        memo: fromUnit.memo,
      },
    })
  );

  // 來源單位清空，轉為空置
  ops.push(
    prisma.unit.update({
      where: { id: fromUnit.id },
      data: {
        tenantCode: "",
        tenantName: "",
        email: "",
        leaseEndDate: "",
        contractFileUrl: "",
        memo: "",
        ...(carryDeposit ? { deposit: 0 } : {}),
      },
    })
  );

  await prisma.$transaction(ops);

  return ok({
    from: fromUnit.address,
    to: toUnit.address,
    tenant: fromUnit.tenantName,
    oldCode,
    newCode,
    rekeyed: newCode !== oldCode,
  });
}
