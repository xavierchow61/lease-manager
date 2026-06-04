import { prisma } from "@/lib/db";
import { ok, fail, adminOnly } from "@/lib/api";
import { sendMail } from "@/lib/email";
import { ymNow, displayMonth } from "@/lib/services";

// Consolidated notification actions. Body: { action, ...args }
//  - "expiry":  email tenants whose lease ends within 60 days
//  - "overdue": email tenants with unpaid bills from past periods
//  - "monthly": email a monthly statement for a given year-month
//  - "rentAdjust": notify a tenant of a rent change (optionally apply it)
export async function POST(req: Request) {
  const a = await adminOnly();
  if ("response" in a) return a.response;
  const owner = a.user;
  const cur = owner.currency;
  const body = await req.json();

  const units = await prisma.unit.findMany({ where: { ownerId: owner.id } });

  if (body.action === "expiry") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let sent = 0;
    const expiring: { name: string; days: number; address: string }[] = [];
    for (const u of units) {
      if (!u.leaseEndDate || !u.email) continue;
      const parts = u.leaseEndDate.split(/[-/]/);
      if (parts.length < 3) continue;
      const expiry = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      if (isNaN(expiry.getTime())) continue;
      const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
      if (days < 0 || days > 60) continue;
      expiring.push({ name: u.tenantName, days, address: u.address });
      const urgency = days <= 7 ? "⚠️ 緊急" : days <= 14 ? "🔔 重要" : "📅 提醒";
      await sendMail({
        to: u.email,
        subject: `${urgency} 合約到期提醒：您的租約將於 ${days} 天後到期`,
        body:
          `親愛的 ${u.tenantName} 您好：\n\n您位於「${u.address}」的租約將於 ${u.leaseEndDate} 到期（還有 ${days} 天）。\n\n如需續約，請盡快與業主聯繫。\n\n-- 物業管理系統自動發送 --`,
      });
      sent++;
    }
    return ok({ sent, expiring });
  }

  if (body.action === "overdue") {
    const ym = ymNow();
    const payments = await prisma.payment.findMany({
      where: { ownerId: owner.id, status: { not: "已繳費" } },
    });
    const byTenant: Record<string, typeof payments> = {};
    for (const p of payments) {
      if (p.period && p.period >= ym) continue; // only past-due
      (byTenant[p.tenantCode] ||= []).push(p);
    }
    let sent = 0;
    for (const [code, bills] of Object.entries(byTenant)) {
      const unit = units.find((u) => u.tenantCode === code);
      if (!unit?.email) continue;
      const owing = bills.reduce(
        (s, p) => s + Math.max(p.totalAmount - p.paidAmount, 0),
        0
      );
      const lines = bills
        .map(
          (p) =>
            `・${p.title}（${p.period || p.createdDate}）尚欠 ${cur}${Math.max(p.totalAmount - p.paidAmount, 0).toLocaleString()}`
        )
        .join("\n");
      await sendMail({
        to: unit.email,
        subject: `[催款通知] 您有 ${bills.length} 筆逾期帳單，合計 ${cur}${owing.toLocaleString()}`,
        body: `親愛的 ${unit.tenantName} 您好：\n\n系統顯示您有以下逾期未繳費帳單：\n\n${lines}\n\n合計尚欠：${cur}${owing.toLocaleString()}\n\n請盡快完成繳費，感謝您的配合。\n\n-- 物業管理系統自動催款 --`,
      });
      sent++;
    }
    return ok({ sent });
  }

  if (body.action === "monthly") {
    const ym = body.yearMonth || ymNow();
    const payments = await prisma.payment.findMany({
      where: { ownerId: owner.id, period: ym },
    });
    let sent = 0;
    for (const u of units) {
      if (!u.email || !u.tenantCode) continue;
      const bills = payments.filter((p) => p.tenantCode === u.tenantCode);
      if (!bills.length) continue;
      const total = bills.reduce((s, p) => s + p.totalAmount, 0);
      const paid = bills.reduce((s, p) => s + p.paidAmount, 0);
      const owing = Math.max(total - paid, 0);
      const lines = bills
        .map((p) => {
          const icon =
            p.status === "已繳費" ? "✅" : p.status === "部分繳費" ? "⚠️" : "❌";
          return `${icon} ${p.title}\n   應繳：${cur}${p.totalAmount.toLocaleString()}  已付：${cur}${p.paidAmount.toLocaleString()}`;
        })
        .join("\n");
      await sendMail({
        to: u.email,
        subject: `[${displayMonth(ym)}月結單] ${u.tenantName} 帳單明細`,
        body: `親愛的 ${u.tenantName} 您好：\n\n以下是您 ${displayMonth(ym)} 的月結單：\n\n${lines}\n\n本月應繳合計：${cur}${total.toLocaleString()}\n已付合計：${cur}${paid.toLocaleString()}\n尚欠：${cur}${owing.toLocaleString()}\n\n-- ${displayMonth(ym)} 月結單 --`,
      });
      sent++;
    }
    return ok({ sent, month: ym });
  }

  if (body.action === "rentAdjust") {
    const unit = units.find((u) => u.tenantCode === body.tenantCode);
    if (!unit) return fail("找不到租客資料");
    const oldRent = unit.monthlyRent;
    const newRent = parseFloat(String(body.newRent)) || 0;
    if (body.updateNow) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { monthlyRent: newRent },
      });
    }
    if (unit.email) {
      const diff = newRent - oldRent;
      const pct = oldRent > 0 ? ((diff / oldRent) * 100).toFixed(1) : "—";
      await sendMail({
        to: unit.email,
        subject: `[租金調整通知] ${unit.address} 生效日：${body.effectiveDate}`,
        body:
          `親愛的 ${unit.tenantName} 您好：\n\n茲通知您「${unit.address}」的租金調整如下：\n\n・現時租金：${cur}${oldRent.toLocaleString()} / 月\n・調整後租金：${cur}${newRent.toLocaleString()} / 月（${diff >= 0 ? "+" : ""}${pct}%）\n・生效日期：${body.effectiveDate}\n` +
          (body.reason ? `・調整原因：${body.reason}\n` : "") +
          `\n如有疑問請與業主聯絡。\n\n-- 物業管理系統自動通知 --`,
      });
    }
    return ok({ oldRent, newRent });
  }

  return fail("未知的動作");
}
