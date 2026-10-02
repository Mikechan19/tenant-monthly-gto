import type { PeriodType } from "@/lib/data/types";
import { PERIOD_TYPES } from "@/lib/data/types";
import { monthStart, myWallToUtc, weekStart } from "./dates";

/**
 * Canonical timestamp for a sales period (Malaysia time):
 *  hourly  → the given hour on the date
 *  daily   → 12:00 on the date
 *  weekly  → 12:00 on the Monday of that week
 *  monthly → 12:00 on the 1st of that month
 */
export function periodTimestamp(period: PeriodType, date: string, hour?: number): Date {
  switch (period) {
    case "hourly":
      return myWallToUtc(date, hour ?? 12);
    case "daily":
      return myWallToUtc(date, 12);
    case "weekly":
      return myWallToUtc(weekStart(date), 12);
    case "monthly":
      return myWallToUtc(monthStart(date), 12);
  }
}

export type SalesFields = {
  tenant_id: string;
  period_type: PeriodType;
  amount: number;
  date: string;
  hour?: number;
};

export type FieldErrors = Partial<Record<"tenant_id" | "period_type" | "amount" | "date" | "hour", string>>;

/** Parses + validates a sales entry. Error copy matches docs/TEST_PLAN.md. */
export function parseSalesFields(input: {
  tenant_id?: unknown;
  period_type?: unknown;
  amount?: unknown;
  date?: unknown;
  hour?: unknown;
}): { ok: true; value: SalesFields } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const tenant_id = String(input.tenant_id ?? "").trim();
  if (!tenant_id) errors.tenant_id = "Please select a tenant.";

  const period_type = String(input.period_type ?? "").trim() as PeriodType;
  if (!PERIOD_TYPES.includes(period_type)) errors.period_type = "Choose hourly, daily, weekly or monthly.";

  const rawAmount = String(input.amount ?? "").replace(/[,\s]|^RM/gi, "");
  const amount = Number(rawAmount);
  if (rawAmount === "" || !Number.isFinite(amount)) errors.amount = "Enter a sales amount.";
  else if (amount < 0) errors.amount = "Amount must be 0 or greater.";

  const date = String(input.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) errors.date = "Enter a valid date.";

  let hour: number | undefined;
  if (period_type === "hourly") {
    hour = Number(input.hour);
    if (String(input.hour ?? "") === "" || !Number.isInteger(hour) || hour < 0 || hour > 23)
      errors.hour = "Pick the hour (0–23).";
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { tenant_id, period_type, amount: Math.round(amount * 100) / 100, date, hour } };
}
