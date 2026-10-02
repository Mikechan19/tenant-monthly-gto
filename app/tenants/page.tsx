import Link from "next/link";
import { AddSales } from "@/components/AddSales";
import { Sparkline } from "@/components/Charts";
import { ConfidenceBadge } from "@/components/ProjectionCard";
import { DeleteTenant, TenantButton } from "@/components/TenantForm";
import { Avatar, Badge, EmptyState, ErrorPanel, PageHeader, SectionLabel, cardCls, linkCls } from "@/components/ui";
import { loadPortfolio } from "@/lib/data/load";
import { dailyTotalsByTenant, lastNDays } from "@/lib/logic/aggregate";
import { projectFromDaily } from "@/lib/logic/projection";
import { rm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const res = await loadPortfolio();
  if (!res.ok)
    return (
      <>
        <PageHeader title="Tenants" />
        <ErrorPanel message={res.error} />
      </>
    );
  const { tenants, records, today } = res.data;
  const by = dailyTotalsByTenant(records);
  const lite = tenants.map((t) => ({ id: t.id, name: t.name, unit: t.unit }));

  return (
    <>
      <PageHeader
        title="Tenants"
        subtitle={`${tenants.length} tenant${tenants.length === 1 ? "" : "s"} in the portfolio`}
        actions={
          <>
            <AddSales tenants={lite} />
            <TenantButton />
          </>
        }
      />
      {tenants.length === 0 ? (
        <EmptyState title="No tenants yet" body="Add a tenant to start capturing GTO." action={<TenantButton />} />
      ) : (
        <>
          <SectionLabel action={<span className="num text-xs font-semibold text-muted">{tenants.length} total</span>}>Tenant roster</SectionLabel>
          {/* Stitch roster cards: avatar tile, caps unit/category eyebrow, status pill, inset stat panel. */}
          <ul className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3" data-testid="tenant-cards">
            {tenants.map((t) => {
              const m = by.get(t.id) ?? new Map<string, number>();
              const p = projectFromDaily(m, today, "weekly");
              const todayAmt = m.get(today) ?? 0;
              return (
                <li key={t.id} className={`${cardCls} flex flex-col p-4 transition-shadow hover:shadow-lift`}>
                  <div className="flex items-start gap-3">
                    <Avatar name={t.name} seed={t.id} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="label-caps min-w-0 truncate pt-0.5 text-[11px] text-muted">
                          Unit {t.unit ?? "—"} • {t.category ?? "Uncategorised"}
                        </span>
                        {todayAmt > 0 ? (
                          <Badge tone="emerald" dot>Reported</Badge>
                        ) : m.size ? (
                          <Badge tone="slate">No sales today</Badge>
                        ) : (
                          <Badge tone="amber" dot>No data</Badge>
                        )}
                      </div>
                      <Link href={`/tenants/${t.id}`} className="mt-0.5 block truncate text-lg leading-7 font-bold tracking-tight text-ink hover:text-primary">
                        {t.name}
                      </Link>
                      <div className="text-sm text-muted">{t.rent_rate_pct === null ? "No % rent" : <><span className="num font-semibold text-ink-2">{Number(t.rent_rate_pct)}%</span> of GTO rent</>}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-panel p-3">
                    <div className="min-w-0">
                      <div className="label-caps text-[10px] text-muted">Today</div>
                      <div className="num mt-0.5 truncate text-lg leading-6 font-semibold text-ink">{rm(todayAmt)}</div>
                      {m.size ? (
                        <Sparkline data={lastNDays(m, today, 14)} href={`/tenants/${t.id}`} className="mt-1.5 h-7 w-full max-w-36" />
                      ) : (
                        <div className="mt-1 text-xs text-muted">No sales yet</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="label-caps text-[10px] text-muted">Next week (proj.)</div>
                      {p ? (
                        <>
                          <div className="num mt-0.5 truncate text-lg leading-6 font-semibold text-ink">{rm(p.projectedAmount)}</div>
                          <div className="mt-1.5"><ConfidenceBadge confidence={p.confidence} /></div>
                        </>
                      ) : (
                        <div className="mt-1 text-xs text-muted">Not enough data</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2 empty:hidden">
                      <TenantButton tenant={t} />
                      <DeleteTenant tenant={t} />
                    </div>
                    <Link href={`/tenants/${t.id}`} className={`${linkCls} ml-auto inline-flex min-h-11 items-center gap-0.5 text-sm whitespace-nowrap sm:min-h-10`} aria-label={`Drill down into ${t.name}`}>
                      Drill-down
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
