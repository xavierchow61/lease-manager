// Shared client-side types and a typed fetch helper.

export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "tenant";
  tier: string;
  currency: string;
  ownerId?: string;
  tenantCode?: string;
};

export type Unit = {
  id: string;
  ownerId: string;
  status: string;
  tenantCode: string;
  tenantName: string;
  address: string;
  email: string;
  monthlyRent: number;
  managementFee: number;
  deposit: number;
  leaseEndDate: string;
  contractFileUrl: string;
  memo: string;
  waterRate: number;
  electricRate: number;
  waterUsage: number;
  electricUsage: number;
  waterReading: number;
  electricReading: number;
};

export type Repair = {
  id: string;
  ownerId: string;
  tenantCode: string;
  applyDate: string;
  description: string;
  photoUrl: string;
  status: string;
  ownerReply: string;
};

export type Payment = {
  id: string;
  ownerId: string;
  tenantCode: string;
  createdDate: string;
  period: string;
  docCategory: string;
  title: string;
  totalAmount: number;
  paidAmount: number;
  receiptDate: string;
  status: string;
  relatedDocId: string;
  currency: string;
  invoiceNumber: string;
  remark: string;
};

export type Expense = {
  id: string;
  ownerId: string;
  date: string;
  category: string;
  item: string;
  amount: number;
  relatedUnit: string;
  remark: string;
};

export type AllData = {
  units: Unit[];
  repairs: Repair[];
  payments: Payment[];
  expenses: Expense[];
};

type ApiResult<T = Record<string, unknown>> = {
  success: boolean;
  message?: string;
} & T;

export async function api<T = Record<string, unknown>>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown
): Promise<ApiResult<T>> {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  try {
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { success: false, message: `伺服器錯誤 (${res.status})` } as ApiResult<T>;
  }
}
