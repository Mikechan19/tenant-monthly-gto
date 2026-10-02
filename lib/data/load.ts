import "server-only";
import { DataError } from "./db";
import { listSalesBetween } from "./sales";
import { listTenants } from "./tenants";
import type { SalesRecord, Tenant } from "./types";
import { addDays, myWallToUtc, prevMonthStart, todayKey, weekStart } from "@/lib/logic/dates";

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

export async function safe<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof DataError ? e.message : "Unexpected error loading data." };
  }
}

/** Earliest day any v1 screen needs: start of last month, last week's Monday, or 28 days back. */
export function windowStart(today: string): string {
  return [prevMonthStart(today), addDays(weekStart(today), -7), addDays(today, -27)].sort()[0];
}

export async function loadPortfolio(tenantId?: string): Promise<
  Loaded<{ tenants: Tenant[]; records: SalesRecord[]; today: string }>
> {
  return safe(async () => {
    const today = todayKey();
    const [tenants, records] = await Promise.all([
      listTenants(),
      listSalesBetween(myWallToUtc(windowStart(today)), myWallToUtc(addDays(today, 1)), tenantId),
    ]);
    return { tenants, records, today };
  });
}
