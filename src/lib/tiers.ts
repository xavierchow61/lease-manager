// Subscription tiers and the feature limits attached to each.
// Mirrors the gating logic from the original Vue app.

export type Tier = "Free" | "Pro" | "Max";

export const TIERS: Tier[] = ["Free", "Pro", "Max"];

export type TierLimits = {
  maxTenants: number; // Infinity for unlimited
  autoInvoice: boolean; // 自動發票/帳單批量
  repairs: boolean; // 維修模組
  expenses: boolean; // 財務支出
  monthlyStatements: boolean; // 月結單
};

export function tierLimits(tier: string): TierLimits {
  switch (tier) {
    case "Max":
      return {
        maxTenants: Infinity,
        autoInvoice: true,
        repairs: true,
        expenses: true,
        monthlyStatements: true,
      };
    case "Pro":
      return {
        maxTenants: 5,
        autoInvoice: true,
        repairs: true,
        expenses: false,
        monthlyStatements: false,
      };
    default: // Free
      return {
        maxTenants: 3,
        autoInvoice: false,
        repairs: false,
        expenses: false,
        monthlyStatements: false,
      };
  }
}

export const PLAN_INFO: Record<
  Tier,
  { name: string; price: string; tenants: string; features: string[] }
> = {
  Free: {
    name: "免費版",
    price: "HK$0",
    tenants: "最多 3 位租客",
    features: ["單位與租客管理", "收款帳單/收據", "繳費狀態追蹤", "多幣別支援"],
  },
  Pro: {
    name: "專業版 Pro",
    price: "HK$88 / 月",
    tenants: "最多 5 位租客",
    features: ["免費版全部功能", "維修管理模組", "批量帳單與自動發票", "Email 通知"],
  },
  Max: {
    name: "旗艦版 Max",
    price: "HK$188 / 月",
    tenants: "無限租客",
    features: ["專業版全部功能", "財務支出管理", "月結單與年度報表", "全部進階帳務工具"],
  },
};
