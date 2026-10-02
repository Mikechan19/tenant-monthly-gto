"use client";

import { useEffect, useState } from "react";
import { listTenantOutlets } from "@/app/tenant-options";
import { saveSale, type ActionState } from "@/app/actions";
import type { PeriodType, SalesRecord, Tenant } from "@/lib/data/types";
import { Field, btnPrimary, btnSecondary, inputCls } from "./ui";
import { modalFooterCls } from "./Modal";
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
  const [state, setState] = useState<ActionState>({});
  const [pending, setPending] = useState(false);
  const [period, setPeriod] = useState<PeriodType>(record?.period_type ?? "daily");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [tenantId, setTenantId] = useState(record?.tenant_id ?? defaultTenantId ?? "");
  const [outlets, setOutlets] = useState<string[]>([]);
  // Suggest the tenant's existing outlets (e.g. "Outlet North", "Outlet South") in the Outlet field.
  useEffect(() => {
    let live = true;
    setOutlets([]);
    if (tenantId) listTenantOutlets(tenantId).then((o) => live && setOutlets(o)).catch(() => {});
    return () => {
      live = false;
    };
  }, [tenantId]);

  const errors = { ...state.errors, ...clientErrors } as Record<string, string | undefined>;
  const today = todayKey();

  // Submitted manually (not via <form action>) so fields keep their values when the
  // server returns a validation error, and the modal closes as soon as the write lands.
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    if (!fd.get("tenant_id")) errs.tenant_id = "Please select a tenant.";
    if (String(fd.get("amount") ?? "") === "") errs.amount = "Enter a sales amount.";
    setClientErrors(errs);
    if (Object.keys(errs).length) return;
    setPending(true);
    try {
      const r = await saveSale({}, fd);
      setState(r);
      if (r.ok) onDone?.(r.message ?? "Saved.");
    } catch {
      setState({ errors: { form: "Couldn’t reach the server. Check your connection and try again." } });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {record && <input type="hidden" name="id" value={record.id} />}
      <Field label="Tenant" htmlFor="tenant_id" error={errors.tenant_id}>
        <select id="tenant_id" name="tenant_id" value={tenantId} onChange={(e) => setTenantId(e.target.value)} className={inputCls}>
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
        <p className="mt-1.5 text-xs text-muted">{PERIOD_HELP[period]}</p>
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
        <div className="relative">
        <span className="num pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-base font-bold text-muted" aria-hidden>
          RM
        </span>
        <input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="e.g. 1500"
          defaultValue={record ? String(record.amount) : ""}
          className={`${inputCls.replace("px-3.5", "pr-3.5 pl-12").replace("min-h-11", "min-h-12").replace("text-base", "text-lg").replace(" sm:text-sm", "")} num font-semibold`}
        />
        </div>
      </Field>

      <Field label="Outlet (optional)" htmlFor="outlet" error={errors.outlet}>
        <input
          id="outlet"
          name="outlet"
          list="outlet-options"
          defaultValue={record?.outlet ?? ""}
          className={inputCls}
          placeholder={outlets[0] ? `e.g. ${outlets[0]}` : "For tenants with several outlets"}
          autoComplete="off"
          maxLength={80}
        />
        <datalist id="outlet-options">
          {outlets.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </Field>

      {errors.form && (
        <p role="alert" className="rounded-xl bg-neg-bg px-3 py-2 text-sm text-rose-800">
          {errors.form}
        </p>
      )}

      <div className={modalFooterCls}>
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
