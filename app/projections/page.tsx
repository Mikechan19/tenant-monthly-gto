import Link from "next/link";
import { ConfidenceBadge } from "@/components/ProjectionCard";
import { ProjectionRowActions, SaveProjectionButton } from "@/components/RowActions";
import { Avatar, Badge, ButtonLink, Card, EmptyState, ErrorPanel, Meter, PageHeader, SectionLabel, cardCls } from "@/components/ui";
import { loadPortfolio, safe } from "@/lib/data/load";
import { listSavedProjections } from "@/lib/data/projections";
import { dailyTotalsByTenant } from "@/lib/logic/aggregate";
import { formatMonth, nextMonthStart, weekStart, addDays, formatDay } from "@/lib/logic/dates";
import { projectFromDaily, projectedRent } from "@/lib/logic/projection";
import { dateTime, rm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectionsPage() {
  const [res, savedRes] = await Promise.all([loadPortfolio(), safe(() => listSavedProjections())]);
  if (!res.ok || !savedRes.ok)
    return (
      <>
        <PageHeader title="Projections" />
        <ErrorPanel message={!res.ok ? res.error : !savedRes.ok ? savedRes.error : ""} />
      </>
    );
  const { tenants, records, today } = res.data;
  const saved = savedRes.data;
  const by = dailyTotalsByTenant(records);
  const rows = tenants
    .map((t) => {
      const m = by.get(t.id) ?? new Map<string, number>();
      return { t, w: projectFromDaily(m, today, "weekly"), mo: projectFromDaily(m, today, "monthly") };
    })
    .sort((a, b) => (b.w?.projectedAmount ?? -1) - (a.w?.projectedAmount ?? -1));
  const totalWeek = rows.reduce((s, r) => s + (r.w?.projectedAmount ?? 0), 0);
  const totalMonth = rows.reduce((s, r) => s + (r.mo?.projectedAmount ?? 0), 0);
  const totalRent = rows.reduce((s, r) => s + (projectedRent(r.w?.projectedAmount ?? 0, r.t.rent_rate_pct) ?? 0), 0);
  const nextMon = addDays(weekStart(today), 7);
  const names = new Map(tenants.map((t) => [t.id, t.name]));
  const projectable = rows.filter((r) => r.w).length;
  const highConf = rows.filter((r) => r.w && r.w.confidence >= 0.7).length;

  return (
    <>
      <PageHeader
        title="Projections"
        subtitle={`Rule-based: trailing 7-day average × 7 (next week from ${formatDay(nextMon)}), trailing 28-day average for ${formatMonth(nextMonthStart(today))}.`}
        actions={
          <>
            <SaveProjectionButton period="monthly" label="Save monthly snapshot" />
            <SaveProjectionButton period="weekly" label="Save weekly snapshot" primary />
          </>
        }
      />

      {tenants.length === 0 ? (
        <EmptyState title="No tenants yet" action={<ButtonLink href="/tenants" variant="primary">Add a tenant</ButtonLink>} />
      ) : (
        <>
          {/* Hero: portfolio pace (Stitch "predictive GTO engine" card) */}
          <section className={`${cardCls} relative mb-6 overflow-hidden p-4 sm:p-6`} data-testid="projection-hero">
            <div className="pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-chart-emerald/10 blur-3xl" aria-hidden />
            <div className="relative flex flex-wrap items-center justify-between gap-2">
              <div className="label-caps flex items-center gap-1.5 text-primary">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 19h16M5 15l4-5 3 3 4-6 3 3" />
                </svg>
                Projection engine
              </div>
              <Badge tone={highConf === projectable && projectable > 0 ? "emerald" : "amber"} dot>
                <span className="num">{highConf}</span>&nbsp;of&nbsp;<span className="num">{projectable}</span>&nbsp;high confidence
              </Badge>
            </div>
            <div className="relative mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
              <div className="sm:col-span-2">
                <div className="label-caps text-[11px] text-muted">Portfolio — next week</div>
                <div className="num mt-1 text-[2rem] leading-10 font-bold tracking-[-0.02em] text-ink sm:text-[2.5rem] sm:leading-[3rem]">{rm(totalWeek)}</div>
                <div className="mt-1 text-sm text-muted">
                  From {formatDay(nextMon)} · <span className="num font-semibold text-ink-2">{projectable}</span> of <span className="num font-semibold text-ink-2">{tenants.length}</span> tenants projectable
                </div>
                <Meter value={tenants.length ? projectable / tenants.length : 0} className="mt-3 h-2" />
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-panel p-3 sm:grid-cols-1">
                <div className="min-w-0">
                  <div className="label-caps text-[10px] text-muted">{formatMonth(nextMonthStart(today))}</div>
                  <div className="num mt-0.5 truncate text-lg leading-6 font-semibold text-ink">{rm(totalMonth)}</div>
                </div>
                <div className="min-w-0">
                  <div className="label-caps text-[10px] text-muted">Est. % rent — next week</div>
                  <div className="num mt-0.5 truncate text-lg leading-6 font-semibold text-pos">{rm(totalRent)}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Phones: one Stitch-style card per tenant */}
          <div className="sm:hidden">
            <SectionLabel action={<span className="num text-xs font-semibold text-muted">{tenants.length} tenants</span>}>Next-period estimate by tenant</SectionLabel>
            <ul className="space-y-3" data-testid="projection-list">
              {rows.map(({ t, w, mo }) => (
                <li key={t.id} className={`${cardCls} p-4`}>
                  <div className="flex items-start gap-3">
                    <Avatar name={t.name} seed={t.id} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="label-caps min-w-0 truncate pt-0.5 text-[11px] text-muted">{t.category ?? "Uncategorised"}</span>
                        {w ? <ConfidenceBadge confidence={w.confidence} /> : <Badge>No projection</Badge>}
                      </div>
                      <Link href={`/tenants/${t.id}`} className="mt-0.5 block truncate text-lg leading-7 font-bold tracking-tight text-ink">
                        {t.name}
                      </Link>
                      <div className="text-sm text-muted">Unit {t.unit ?? "—"}</div>
                    </div>
                  </div>
                  {w ? (
                    <>
                      <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-panel p-3">
                        <div className="min-w-0">
                          <div className="label-caps text-[10px] text-muted">Next week</div>
                          <div className="num mt-0.5 truncate text-lg leading-6 font-bold text-ink">{rm(w.projectedAmount)}</div>
                          <div className="num mt-0.5 text-[11px] text-muted">{rm(w.avgDaily)} / day · {w.daysWithData}/7 days</div>
                        </div>
                        <div className="min-w-0 text-right">
                          <div className="label-caps text-[10px] text-muted">Est. % rent</div>
                          <div className="num mt-0.5 truncate text-lg leading-6 font-bold text-pos">{rm(projectedRent(w.projectedAmount, t.rent_rate_pct))}</div>
                          <div className="num mt-0.5 text-[11px] text-muted">
                            Next month {mo ? rm(mo.projectedAmount) : "—"} {mo?.lowConfidence && <span className="font-semibold text-warn">(low)</span>}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex *:flex-1">
                        <SaveProjectionButton period="weekly" tenantId={t.id} label={`Save ${t.name} weekly projection`} />
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 rounded-xl bg-panel px-3 py-2.5 text-sm text-muted">Not enough data to project.</p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <Card className="hidden sm:block" eyebrow="Rule-based projection" title="Next-period estimate by tenant">
            <div className="hidden overflow-x-auto sm:block">
              <table className="data-grid w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left label-caps text-[11px] text-muted">
                    <th className="py-2 pr-3">Tenant</th>
                    <th className="py-2 pr-3 text-right">Avg / day (7d)</th>
                    <th className="py-2 pr-3 text-right">Days of data</th>
                    <th className="py-2 pr-3 text-right">Next week</th>
                    <th className="py-2 pr-3">Confidence</th>
                    <th className="py-2 pr-3 text-right">Est. % rent</th>
                    <th className="py-2 pr-3 text-right">Next month</th>
                    <th className="py-2 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-row">
                  {rows.map(({ t, w, mo }) => (
                    <tr key={t.id}>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={t.name} seed={t.id} size="sm" />
                          <div className="min-w-0">
                            <Link href={`/tenants/${t.id}`} className="font-semibold text-ink hover:text-primary">
                              {t.name}
                            </Link>
                            <div className="label-caps text-[10px] text-muted">{t.category ?? "—"} • {t.unit ?? "—"}</div>
                          </div>
                        </div>
                      </td>
                      {w ? (
                        <>
                          <td className="py-3 pr-3 text-right num">{rm(w.avgDaily)}</td>
                          <td className="py-3 pr-3 text-right num">{w.daysWithData} / 7</td>
                          <td className="py-3 pr-3 text-right font-semibold num">{rm(w.projectedAmount)}</td>
                          <td className="py-3 pr-3">
                            <ConfidenceBadge confidence={w.confidence} />
                          </td>
                          <td className="py-3 pr-3 text-right num">{rm(projectedRent(w.projectedAmount, t.rent_rate_pct))}</td>
                          <td className="py-3 pr-3 text-right num">
                            {mo ? rm(mo.projectedAmount) : "—"} {mo?.lowConfidence && <span className="text-xs text-warn">(low)</span>}
                          </td>
                        </>
                      ) : (
                        <td colSpan={6} className="py-3 pr-3 text-sm text-muted">
                          Not enough data to project.
                        </td>
                      )}
                      <td className="py-3 text-right">
                        {w && <SaveProjectionButton period="weekly" tenantId={t.id} label="Save" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="mt-6" title={`Saved projections (${saved.length})`} action={<span className="text-xs text-muted">Snapshots for review & approval</span>}>
            {saved.length === 0 ? (
              <p className="text-sm text-muted">No snapshots saved yet. Save one to keep a reviewed record of this week’s estimate.</p>
            ) : (
              <>
              <ul className="-mx-4 divide-y divide-row sm:hidden" data-testid="saved-list">
                {saved.map((p) => (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">
                          {names.get(p.tenant_id) ?? <span className="text-muted">deleted tenant</span>}
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          <span className="capitalize">{p.target_period}</span> · saved {dateTime(p.created_at)}
                        </div>
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
              <div className="hidden overflow-x-auto sm:block">
                <table className="data-grid w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left label-caps text-[11px] text-muted">
                      <th className="py-2 pr-3">Tenant</th>
                      <th className="py-2 pr-3">Period</th>
                      <th className="py-2 pr-3 text-right">Projected</th>
                      <th className="py-2 pr-3">Confidence</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Saved</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-row">
                    {saved.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 pr-3">{names.get(p.tenant_id) ?? <span className="text-muted">deleted tenant</span>}</td>
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
              </div>
              </>
            )}
          </Card>
        </>
      )}
    </>
  );
}
