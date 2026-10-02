import "server-only";
import { listSalesBetween } from "./sales";
import { getTenant, listTenants } from "./tenants";
import type { Tenant } from "./types";
import { gtoYear, portfolioYear, type GtoYear } from "@/lib/logic/gto";
import { myWallToUtc } from "@/lib/logic/dates";

export type TenantGto = { tenant: Tenant; year: GtoYear };

const yearRange = (year: number) => [myWallToUtc(`${year}-01-01`), myWallToUtc(`${year + 1}-01-01`)] as const;

/** Every tenant's monthly GTO for a calendar year (Malaysia time) + the portfolio row. */
export async function loadGtoYear(year: number) {
  const [from, to] = yearRange(year);
  const [tenants, records] = await Promise.all([listTenants(), listSalesBetween(from, to)]);
  const byTenant = new Map<string, typeof records>();
  for (const r of records) byTenant.set(r.tenant_id, [...(byTenant.get(r.tenant_id) ?? []), r]);
  const rows: TenantGto[] = tenants
    .map((tenant) => ({ tenant, year: gtoYear(byTenant.get(tenant.id) ?? [], tenant, year) }))
    // show tenants that have sales this year or GTO terms set up
    .filter((r) => r.year.totals.monthsWithSales > 0 || r.year.tiers !== null);
  return { rows, portfolio: portfolioYear(rows.map((r) => r.year)), tenantCount: tenants.length };
}

export async function loadTenantGtoYear(tenantId: string, year: number): Promise<TenantGto | null> {
  const [from, to] = yearRange(year);
  const [tenant, records] = await Promise.all([getTenant(tenantId), listSalesBetween(from, to, tenantId)]);
  return tenant ? { tenant, year: gtoYear(records, tenant, year) } : null;
}
