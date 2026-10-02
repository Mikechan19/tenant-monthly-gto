"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Tenant } from "@/lib/data/types";
import { listTenantOptions } from "@/app/tenant-options";
import { Modal } from "./Modal";
import { SalesForm } from "./SalesForm";
import { useToast } from "./Toast";
import { btnPrimary } from "./ui";
import { useCanWrite } from "./Workspace";

type TenantLite = Pick<Tenant, "id" | "name" | "unit">;
type Registration = { tenants: TenantLite[]; defaultTenantId?: string };

const Ctx = createContext<{
  open: () => void;
  register: (r: Registration) => () => void;
} | null>(null);

/**
 * App-wide "Add Sales" sheet, opened from the mobile bottom nav. Pages that render <AddSales>
 * register their tenant list (and default tenant), so the global sheet opens instantly with the
 * same context; on pages without one it fetches the tenant list on demand.
 */
export function AddSalesProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [state, setState] = useState<{ tenants: TenantLite[] | null; defaultTenantId?: string; error?: string }>({ tenants: null });
  const regs = useRef<Registration[]>([]);
  const router = useRouter();
  const toast = useToast();

  const register = useCallback((r: Registration) => {
    regs.current.push(r);
    return () => {
      regs.current = regs.current.filter((x) => x !== r);
    };
  }, []);

  const open = useCallback(() => {
    const reg = regs.current[regs.current.length - 1];
    setOpen(true);
    if (reg) {
      setState({ tenants: reg.tenants, defaultTenantId: reg.defaultTenantId });
      return;
    }
    setState({ tenants: null });
    listTenantOptions()
      .then((tenants) => setState({ tenants }))
      .catch(() => setState({ tenants: [], error: "Couldn’t load tenants. Check your connection and try again." }));
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ open, register }}>
      {children}
      <Modal title="Add sales record" open={isOpen} onClose={close}>
        {state.error ? (
          <p role="alert" className="text-sm text-rose-700">{state.error}</p>
        ) : state.tenants === null ? (
          <p className="py-6 text-center text-sm text-slate-500" aria-busy="true">Loading tenants…</p>
        ) : state.tenants.length === 0 ? (
          <p className="text-sm text-slate-600">Add a tenant first, then record its sales.</p>
        ) : (
          <SalesForm
            tenants={state.tenants}
            defaultTenantId={state.defaultTenantId}
            onCancel={close}
            onDone={(msg) => {
              setOpen(false);
              toast(msg);
              router.refresh();
            }}
          />
        )}
      </Modal>
    </Ctx.Provider>
  );
}

/** Opens the app-wide Add Sales sheet (no-op outside <AddSalesProvider>). */
export function useOpenAddSales() {
  return useContext(Ctx)?.open ?? (() => {});
}

export function AddSales({
  tenants,
  defaultTenantId,
  label = "Add Sales",
}: {
  tenants: TenantLite[];
  defaultTenantId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const canWrite = useCanWrite();
  const ctx = useContext(Ctx);
  const register = ctx?.register;
  useEffect(() => register?.({ tenants, defaultTenantId }), [register, tenants, defaultTenantId]);

  if (!canWrite) return null; // viewers are read-only

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
