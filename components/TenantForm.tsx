"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeTenant, saveTenant, type ActionState } from "@/app/actions";
import type { Tenant } from "@/lib/data/types";
import { Modal, modalFooterCls } from "./Modal";
import { useToast } from "./Toast";
import { Field, btnDanger, btnPrimary, btnSecondary, inputCls } from "./ui";
import { TierEditor } from "./TierEditor";
import { useCanWrite } from "./Workspace";

const CATEGORIES = ["F&B", "Fashion", "Electronics", "Grocery", "Kids", "Health & Beauty", "Services", "Entertainment", "Other"];

export function TenantForm({ tenant, onDone, onCancel }: { tenant?: Tenant; onDone: (msg: string) => void; onCancel?: () => void }) {
  const [state, setState] = useState<ActionState>({});
  const [pending, setPending] = useState(false);
  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    setPending(true);
    try {
      const r = await saveTenant({}, fd);
      setState(r);
      if (r.ok) onDone(r.message ?? "Saved.");
    } catch {
      setState({ errors: { form: "Couldn’t reach the server. Try again." } });
    } finally {
      setPending(false);
    }
  }
  const e = state.errors ?? {};
  return (
    <form
      onSubmit={submit}
      className="space-y-4"
      noValidate
    >
      {tenant && <input type="hidden" name="id" value={tenant.id} />}
      <Field label="Tenant name" htmlFor="t-name" error={e.name}>
        <input id="t-name" name="name" defaultValue={tenant?.name} className={inputCls} placeholder="e.g. Coffee House" autoComplete="off" enterKeyHint="next" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Category" htmlFor="t-cat">
          <input id="t-cat" name="category" list="tenant-categories" defaultValue={tenant?.category ?? ""} className={inputCls} placeholder="F&B" />
          <datalist id="tenant-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Unit" htmlFor="t-unit">
          <input id="t-unit" name="unit" defaultValue={tenant?.unit ?? ""} className={inputCls} placeholder="A-12" />
        </Field>
        <Field label="Flat % rent (if no bands)" htmlFor="t-rate" error={e.rent_rate_pct}>
          <input
            id="t-rate"
            name="rent_rate_pct"
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            enterKeyHint="done"
            defaultValue={tenant?.rent_rate_pct ?? ""}
            className={inputCls}
            placeholder="8.0"
          />
        </Field>
      </div>
      <details className="group rounded-2xl border border-line bg-canvas/60 p-3 open:bg-white sm:p-4" open={Boolean(tenant?.gto_tiers?.length || tenant?.base_rent_monthly || tenant?.property || e.property || e.base_rent_monthly || e.lease_start || e.lease_end || e.gto_sst_pct || e.gto_tiers)}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-semibold text-ink">
          Lease &amp; GTO terms
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-muted transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>
        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Property" htmlFor="t-property" error={e.property}>
              <input id="t-property" name="property" defaultValue={tenant?.property ?? ""} className={inputCls} placeholder="e.g. mall or building" />
            </Field>
            <Field label="Base rent / month (RM)" htmlFor="t-base" error={e.base_rent_monthly}>
              <input id="t-base" name="base_rent_monthly" inputMode="decimal" defaultValue={tenant?.base_rent_monthly ?? ""} className={`${inputCls} num`} placeholder="12,500" />
            </Field>
            <Field label="Lease start" htmlFor="t-ls" error={e.lease_start}>
              <input id="t-ls" name="lease_start" type="date" defaultValue={tenant?.lease_start ?? ""} className={inputCls} />
            </Field>
            <Field label="Lease end" htmlFor="t-le" error={e.lease_end}>
              <input id="t-le" name="lease_end" type="date" defaultValue={tenant?.lease_end ?? ""} className={inputCls} />
            </Field>
            <Field label="SST on GTO (%)" htmlFor="t-sst" error={e.gto_sst_pct}>
              <input id="t-sst" name="gto_sst_pct" inputMode="decimal" defaultValue={tenant?.gto_sst_pct ? String(tenant.gto_sst_pct) : ""} className={`${inputCls} num`} placeholder="0 (e.g. 6)" />
            </Field>
          </div>
          <TierEditor initial={tenant?.gto_tiers} error={e.gto_tiers} />
        </div>
      </details>
      {e.form && (
        <p role="alert" className="rounded-xl bg-neg-bg px-3 py-2 text-sm text-rose-800">
          {e.form}
        </p>
      )}
      <div className={modalFooterCls}>
        {onCancel && (
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? "Saving…" : tenant ? "Save tenant" : "Add tenant"}
        </button>
      </div>
    </form>
  );
}

export function TenantButton({ tenant, label }: { tenant?: Tenant; label?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  if (!useCanWrite()) return null;
  return (
    <>
      <button type="button" className={tenant ? btnSecondary : btnPrimary} onClick={() => setOpen(true)}>
        {label ?? (tenant ? "Edit" : "Add tenant")}
      </button>
      <Modal title={tenant ? `Edit ${tenant.name}` : "Add tenant"} open={open} onClose={() => setOpen(false)}>
        <TenantForm
          tenant={tenant}
          onCancel={() => setOpen(false)}
          onDone={(m) => {
            setOpen(false);
            toast(m);
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}

/** Two-step inline delete (no browser confirm dialogs). */
export function ConfirmDelete({
  onConfirm,
  label = "Delete",
  confirmLabel = "Confirm delete",
  redirectTo,
  successMessage,
}: {
  onConfirm: () => Promise<ActionState>;
  label?: string;
  confirmLabel?: string;
  redirectTo?: string;
  successMessage?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const canWrite = useCanWrite();
  if (!canWrite) return null;
  if (!armed)
    return (
      <button type="button" className={btnDanger} onClick={() => setArmed(true)}>
        {label}
      </button>
    );
  return (
    <span className="inline-flex flex-wrap gap-1">
      <button
        type="button"
        className={`${btnDanger} bg-rose-50`}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await onConfirm();
          setBusy(false);
          setArmed(false);
          if (r.ok) {
            toast(successMessage ?? r.message ?? "Deleted.");
            if (redirectTo) router.push(redirectTo);
            router.refresh();
          } else toast(r.errors?.form ?? "Delete failed.", "error");
        }}
      >
        {busy ? "Deleting…" : confirmLabel}
      </button>
      <button type="button" className="min-h-11 touch-manipulation rounded-full px-3.5 text-sm font-semibold text-ink-2 hover:bg-row sm:min-h-10" onClick={() => setArmed(false)}>
        Cancel
      </button>
    </span>
  );
}

export function DeleteTenant({ tenant, redirectTo }: { tenant: Tenant; redirectTo?: string }) {
  return (
    <ConfirmDelete
      onConfirm={() => removeTenant(tenant.id)}
      label="Delete"
      confirmLabel={`Delete ${tenant.name} + its sales`}
      redirectTo={redirectTo}
    />
  );
}
