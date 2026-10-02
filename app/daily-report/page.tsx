import Link from "next/link";
import { AddSales } from "@/components/AddSales";
import { SalesChart } from "@/components/Charts";
import { ReportControls } from "@/components/ReportControls";
import { Card, Delta, EmptyState, ErrorPanel, PageHeader, Stat } from "@/components/ui";
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

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={`Today · ${formatDay(today)}`} value={<span data-testid="report-today">{rm(todayPoint?.current ?? 0)}</span>} delta={pctChange(todayPoint?.current ?? 0, todayPoint?.previous ?? 0)} hint={`vs ${mode === "wow" ? "same day last week" : "same date last month"}`} />
        <Stat label={`${curLabel} to date`} value={rm(cur)} delta={pctChange(cur, prevToDate)} hint="vs same point last period" />
        <Stat label={`${prevLabel} (full)`} value={rm(prevFull)} />
        <Stat label="Days reported" value={`${series.filter((p) => (p.current ?? 0) > 0).length} / ${todayIdx + 1}`} hint="in current period" />
      </div>

      <Card title={`${curLabel} vs ${prevLabel}`}>
        {hasAny ? (
          <SalesChart data={series} currentLabel={curLabel} previousLabel={prevLabel} height={340} />
        ) : (
          <EmptyState title="No sales in this window" body="Add a sales record or import a CSV to populate the report." />
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Day by day">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">{mode === "wow" ? "Day" : "Date"}</th>
                  <th className="py-2 pr-3 text-right font-medium">{curLabel}</th>
                  <th className="py-2 pr-3 text-right font-medium">{prevLabel}</th>
                  <th className="py-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {series.map((p) => (
                  <tr key={p.label} className={p.currentDate === today ? "bg-teal-50/60" : ""}>
                    <td className="py-2 pr-3 text-slate-700">{p.currentDate ? formatDay(p.currentDate) : p.label}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.current === null ? "—" : rm(p.current)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{p.previous === null ? "—" : rm(p.previous)}</td>
                    <td className="py-2 text-right">{p.current === null ? "" : <Delta value={pctChange(p.current, p.previous ?? 0)} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="By tenant (period to date)">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Tenant</th>
                <th className="py-2 pr-3 text-right font-medium">{curLabel}</th>
                <th className="py-2 pr-3 text-right font-medium">Prior to date</th>
                <th className="py-2 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenantRows.map(({ t, c, p, change }) => (
                <tr key={t.id}>
                  <td className="py-2 pr-3">
                    <Link className="font-medium text-slate-900 hover:underline" href={`/tenants/${t.id}`}>
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{rm(c)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{rm(p)}</td>
                  <td className="py-2 text-right">{c || p ? <Delta value={change} /> : <span className="text-xs text-slate-400">no data</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Weekly and monthly summary records are shown on each tenant’s page and are not spread across days.
      </p>
    </>
  );
}
