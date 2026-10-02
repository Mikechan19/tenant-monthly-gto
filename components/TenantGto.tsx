import Link from "next/link";
import { GtoCell } from "./GtoDetail";
import { Card } from "./ui";
import type { TenantGto } from "@/lib/data/gto";
import { MONTHS, tiersSummary } from "@/lib/logic/gto";
import { money, moneyAuto } from "@/lib/format";

const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const pct = (r: number) => `${Number((r * 100).toFixed(4))}%`;

/** Tenant page: lease & GTO terms + this year's monthly GTO. */
export function TenantGtoSection({ data }: { data: TenantGto }) {
  const { tenant: t, year: y } = data;
  const sst = Number(t.gto_sst_pct);
  const tiers = y.tiers;
  const term = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-ink-2">{label}</dt>
      <dd className="num text-right font-semibold text-ink">{value}</dd>
    </div>
  );
  return (
    <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2" eyebrow="Lease" title="Lease & GTO terms">
        <dl className="divide-y divide-row text-sm" data-testid="lease-terms">
          {term("Property", t.property ?? "—")}
          {term("Base rent / month", t.base_rent_monthly === null ? "—" : `RM ${money(Number(t.base_rent_monthly))}`)}
          {term("Lease term", t.lease_start || t.lease_end ? `${fmtDate(t.lease_start)} – ${fmtDate(t.lease_end)}` : "—")}
          {term("SST on GTO", sst > 0 ? `${sst}%` : "None")}
        </dl>
        <div className="mt-3">
          <div className="label-caps mb-1.5 text-[10px] text-muted">Turnover rent bands (monthly gross sales)</div>
          {tiers ? (
            <table className="w-full text-sm" data-testid="terms-bands">
              <tbody className="divide-y divide-row">
                {tiers.map((b, i) => {
                  const from = i === 0 ? 0 : tiers[i - 1].up_to!;
                  return (
                    <tr key={i}>
                      <td className="num py-1.5 pr-2 text-ink-2">
                        {b.up_to === null ? (i === 0 ? "All sales" : `Above RM ${money(from, false)}`) : `RM ${money(from, false)} – ${money(b.up_to, false)}`}
                      </td>
                      <td className="num py-1.5 text-right font-semibold text-ink">{pct(b.rate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="rounded-xl bg-panel px-3 py-2.5 text-sm text-muted">No bands or % rent set — edit the tenant to add them.</p>
          )}
          {!t.gto_tiers?.length && t.rent_rate_pct !== null && <p className="mt-1 text-xs text-muted">Flat % rent rate (no bands set).</p>}
        </div>
      </Card>

      <Card
        className="lg:col-span-3"
        eyebrow={`Monthly GTO · ${y.year}`}
        title={tiersSummary(tiers)}
        action={
          <Link href={`/gto?year=${y.year}`} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            All tenants →
          </Link>
        }
      >
        <table className="w-full text-sm" data-testid="tenant-gto-table">
          <thead>
            <tr className="label-caps border-b border-line text-left text-[10px] text-muted">
              <th className="py-2 pr-2">Month</th>
              <th className="py-2 pr-2 text-right">Gross sales</th>
              <th className="py-2 pr-2 text-right">GTO</th>
              {sst > 0 && <th className="py-2 text-right">After SST</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-row">
            {y.months.map((m, i) => (
              <tr key={m.month}>
                <td className="py-1.5 pr-2 font-semibold text-ink-2">{MONTHS[i]}</td>
                <td className="num py-1.5 pr-2 text-right text-ink-2">{m.gross === null ? <span className="text-muted">—</span> : moneyAuto(m.gross)}</td>
                <td className="num py-1.5 pr-2 text-right font-semibold text-ink">
                  <GtoCell tenant={t.name} m={m} sstPct={sst}>{m.calc ? money(m.calc.gto) : "—"}</GtoCell>
                </td>
                {sst > 0 && (
                  <td className="num py-1.5 text-right font-bold text-ink">
                    <GtoCell tenant={t.name} m={m} sstPct={sst} label={`${MONTHS[i]} after SST: show breakdown`}>{m.calc ? money(m.calc.afterSst) : "—"}</GtoCell>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-bold text-ink">
              <td className="py-2 pr-2">Total</td>
              <td className="num py-2 pr-2 text-right">{y.totals.monthsWithSales ? moneyAuto(y.totals.gross) : "—"}</td>
              <td className="num py-2 pr-2 text-right">{y.totals.monthsWithSales && tiers ? money(y.totals.gto) : "—"}</td>
              {sst > 0 && <td className="num py-2 text-right">{y.totals.monthsWithSales ? money(y.totals.afterSst) : "—"}</td>}
            </tr>
          </tfoot>
        </table>
        {t.base_rent_monthly !== null && y.totals.monthsWithSales > 0 && (
          <p className="mt-2 text-xs text-muted">
            Base rent RM {money(y.totals.baseRent)} + GTO = total rent <b className="num text-ink">RM {money(y.totals.totalRent)}</b> for the {y.totals.monthsWithSales} month
            {y.totals.monthsWithSales === 1 ? "" : "s"} with sales.
          </p>
        )}
      </Card>
    </div>
  );
}
