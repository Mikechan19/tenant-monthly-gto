import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import synthetic from "./fixtures/synthetic_gto_2026.json";
import {
  bandLabel,
  effectiveTiers,
  gtoYear,
  monthlyGross,
  portfolioYear,
  sumUnits,
  tieredGto,
  tiersSummary,
  unitsToExact,
  validateTiers,
  withSst,
  type GrossRecord,
  type GtoTier,
} from "../lib/logic/gto";
import { myWallToUtc } from "../lib/logic/dates";

// Fixture shape (written by scripts/gto_from_excel.py for the real Excel → private/, gitignored; and by
// scripts/make_synthetic_gto_fixture.py for made-up tenants → __tests__/fixtures/, committed).
type Band = { label: string; rate: number; sales: number; excel_exact: string; excel_cents: string };
type Month = {
  gross: number;
  gto_exact: string;
  gto_cents: string;
  bands?: Band[];
  after_sst_exact?: string;
  after_sst_cents?: string;
  outlets?: Record<string, number>;
};
type FxTenant = { name: string; tiers: GtoTier[]; sst_pct: number; months: Record<string, Month>; outlets?: string[]; base_rent_monthly?: number | null };
type Fixture = { year: number; tenants: FxTenant[]; excel_summary_sheet: Record<string, Record<string, { gross: number | null; gto: number }>> };

const PRIVATE_FIXTURE = path.resolve(__dirname, "../private/excel_gto_2026.json");
const real: Fixture | null = existsSync(PRIVATE_FIXTURE) ? JSON.parse(readFileSync(PRIVATE_FIXTURE, "utf8")) : null;
const fake = synthetic as unknown as Fixture;

const money = (s: string) => Number(s);
const monthlyRec = (year: number, month: number, amount: number, outlet: string | null = null): GrossRecord => ({
  period_type: "monthly",
  amount,
  outlet,
  recorded_at: myWallToUtc(`${year}-${String(month).padStart(2, "0")}-01`, 12).toISOString(),
});
const recordsOf = (t: FxTenant, year: number) =>
  Object.entries(t.months).flatMap(([m, x]) =>
    x.outlets ? Object.entries(x.outlets).map(([o, a]) => monthlyRec(year, Number(m), a, o)) : [monthlyRec(year, Number(m), x.gross)],
  );
/** Exact decimal string → app units (RM × 1e14), to sum the fixture's own exact figures. */
const decUnits = (s: string) => {
  const [w, f = ""] = s.replace("-", "").split(".");
  const u = BigInt(w) * 10n ** 14n + BigInt((f + "0".repeat(14)).slice(0, 14));
  return s.startsWith("-") ? -u : u;
};

/** Every month of every tenant in a fixture must come out identical, band by band, to the cent. */
function reconcile(fx: Fixture) {
  for (const t of fx.tenants) {
    const y = gtoYear(recordsOf(t, fx.year), { gto_tiers: t.tiers, gto_sst_pct: t.sst_pct, base_rent_monthly: t.base_rent_monthly ?? null }, fx.year);
    for (const [m, x] of Object.entries(t.months)) {
      it(`${t.name} · month ${m}: gross ${x.gross} → GTO ${x.gto_cents}${x.after_sst_cents ? `, after SST ${x.after_sst_cents}` : ""}`, () => {
        const mm = y.months[Number(m) - 1];
        expect(mm.gross).toBe(x.gross);
        expect(mm.calc!.gto).toBe(money(x.gto_cents));
        expect(unitsToExact(BigInt(mm.calc!.units.gto))).toBe(x.gto_exact);
        if (x.after_sst_cents) {
          expect(mm.calc!.afterSst).toBe(money(x.after_sst_cents));
          expect(unitsToExact(BigInt(mm.calc!.units.afterSst))).toBe(x.after_sst_exact);
        } else {
          expect(mm.calc!.afterSst).toBe(mm.calc!.gto); // no SST
        }
        if (x.bands) {
          const b = mm.calc!.bands;
          expect(b.map((z) => z.label)).toEqual(x.bands.map((z) => z.label));
          expect(b.map((z) => z.rate)).toEqual(x.bands.map((z) => z.rate));
          expect(b.map((z) => z.sales)).toEqual(x.bands.map((z) => z.sales));
          expect(b.map((z) => z.exact)).toEqual(x.bands.map((z) => z.excel_exact));
          expect(b.map((z) => z.amount)).toEqual(x.bands.map((z) => money(z.excel_cents)));
        }
        if (x.outlets) {
          expect(mm.byOutlet.map((o) => o.outlet)).toEqual(Object.keys(x.outlets).sort());
          expect(mm.byOutlet.map((o) => o.amount)).toEqual(Object.keys(x.outlets).sort().map((o) => x.outlets![o]));
        }
        if (t.base_rent_monthly != null) expect(mm.totalRent).toBe(Math.round((t.base_rent_monthly + mm.calc!.afterSst) * 100) / 100);
      });
    }
    it(`${t.name}: months without sales → null ("—"), never 0 or negative`, () => {
      for (const mm of y.months.filter((_, i) => !t.months[String(i + 1)])) {
        expect(mm.gross).toBeNull();
        expect(mm.calc).toBeNull();
        expect(mm.totalRent).toBeNull();
      }
    });
    it(`${t.name}: annual totals = exact sum of the monthly figures, rounded once`, () => {
      const xs = Object.values(t.months);
      expect(y.totals.monthsWithSales).toBe(xs.length);
      expect(y.totals.gross).toBe(Math.round(xs.reduce((s, x) => s + x.gross * 100, 0)) / 100);
      expect(y.totals.gto).toBe(sumUnits(xs.map((x) => decUnits(x.gto_exact).toString())));
      if (xs.every((x) => x.after_sst_exact)) expect(y.totals.afterSst).toBe(sumUnits(xs.map((x) => decUnits(x.after_sst_exact!).toString())));
    });
  }
}

