import "server-only";
import { check, db } from "./db";
import { activeTeamId } from "./team";
import type { Tenant } from "./types";
import type { TenantTerms } from "@/lib/logic/terms";

export type TenantInput = {
  name: string;
  category: string | null;
  unit: string | null;
  rent_rate_pct: number | null;
} & TenantTerms;

// Every query is filtered by the active team; RLS independently limits rows to the user's teams.

export async function listTenants(): Promise<Tenant[]> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  return check(await s.from("tenants").select("*").eq("team_id", team).order("name"));
}

export async function getTenant(id: string): Promise<Tenant | null> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  const rows = check(await s.from("tenants").select("*").eq("id", id).eq("team_id", team).limit(1));
  return (rows as Tenant[])[0] ?? null;
}

export async function createTenant(input: TenantInput): Promise<Tenant> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  return check(await s.from("tenants").insert({ ...input, team_id: team }).select().single());
}

export async function updateTenant(id: string, input: TenantInput): Promise<Tenant> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  return check(await s.from("tenants").update(input).eq("id", id).eq("team_id", team).select().single());
}

/** Deletes a tenant and its dependent rows (no FK cascade from tenants in the demo schema). */
export async function deleteTenant(id: string): Promise<void> {
  const [s, team] = await Promise.all([db(), activeTeamId()]);
  check(await s.from("sales_records").delete().eq("tenant_id", id).eq("team_id", team));
  check(await s.from("projections").delete().eq("tenant_id", id).eq("team_id", team));
  check(await s.from("tenants").delete().eq("id", id).eq("team_id", team));
}
