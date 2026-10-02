import Link from "next/link";
import { AddSales } from "@/components/AddSales";
import { SalesChart } from "@/components/Charts";
import { ReportControls } from "@/components/ReportControls";
import { Avatar, Card, Delta, EmptyState, ErrorPanel, PageHeader, Stat } from "@/components/ui";
import { loadPortfolio } from "@/lib/data/load";
import {
  compareSeries,
  dailyTotals,
  dailyTotalsByTenant,
  pctChange,
  sumSeries,
  type CompareMode,
} from "@/lib/logic/aggregate";
import { formatDay, formatMonth, prevMonthStart } from "@/lib/logic/dates";
import { rm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DailyReport({ searchParams }: { searchParams: Promise<{ mode?: string; tenant?: string }> }) {
  const sp = await searchParams;
  const mode: CompareMode = sp.mode === "mom" ? "mom" : "wow";
  const res = await loadPortfolio();
  if (!res.ok)
    return (
      <>
        <PageHeader title="Daily Report" />
        <ErrorPanel message={res.error} />
      </>
    );
  const { tenants, records, today } = res.data;
  const tenant = tenants.find((t) => t.id === sp.tenant);
  const totals = dailyTotals(records, tenant?.id);
  const series = compareSeries(totals, mode, today);
  const todayIdx = series.findIndex((p) => p.currentDate === today);
  const cur = sumSeries(series, "current");
  const prevToDate = sumSeries(series, "previous", todayIdx);
  const prevFull = sumSeries(series, "previous");
  const curLabel = mode === "wow" ? "This week" : formatMonth(today);
  const prevLabel = mode === "wow" ? "Last week" : formatMonth(prevMonthStart(today));
  const todayPoint = series[todayIdx];
  const lite = tenants.map((t) => ({ id: t.id, name: t.name, unit: t.unit }));

  // Per-tenant table for the selected window.
  const byTenant = dailyTotalsByTenant(records);
  const tenantRows = tenants
    .map((t) => {
      const s = compareSeries(byTenant.get(t.id) ?? new Map(), mode, today);
      const c = sumSeries(s, "current");
      const p = sumSeries(s, "previous", todayIdx);
      return { t, c, p, change: pctChange(c, p) };
    })
    .sort((a, b) => b.c - a.c);

  const hasAny = series.some((p) => (p.current ?? 0) > 0 || (p.previous ?? 0) > 0);

  return (
    <>
      <PageHeader
        title="Daily Report"
        subtitle={`${tenant ? tenant.name : "Portfolio"} · ${curLabel} vs ${prevLabel.toLowerCase()} · daily GTO (hourly + daily records)`}
        actions={<AddSales tenants={lite} defaultTenantId={tenant?.id} />}
      />
      <div className="mb-4">
        <ReportControls mode={mode} tenantId={tenant?.id} tenants={tenants.map((t) => ({ id: t.id, name: t.name }))} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label={`Today · ${formatDay(today)}`} value={<span data-testid="report-today">{rm(todayPoint?.current ?? 0)}</span>} delta={pctChange(todayPoint?.current ?? 0, todayPoint?.previous ?? 0)} hint={`vs ${mode === "wow" ? "same day last week" : "same date last month"}`} />
        <Stat label={`${curLabel} to date`} value={rm(cur)} delta={pctChange(cur, prevToDate)} hint="vs same point last period" spark={series.slice(0, todayIdx + 1).map((p) => p.current ?? 0)} />
        <Stat label={`${prevLabel} (full)`} value={rm(prevFull)} spark={series.map((p) => p.previous ?? 0)} />
        <Stat label="Days reported" value={`${series.filter((p) => (p.current ?? 0) > 0).length} / ${todayIdx + 1}`} hint="in current period" />
      </div>

      <Card eyebrow={mode === "wow" ? "Week over week" : "Month over month"} title={`${curLabel} vs ${prevLabel}`}>
        {hasAny ? (
          <SalesChart data={series} currentLabel={curLabel} previousLabel={prevLabel} height={340} />
        ) : (
          <EmptyState title="No sales in this window" body="Add a sales record or import a CSV to populate the report." />
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card eyebrow="Daily ledger" title="Day by day">
          {/* Phones: compact two-line rows instead of a 4-column table */}
          <ul className="-mx-4 divide-y divide-row sm:hidden" data-testid="day-list">
            {series.map((p) => (
              <li key={p.label} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${p.currentDate === today ? "bg-primary-soft" : ""}`}>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">
                    {p.currentDate ? formatDay(p.currentDate) : p.label}
                    {p.currentDate === today && <span className="label-caps ml-1.5 rounded-full bg-primary-tint px-1.5 py-0.5 text-[10px] text-primary">Today</span>}
                  </div>
                  <div className="text-xs text-muted num">
                    {prevLabel}: {p.previous === null ? "—" : rm(p.previous)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold num">{p.current === null ? "—" : rm(p.current)}</div>
                  <div className="text-xs">{p.current === null ? "" : <Delta value={pctChange(p.current, p.previous ?? 0)} />}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="data-grid w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left label-caps text-[11px] text-muted">
                  <th className="py-2 pr-3">{mode === "wow" ? "Day" : "Date"}</th>
                  <th className="py-2 pr-3 text-right">{curLabel}</th>
                  <th className="py-2 pr-3 text-right">{prevLabel}</th>
                  <th className="py-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-row">
                {series.map((p) => (
                  <tr key={p.label} className={p.currentDate === today ? "bg-primary-soft" : ""}>
                    <td className="py-2 pr-3 text-ink-2">{p.currentDate ? formatDay(p.currentDate) : p.label}</td>
                    <td className="py-2 pr-3 text-right num">{p.current === null ? "—" : rm(p.current)}</td>
                    <td className="py-2 pr-3 text-right num text-muted">{p.previous === null ? "—" : rm(p.previous)}</td>
                    <td className="py-2 text-right">{p.current === null ? "" : <Delta value={pctChange(p.current, p.previous ?? 0)} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card eyebrow="Merchant roster" title="By tenant (period to date)">
          <ul className="-mx-4 divide-y divide-row sm:hidden">
            {tenantRows.map(({ t, c, p, change }) => (
              <li key={t.id}>
                <Link href={`/tenants/${t.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 active:bg-canvas">
                  <Avatar name={t.name} seed={t.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{t.name}</div>
                    <div className="text-xs text-muted num">Prior to date: {rm(p)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold num">{rm(c)}</div>
                    <div className="text-xs">{c || p ? <Delta value={change} /> : <span className="text-muted">no data</span>}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <table className="data-grid hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-line text-left label-caps text-[11px] text-muted">
                <th className="py-2 pr-3">Tenant</th>
                <th className="py-2 pr-3 text-right">{curLabel}</th>
                <th className="py-2 pr-3 text-right">Prior to date</th>
                <th className="py-2 text-right">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-row">
              {tenantRows.map(({ t, c, p, change }) => (
                <tr key={t.id}>
                  <td className="py-2 pr-3">
                    <Link className="flex items-center gap-2.5 font-semibold text-ink hover:text-primary" href={`/tenants/${t.id}`}>
                      <Avatar name={t.name} seed={t.id} size="sm" />
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right num">{rm(c)}</td>
                  <td className="py-2 pr-3 text-right num text-muted">{rm(p)}</td>
                  <td className="py-2 text-right">{c || p ? <Delta value={change} /> : <span className="text-xs text-muted">no data</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted">
        Weekly and monthly summary records are shown on each tenant’s page and are not spread across days.
      </p>
    </>
  );
}
