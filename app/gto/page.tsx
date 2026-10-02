import Link from "next/link";
import { GtoCell } from "@/components/GtoDetail";
import { money, moneyAuto } from "@/lib/format";
import { Avatar, Badge, ButtonLink, Card, EmptyState, ErrorPanel, PageHeader, SectionLabel, Stat, cardCls } from "@/components/ui";
import { loadGtoYear, type TenantGto } from "@/lib/data/gto";
import { safe } from "@/lib/data/load";
import { todayKey } from "@/lib/logic/dates";
import { MONTHS, tiersSummary } from "@/lib/logic/gto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monthly GTO · Tenant GTO" };

const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;

function TermsLine({ r }: { r: TenantGto }) {
  const t = r.tenant;
  const bits = [
    tiersSummary(r.year.tiers),
    Number(t.gto_sst_pct) > 0 ? `+${Number(t.gto_sst_pct)}% SST` : null,
    t.base_rent_monthly !== null ? `Base RM ${money(Number(t.base_rent_monthly))}/mo` : null,
    t.lease_start || t.lease_end ? `Lease ${fmtDate(t.lease_start) ?? "?"} – ${fmtDate(t.lease_end) ?? "?"}` : null,
  ].filter(Boolean);
  return <span>{bits.join(" · ")}</span>;
}

function YearPicker({ year }: { year: number }) {
  const thisYear = Number(todayKey().slice(0, 4));
  const pill = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-canvas sm:min-h-10";
  return (
    <nav className="flex items-center gap-1.5" aria-label="Year">
      <Link href={`/gto?year=${year - 1}`} className={pill} aria-label={`Previous year, ${year - 1}`} data-testid="year-prev">
        ←
      </Link>
      <span className="num inline-flex min-h-11 items-center rounded-full bg-primary-tint px-4 text-base font-bold text-primary sm:min-h-10" data-testid="year-current">
        {year}
      </span>
      {year < thisYear + 1 && (
        <Link href={`/gto?year=${year + 1}`} className={pill} aria-label={`Next year, ${year + 1}`} data-testid="year-next">
          →
        </Link>
      )}
    </nav>
  );
}

