import { describe, expect, it } from "vitest";
import { projectFromDaily, projectedRent } from "../lib/logic/projection";
import { compareSeries, dailyTotals } from "../lib/logic/aggregate";
import { addDays, dayKey, myWallToUtc, weekStart } from "../lib/logic/dates";
import { parseSalesFields, periodTimestamp } from "../lib/logic/records";
import { parseCsv } from "../lib/logic/csv";
import type { SalesRecord, Tenant } from "../lib/data/types";

const today = "2026-10-02"; // Friday
const series = (vals: number[]) => new Map(vals.map((v, i) => [addDays(today, -i), v]));

describe("projection (TEST_PLAN §Projection)", () => {
  it("5 days of data → trailing average, confidence 0.7", () => {
    const p = projectFromDaily(series([100, 200, 300, 400, 500]), today, "weekly")!;
    expect(p.daysWithData).toBe(5);
    expect(p.avgDaily).toBe(300);
    expect(p.projectedAmount).toBe(2100);
    expect(p.confidence).toBe(0.7);
    expect(p.lowConfidence).toBe(false);
  });
  it("1 day of data → confidence 0.4, low confidence", () => {
    const p = projectFromDaily(series([1000]), today, "weekly")!;
    expect(p.confidence).toBe(0.4);
    expect(p.lowConfidence).toBe(true);
  });
  it("no data → null (Not enough data to project)", () => {
    expect(projectFromDaily(new Map(), today, "weekly")).toBeNull();
  });
  it("ignores data older than 7 days for weekly", () => {
    const m = new Map([[addDays(today, -8), 9999]]);
    expect(projectFromDaily(m, today, "weekly")).toBeNull();
  });
  it("monthly: 28-day window, confidence 0.8 at ≥21 days, × days in next month (Nov = 30)", () => {
    const p = projectFromDaily(series(Array(21).fill(100)), today, "monthly")!;
    expect(p.confidence).toBe(0.8);
    expect(p.projectedAmount).toBe(3000);
    expect(projectFromDaily(series(Array(20).fill(100)), today, "monthly")!.confidence).toBe(0.5);
  });
  it("percentage rent", () => {
    expect(projectedRent(10000, 8)).toBe(800);
    expect(projectedRent(10000, null)).toBeNull();
  });
});

describe("dates & aggregation (Malaysia time)", () => {
  it("buckets by MYT day — 23:30 UTC belongs to next MYT day", () => {
    expect(dayKey("2026-10-01T23:30:00Z")).toBe("2026-10-02");
    expect(dayKey("2026-10-01T15:59:00Z")).toBe("2026-10-01");
  });
  it("week starts Monday", () => expect(weekStart(today)).toBe("2026-09-28"));
  const rec = (amount: number, at: Date, period: SalesRecord["period_type"] = "daily"): SalesRecord => ({
    id: Math.random().toString(), tenant_id: "t1", period_type: period, amount, recorded_at: at.toISOString(),
    source: "manual", outlet: null, team_id: "team1", user_id: null, created_at: "",
  });
  it("daily totals sum hourly + daily, exclude weekly/monthly", () => {
    const recs = [
      rec(100, myWallToUtc(today, 10), "hourly"),
      rec(200, myWallToUtc(today, 11), "hourly"),
      rec(1500, myWallToUtc(today, 12)),
      rec(50000, myWallToUtc(today, 12), "weekly"),
    ];
    expect(dailyTotals(recs).get(today)).toBe(1800);
  });
  it("WoW series: future days null, last week filled", () => {
    const m = new Map([[today, 10], [addDays(today, -7), 5]]);
    const s = compareSeries(m, "wow", today);
    expect(s).toHaveLength(7);
    expect(s[4]).toMatchObject({ label: "Fri", current: 10, previous: 5 });
    expect(s[5].current).toBeNull();
  });
  it("MoM series covers both months", () => {
    const s = compareSeries(new Map(), "mom", today);
    expect(s).toHaveLength(31); // Oct 31 vs Sep 30
    expect(s[30].previous).toBeNull();
  });
});

describe("sales validation (TEST_PLAN §Error)", () => {
  it("negative amount", () => {
    const r = parseSalesFields({ tenant_id: "x", period_type: "daily", amount: "-100", date: today });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.amount).toBe("Amount must be 0 or greater.");
  });
  it("missing tenant", () => {
    const r = parseSalesFields({ tenant_id: "", period_type: "daily", amount: "1500", date: today });
    expect(!r.ok && r.errors.tenant_id).toBe("Please select a tenant.");
  });
  it("period timestamps", () => {
    expect(periodTimestamp("daily", today).toISOString()).toBe("2026-10-02T04:00:00.000Z");
    expect(periodTimestamp("hourly", today, 9).toISOString()).toBe("2026-10-02T01:00:00.000Z");
    expect(dayKey(periodTimestamp("weekly", today))).toBe("2026-09-28");
    expect(dayKey(periodTimestamp("monthly", today))).toBe("2026-10-01");
  });
});

describe("CSV import", () => {
  const tenants = [{ id: "t1", name: "Coffee House", unit: "A-12" }] as Tenant[];
  it("parses names, units, DD/MM/YYYY, quotes and reports bad rows", () => {
    const rows = parseCsv(
      'Tenant,Date,Amount,Period\n"Coffee House",02/10/2026,"1,250.50",daily\n,2026-10-01,10,daily\nNope,2026-10-01,10,daily\nCoffee House,2026-10-01,-5,daily',
      tenants,
    );
    expect(rows[0].record).toMatchObject({ tenant_id: "t1", amount: 1250.5, period_type: "daily" });
    expect(dayKey(rows[0].record!.recorded_at)).toBe("2026-10-02");
    expect(rows[1].error).toMatch(/Unknown tenant/);
    expect(rows[2].error).toMatch(/Unknown tenant "Nope"/);
    expect(rows[3].error).toBe("Amount must be 0 or greater.");
  });
  it("matches by unit and supports hourly with hour column", () => {
    const rows = parseCsv("unit,date,amount,period_type,hour\nA-12,2026-10-02,300,hourly,14", tenants);
    expect(rows[0].record!.recorded_at).toBe("2026-10-02T06:00:00.000Z");
  });
  it("rejects a header missing required columns", () => {
    expect(parseCsv("foo,bar\n1,2", tenants)[0].error).toMatch(/Header must include/);
  });
});
