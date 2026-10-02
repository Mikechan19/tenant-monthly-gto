"use server";

import { revalidatePath } from "next/cache";
import { DataError } from "@/lib/data/db";
import { createTenant, deleteTenant, updateTenant, type TenantInput } from "@/lib/data/tenants";
import { deleteSale, insertSales, updateSale } from "@/lib/data/sales";
import { deleteProjection, insertProjections, setProjectionStatus } from "@/lib/data/projections";
import { listSalesBetween } from "@/lib/data/sales";
import { listTenants } from "@/lib/data/tenants";
import { parseSalesFields, periodTimestamp, type FieldErrors } from "@/lib/logic/records";
import { dailyTotalsByTenant } from "@/lib/logic/aggregate";
import { projectFromDaily, type ProjectionPeriod } from "@/lib/logic/projection";
import { addDays, myWallToUtc, todayKey } from "@/lib/logic/dates";
import { parseCsv, type ImportRow } from "@/lib/logic/csv";

export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors & { form?: string; name?: string; rent_rate_pct?: string };
  nonce?: number;
};

function refresh() {
  revalidatePath("/", "layout");
}

function dbMessage(e: unknown): string {
  if (e instanceof DataError) {
    if (e.code === "23514" && /amount/.test(e.message)) return "Amount must be 0 or greater.";
    return e.message;
  }
  return "Something went wrong saving to the database. Please try again.";
}

// ── Sales records ───────────────────────────────────────────────────────────

export async function saveSale(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseSalesFields({
    tenant_id: fd.get("tenant_id"),
    period_type: fd.get("period_type"),
    amount: fd.get("amount"),
    date: fd.get("date"),
    hour: fd.get("hour"),
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const v = parsed.value;
  const row = {
    tenant_id: v.tenant_id,
    period_type: v.period_type,
    amount: v.amount,
    recorded_at: periodTimestamp(v.period_type, v.date, v.hour).toISOString(),
  };
  const id = String(fd.get("id") ?? "");
  try {
    if (id) await updateSale(id, row);
    else await insertSales([{ ...row, source: "manual" }]);
  } catch (e) {
    const msg = dbMessage(e);
    return { ok: false, errors: msg.startsWith("Amount") ? { amount: msg } : { form: msg } };
  }
  refresh();
  return { ok: true, message: id ? "Sales record updated." : "Sales record added.", nonce: Date.now() };
}

export async function removeSale(id: string): Promise<ActionState> {
  try {
    await deleteSale(id);
  } catch (e) {
    return { ok: false, errors: { form: dbMessage(e) } };
  }
  refresh();
  return { ok: true, message: "Sales record deleted." };
}

// ── Tenants ─────────────────────────────────────────────────────────────────

function parseTenant(fd: FormData): { ok: true; value: TenantInput } | { ok: false; errors: ActionState["errors"] } {
  const name = String(fd.get("name") ?? "").trim();
  const category = String(fd.get("category") ?? "").trim() || null;
  const unit = String(fd.get("unit") ?? "").trim() || null;
  const rateRaw = String(fd.get("rent_rate_pct") ?? "").trim();
  const errors: ActionState["errors"] = {};
  if (!name) errors.name = "Tenant name is required.";
  let rent_rate_pct: number | null = null;
  if (rateRaw) {
    rent_rate_pct = Number(rateRaw);
    if (!Number.isFinite(rent_rate_pct) || rent_rate_pct < 0 || rent_rate_pct > 100)
      errors.rent_rate_pct = "Rate must be between 0 and 100.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, category, unit, rent_rate_pct } };
}

export async function saveTenant(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseTenant(fd);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const id = String(fd.get("id") ?? "");
  try {
    if (id) await updateTenant(id, parsed.value);
    else await createTenant(parsed.value);
  } catch (e) {
    return { ok: false, errors: { form: dbMessage(e) } };
  }
  refresh();
  return { ok: true, message: id ? "Tenant updated." : "Tenant added.", nonce: Date.now() };
}

export async function removeTenant(id: string): Promise<ActionState> {
  try {
    await deleteTenant(id);
  } catch (e) {
    return { ok: false, errors: { form: dbMessage(e) } };
  }
  refresh();
  return { ok: true, message: "Tenant deleted." };
}

// ── Projections ─────────────────────────────────────────────────────────────

/** Recomputes projections from current data and saves a snapshot row per tenant. */
export async function saveProjectionSnapshot(
  period: ProjectionPeriod,
  tenantId?: string,
): Promise<ActionState> {
  try {
    const today = todayKey();
    const from = myWallToUtc(addDays(today, -27));
    const to = myWallToUtc(addDays(today, 1));
    const [tenants, records] = await Promise.all([listTenants(), listSalesBetween(from, to, tenantId)]);
    const by = dailyTotalsByTenant(records);
    const rows = tenants
      .filter((t) => !tenantId || t.id === tenantId)
      .map((t) => ({ t, p: projectFromDaily(by.get(t.id) ?? new Map(), today, period) }))
      .filter((x) => x.p)
      .map(({ t, p }) => ({
        tenant_id: t.id,
        target_period: period,
        projected_amount: p!.projectedAmount,
        method: p!.method,
        confidence: p!.confidence,
        source: "rule_based",
        review_status: "unreviewed",
        user_id: null,
      }));
    if (!rows.length) return { ok: false, errors: { form: "Not enough data to project." } };
    await insertProjections(rows);
    refresh();
    return { ok: true, message: `Saved ${rows.length} projection${rows.length > 1 ? "s" : ""}.` };
  } catch (e) {
    return { ok: false, errors: { form: dbMessage(e) } };
  }
}

export async function reviewProjection(id: string, status: "approved" | "unreviewed"): Promise<ActionState> {
  try {
    await setProjectionStatus(id, status);
  } catch (e) {
    return { ok: false, errors: { form: dbMessage(e) } };
  }
  refresh();
  return { ok: true };
}

export async function removeProjection(id: string): Promise<ActionState> {
  try {
    await deleteProjection(id);
  } catch (e) {
    return { ok: false, errors: { form: dbMessage(e) } };
  }
  refresh();
  return { ok: true };
}

// ── CSV import ──────────────────────────────────────────────────────────────

export type ImportPreview = { rows: ImportRow[]; validCount: number; error?: string };

export async function previewImport(csv: string): Promise<ImportPreview> {
  try {
    const tenants = await listTenants();
    const rows = parseCsv(csv, tenants);
    return { rows, validCount: rows.filter((r) => !r.error).length };
  } catch (e) {
    return { rows: [], validCount: 0, error: dbMessage(e) };
  }
}

export async function commitImport(csv: string): Promise<ActionState> {
  try {
    const tenants = await listTenants();
    const valid = parseCsv(csv, tenants).filter((r) => !r.error && r.record);
    if (!valid.length) return { ok: false, errors: { form: "No valid rows to import." } };
    for (let i = 0; i < valid.length; i += 500) {
      await insertSales(valid.slice(i, i + 500).map((r) => ({ ...r.record!, source: "import" })));
    }
    refresh();
    return { ok: true, message: `Imported ${valid.length} sales record${valid.length > 1 ? "s" : ""}.` };
  } catch (e) {
    return { ok: false, errors: { form: dbMessage(e) } };
  }
}