describe("synthetic fixture (made-up tenants) reconciles to the cent", () => reconcile(fake));

describe.skipIf(!real)("private Excel fixture (local only: private/excel_gto_2026.json) reconciles to the cent", () => {
  if (!real) return;
  reconcile(real);
});

describe("synthetic edge cases", () => {
  const [A, B, C] = fake.tenants;
  it("half-sen rounding: Demo Tenant B 700,001 → exactly 18,750.045 → RM 18,750.05 (naive float gives .04)", () => {
    const naive = Math.round((200000 * 0.015 + 350001 * 0.045) * 100) / 100;
    expect(naive).toBe(18750.04);
    const r = tieredGto(700001, B.tiers, 8);
    expect(unitsToExact(BigInt(r.units.gto))).toBe("18750.045");
    expect(r.gto).toBe(18750.05);
    expect(r.afterSst).toBe(20250.05); // 18,750.045 × 1.08 = 20,250.0486
  });
  it("below / exactly on the threshold → GTO 0 and nothing in the upper band", () => {
    expect(tieredGto(385000, A.tiers).gto).toBe(0);
    const on = tieredGto(400000, A.tiers);
    expect(on.gto).toBe(0);
    expect(on.bands.map((b) => b.sales)).toEqual([400000, 0]);
    expect(tieredGto(400000.01, A.tiers).bands[1].sales).toBe(0.01);
  });
  it("two outlets cross the threshold only combined (Demo Tenant C, month 4)", () => {
    const m4 = C.months["4"];
    const outlets = Object.values(m4.outlets!);
    expect(outlets.every((a) => tieredGto(a, C.tiers).gto === 0)).toBe(true);
    const g = monthlyGross(recordsOf(C, 2026), "2026-04");
    expect(g.gross).toBe(312345.67);
    expect(tieredGto(g.gross!, C.tiers).gto).toBe(617.28); // 12,345.67 × 5% = 617.2835
  });
  it("base rent + GTO = total rent, totals over months with sales only", () => {
    const y = gtoYear(recordsOf(C, 2026), { gto_tiers: C.tiers, base_rent_monthly: 12500 }, 2026);
    expect(y.months[3].totalRent).toBe(13117.28);
    expect(y.months[0].totalRent).toBe(12500);
    expect(y.totals.baseRent).toBe(12500 * 7);
    expect(y.totals.totalRent).toBe(12500 * 7 + 617.28);
    expect(y.months[7].totalRent).toBeNull();
  });
  it("zero sales → 0 GTO, never negative", () => {
    const r = tieredGto(0, B.tiers, 8);
    expect([r.gto, r.afterSst]).toEqual([0, 0]);
    expect(r.bands.every((b) => b.sales === 0 && b.amount === 0)).toBe(true);
  });
  it("flat rent_rate_pct fallback when no tiers; tiers win when both", () => {
    expect(effectiveTiers({ gto_tiers: null, rent_rate_pct: 8 })).toEqual([{ up_to: null, rate: 0.08 }]);
    expect(tieredGto(1000, effectiveTiers({ rent_rate_pct: 8 })!).gto).toBe(80);
    expect(effectiveTiers({ gto_tiers: [], rent_rate_pct: null })).toBeNull();
    expect(effectiveTiers({ gto_tiers: A.tiers, rent_rate_pct: 8 })).toBe(A.tiers);
  });
  it("no terms at all → gross shown, GTO null", () => {
    const y = gtoYear([monthlyRec(2026, 1, 500)], {}, 2026);
    expect(y.months[0].gross).toBe(500);
    expect(y.months[0].calc).toBeNull();
  });
  it("withSst and sumUnits round half-up once", () => {
    expect(withSst(18750.05, 8)).toBe(20250.05);
    expect(withSst(100, 0)).toBe(100);
    const u = tieredGto(700001, B.tiers).units.gto; // 18,750.045
    expect(sumUnits([u, u])).toBe(37500.09);
  });
  it("band labels follow the Excel wording", () => {
    expect(bandLabel(0, 400000)).toBe("0 - 400,000");
    expect(bandLabel(400000, null)).toBe("400,001 - Above");
    expect(bandLabel(150000, 350000)).toBe("150,001 - 350,000");
  });
  it("tiersSummary", () => {
    expect(tiersSummary(B.tiers)).toBe("0% to RM 150,000 · 1.5% to RM 350,000 · 4.5% above");
    expect(tiersSummary([{ up_to: null, rate: 0.08 }])).toBe("8% of all sales");
    expect(tiersSummary(null)).toBe("No turnover rent terms");
  });
});

