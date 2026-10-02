import Link from "next/link";
import { notFound } from "next/navigation";
import { AddSales } from "@/components/AddSales";
import { HourlyBars, SalesChart, TrendBars } from "@/components/Charts";
import { ConfidenceBadge, ProjectionCard } from "@/components/ProjectionCard";
import { ProjectionRowActions, SaleRowActions, SaveProjectionButton } from "@/components/RowActions";
import { DeleteTenant, TenantButton } from "@/components/TenantForm";
import { Avatar, Badge, Card, EmptyState, ErrorPanel, PageHeader, Stat } from "@/components/ui";
import { safe, windowStart } from "@/lib/data/load";
import { listSavedProjections } from "@/lib/data/projections";
import { countSales, listRecentSales, listSalesBetween } from "@/lib/data/sales";
import { getTenant, listTenants } from "@/lib/data/tenants";
import { compareSeries, dailyTotals, hourlyBreakdown, lastNDays, pctChange } from "@/lib/logic/aggregate";
import { addDays, dayKey, formatDay, myWallToUtc, todayKey } from "@/lib/logic/dates";
import { projectFromDaily } from "@/lib/logic/projection";
import { dateTime, rm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TenantDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const today = todayKey();
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today ? sp.day : today;

  const res = await safe(async () => {
    const tenant = await getTenant(id);
    if (!tenant) return null;
    const [tenants, records, dayRecords, recent, count, saved] = await Promise.all([
      listTenants(),
      listSalesBetween(myWallToUtc(windowStart(today)), myWallToUtc(addDays(today, 1)), id),
      listSalesBetween(myWallToUtc(day), myWallToUtc(addDays(day, 1)), id),
      listRecentSales(id, 100),
      countSales(id),
      listSavedProjections(id),
    ]);
    return { tenant, tenants, records, dayRecords, recent, count, saved };
  });
  if (!res.ok)
    return (
      <>
        <PageHeader title="Tenant" />
        <ErrorPanel message={res.error} />
      </>
    );
  if (!res.data) notFound();
  const { tenant, tenants, records, dayRecords, recent, count, saved } = res.data;
  const lite = tenants.map((t) => ({ id: t.id, name: t.name, unit: t.unit }));

  const header = (
    <PageHeader
      title={tenant.name}
      subtitle={
        <span className="flex items-center gap-3">
          <Avatar name={tenant.name} seed={tenant.id} />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="label-caps flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
              <Link href="/tenants" className="text-primary underline-offset-4 hover:underline">
                ← Tenants
              </Link>
              <span aria-hidden>•</span>
              <span>Unit {tenant.unit ?? "—"}</span>
            </span>
            <span className="inline-flex flex-wrap items-center gap-2">
              {tenant.category && <Badge tone="teal">{tenant.category}</Badge>}
              <span>{tenant.rent_rate_pct === null ? "No % rent" : <><span className="num font-semibold text-ink-2">{Number(tenant.rent_rate_pct)}%</span> of GTO rent</>}</span>
            </span>
          </span>
        </span>
      }
      actions={
        <>
          <TenantButton tenant={tenant} />
          <DeleteTenant tenant={tenant} redirectTo="/tenants" />
          <AddSales tenants={lite} defaultTenantId={tenant.id} />
        </>
      }
    />
  );

  if (count === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="No sales recorded yet"
          body={`Record ${tenant.name}’s first hourly, daily, weekly or monthly GTO to see its trend and projection.`}
          action={<AddSales tenants={lite} defaultTenantId={tenant.id} label="Add first sales record" />}
        />
      </>
    );
  }

  const totals = dailyTotals(records);
  const weekly = projectFromDaily(totals, today, "weekly");
  const monthly = projectFromDaily(totals, today, "monthly");
  const wow = compareSeries(totals, "wow", today);
  const trend = lastNDays(totals, today, 14);
  const hourly = hourlyBreakdown(dayRecords, tenant.id, day);
  const dayTotal = dailyTotals(dayRecords).get(day) ?? 0;
  const todayTotal = totals.get(today) ?? 0;
  const yTotal = totals.get(addDays(today, -1)) ?? 0;
  const summaries = recent.filter((r) => r.period_type === "weekly" || r.period_type === "monthly");

  return (
    <>
      {header}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Today" value={rm(todayTotal)} delta={pctChange(todayTotal, yTotal)} hint="vs yesterday" spark={trend.slice(-7)} />
        <Stat label="Last 7 days" value={rm(trend.slice(-7).reduce((s, d) => s + d.amount, 0))} spark={trend} />
        <Stat label="Projected next week" value={<span data-testid="tenant-projection">{weekly ? rm(weekly.projectedAmount) : "—"}</span>} hint={weekly ? <ConfidenceBadge confidence={weekly.confidence} /> : "not enough data"} />
        <Stat label="Records" value={count} hint="all periods" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <ProjectionCard
          title="Next week"
          p={weekly}
          ratePct={tenant.rent_rate_pct}
          action={<SaveProjectionButton period="weekly" tenantId={tenant.id} label="Save weekly projection" />}
        />
        <ProjectionCard
          title="Next month"
          p={monthly}
          ratePct={tenant.rent_rate_pct}
          action={<SaveProjectionButton period="monthly" tenantId={tenant.id} label="Save monthly projection" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card eyebrow="Week over week" title="This week vs last week">
          <SalesChart data={wow} currentLabel="This week" previousLabel="Last week" height={240} />
        </Card>
        <Card
          title={`Hourly breakdown · ${formatDay(day)}`}
          action={
            <div className="-my-2 flex items-center gap-1 text-sm">
              <Link className="grid h-11 w-11 place-items-center rounded-full bg-canvas text-ink-2 ring-1 ring-line hover:bg-row hover:text-primary sm:h-9 sm:w-9" href={`/tenants/${tenant.id}?day=${addDays(day, -1)}`} aria-label="Previous day" scroll={false}>
                ←
              </Link>
              {day < today && (
                <Link className="grid h-11 w-11 place-items-center rounded-full bg-canvas text-ink-2 ring-1 ring-line hover:bg-row hover:text-primary sm:h-9 sm:w-9" href={`/tenants/${tenant.id}?day=${addDays(day, 1)}`} aria-label="Next day" scroll={false}>
                  →
                </Link>
              )}
            </div>
          }
        >
          {hourly ? (
            <HourlyBars data={hourly} height={240} />
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center text-center text-sm text-muted sm:h-[240px]">
              <div>No hourly records for this day.</div>
              <div className="mt-1 text-xs">Day total from daily records: {rm(dayTotal)}</div>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6" eyebrow="14-day trajectory" title="Daily GTO — last 14 days">
        <TrendBars data={trend} />
      </Card>

      {summaries.length > 0 && (
        <Card className="mt-6" title="Weekly & monthly reported totals">
          <ul className="divide-y divide-row text-sm">
            {summaries.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <Badge tone="teal">{r.period_type}</Badge>{" "}
                  <span className="text-ink-2">
                    {r.period_type === "weekly" ? "Week of " : ""}
                    {formatDay(dayKey(r.recorded_at))}
                  </span>
                </span>
                <span className="font-semibold num">{rm(Number(r.amount))}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-6" title={`Sales records (${count})`} action={<span className="label-caps text-[10px] text-muted">Latest 100 shown</span>}>
        {/* Phones: stacked rows with full-width Edit / Delete */}
        <ul className="-mx-4 divide-y divide-row sm:hidden" data-testid="record-list">
          {recent.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium capitalize text-ink">
                    {r.period_type}
                    <Badge tone={r.source === "import" ? "teal" : "slate"}>{r.source ?? "manual"}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{dateTime(r.recorded_at)}</div>
                </div>
                <div className="shrink-0 text-right text-base font-semibold num">{rm(Number(r.amount), { cents: true })}</div>
              </div>
              {/* Right-aligned, content-width actions (each still ≥44px tall) */}
              <div className="mt-2 flex justify-end [&>div]:flex-none [&_button]:min-w-[5.5rem]">
                <SaleRowActions record={r} tenants={lite} />
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="data-grid w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left label-caps text-[11px] text-muted">
                <th className="py-2 pr-3">Period</th>
                <th className="py-2 pr-3">Recorded for</th>
                <th className="py-2 pr-3 text-right">Amount</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-row">
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-3 capitalize">{r.period_type}</td>
                  <td className="py-2 pr-3 text-ink-2">{dateTime(r.recorded_at)}</td>
                  <td className="py-2 pr-3 text-right font-medium num">{rm(Number(r.amount), { cents: true })}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={r.source === "import" ? "teal" : "slate"}>{r.source ?? "manual"}</Badge>
                  </td>
                  <td className="py-2 text-right">
                    <SaleRowActions record={r} tenants={lite} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {saved.length > 0 && (
        <Card className="mt-6" title="Saved projections">
          <SavedTable rows={saved} />
        </Card>
      )}
    </>
  );
}

function SavedTable({ rows }: { rows: Awaited<ReturnType<typeof listSavedProjections>> }) {
  return (
    <>
    <ul className="-mx-4 divide-y divide-row sm:hidden">
      {rows.map((p) => (
        <li key={p.id} className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium capitalize text-ink">{p.target_period}</div>
              <div className="mt-0.5 text-xs text-muted">Saved {dateTime(p.created_at)}</div>
            </div>
            <div className="shrink-0 text-right text-base font-semibold num">{rm(Number(p.projected_amount))}</div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ConfidenceBadge confidence={p.confidence === null ? null : Number(p.confidence)} />
            <Badge tone={p.review_status === "approved" ? "emerald" : "slate"}>{p.review_status ?? "unreviewed"}</Badge>
          </div>
          <div className="mt-2 flex justify-end [&>div]:flex-none [&_button]:min-w-[5.5rem]">
            <ProjectionRowActions id={p.id} status={p.review_status} />
          </div>
        </li>
      ))}
    </ul>
    <table className="data-grid hidden w-full text-sm sm:table">
      <tbody className="divide-y divide-row">
        {rows.map((p) => (
          <tr key={p.id}>
            <td className="py-2 pr-3 capitalize">{p.target_period}</td>
            <td className="py-2 pr-3 text-right font-medium num">{rm(Number(p.projected_amount))}</td>
            <td className="py-2 pr-3">
              <ConfidenceBadge confidence={p.confidence === null ? null : Number(p.confidence)} />
            </td>
            <td className="py-2 pr-3">
              <Badge tone={p.review_status === "approved" ? "emerald" : "slate"}>{p.review_status ?? "unreviewed"}</Badge>
            </td>
            <td className="py-2 pr-3 text-xs text-muted">{dateTime(p.created_at)}</td>
            <td className="py-2 text-right">
              <ProjectionRowActions id={p.id} status={p.review_status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </>
  );
}
