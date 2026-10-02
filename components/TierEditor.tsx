"use client";

import { useState } from "react";
import type { GtoTier } from "@/lib/logic/gto";
import { btnSecondary, inputCls } from "./ui";

type Row = { key: number; upTo: string; rate: string };
let seq = 0;
const toRows = (tiers: GtoTier[] | null | undefined): Row[] =>
  (tiers ?? []).map((t) => ({ key: ++seq, upTo: t.up_to === null ? "" : String(t.up_to), rate: String(Number((t.rate * 100).toFixed(6))) }));
const fmt = (s: string) => {
  const n = Number(s.replace(/,/g, ""));
  return s.trim() && Number.isFinite(n) ? n.toLocaleString("en-MY") : "…";
};

/**
 * Marginal turnover-rent bands on monthly gross sales: "up to RM X @ Y%" rows, the last row is
 * "above". Posts parallel `tier_up_to` / `tier_rate_pct` fields (see lib/logic/terms.ts).
 */
export function TierEditor({ initial, error }: { initial?: GtoTier[] | null; error?: string }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initial));
  const set = (k: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === k ? { ...r, ...patch } : r)));
  const add = () =>
    setRows((rs) => {
      if (!rs.length) return [{ key: ++seq, upTo: "", rate: "0" }, { key: ++seq, upTo: "", rate: "" }];
      // new band goes just before the open-ended last band
      return [...rs.slice(0, -1), { key: ++seq, upTo: "", rate: rs[rs.length - 1].rate }, rs[rs.length - 1]];
    });
  const remove = (k: number) => setRows((rs) => rs.filter((r) => r.key !== k));

  return (
    <fieldset className="space-y-2" data-testid="tier-editor">
      <legend className="label-caps mb-1.5 block text-[11px] text-muted">Turnover rent bands (monthly gross sales)</legend>
      {rows.length === 0 && (
        <p className="rounded-xl bg-panel px-3 py-2.5 text-sm text-ink-2">
          No bands — the flat <b>% rent rate</b> above applies to all sales (or no GTO if that’s blank).
        </p>
      )}
      {rows.map((r, i) => {
        const last = i === rows.length - 1;
        const from = i === 0 ? "0" : fmt(rows[i - 1].upTo);
        return (
          <div key={r.key} className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-xl border border-line bg-white p-2.5 sm:grid-cols-[auto_1fr_7rem_auto] sm:items-center sm:p-2">
            <span className="label-caps col-span-2 text-[11px] text-muted sm:col-span-1 sm:w-14">Band {i + 1}</span>
            {last ? (
              <>
                <input type="hidden" name="tier_up_to" value="" />
                <span className="num text-sm text-ink-2" data-testid={`tier-above-${i}`}>
                  {rows.length === 1 ? "All sales" : <>Above RM {from}</>}
                </span>
              </>
            ) : (
              <label className="block">
                <span className="sr-only">Band {i + 1} upper limit (RM)</span>
                <span className="relative block">
                  <span className="num pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted" aria-hidden>
                    up to RM
                  </span>
                  <input
                    name="tier_up_to"
                    inputMode="decimal"
                    value={r.upTo}
                    onChange={(e) => set(r.key, { upTo: e.target.value })}
                    className={`${inputCls.replace("px-3.5", "pr-3 pl-[4.75rem]")} num`}
                    placeholder="400,000"
                    aria-label={`Band ${i + 1} upper limit (RM)`}
                  />
                </span>
              </label>
            )}
            <label className="relative block">
              <span className="sr-only">Band {i + 1} rate (%)</span>
              <input
                name="tier_rate_pct"
                inputMode="decimal"
                value={r.rate}
                onChange={(e) => set(r.key, { rate: e.target.value })}
                className={`${inputCls.replace("px-3.5", "pr-8 pl-3")} num`}
                placeholder="2.5"
                aria-label={`Band ${i + 1} rate (%)`}
              />
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-muted" aria-hidden>
                %
              </span>
            </label>
            <button
              type="button"
              onClick={() => remove(r.key)}
              className="col-start-2 row-start-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-neg-bg hover:text-neg sm:col-start-auto sm:row-start-auto sm:h-10 sm:w-10"
              aria-label={`Remove band ${i + 1}`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${btnSecondary} px-3`} onClick={add}>
          + Add band
        </button>
        <span className="text-xs text-muted">Marginal: each rate applies only to sales within its band.</span>
      </div>
      {error && (
        <p className="text-sm font-medium text-neg" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
