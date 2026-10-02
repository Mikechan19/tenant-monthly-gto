"use client";

import { useState, type ReactNode } from "react";
import type { GtoMonth } from "@/lib/logic/gto";
import { Modal } from "./Modal";
import { money } from "@/lib/format";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pct = (r: number) => `${Number((r * 100).toFixed(4))}%`;

/** Excel-style band breakdown for one tenant-month ("JAN(TF)" sheet layout). */
export function GtoBreakdown({ tenant, m, sstPct }: { tenant: string; m: GtoMonth; sstPct: number }) {
  const [y, mm] = m.month.split("-").map(Number);
  return (
    <div className="space-y-4 text-sm" data-testid="gto-breakdown">
      <div className="rounded-xl bg-panel p-3">
        <div className="label-caps text-[10px] text-muted">{tenant} · {MONTH_NAMES[mm - 1]} {y}</div>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-ink-2">Gross sales</span>
          <span className="num text-xl font-bold text-ink" data-testid="breakdown-gross">RM {money(m.gross)}</span>
        </div>
        <div className="mt-1 text-xs text-muted">
          {m.source === "monthly" ? "Monthly sales report" : `Sum of ${m.records} daily / hourly record${m.records === 1 ? "" : "s"}`}
          {m.byOutlet.length > 1 || (m.byOutlet.length === 1 && m.byOutlet[0].outlet) ? (
            <ul className="mt-1.5 space-y-0.5">
              {m.byOutlet.map((o) => (
                <li key={o.outlet ?? "-"} className="flex justify-between gap-3">
                  <span className="text-ink-2">{o.outlet ?? "(no outlet)"}</span>
                  <span className="num text-ink">RM {money(o.amount)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {m.calc ? (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[19rem] text-sm">
            <thead>
              <tr className="label-caps border-b border-line text-left text-[10px] text-muted">
                <th className="py-2 pr-2">No</th>
                <th className="py-2 pr-2">Monthly gross sales (RM)</th>
                <th className="py-2 pr-2 text-right">%</th>
                <th className="py-2 pr-2 text-right">Sales (RM)</th>
                <th className="py-2 text-right">GTO (RM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-row">
              {m.calc.bands.map((b) => (
                <tr key={b.no} data-testid="band-row">
                  <td className="num py-2 pr-2 text-muted">{b.no}</td>
                  <td className="num py-2 pr-2 text-ink-2">{b.label}</td>
                  <td className="num py-2 pr-2 text-right">{pct(b.rate)}</td>
                  <td className="num py-2 pr-2 text-right">{money(b.sales, !Number.isInteger(b.sales))}</td>
                  <td className="num py-2 text-right font-semibold text-ink">{money(b.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line font-bold text-ink">
                <td colSpan={3} className="py-2 pr-2">Turnover rent (GTO)</td>
                <td className="num py-2 pr-2 text-right">{money(m.gross, !Number.isInteger(m.gross ?? 0))}</td>
                <td className="num py-2 text-right" data-testid="breakdown-gto">{money(m.calc.gto)}</td>
              </tr>
              {sstPct > 0 && (
                <tr className="text-ink">
                  <td colSpan={4} className="py-1.5 pr-2 font-semibold">After SST ({Number(sstPct)}%)</td>
                  <td className="num py-1.5 text-right font-bold text-primary" data-testid="breakdown-after-sst">{money(m.calc.afterSst)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="rounded-xl bg-warn-bg px-3 py-2.5 text-warn">This tenant has no turnover-rent terms yet — add bands or a % rent rate on the tenant.</p>
      )}

      {m.baseRent !== null && (
        <div className="rounded-xl border border-line p-3">
          <div className="flex justify-between gap-3"><span className="text-ink-2">Base rent</span><span className="num">RM {money(m.baseRent)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-ink-2">+ Turnover rent{sstPct > 0 ? " (after SST)" : ""}</span><span className="num">RM {money(m.calc?.afterSst ?? 0)}</span></div>
          <div className="mt-1 flex justify-between gap-3 border-t border-line pt-1 font-bold text-ink"><span>Total rent</span><span className="num" data-testid="breakdown-total-rent">RM {money(m.totalRent)}</span></div>
        </div>
      )}
    </div>
  );
}

/** A tappable figure that opens the month's band breakdown. Empty months render as plain "—". */
export function GtoCell({
  tenant,
  m,
  sstPct,
  children,
  className = "",
  label,
}: {
  tenant: string;
  m: GtoMonth;
  sstPct: number;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  if (m.gross === null) return <span className={`text-muted ${className}`}>—</span>;
  const [y, mm] = m.month.split("-").map(Number);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`num touch-manipulation rounded-md underline decoration-line-strong decoration-dotted underline-offset-4 hover:text-primary hover:decoration-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:outline-none ${className}`}
        aria-label={label ?? `${tenant} ${MONTH_NAMES[mm - 1]} ${y}: show GTO breakdown`}
        data-testid={`gto-cell-${m.month}`}
      >
        {children}
      </button>
      <Modal title={`GTO breakdown — ${MONTH_NAMES[mm - 1]} ${y}`} open={open} onClose={() => setOpen(false)}>
        <GtoBreakdown tenant={tenant} m={m} sstPct={sstPct} />
      </Modal>
    </>
  );
}
