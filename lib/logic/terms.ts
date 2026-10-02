// Parses the tenant form's lease & GTO terms (pure; tests in __tests__/terms.test.ts).
import { validateTiers, type GtoTier } from "./gto";

export type TenantTerms = {
  property: string | null;
  base_rent_monthly: number | null;
  lease_start: string | null;
  lease_end: string | null;
  gto_sst_pct: number;
  gto_tiers: GtoTier[] | null;
};
export type TermErrors = Partial<Record<"property" | "base_rent_monthly" | "lease_start" | "lease_end" | "gto_sst_pct" | "gto_tiers", string>>;

const num = (v: unknown) => {
  const s = String(v ?? "").replace(/[,\s]|^RM/gi, "");
  return s === "" ? null : Number(s);
};
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * Tier rows come from the form as parallel lists: `tier_up_to` (RM, blank on the last "and above" row)
 * and `tier_rate_pct` (percent). No rows → null (the flat % rent rate, if any, applies).
 */
export function parseTiers(upTo: unknown[], ratePct: unknown[]): { ok: true; value: GtoTier[] | null } | { ok: false; error: string } {
  const rows = ratePct.map((r, i) => ({ up: num(upTo[i]), rate: num(r) }));
  if (!rows.length) return { ok: true, value: null };
  const tiers: GtoTier[] = [];
  for (let i = 0; i < rows.length; i++) {
    const { up, rate } = rows[i];
    if (rate === null || !Number.isFinite(rate)) return { ok: false, error: `Band ${i + 1}: enter a rate (%).` };
    const last = i === rows.length - 1;
    if (!last && (up === null || !Number.isFinite(up))) return { ok: false, error: `Band ${i + 1}: enter the upper limit (RM).` };
    // percent → fraction without float noise (4.5 → 0.045)
    tiers.push({ up_to: last ? null : up, rate: Number((rate / 100).toFixed(8)) });
  }
  const err = validateTiers(tiers);
  return err ? { ok: false, error: err } : { ok: true, value: tiers };
}

export function parseTerms(get: (k: string) => unknown, getAll: (k: string) => unknown[]): { ok: true; value: TenantTerms } | { ok: false; errors: TermErrors } {
  const errors: TermErrors = {};
  const property = String(get("property") ?? "").trim().replace(/\s+/g, " ") || null;
  if (property && property.length > 120) errors.property = "Keep the property name under 120 characters.";

  const base = num(get("base_rent_monthly"));
  if (base !== null && (!Number.isFinite(base) || base < 0)) errors.base_rent_monthly = "Base rent must be 0 or more.";

  const ls = String(get("lease_start") ?? "").trim() || null;
  const le = String(get("lease_end") ?? "").trim() || null;
  if (ls && !isDate(ls)) errors.lease_start = "Enter a valid date.";
  if (le && !isDate(le)) errors.lease_end = "Enter a valid date.";
  if (ls && le && isDate(ls) && isDate(le) && le < ls) errors.lease_end = "Lease end must be on or after the start.";

  const sst = num(get("gto_sst_pct")) ?? 0;
  if (!Number.isFinite(sst) || sst < 0 || sst > 100) errors.gto_sst_pct = "SST must be between 0 and 100%.";

  const t = parseTiers(getAll("tier_up_to"), getAll("tier_rate_pct"));
  if (!t.ok) errors.gto_tiers = t.error;

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      property,
      base_rent_monthly: base === null ? null : Math.round(base * 100) / 100,
      lease_start: ls,
      lease_end: le,
      gto_sst_pct: sst,
      gto_tiers: t.ok ? t.value : null,
    },
  };
}

/** Outlet name: trimmed, single-spaced, ≤ 80 chars; blank → null. */
export function parseOutlet(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  if (!s) return { ok: true, value: null };
  if (s.length > 80) return { ok: false, error: "Outlet name is too long (80 characters max)." };
  return { ok: true, value: s };
}
