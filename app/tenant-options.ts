"use server";

import { listOutlets } from "@/lib/data/sales";
import { listTenants } from "@/lib/data/tenants";

/** Lightweight tenant list for the global (mobile nav) Add Sales sheet on pages that don't load tenants. */
export async function listTenantOptions(): Promise<{ id: string; name: string; unit: string | null }[]> {
  const tenants = await listTenants();
  return tenants.map((t) => ({ id: t.id, name: t.name, unit: t.unit }));
}

/** Outlets previously recorded for a tenant — suggestions for the Add Sales "Outlet" field. */
export async function listTenantOutlets(tenantId: string): Promise<string[]> {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) return [];
  try {
    return await listOutlets(tenantId);
  } catch {
    return [];
  }
}
