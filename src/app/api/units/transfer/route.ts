import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { createPayment } from "@/lib/services";

function num(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

// 轉租：把租客從來源單位轉到目標（空置）單位。
// 押金、未繳帳單、維修、登入帳號全部跟隨；來源單位轉為空置。
// 押金差額：新押金 > 原押金 → 開帳單補繳；新押金 < 原押金 → 多付記入預付款。
// Body: { fromUnitId, toUnitId, newTenantCode?, newDeposit? }
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
  const oldDeposit = fromUnit.deposit;
  // 新單位押金：預設沿用目標單位設定的押金；可由前端覆寫
  const newDeposit = b.newDeposit !== undefined ? num(b.newDeposit) : toUnit.deposit;
  const depositDiff = newDeposit - oldDeposit; // >0 需補繳；<0 多付退回（記預付款）

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

  // 目標單位接收租客（保留目標單位本身的地址/租金/管理費/水電錶），押金設為新押金
  ops.push(
    prisma.unit.update({
      where: { id: toUnit.id },
      data: {
        status: "出租中",
        tenantCode: newCode,
        tenantName: fromUnit.tenantName,
        email: fromUnit.email,
        leaseEndDate: fromUnit.leaseEndDate,
        deposit: newDeposit,
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
        status: "空置中",
        tenantCode: "", tenantName: "", email: "", leaseEndDate: "",
        contractFileUrl: "", memo: "", deposit: 0,
      },
    })
  );

  await prisma.$transaction(ops);

  // 押金差額結算
  const cur = owner.currency;
  let reconciliation: { type: string; amount: number } | null = null;
  if (depositDiff > 0) {
    // 需補繳：開立帳單
    await createPayment({
      ownerId: owner.id,
      tenantCode: newCode,
      docCategory: "帳單",
      title: `轉租押金補差額（${fromUnit.address} → ${toUnit.address}）`,
      totalAmount: depositDiff,
      status: "未繳費",
      currency: cur,
      remark: `原押金 ${cur}${oldDeposit.toFixed(2)} → 新押金 ${cur}${newDeposit.toFixed(2)}，需補繳差額 ${cur}${depositDiff.toFixed(2)}`,
    });
    reconciliation = { type: "補繳", amount: depositDiff };
  } else if (depositDiff < 0) {
    // 多付：記入預付款
    const over = Math.abs(depositDiff);
    await createPayment({
      ownerId: owner.id,
      tenantCode: newCode,
      docCategory: "預付款",
      title: `轉租退回多付押金（${fromUnit.address} → ${toUnit.address}）`,
      totalAmount: over,
      paidAmount: over,
      status: "已繳費",
      currency: cur,
      remark: `原押金 ${cur}${oldDeposit.toFixed(2)} → 新押金 ${cur}${newDeposit.toFixed(2)}，多付 ${cur}${over.toFixed(2)} 記入預付款`,
    });
    reconciliation = { type: "預付款", amount: over };
  }

  return ok({
    from: fromUnit.address,
    to: toUnit.address,
    tenant: fromUnit.tenantName,
    oldCode,
    newCode,
    rekeyed: newCode !== oldCode,
    oldDeposit,
    newDeposit,
    depositDiff,
    reconciliation,
  });
}
