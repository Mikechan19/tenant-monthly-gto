import Link from "next/link";
import { AddSales } from "@/components/AddSales";
import { SalesChart, TenantBars, TrendBars } from "@/components/Charts";
import { Avatar, ButtonLink, Card, EmptyState, ErrorPanel, Meter, PageHeader, Stat, linkCls } from "@/components/ui";
import { loadPortfolio } from "@/lib/data/load";
import { compareSeries, dailyTotals, lastNDays, pctChange, rankTenants, sumSeries } from "@/lib/logic/aggregate";
import { addDays, formatDay, isoDow, monthStart } from "@/lib/logic/dates";
import { rm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const res = await loadPortfolio();
  if (!res.ok)
    return (
      <>
        <PageHeader title="Portfolio dashboard" />
        <ErrorPanel message={res.error} />
      </>
    );
  const { tenants, records, today } = res.data;

  if (tenants.length === 0) {
    return (
      <>
        <PageHeader title="Portfolio dashboard" />
        <EmptyState
          title="No tenants yet"
          body="Add your first tenant to start capturing GTO sales."
          action={<ButtonLink href="/tenants" variant="primary">Add a tenant</ButtonLink>}
        />
      </>
    );
  }

  const totals = dailyTotals(records);
  const todayTotal = totals.get(today) ?? 0;
  const yesterdayTotal = totals.get(addDays(today, -1)) ?? 0;
  const wow = compareSeries(totals, "wow", today);
  const dowIdx = isoDow(today) - 1;
  const wtd = sumSeries(wow, "current", dowIdx);
  const lwtd = sumSeries(wow, "previous", dowIdx);
  let mtd = 0;
  for (let d = monthStart(today); d <= today; d = addDays(d, 1)) mtd += totals.get(d) ?? 0;
  const ranks = rankTenants(tenants, records, today);
  const reporting = ranks.filter((r) => r.today > 0).length;
  const trend = lastNDays(totals, today, 14);
  const lite = tenants.map((t) => ({ id: t.id, name: t.name, unit: t.unit }));

  return (
    <>
      <PageHeader
        title="Portfolio dashboard"
        subtitle={`${formatDay(today)} · ${tenants.length} tenants · figures in RM, Malaysia time`}
        actions={
          <>
            <ButtonLink href="/daily-report">Daily Report</ButtonLink>
            <AddSales tenants={lite} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-testid="kpi-rail">
        <Stat label="Today’s GTO" value={<span data-testid="today-total">{rm(todayTotal)}</span>} delta={pctChange(todayTotal, yesterdayTotal)} hint="vs yesterday" spark={trend.slice(-7)} />
        <Stat label="Week to date" value={rm(wtd)} delta={pctChange(wtd, lwtd)} hint="vs same days last week" spark={wow.slice(0, dowIdx + 1).map((p) => p.current ?? 0)} />
        <Stat label="Month to date" value={rm(mtd)} hint="hourly + daily records" spark={trend} />
        <Stat
          label="Reporting today"
          value={
            <>
              {reporting}
              <span className="text-muted"> / {tenants.length}</span>
            </>
          }
          hint={
            <span className="flex w-full flex-col gap-1.5">
              tenants with sales today
              <Meter value={tenants.length ? reporting / tenants.length : 0} />
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          eyebrow="Week over week"
          title="This week vs last week"
          action={
            <Link href="/daily-report" className={`${linkCls} text-sm`}>
              Open Daily Report →
            </Link>
          }
        >
          <SalesChart data={wow} currentLabel="This week" previousLabel="Last week" height={260} />
        </Card>
        <Card className="lg:col-span-2" eyebrow="Leaderboard" title="Top tenants today" action={
            <span className="text-xs text-muted">
              <span className="sm:hidden">Tap</span>
              <span className="hidden sm:inline">Click</span> a bar to drill in
            </span>
          }>
          {reporting === 0 ? (
            <EmptyState title="No sales recorded today" body="Add today’s figures to see the ranking." />
          ) : (
            <TenantBars data={ranks.filter((r) => r.today > 0).slice(0, 8).map((r) => ({ id: r.tenant.id, name: r.tenant.name, amount: r.today }))} />
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" eyebrow="14-day trajectory" title="Daily GTO — last 14 days">
          <TrendBars data={trend} height={300} />
        </Card>
        <Card className="lg:col-span-2" eyebrow="Merchant roster" title="Tenant contribution today">
          <ul className="-my-1 divide-y divide-row">
            {ranks.map((r) => (
              <li key={r.tenant.id}>
                <Link href={`/tenants/${r.tenant.id}`} className="group flex min-h-14 items-center gap-3 py-2.5">
                  <Avatar name={r.tenant.name} seed={r.tenant.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-ink group-hover:text-primary">{r.tenant.name}</span>
                      <span className="num shrink-0 text-sm font-bold text-ink">{rm(r.today)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="label-caps min-w-0 flex-1 truncate text-[10px] text-muted">
                        {r.tenant.category ?? "—"} • {r.tenant.unit ?? "—"}
                      </span>
                      <span className="num shrink-0 text-[11px] font-semibold text-muted">{(r.share * 100).toFixed(0)}% share</span>
                    </div>
                    <Meter value={r.share} className="mt-1.5" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
