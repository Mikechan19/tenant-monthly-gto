import "server-only";
import { check, db } from "./db";
import type { PeriodType, SalesRecord } from "./types";

export type SalesInput = {
  tenant_id: string;
  period_type: PeriodType;
  amount: number;
  recorded_at: string; // ISO UTC
  source?: string;
};

const PAGE = 1000;

/** All records with recorded_at in [from, to). Paginates past PostgREST's row cap. */
export async function listSalesBetween(from: Date, to: Date, tenantId?: string): Promise<SalesRecord[]> {
  const s = await db();
  const out: SalesRecord[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = s
      .from("sales_records")
      .select("*")
      .gte("recorded_at", from.toISOString())
      .lt("recorded_at", to.toISOString())
      .order("recorded_at")
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    const rows = check(await q) as SalesRecord[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function listRecentSales(tenantId: string, limit = 50): Promise<SalesRecord[]> {
  const s = await db();
  return check(
    await s
      .from("sales_records")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("recorded_at", { ascending: false })
      .limit(limit),
  );
}

export async function countSales(tenantId: string): Promise<number> {
  const s = await db();
  const res = await s.from("sales_records").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if (res.error) check(res);
  return res.count ?? 0;
}

export async function insertSales(rows: SalesInput[]): Promise<SalesRecord[]> {
  const s = await db();
  return check(await s.from("sales_records").insert(rows.map((r) => ({ source: "manual", ...r }))).select());
}

export async function updateSale(id: string, input: Omit<SalesInput, "source">): Promise<SalesRecord> {
  const s = await db();
  return check(await s.from("sales_records").update(input).eq("id", id).select().single());
}

export async function deleteSale(id: string): Promise<void> {
  const s = await db();
  check(await s.from("sales_records").delete().eq("id", id));
}
