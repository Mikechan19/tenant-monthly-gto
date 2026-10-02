import type { SalesRecord, Tenant } from "@/lib/data/types";
import {
  WEEKDAYS,
  addDays,
  dayKey,
  daysInMonth,
  monthStart,
  myHour,
  prevMonthStart,
  weekStart,
} from "./dates";

/**
 * Daily GTO counts hourly + daily records. Weekly and monthly figures are
 * period summaries and are reported separately so they are never double-counted
 * into a single day.
 */
export function isDailyGranular(r: Pick<SalesRecord, "period_type">) {
  return r.period_type === "hourly" || r.period_type === "daily";
}

/** Map of dayKey → total (optionally for one tenant). */
export function dailyTotals(records: SalesRecord[], tenantId?: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of records) {
    if (!isDailyGranular(r)) continue;
    if (tenantId && r.tenant_id !== tenantId) continue;
    const k = dayKey(r.recorded_at);
    out.set(k, (out.get(k) ?? 0) + Number(r.amount));
  }
  return out;
}

/** Map of tenantId → (dayKey → total). */
export function dailyTotalsByTenant(records: SalesRecord[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const r of records) {
    if (!isDailyGranular(r)) continue;
    let m = out.get(r.tenant_id);
    if (!m) out.set(r.tenant_id, (m = new Map()));
    const k = dayKey(r.recorded_at);
    m.set(k, (m.get(k) ?? 0) + Number(r.amount));
  }
  return out;
}

export type ComparePoint = {
  label: string;
  current: number | null;
  previous: number | null;
  currentDate: string | null;
  previousDate: string | null;
};

export type CompareMode = "wow" | "mom";

/**
 * Comparison series for the Daily Report.
 *  - wow: Mon–Sun of this week vs last week.
 *  - mom: day 1..31 of this month vs last month.
 * Future days in the current period are null (not zero) so the line stops at today.
 */
export function compareSeries(
  totals: Map<string, number>,
  mode: CompareMode,
  today: string,
): ComparePoint[] {
  if (mode === "wow") {
    const thisMon = weekStart(today);
    const lastMon = addDays(thisMon, -7);
    return WEEKDAYS.map((label, i) => {
      const cur = addDays(thisMon, i);
      const prev = addDays(lastMon, i);
      return {
        label,
        current: cur <= today ? (totals.get(cur) ?? 0) : null,
        previous: totals.get(prev) ?? 0,
        currentDate: cur,
        previousDate: prev,
      };
    });
  }
  const thisStart = monthStart(today);
  const lastStart = prevMonthStart(today);
  const nThis = daysInMonth(thisStart);
  const nLast = daysInMonth(lastStart);
  const n = Math.max(nThis, nLast);
  const pts: ComparePoint[] = [];
  for (let i = 0; i < n; i++) {
    const cur = i < nThis ? addDays(thisStart, i) : null;
    const prev = i < nLast ? addDays(lastStart, i) : null;
    pts.push({
      label: String(i + 1),
      current: cur && cur <= today ? (totals.get(cur) ?? 0) : null,
      previous: prev ? (totals.get(prev) ?? 0) : null,
      currentDate: cur,
      previousDate: prev,
    });
  }
  return pts;
}

export function sumSeries(points: ComparePoint[], key: "current" | "previous", uptoIndex?: number) {
  return points.reduce(
    (s, p, i) => (uptoIndex !== undefined && i > uptoIndex ? s : s + (p[key] ?? 0)),
    0,
  );
}

/** Percentage change, or null when the base is zero. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export type TenantRank = {
  tenant: Tenant;
  today: number;
  yesterday: number;
  share: number;
};

export function rankTenants(tenants: Tenant[], records: SalesRecord[], today: string): TenantRank[] {
  const by = dailyTotalsByTenant(records);
  const yesterday = addDays(today, -1);
  const rows = tenants.map((t) => {
    const m = by.get(t.id);
    return { tenant: t, today: m?.get(today) ?? 0, yesterday: m?.get(yesterday) ?? 0, share: 0 };
  });
  const total = rows.reduce((s, r) => s + r.today, 0);
  for (const r of rows) r.share = total ? r.today / total : 0;
  return rows.sort((a, b) => b.today - a.today || b.yesterday - a.yesterday);
}

/** Hourly totals (0–23) for one tenant on one day — hourly records only. */
export function hourlyBreakdown(records: SalesRecord[], tenantId: string, day: string) {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, amount: 0 }));
  let any = false;
  for (const r of records) {
    if (r.tenant_id !== tenantId || r.period_type !== "hourly") continue;
    if (dayKey(r.recorded_at) !== day) continue;
    hours[myHour(r.recorded_at)].amount += Number(r.amount);
    any = true;
  }
  return any ? hours : null;
}

/** Last N days as an ordered series (oldest first). */
export function lastNDays(totals: Map<string, number>, today: string, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(today, i - (n - 1));
    return { date: d, amount: totals.get(d) ?? 0 };
  });
}
