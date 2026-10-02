import { describe, expect, it } from "vitest";
import { parseOutlet, parseTerms, parseTiers } from "../lib/logic/terms";

const form = (o: Record<string, string | string[]>) => ({
  get: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[])[0] : o[k]),
  getAll: (k: string) => (o[k] === undefined ? [] : Array.isArray(o[k]) ? (o[k] as string[]) : [o[k] as string]),
});

describe("parseTiers", () => {
  it("percent rows → fractional marginal bands, last open-ended", () => {
    expect(parseTiers(["150,000", "350000", ""], ["0", "1.5", "4.5"])).toEqual({
      ok: true,
      value: [
        { up_to: 150000, rate: 0 },
        { up_to: 350000, rate: 0.015 },
        { up_to: null, rate: 0.045 },
      ],
    });
  });
  it("no rows → null (flat % rent applies)", () => expect(parseTiers([], [])).toEqual({ ok: true, value: null }));
  it("ignores an upper limit typed on the last row", () => {
    expect(parseTiers(["300000", "999"], ["0", "5"])).toEqual({ ok: true, value: [{ up_to: 300000, rate: 0 }, { up_to: null, rate: 0.05 }] });
  });
  it("errors", () => {
    expect(parseTiers(["", ""], ["0", "2.5"])).toMatchObject({ ok: false, error: expect.stringMatching(/upper limit/) });
    expect(parseTiers(["500", ""], ["", "2"])).toMatchObject({ ok: false, error: expect.stringMatching(/rate/) });
    expect(parseTiers(["500", "400", ""], ["0", "1", "2"])).toMatchObject({ ok: false, error: expect.stringMatching(/increase/) });
    expect(parseTiers([""], ["120"])).toMatchObject({ ok: false });
  });
});

describe("parseTerms", () => {
  it("a made-up tenant's terms", () => {
    const f = form({
      property: "  ", base_rent_monthly: "RM12,500", lease_start: "2025-07-01", lease_end: "2028-06-30", gto_sst_pct: "",
      tier_up_to: ["300000", ""], tier_rate_pct: ["0", "5"],
    });
    expect(parseTerms(f.get, f.getAll)).toEqual({
      ok: true,
      value: { property: null, base_rent_monthly: 12500, lease_start: "2025-07-01", lease_end: "2028-06-30", gto_sst_pct: 0,
        gto_tiers: [{ up_to: 300000, rate: 0 }, { up_to: null, rate: 0.05 }] },
    });
  });
  it("validation errors", () => {
    const f = form({ base_rent_monthly: "-5", lease_start: "2027-01-01", lease_end: "2026-01-01", gto_sst_pct: "150", tier_up_to: ["5"], tier_rate_pct: ["1"] });
    const r = parseTerms(f.get, f.getAll);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["base_rent_monthly", "gto_sst_pct", "lease_end"].sort());
  });
});

describe("parseOutlet", () => {
  it("trims, collapses, blanks → null", () => {
    expect(parseOutlet("  Outlet   North ")).toEqual({ ok: true, value: "Outlet North" });
    expect(parseOutlet("   ")).toEqual({ ok: true, value: null });
    expect(parseOutlet("x".repeat(81)).ok).toBe(false);
  });
});

import { parseCsv } from "../lib/logic/csv";
import type { Tenant } from "../lib/data/types";
describe("CSV import: optional outlet column", () => {
  const tc = { id: "t-c", name: "Demo Tenant C", unit: null } as unknown as Tenant;
  it("reads outlet, blank → null, monthly rows on the 1st", () => {
    const rows = parseCsv("tenant,date,amount,period_type,outlet\nDemo Tenant C,2026-01-01,120450.5,monthly,Outlet North\nDemo Tenant C,2026-01-01,60210.25,monthly,", [tc]);
    expect(rows.map((r) => r.record?.outlet)).toEqual(["Outlet North", null]);
    expect(rows[0].record).toMatchObject({ period_type: "monthly", amount: 120450.5, recorded_at: "2026-01-01T04:00:00.000Z" });
  });
  it("files without an outlet column still import", () => {
    expect(parseCsv("tenant,date,amount\nDemo Tenant C,2026-01-05,10", [tc])[0].record?.outlet).toBeNull();
  });
});
