import "server-only";
import { check, db } from "./db";
import { activeTeamId } from "./team";
import type { PeriodType, SalesRecord } from "./types";

export type SalesInput = {
  tenant_id: string;
  period_type: PeriodType;
  amount: number;
  recorded_at: string; // ISO UTC
  source?: string;
  outlet?: string | null;
};

const PAGE = 1000;

/** All records with recorded_at in [from, to). Paginates past PostgREST's row cap. */
export async function listSalesBetween(from: Date, to: Date, tenantId?: string): Promise<SalesRecord[]> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  const out: SalesRecord[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = s
      .from("sales_records")
      .select("*")
      .eq("team_id", team)
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
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  return check(
    await s
      .from("sales_records")
      .select("*")
      .eq("team_id", team)
      .eq("tenant_id", tenantId)
      .order("recorded_at", { ascending: false })
      .limit(limit),
  );
}

export async function countSales(tenantId: string): Promise<number> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  const res = await s
    .from("sales_records")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team)
    .eq("tenant_id", tenantId);
  if (res.error) check(res);
  return res.count ?? 0;
}

export async function insertSales(rows: SalesInput[]): Promise<SalesRecord[]> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  return check(
    await s
      .from("sales_records")
      .insert(rows.map((r) => ({ source: "manual", ...r, team_id: team })))
      .select(),
  );
}

export async function updateSale(id: string, input: Omit<SalesInput, "source">): Promise<SalesRecord> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  return check(await s.from("sales_records").update(input).eq("id", id).eq("team_id", team).select().single());
}

export async function deleteSale(id: string): Promise<void> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  check(await s.from("sales_records").delete().eq("id", id).eq("team_id", team));
}

/** Distinct outlet names already used for a tenant (for the Add Sales datalist). */
export async function listOutlets(tenantId: string): Promise<string[]> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  const rows = check(
    await s
      .from("sales_records")
      .select("outlet")
      .eq("team_id", team)
      .eq("tenant_id", tenantId)
      .not("outlet", "is", null)
      .order("recorded_at", { ascending: false })
      .limit(1000),
  ) as { outlet: string }[];
  return [...new Set(rows.map((r) => r.outlet))].sort((a, b) => a.localeCompare(b));
}
