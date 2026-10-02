import "server-only";
import { check, db } from "./db";
import type { Tenant } from "./types";

export type TenantInput = {
  name: string;
  category: string | null;
  unit: string | null;
  rent_rate_pct: number | null;
};

export async function listTenants(): Promise<Tenant[]> {
  const s = await db();
  return check(await s.from("tenants").select("*").order("name"));
}

export async function getTenant(id: string): Promise<Tenant | null> {
  const s = await db();
  const rows = check(await s.from("tenants").select("*").eq("id", id).limit(1));
  return (rows as Tenant[])[0] ?? null;
}

export async function createTenant(input: TenantInput): Promise<Tenant> {
  const s = await db();
  return check(await s.from("tenants").insert(input).select().single());
}

export async function updateTenant(id: string, input: TenantInput): Promise<Tenant> {
  const s = await db();
  return check(await s.from("tenants").update(input).eq("id", id).select().single());
}

/** Deletes a tenant and its dependent rows (no FK cascade in the demo schema). */
export async function deleteTenant(id: string): Promise<void> {
  const s = await db();
  check(await s.from("sales_records").delete().eq("tenant_id", id));
  check(await s.from("projections").delete().eq("tenant_id", id));
  check(await s.from("tenants").delete().eq("id", id));
}
