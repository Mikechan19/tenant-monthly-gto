// Monthly gross sales → tiered turnover rent (GTO) → after SST. Pure, no I/O (tests: __tests__/gto.test.ts).
//
// Money is computed EXACTLY in integer units (bigint) and only rounded (half-up, to the sen) for display,
// so figures reconcile with Excel to the cent — e.g. 3,000 + 350,001 × 4.5% = 18,750.045 → RM 18,750.05,
// where naive floating-point rounding gives 18,750.04. Gross sales are taken to the sen, rates to 1e-6 (0.0001%), SST % to 1e-4.

import type { PeriodType } from "@/lib/data/types";
import { dayKey } from "./dates";

export type GtoTier = { up_to: number | null; rate: number };

/** Exact money: RM × 10^14 (gross in sen × rate in ppm × SST factor all divide in). */
const SCALE = 10n ** 14n;
const SEN = 10n ** 12n; // one sen in SCALE units

const toSen = (rm: number) => BigInt(Math.round(rm * 100));
const ppm = (rate: number) => BigInt(Math.round(rate * 1e6));

/** Round exact units half-up to the sen and return RM as a number (2 dp). */
export function unitsToRm(units: bigint): number {
  const neg = units < 0n;
  const a = neg ? -units : units;
  const sen = (a + SEN / 2n) / SEN;
  return (neg ? -1 : 1) * Number(sen) / 100;
}
/** Exact units as a decimal string (for tests / debugging), e.g. "18750.045". */
export function unitsToExact(units: bigint): string {
  const neg = units < 0n;
  const a = neg ? -units : units;
  const whole = a / SCALE;
  const frac = (a % SCALE).toString().padStart(14, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

// ── monthly gross ───────────────────────────────────────────────────────────

export type GrossRecord = { period_type: PeriodType; amount: number; recorded_at: string; outlet?: string | null };
export type GrossSource = "monthly" | "daily";
export type MonthlyGross = {
  month: string; // YYYY-MM
  /** null = no sales recorded for the month (shown as "—", never as a negative or zero GTO) */
  gross: number | null;
  source: GrossSource | null;
  records: number;
  byOutlet: { outlet: string | null; amount: number }[];
};

/** YYYY-MM of a record in Malaysia time. */
export const monthKeyOf = (iso: string) => dayKey(iso).slice(0, 7);

/**
 * Gross sales for a month (YYYY-MM): the sum of `monthly` records when any exist for that month
 * (a tenant's reported monthly total wins), otherwise the sum of daily + hourly records.
 * Weekly summaries are ignored (a week can straddle two months).
 */
export function monthlyGross(records: GrossRecord[], month: string): MonthlyGross {
  const inMonth = records.filter((r) => monthKeyOf(r.recorded_at) === month);
  const monthly = inMonth.filter((r) => r.period_type === "monthly");
  const daily = inMonth.filter((r) => r.period_type === "daily" || r.period_type === "hourly");
  const use = monthly.length ? monthly : daily;
  if (!use.length) return { month, gross: null, source: null, records: 0, byOutlet: [] };
  const outlets = new Map<string | null, bigint>();
  let total = 0n;
  for (const r of use) {
    const sen = toSen(Number(r.amount));
    total += sen;
    const k = r.outlet?.trim() || null;
    outlets.set(k, (outlets.get(k) ?? 0n) + sen);
  }
  const byOutlet = [...outlets.entries()]
    .map(([outlet, sen]) => ({ outlet, amount: Number(sen) / 100 }))
    .sort((a, b) => (a.outlet ?? "").localeCompare(b.outlet ?? ""));
  return { month, gross: Number(total) / 100, source: monthly.length ? "monthly" : "daily", records: use.length, byOutlet };
}

// ── tiers ───────────────────────────────────────────────────────────────────

/** Mirrors the DB check (public.valid_gto_tiers): ascending bounds, last band open, 0 ≤ rate ≤ 1. */
export function validateTiers(tiers: unknown): string | null {
  if (!Array.isArray(tiers) || tiers.length === 0) return "Add at least one band.";
  if (tiers.length > 20) return "At most 20 bands.";
  let prev = 0;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i] as Partial<GtoTier>;
    if (typeof t?.rate !== "number" || !Number.isFinite(t.rate) || t.rate < 0 || t.rate > 1)
      return `Band ${i + 1}: rate must be between 0% and 100%.`;
    const last = i === tiers.length - 1;
    if (last) {
      if (t.up_to !== null && t.up_to !== undefined) return "The last band must be open-ended (“and above”).";
    } else {
      if (typeof t.up_to !== "number" || !Number.isFinite(t.up_to)) return `Band ${i + 1}: enter the upper limit.`;
      if (t.up_to <= prev) return `Band ${i + 1}: limits must increase (each above RM ${prev.toLocaleString("en-MY")}).`;
      prev = t.up_to;
    }
  }
  return null;
}