export default async function GtoPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const thisYear = Number(todayKey().slice(0, 4));
  const year = /^\d{4}$/.test(sp.year ?? "") && Number(sp.year) >= 2000 && Number(sp.year) <= thisYear + 1 ? Number(sp.year) : thisYear;
  const res = await safe(() => loadGtoYear(year));
  if (!res.ok)
    return (
      <>
        <PageHeader title="Monthly GTO" />
        <ErrorPanel message={res.error} />
      </>
    );
  const { rows, portfolio, tenantCount } = res.data;
  const anySst = rows.some((r) => Number(r.tenant.gto_sst_pct) > 0);
  const anyBase = rows.some((r) => r.tenant.base_rent_monthly !== null);
  const months = portfolio.months.filter((m) => m.gross !== null).length;

  return (
    <>
      <PageHeader
        title="Monthly GTO"
        subtitle={<>Turnover rent from monthly gross sales, per each tenant’s bands. Tap a figure for the band breakdown.</>}
        actions={<YearPicker year={year} />}
      />

      {rows.length === 0 ? (
        <EmptyState
          title={`No GTO data for ${year}`}
          body={tenantCount ? "Add a tenant’s turnover-rent bands and record monthly sales (Add Sales → Monthly, or CSV import)." : "Add a tenant to get started."}
          action={<ButtonLink href="/tenants" variant="primary">Go to tenants</ButtonLink>}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label={`Gross sales ${year}`} value={<span data-testid="ytd-gross">RM {moneyAuto(portfolio.totals.gross)}</span>} hint={`${months} month${months === 1 ? "" : "s"} reported`} />
            <Stat label="Turnover rent (GTO)" value={<span data-testid="ytd-gto">RM {money(portfolio.totals.gto)}</span>} hint="year to date" />
            <Stat label={anySst ? "GTO after SST" : "GTO payable"} value={<span data-testid="ytd-after-sst">RM {money(portfolio.totals.afterSst)}</span>} hint={anySst ? "incl. SST where charged" : "no SST"} />
            <Stat label="Tenants" value={rows.length} hint={`${rows.filter((r) => r.year.totals.gto > 0).length} paying GTO this year`} />
          </div>

          {/* Phones: one card per tenant with a month list */}
          <div className="md:hidden">
            <SectionLabel>By tenant</SectionLabel>
            <ul className="space-y-3" data-testid="gto-cards">
              {rows.map((r) => (
                <li key={r.tenant.id} className={`${cardCls} p-4`} data-testid="gto-card">
                  <div className="flex items-start gap-3">
                    <Avatar name={r.tenant.name} seed={r.tenant.id} />
                    <div className="min-w-0 flex-1">
                      <span className="label-caps block truncate text-[11px] text-muted">{r.tenant.property ?? "Property not set"}</span>
                      <Link href={`/tenants/${r.tenant.id}`} className="block text-base leading-6 font-bold tracking-tight [overflow-wrap:anywhere] text-ink">
                        {r.tenant.name}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted"><TermsLine r={r} /></div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-panel p-3">
                    <div className="min-w-0">
                      <div className="label-caps text-[10px] text-muted">GTO {year}</div>
                      <div className="num mt-0.5 truncate text-lg leading-6 font-bold text-ink">{r.year.totals.monthsWithSales ? `RM ${money(r.year.totals.gto)}` : "—"}</div>
                    </div>
                    <div className="min-w-0 text-right">
                      <div className="label-caps text-[10px] text-muted">{Number(r.tenant.gto_sst_pct) > 0 ? "After SST" : "Gross sales"}</div>
                      <div className="num mt-0.5 truncate text-lg leading-6 font-bold text-pos">
                        {!r.year.totals.monthsWithSales ? "—" : `RM ${Number(r.tenant.gto_sst_pct) > 0 ? money(r.year.totals.afterSst) : moneyAuto(r.year.totals.gross)}`}
                      </div>
                    </div>
                  </div>
                  <ul className="mt-2 divide-y divide-row text-sm">
                    {r.year.months.map((m, i) => (
                      <li key={m.month} className="flex min-h-11 items-center justify-between gap-3 py-1.5">
                        <span className="w-9 shrink-0 font-semibold text-ink-2">{MONTHS[i]}</span>
                        {m.gross === null ? (
                          <span className="flex-1 text-right text-muted">— no sales</span>
                        ) : (
                          <>
                            <span className="num min-w-0 flex-1 truncate text-right text-xs text-muted">{money(m.gross, !Number.isInteger(m.gross))}</span>
                            <GtoCell tenant={r.tenant.name} m={m} sstPct={Number(r.tenant.gto_sst_pct)} className="text-right font-bold text-ink">
                              {m.calc ? money(Number(r.tenant.gto_sst_pct) > 0 ? m.calc.afterSst : m.calc.gto) : "—"}
                            </GtoCell>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[11px] text-muted">
                    Gross sales · {Number(r.tenant.gto_sst_pct) > 0 ? `GTO after ${Number(r.tenant.gto_sst_pct)}% SST` : "GTO"} (RM). Tap a figure for the bands.
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* md+: tenants × months grid */}
          <Card className="hidden md:block" eyebrow={`Calendar year ${year}`} title="Gross sales & turnover rent by month (RM)">
            <div className="-mx-4 overflow-x-auto sm:-mx-5" data-testid="gto-grid">
              <table className="w-full min-w-[60rem] border-separate border-spacing-0 text-xs">
                <thead>
                  <tr className="label-caps text-[10px] text-muted">
                    <th className="sticky left-0 z-10 w-36 min-w-36 border-b border-line bg-card py-2 pr-2 pl-4 text-left sm:pl-5">Tenant</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="border-b border-line px-1 py-2 text-right">{m}</th>
                    ))}
                    <th className="border-b border-line py-2 pr-4 pl-1.5 text-right sm:pr-5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const sst = Number(r.tenant.gto_sst_pct);
                    const none = r.year.totals.monthsWithSales === 0;
                    const cents = r.year.months.some((m) => m.gross !== null && !Number.isInteger(m.gross));
                    const lines: { key: string; label: string; cell: (i: number) => React.ReactNode; total: React.ReactNode; strong?: boolean }[] = [
                      {
                        key: "gross",
                        label: "Gross sales",
                        cell: (i) => money(r.year.months[i].gross, cents),
                        total: none ? "—" : money(r.year.totals.gross, cents),
                      },
                      {
                        key: "gto",
                        label: "Turnover rent (GTO)",
                        strong: sst === 0,
                        cell: (i) => {
                          const m = r.year.months[i];
                          return (
                            <GtoCell tenant={r.tenant.name} m={m} sstPct={sst}>
                              {m.calc ? money(m.calc.gto) : "—"}
                            </GtoCell>
                          );
                        },
                        total: none ? "—" : money(r.year.totals.gto),
                      },
                    ];
                    if (sst > 0)
                      lines.push({
                        key: "sst",
                        label: `After SST (${sst}%)`,
                        strong: true,
                        cell: (i) => {
                          const m = r.year.months[i];
                          return (
                            <GtoCell tenant={r.tenant.name} m={m} sstPct={sst} label={`${r.tenant.name} ${MONTHS[i]} ${year}: after SST, show breakdown`}>
                              {m.calc ? money(m.calc.afterSst) : "—"}
                            </GtoCell>
                          );
                        },
                        total: none ? "—" : money(r.year.totals.afterSst),
                      });
                    if (r.tenant.base_rent_monthly !== null)
                      lines.push(
                        { key: "base", label: "Base rent", cell: (i) => (r.year.months[i].gross === null ? "—" : money(r.year.months[i].baseRent)), total: none ? "—" : money(r.year.totals.baseRent) },
                        { key: "total", label: "Total rent", strong: true, cell: (i) => money(r.year.months[i].totalRent), total: none ? "—" : money(r.year.totals.totalRent) },
                      );
                    return lines.map((ln, li) => (
                      <tr key={`${r.tenant.id}-${ln.key}`} data-testid={`gto-row-${ln.key}`} data-tenant={r.tenant.name} className={ln.strong ? "font-bold text-ink" : "text-ink-2"}>
                        <th
                          scope="row"
                          className={`sticky left-0 z-10 w-36 min-w-36 bg-card py-1.5 pr-2 pl-4 text-left align-top font-normal sm:pl-5 ${li === lines.length - 1 ? "border-b border-line pb-3" : ""} ${li === 0 ? "pt-3" : ""}`}
                        >
                          {li === 0 && (
                            <div className="mb-1">
                              <Link href={`/tenants/${r.tenant.id}`} className="text-sm font-bold text-ink hover:text-primary">{r.tenant.name}</Link>
                              <div className="text-[11px] leading-4 text-muted">
                                {r.tenant.property && <Badge tone="teal">{r.tenant.property}</Badge>} <TermsLine r={r} />
                              </div>
                            </div>
                          )}
                          <span className={`label-caps text-[10px] ${ln.strong ? "text-primary" : "text-muted"}`}>{ln.label}</span>
                        </th>
                        {MONTHS.map((_, i) => (
                          <td key={i} className={`num px-1 py-1.5 text-right align-bottom whitespace-nowrap ${li === lines.length - 1 ? "border-b border-line pb-3" : ""}`}>
                            {ln.cell(i)}
                          </td>
                        ))}
                        <td className={`num py-1.5 pr-4 pl-1.5 text-right align-bottom font-bold whitespace-nowrap text-ink sm:pr-5 ${li === lines.length - 1 ? "border-b border-line pb-3" : ""}`}>
                          {ln.total}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
                <tfoot>
                  {[
                    // whole ringgit here keeps the 12 months on screen; exact sen in the tooltip
                    {
                      key: "gross",
                      label: "Portfolio gross sales",
                      v: (i: number) => <span title={`RM ${money(portfolio.months[i].gross)}`}>{money(portfolio.months[i].gross === null ? null : Math.round(portfolio.months[i].gross!), false)}</span>,
                      t: <span title={`RM ${money(portfolio.totals.gross)}`}>{money(Math.round(portfolio.totals.gross), false)}</span>,
                    },
                    { key: "gto", label: "Portfolio GTO", v: (i: number) => money(portfolio.months[i].gto), t: money(portfolio.totals.gto) },
                    ...(anySst ? [{ key: "sst", label: "Portfolio GTO after SST", v: (i: number) => money(portfolio.months[i].afterSst), t: money(portfolio.totals.afterSst) }] : []),
                    ...(anyBase ? [{ key: "total", label: "Total rent (base known)", v: (i: number) => money(portfolio.months[i].totalRent), t: money(portfolio.totals.totalRent) }] : []),
                  ].map((ln) => (
                    <tr key={ln.key} className="bg-panel font-bold text-ink" data-testid={`portfolio-${ln.key}`}>
                      <th scope="row" className="label-caps sticky left-0 z-10 bg-panel py-2 pr-2 pl-4 text-left text-[10px] text-primary sm:pl-5">{ln.label}</th>
                      {MONTHS.map((_, i) => (
                        <td key={i} className="num px-1 py-2 text-right whitespace-nowrap">{ln.v(i)}</td>
                      ))}
                      <td className="num py-2 pr-4 pl-1.5 text-right whitespace-nowrap sm:pr-5">{ln.t}</td>
                    </tr>
                  ))}
                </tfoot>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">
              Months without sales show “—” (no turnover rent is charged or estimated). Gross sales use the tenant’s monthly report when there is one, otherwise the sum of daily / hourly records. Totals are exact sums, rounded once.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