describe("monthlyGross", () => {
  const day = (d: string, amount: number, period: GrossRecord["period_type"] = "daily"): GrossRecord => ({
    period_type: period,
    amount,
    recorded_at: myWallToUtc(d, 12).toISOString(),
  });
  it("monthly records win over daily/hourly for the same month", () => {
    const g = monthlyGross([day("2026-03-05", 100), monthlyRec(2026, 3, 5000), day("2026-03-06", 50, "hourly")], "2026-03");
    expect(g).toMatchObject({ gross: 5000, source: "monthly", records: 1 });
  });
  it("falls back to daily + hourly, ignores weekly and other months", () => {
    const g = monthlyGross(
      [day("2026-03-05", 100.1), day("2026-03-06", 50.2, "hourly"), day("2026-03-02", 9999, "weekly"), day("2026-04-01", 7)],
      "2026-03",
    );
    expect(g).toMatchObject({ gross: 150.3, source: "daily", records: 2 });
  });
  it("buckets by Malaysia time (00:30 MYT on the 1st belongs to that month)", () => {
    const r: GrossRecord = { period_type: "daily", amount: 10, recorded_at: "2026-02-28T16:30:00Z" }; // = 1 Mar 00:30 MYT
    expect(monthlyGross([r], "2026-03").gross).toBe(10);
    expect(monthlyGross([r], "2026-02").gross).toBeNull();
  });
  it("no records → gross null", () => {
    expect(monthlyGross([], "2026-09")).toMatchObject({ gross: null, source: null, records: 0 });
  });
});

describe("validateTiers (mirrors the DB check)", () => {
  it("accepts the fixture tier sets", () => {
    for (const t of [...fake.tenants, ...(real?.tenants ?? [])]) expect(validateTiers(t.tiers)).toBeNull();
  });
  it("rejects bad shapes", () => {
    expect(validateTiers([])).toMatch(/at least one/);
    expect(validateTiers([{ up_to: 500, rate: 0 }])).toMatch(/open-ended/);
    expect(validateTiers([{ up_to: 500, rate: 0 }, { up_to: 400, rate: 0.1 }, { up_to: null, rate: 0.2 }])).toMatch(/increase/);
    expect(validateTiers([{ up_to: null, rate: 1.5 }])).toMatch(/rate/);
    expect(validateTiers([{ up_to: null, rate: -0.1 }])).toMatch(/rate/);
  });
});

describe("portfolioYear", () => {
  it("sums tenants exactly per month and leaves empty months null", () => {
    const [A, B] = fake.tenants;
    const ya = gtoYear([monthlyRec(2026, 1, 912345)], { gto_tiers: A.tiers, gto_sst_pct: 8 }, 2026);
    const yb = gtoYear([monthlyRec(2026, 1, 700001)], { gto_tiers: B.tiers, gto_sst_pct: 8 }, 2026);
    const p = portfolioYear([ya, yb]);
    expect(p.months[0].gross).toBe(1612346);
    expect(p.months[0].gto).toBe(34120.4); // 15,370.35 + 18,750.045 = 34,120.395 → .40 (rounded once)
    expect(p.months[1]).toEqual({ gross: null, gto: null, afterSst: null, totalRent: null });
    expect(p.totals).toMatchObject({ gross: 1612346, gto: 34120.4, totalRent: null });
  });
});
