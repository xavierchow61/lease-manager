// Number / currency formatting helpers shared by client and server.

export function fmtNum(v: unknown): string {
  const n = parseFloat(String(v));
  if (isNaN(n) || v === "" || v == null) return "—";
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function fmtMoney(v: unknown, currency = "HK$"): string {
  return `${currency} ${fmtNum(v)}`;
}

export const CURRENCY_OPTIONS = [
  { symbol: "HK$", name: "港幣", desc: "Hong Kong Dollar" },
  { symbol: "¥", name: "人民幣", desc: "Chinese Yuan (CNY)" },
  { symbol: "$", name: "美元", desc: "US Dollar (USD)" },
  { symbol: "MOP$", name: "澳門幣", desc: "Macanese Pataca" },
  { symbol: "NT$", name: "台幣", desc: "New Taiwan Dollar" },
  { symbol: "£", name: "英鎊", desc: "British Pound (GBP)" },
] as const;

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function currentYM(): string {
  return new Date().toISOString().slice(0, 7);
}

// Classify a payment into an income category (faithful to the original system).
export function incomeCategory(p: { title: string; docCategory: string }): string {
  const t = p.title || "";
  const d = p.docCategory || "";
  if (d.includes("押金") || t.includes("押金")) return "押金";
  if (t.includes("管理費")) return "管理費";
  if (t.includes("水費") || t.includes("電費") || t.includes("水電")) return "水電費";
  if (t.includes("維修")) return "維修費";
  return "租金";
}
