import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const hash = (p: string) => bcrypt.hash(p, 10);
const ym = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

async function main() {
  console.log("🌱 Seeding demo data…");

  // Wipe (idempotent reseed)
  await prisma.$transaction([
    prisma.payment.deleteMany(),
    prisma.repair.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.unit.deleteMany(),
    prisma.checklist.deleteMany(),
    prisma.archivedTenant.deleteMany(),
    prisma.subscriptionLog.deleteMany(),
    prisma.account.deleteMany(),
  ]);

  // Owner (admin) — Max tier so every module (含維修、財務支出、月結單) is
  // unlocked in the demo.
  const owner = await prisma.account.create({
    data: {
      email: "owner@demo.com",
      passwordHash: await hash("demo1234"),
      name: "示範業主",
      role: "admin",
      tier: "Max",
      currency: "HK$",
    },
  });

  // Two tenants + units
  const t1 = await prisma.account.create({
    data: {
      email: "tenant@demo.com",
      passwordHash: await hash("demo1234"),
      name: "陳大文",
      role: "tenant",
      currency: "HK$",
      ownerId: owner.id,
      linkedTenantId: "T001",
      mustChangePassword: false,
      note: "示範租客",
    },
  });

  await prisma.unit.create({
    data: {
      ownerId: owner.id,
      tenantCode: "T001",
      tenantName: "陳大文",
      address: "九龍灣宏開道 8 號 12 樓 A 室",
      email: t1.email,
      monthlyRent: 12000,
      managementFee: 800,
      deposit: 24000,
      leaseEndDate: new Date(Date.now() + 40 * 86400000).toISOString().split("T")[0],
      waterRate: 12,
      electricRate: 1.5,
    },
  });

  await prisma.unit.create({
    data: {
      ownerId: owner.id,
      tenantCode: "T002",
      tenantName: "李美玲",
      address: "觀塘鴻圖道 21 號 6 樓",
      email: "",
      monthlyRent: 9500,
      deposit: 19000,
      leaseEndDate: new Date(Date.now() + 200 * 86400000).toISOString().split("T")[0],
      waterRate: 12,
      electricRate: 1.5,
    },
  });

  // A vacant unit
  await prisma.unit.create({
    data: { ownerId: owner.id, address: "荃灣沙咀道 100 號 3 樓", monthlyRent: 8000 },
  });

  // Sample bills
  await prisma.payment.createMany({
    data: [
      {
        ownerId: owner.id, tenantCode: "T001", createdDate: "2026-06-01", period: ym(),
        docCategory: "帳單", title: "2026年6月租金", totalAmount: 12000, paidAmount: 0,
        status: "未繳費", currency: "HK$", invoiceNumber: "INV-2026-0001",
      },
      {
        ownerId: owner.id, tenantCode: "T001", createdDate: "2026-05-01", period: "2026-05",
        docCategory: "收據", title: "2026年5月租金", totalAmount: 12000, paidAmount: 12000,
        receiptDate: "2026-05-03", status: "已繳費", currency: "HK$", invoiceNumber: "INV-2026-0002",
      },
      {
        ownerId: owner.id, tenantCode: "T002", createdDate: "2026-06-01", period: ym(),
        docCategory: "帳單", title: "2026年6月租金", totalAmount: 9500, paidAmount: 4000,
        status: "部分繳費", currency: "HK$", invoiceNumber: "INV-2026-0003",
      },
    ],
  });

  // Sample expenses (財務支出)
  await prisma.expense.createMany({
    data: [
      { ownerId: owner.id, date: "2026-06-02", category: "維修保養", item: "更換廚房水龍頭", amount: 650, relatedUnit: "九龍灣宏開道 8 號 12 樓 A 室", remark: "師傅上門" },
      { ownerId: owner.id, date: "2026-06-01", category: "管理費", item: "大廈管理費（業主負擔）", amount: 1200, relatedUnit: "觀塘鴻圖道 21 號 6 樓" },
      { ownerId: owner.id, date: "2026-05-15", category: "保險", item: "物業火險年費", amount: 3800, relatedUnit: "" },
      { ownerId: owner.id, date: "2026-05-03", category: "稅費", item: "差餉（第一季）", amount: 2400, relatedUnit: "" },
    ],
  });

  // Sample repair
  await prisma.repair.create({
    data: {
      ownerId: owner.id, tenantCode: "T001", applyDate: "2026-06-02",
      description: "廚房水龍頭漏水，需要更換墊圈。", status: "處理中",
    },
  });

  console.log("✅ Done.\n");
  console.log("   業主登入：owner@demo.com / demo1234");
  console.log("   租客登入：tenant@demo.com（或 T001）/ demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