/** Tiers in force: the tenant's bands, else `rent_rate_pct` as one flat band, else null (no GTO terms). */
export function effectiveTiers(t: { gto_tiers?: GtoTier[] | null; rent_rate_pct?: number | null }): GtoTier[] | null {
  if (Array.isArray(t.gto_tiers) && t.gto_tiers.length) return t.gto_tiers;
  if (t.rent_rate_pct !== null && t.rent_rate_pct !== undefined && Number.isFinite(Number(t.rent_rate_pct)))
    return [{ up_to: null, rate: Number(t.rent_rate_pct) / 100 }];
  return null;
}

export type BandLine = {
  no: number;
  from: number; // RM, exclusive lower bound (0 for the first band)
  to: number | null; // RM, inclusive upper bound; null = and above
  label: string; // as in the Excel: "0 - 400,000", "400,001 - Above"
  rate: number; // fraction
  sales: number; // gross sales falling in this band (RM)
  amount: number; // rounded to the sen
  exact: string; // exact decimal
};

const fmtInt = (n: number) => n.toLocaleString("en-MY", { maximumFractionDigits: 2 });
export function bandLabel(from: number, to: number | null): string {
  const lo = from === 0 ? "0" : fmtInt(from + 1);
  return to === null ? `${lo} - Above` : `${lo} - ${fmtInt(to)}`;
}

export type GtoCalc = {
  gross: number;
  bands: BandLine[];
  gto: number; // turnover rent, rounded to the sen
  sstPct: number;
  sst: number; // SST amount, rounded
  afterSst: number; // GTO × (1 + SST%), rounded
  /** exact values (RM × 1e14) as strings so they survive server → client serialisation; sum with sumUnits */
  units: { gto: string; afterSst: string };
};

/** Marginal tiered turnover rent on one month's gross sales, with an Excel-style band breakdown. */
export function tieredGto(gross: number, tiers: GtoTier[], sstPct = 0): GtoCalc {
  const grossSen = toSen(gross);
  let lowerSen = 0n;
  let gtoUnits = 0n;
  const bands: BandLine[] = tiers.map((t, i) => {
    const upperSen = t.up_to === null ? null : toSen(t.up_to);
    const cap = upperSen === null ? grossSen : upperSen < grossSen ? upperSen : grossSen;
    const inBand = cap > lowerSen ? cap - lowerSen : 0n;
    // sen × ppm = RM × 1e8 → × 1e6 to SCALE
    const units = inBand * ppm(t.rate) * 10n ** 6n;
    gtoUnits += units;
    const line: BandLine = {
      no: i + 1,
      from: Number(lowerSen) / 100,
      to: t.up_to,
      label: bandLabel(Number(lowerSen) / 100, t.up_to),
      rate: t.rate,
      sales: Number(inBand) / 100,
      amount: unitsToRm(units),
      exact: unitsToExact(units),
    };
    if (upperSen !== null) lowerSen = upperSen;
    return line;
  });
  const sstE4 = BigInt(Math.round((sstPct || 0) * 1e4)); // percent × 1e4
  // gto × (100 + pct)/100 = gto × (1e6 + pct·1e4)/1e6 — exact because gtoUnits is a multiple of 1e6
  const afterUnits = (gtoUnits * (10n ** 6n + sstE4)) / 10n ** 6n;
  return {
    gross: Number(grossSen) / 100,
    bands,
    gto: unitsToRm(gtoUnits),
    sstPct: sstPct || 0,
    sst: unitsToRm(afterUnits - gtoUnits),
    afterSst: unitsToRm(afterUnits),
    units: { gto: gtoUnits.toString(), afterSst: afterUnits.toString() },
  };
}

/** GTO × (1 + SST%), exact then rounded to the sen. */
export function withSst(gto: number, sstPct: number): number {
  const u = toSen(gto) * 10n ** 12n;
  return unitsToRm((u * (10n ** 6n + BigInt(Math.round(sstPct * 1e4)))) / 10n ** 6n);
}

/** Sum exact unit strings and round once (how Excel totals a column of unrounded cells). */
export function sumUnits(values: (string | null | undefined)[]): number {
  return unitsToRm(values.reduce<bigint>((s, v) => (v ? s + BigInt(v) : s), 0n));
}

