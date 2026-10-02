import Link from "next/link";
import { AddSales } from "@/components/AddSales";
import { SalesChart, TenantBars, TrendBars } from "@/components/Charts";
import { ButtonLink, Card, EmptyState, ErrorPanel, PageHeader, Stat } from "@/components/ui";
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

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Today’s GTO" value={<span data-testid="today-total">{rm(todayTotal)}</span>} delta={pctChange(todayTotal, yesterdayTotal)} hint="vs yesterday" />
        <Stat label="Week to date" value={rm(wtd)} delta={pctChange(wtd, lwtd)} hint="vs same days last week" />
        <Stat label="Month to date" value={rm(mtd)} hint="hourly + daily records" />
        <Stat label="Reporting today" value={`${reporting} / ${tenants.length}`} hint="tenants with sales today" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="This week vs last week"
          action={
            <Link href="/daily-report" className="text-sm font-medium text-teal-700 hover:underline">
              Open Daily Report →
            </Link>
          }
        >
          <SalesChart data={wow} currentLabel="This week" previousLabel="Last week" height={260} />
        </Card>
        <Card className="lg:col-span-2" title="Top tenants today" action={<span className="text-xs text-slate-500">Click a bar to drill in</span>}>
          {reporting === 0 ? (
            <EmptyState title="No sales recorded today" body="Add today’s figures to see the ranking." />
          ) : (
            <TenantBars data={ranks.slice(0, 8).map((r) => ({ id: r.tenant.id, name: r.tenant.name, amount: r.today }))} />
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Daily GTO — last 14 days">
          <TrendBars data={trend} />
        </Card>
        <Card className="lg:col-span-2" title="Tenant contribution today">
          <ul className="divide-y divide-slate-100">
            {ranks.map((r) => (
              <li key={r.tenant.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/tenants/${r.tenant.id}`} className="min-w-0 hover:underline">
                  <div className="truncate text-sm font-medium text-slate-900">{r.tenant.name}</div>
                  <div className="text-xs text-slate-500">
                    {r.tenant.category ?? "—"} · {r.tenant.unit ?? "—"}
                  </div>
                </Link>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">{rm(r.today)}</div>
                  <div className="text-xs text-slate-500 tabular-nums">{(r.share * 100).toFixed(0)}% share</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
