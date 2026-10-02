"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeProjection, removeSale, reviewProjection, saveProjectionSnapshot } from "@/app/actions";
import type { SalesRecord, Tenant } from "@/lib/data/types";
import { Modal } from "./Modal";
import { SalesForm } from "./SalesForm";
import { ConfirmDelete } from "./TenantForm";
import { useToast } from "./Toast";
import { btnPrimary, btnSecondary } from "./ui";

export function SaleRowActions({ record, tenants }: { record: SalesRecord; tenants: Pick<Tenant, "id" | "name" | "unit">[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="flex flex-wrap justify-end gap-2 *:flex-1 sm:inline-flex sm:gap-1.5 sm:*:flex-none">
      <button type="button" className={`${btnSecondary} px-3 py-1.5`} onClick={() => setOpen(true)}>
        Edit
      </button>
      <ConfirmDelete onConfirm={() => removeSale(record.id)} confirmLabel="Delete record" />
      <Modal title="Edit sales record" open={open} onClose={() => setOpen(false)}>
        <SalesForm
          tenants={tenants}
          record={record}
          onCancel={() => setOpen(false)}
          onDone={(m) => {
            setOpen(false);
            toast(m);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

export function SaveProjectionButton({
  period,
  tenantId,
  label,
  primary,
}: {
  period: "weekly" | "monthly";
  tenantId?: string;
  label: string;
  primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      className={primary ? btnPrimary : btnSecondary}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await saveProjectionSnapshot(period, tenantId);
        setBusy(false);
        if (r.ok) {
          toast(r.message ?? "Saved.");
          router.refresh();
        } else toast(r.errors?.form ?? "Could not save projection.", "error");
      }}
    >
      {busy ? "Saving…" : label}
    </button>
  );
}

export function ProjectionRowActions({ id, status }: { id: string; status: string | null }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const approved = status === "approved";
  return (
    <div className="flex flex-wrap justify-end gap-2 *:flex-1 sm:inline-flex sm:gap-1.5 sm:*:flex-none">
      <button
        type="button"
        className={`${btnSecondary} px-3 py-1.5`}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await reviewProjection(id, approved ? "unreviewed" : "approved");
          setBusy(false);
          if (r.ok) {
            toast(approved ? "Marked unreviewed." : "Projection approved.");
            router.refresh();
          } else toast(r.errors?.form ?? "Update failed.", "error");
        }}
      >
        {approved ? "Unapprove" : "Approve"}
      </button>
      <ConfirmDelete onConfirm={() => removeProjection(id)} confirmLabel="Delete" successMessage="Projection deleted." />
    </div>
  );
}
