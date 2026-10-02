import { addDays, daysInMonth, nextMonthStart } from "./dates";

export type ProjectionPeriod = "weekly" | "monthly";

export type ProjectionResult = {
  period: ProjectionPeriod;
  method: "trailing_avg_7d" | "trailing_avg_28d";
  /** Days in the trailing window that had any sales recorded. */
  daysWithData: number;
  windowDays: number;
  avgDaily: number;
  /** Projected total GTO for the next period (next 7 days / next calendar month). */
  projectedAmount: number;
  confidence: number;
  lowConfidence: boolean;
};

/**
 * Rule-based projection (docs/INTELLIGENCE_LAYER.md):
 *  - weekly: trailing 7-day average × 7. Confidence 0.7 if ≥4 days of data, else 0.4.
 *  - monthly: trailing 28-day average × days in next month. Confidence 0.8 if ≥21 days, else 0.5.
 * The average is over days that reported sales (a missing day = not reported, not zero).
 * Returns null when the window has no data ("Not enough data to project").
 */
export function projectFromDaily(
  totals: Map<string, number>,
  today: string,
  period: ProjectionPeriod,
): ProjectionResult | null {
  const windowDays = period === "weekly" ? 7 : 28;
  let sum = 0;
  let daysWithData = 0;
  for (let i = 0; i < windowDays; i++) {
    const v = totals.get(addDays(today, -i));
    if (v !== undefined) {
      sum += v;
      daysWithData++;
    }
  }
  if (daysWithData === 0) return null;
  const avgDaily = sum / daysWithData;
  const horizon = period === "weekly" ? 7 : daysInMonth(nextMonthStart(today));
  const confidence =
    period === "weekly" ? (daysWithData >= 4 ? 0.7 : 0.4) : daysWithData >= 21 ? 0.8 : 0.5;
  return {
    period,
    method: period === "weekly" ? "trailing_avg_7d" : "trailing_avg_28d",
    daysWithData,
    windowDays,
    avgDaily: round2(avgDaily),
    projectedAmount: round2(avgDaily * horizon),
    confidence,
    lowConfidence: confidence < 0.6,
  };
}

/** Estimated percentage rent on a projected GTO. */
export function projectedRent(projected: number, ratePct: number | null): number | null {
  if (ratePct === null || ratePct === undefined) return null;
  return round2((projected * Number(ratePct)) / 100);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
