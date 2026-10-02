import Link from "next/link";
import { ConfidenceBadge } from "@/components/ProjectionCard";
import { ProjectionRowActions, SaveProjectionButton } from "@/components/RowActions";
import { Badge, ButtonLink, Card, EmptyState, ErrorPanel, PageHeader, Stat } from "@/components/ui";
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
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Portfolio — next week" value={rm(totalWeek)} hint={`${rows.filter((r) => r.w).length} of ${tenants.length} tenants projectable`} />
            <Stat label={`Portfolio — ${formatMonth(nextMonthStart(today))}`} value={rm(totalMonth)} />
            <Stat label="Est. % rent — next week" value={rm(totalRent)} hint="projection × tenant rent rate" />
          </div>

          <Card title="Next-period estimate by tenant">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-medium">Tenant</th>
                    <th className="py-2 pr-3 text-right font-medium">Avg / day (7d)</th>
                    <th className="py-2 pr-3 text-right font-medium">Days of data</th>
                    <th className="py-2 pr-3 text-right font-medium">Next week</th>
                    <th className="py-2 pr-3 font-medium">Confidence</th>
                    <th className="py-2 pr-3 text-right font-medium">Est. % rent</th>
                    <th className="py-2 pr-3 text-right font-medium">Next month</th>
                    <th className="py-2 text-right font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ t, w, mo }) => (
                    <tr key={t.id}>
                      <td className="py-3 pr-3">
                        <Link href={`/tenants/${t.id}`} className="font-medium text-slate-900 hover:underline">
                          {t.name}
                        </Link>
                      </td>
                      {w ? (
                        <>
                          <td className="py-3 pr-3 text-right tabular-nums">{rm(w.avgDaily)}</td>
                          <td className="py-3 pr-3 text-right tabular-nums">{w.daysWithData} / 7</td>
                          <td className="py-3 pr-3 text-right font-semibold tabular-nums">{rm(w.projectedAmount)}</td>
                          <td className="py-3 pr-3">
                            <ConfidenceBadge confidence={w.confidence} />
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums">{rm(projectedRent(w.projectedAmount, t.rent_rate_pct))}</td>
                          <td className="py-3 pr-3 text-right tabular-nums">
                            {mo ? rm(mo.projectedAmount) : "—"} {mo?.lowConfidence && <span className="text-xs text-amber-700">(low)</span>}
                          </td>
                        </>
                      ) : (
                        <td colSpan={6} className="py-3 pr-3 text-sm text-slate-500">
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

          <Card className="mt-6" title={`Saved projections (${saved.length})`} action={<span className="text-xs text-slate-500">Snapshots for review & approval</span>}>
            {saved.length === 0 ? (
              <p className="text-sm text-slate-500">No snapshots saved yet. Save one to keep a reviewed record of this week’s estimate.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Tenant</th>
                      <th className="py-2 pr-3 font-medium">Period</th>
                      <th className="py-2 pr-3 text-right font-medium">Projected</th>
                      <th className="py-2 pr-3 font-medium">Confidence</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Saved</th>
                      <th className="py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {saved.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 pr-3">{names.get(p.tenant_id) ?? <span className="text-slate-400">deleted tenant</span>}</td>
                        <td className="py-2 pr-3 capitalize">{p.target_period}</td>
                        <td className="py-2 pr-3 text-right font-medium tabular-nums">{rm(Number(p.projected_amount))}</td>
                        <td className="py-2 pr-3">
                          <ConfidenceBadge confidence={p.confidence === null ? null : Number(p.confidence)} />
                        </td>
                        <td className="py-2 pr-3">
                          <Badge tone={p.review_status === "approved" ? "emerald" : "slate"}>{p.review_status ?? "unreviewed"}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-500">{dateTime(p.created_at)}</td>
                        <td className="py-2 text-right">
                          <ProjectionRowActions id={p.id} status={p.review_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