// ── a tenant's year ───────────────────────────────────────────────────────────

export type GtoTerms = {
  gto_tiers?: GtoTier[] | null;
  rent_rate_pct?: number | null;
  gto_sst_pct?: number | null;
  base_rent_monthly?: number | null;
};

export type GtoMonth = MonthlyGross & {
  calc: GtoCalc | null; // null when there are no sales or no GTO terms
  baseRent: number | null;
  /** base rent + GTO after SST, only for months with sales and a known base rent */
  totalRent: number | null;
  totalRentUnits: string | null;
};

export type GtoYear = {
  year: number;
  months: GtoMonth[]; // 12 entries, Jan..Dec
  tiers: GtoTier[] | null;
  totals: { gross: number; gto: number; afterSst: number; baseRent: number | null; totalRent: number | null; monthsWithSales: number };
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function gtoYear(records: GrossRecord[], terms: GtoTerms, year: number): GtoYear {
  const tiers = effectiveTiers(terms);
  const sst = Number(terms.gto_sst_pct ?? 0);
  const base = terms.base_rent_monthly === null || terms.base_rent_monthly === undefined ? null : Number(terms.base_rent_monthly);
  const months: GtoMonth[] = MONTHS.map((_, i) => {
    const g = monthlyGross(records, `${year}-${String(i + 1).padStart(2, "0")}`);
    const calc = g.gross !== null && tiers ? tieredGto(g.gross, tiers, sst) : null;
    const trUnits = base !== null && g.gross !== null ? toSen(base) * SEN + BigInt(calc?.units.afterSst ?? "0") : null;
    return { ...g, calc, baseRent: base, totalRent: trUnits === null ? null : unitsToRm(trUnits), totalRentUnits: trUnits?.toString() ?? null };
  });
  const withSales = months.filter((m) => m.gross !== null);
  const grossSen = withSales.reduce((s, m) => s + toSen(m.gross!), 0n);
  return {
    year,
    months,
    tiers,
    totals: {
      gross: Number(grossSen) / 100,
      gto: sumUnits(withSales.map((m) => m.calc?.units.gto)),
      afterSst: sumUnits(withSales.map((m) => m.calc?.units.afterSst)),
      baseRent: base === null ? null : Number(toSen(base) * BigInt(withSales.length)) / 100,
      totalRent: base === null ? null : sumUnits(withSales.map((m) => m.totalRentUnits)),
      monthsWithSales: withSales.length,
    },
  };
}

/** Portfolio rows: per-month sums across tenants (exact) — null where no tenant had sales — and the year total. */
export function portfolioYear(years: GtoYear[]) {
  const months = MONTHS.map((_, i) => {
    const ms = years.map((y) => y.months[i]).filter((m) => m.gross !== null);
    if (!ms.length) return { gross: null, gto: null, afterSst: null, totalRent: null };
    return {
      gross: Number(ms.reduce((s, m) => s + toSen(m.gross!), 0n)) / 100,
      gto: sumUnits(ms.map((m) => m.calc?.units.gto)),
      afterSst: sumUnits(ms.map((m) => m.calc?.units.afterSst)),
      totalRent: ms.some((m) => m.totalRentUnits !== null) ? sumUnits(ms.map((m) => m.totalRentUnits)) : null,
    };
  });
  const all = years.flatMap((y) => y.months).filter((m) => m.gross !== null);
  return {
    months,
    totals: {
      gross: Number(all.reduce((s, m) => s + toSen(m.gross!), 0n)) / 100,
      gto: sumUnits(all.map((m) => m.calc?.units.gto)),
      afterSst: sumUnits(all.map((m) => m.calc?.units.afterSst)),
      totalRent: all.some((m) => m.totalRentUnits !== null) ? sumUnits(all.map((m) => m.totalRentUnits)) : null,
    },
  };
}

const pctStr = (rate: number) => `${Number((rate * 100).toFixed(4))}%`;
/** One-line summary of the bands, e.g. "0% to RM 400,000 · 3% above". */
export function tiersSummary(tiers: GtoTier[] | null): string {
  if (!tiers?.length) return "No turnover rent terms";
  if (tiers.length === 1) return `${pctStr(tiers[0].rate)} of all sales`;
  return tiers
    .map((t, i) => (t.up_to === null ? `${pctStr(t.rate)} above` : `${pctStr(t.rate)} to RM ${fmtInt(t.up_to)}`))
    .join(" · ");
}
