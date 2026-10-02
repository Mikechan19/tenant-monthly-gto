"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Tenant } from "@/lib/data/types";
import { Modal } from "./Modal";
import { SalesForm } from "./SalesForm";
import { useToast } from "./Toast";
import { btnPrimary } from "./ui";
import { useCanWrite } from "./Workspace";

export function AddSales({
  tenants,
  defaultTenantId,
  label = "Add Sales",
}: {
  tenants: Pick<Tenant, "id" | "name" | "unit">[];
  defaultTenantId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  if (!useCanWrite()) return null; // viewers are read-only
  return (
    <>
      <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        {label}
      </button>
      <Modal title="Add sales record" open={open} onClose={() => setOpen(false)}>
        {tenants.length === 0 ? (
          <p className="text-sm text-slate-600">Add a tenant first, then record its sales.</p>
        ) : (
          <SalesForm
            tenants={tenants}
            defaultTenantId={defaultTenantId}
            onCancel={() => setOpen(false)}
            onDone={(msg) => {
              setOpen(false);
              toast(msg);
              router.refresh();
            }}
          />
        )}
      </Modal>
    </>
  );
}
