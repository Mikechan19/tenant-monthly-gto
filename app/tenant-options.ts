"use server";

import { listTenants } from "@/lib/data/tenants";

/** Lightweight tenant list for the global (mobile nav) Add Sales sheet on pages that don't load tenants. */
export async function listTenantOptions(): Promise<{ id: string; name: string; unit: string | null }[]> {
  const tenants = await listTenants();
  return tenants.map((t) => ({ id: t.id, name: t.name, unit: t.unit }));
}
