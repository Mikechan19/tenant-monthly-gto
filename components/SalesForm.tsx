"use client";

import { useActionState, useEffect, useState } from "react";
import { saveSale, type ActionState } from "@/app/actions";
import type { PeriodType, SalesRecord, Tenant } from "@/lib/data/types";
import { Field, btnPrimary, btnSecondary, inputCls } from "./ui";
import { dayKey, myHour, todayKey } from "@/lib/logic/dates";

const PERIOD_HELP: Record<PeriodType, string> = {
  hourly: "Sales for one hour of trading.",
  daily: "Total sales for the day.",
  weekly: "Weekly total — stored against the Monday of that week.",
  monthly: "Monthly total — stored against the 1st of that month.",
};

export function SalesForm({
  tenants,
  defaultTenantId,
  record,
  onDone,
  onCancel,
}: {
  tenants: Pick<Tenant, "id" | "name" | "unit">[];
  defaultTenantId?: string;
  record?: SalesRecord;
  onDone?: (message: string) => void;
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSale, {});
  const [period, setPeriod] = useState<PeriodType>(record?.period_type ?? "daily");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state.ok && state.message) onDone?.(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nonce]);

  const errors = { ...state.errors, ...clientErrors } as Record<string, string | undefined>;
  const today = todayKey();

  function validate(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    if (!fd.get("tenant_id")) errs.tenant_id = "Please select a tenant.";
    const amt = String(fd.get("amount") ?? "");
    if (amt === "") errs.amount = "Enter a sales amount.";
    setClientErrors(errs);
    if (Object.keys(errs).length) e.preventDefault();
  }

  return (
    <form action={action} onSubmit={validate} className="space-y-4" noValidate>
      {record && <input type="hidden" name="id" value={record.id} />}
      <Field label="Tenant" htmlFor="tenant_id" error={errors.tenant_id}>
        <select id="tenant_id" name="tenant_id" defaultValue={record?.tenant_id ?? defaultTenantId ?? ""} className={inputCls}>
          <option value="">Select a tenant…</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.unit ? ` (${t.unit})` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Period" htmlFor="period_type" error={errors.period_type}>
        <select
          id="period_type"
          name="period_type"
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodType)}
          className={inputCls}
        >
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">{PERIOD_HELP[period]}</p>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="date" error={errors.date}>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={record ? dayKey(record.recorded_at) : today}
            className={inputCls}
          />
        </Field>
        {period === "hourly" && (
          <Field label="Hour" htmlFor="hour" error={errors.hour}>
            <select id="hour" name="hour" defaultValue={record ? myHour(record.recorded_at) : new Date().getHours()} className={inputCls}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00 – {String((h + 1) % 24).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <Field label="Amount (RM)" htmlFor="amount" error={errors.amount}>
        <input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="e.g. 1500"
          defaultValue={record ? String(record.amount) : ""}
          className={inputCls}
        />
      </Field>

      {errors.form && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {errors.form}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? "Saving…" : record ? "Save changes" : "Add sales record"}
        </button>
      </div>
    </form>
  );
}
