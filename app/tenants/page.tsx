import Link from "next/link";
import { AddSales } from "@/components/AddSales";
import { Sparkline } from "@/components/Charts";
import { DeleteTenant, TenantButton } from "@/components/TenantForm";
import { Badge, Card, EmptyState, ErrorPanel, PageHeader } from "@/components/ui";
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
        {/* Phones: one card per tenant */}
        <ul className="space-y-3 sm:hidden" data-testid="tenant-cards">
          {tenants.map((t) => {
            const m = by.get(t.id) ?? new Map<string, number>();
            const p = projectFromDaily(m, today, "weekly");
            return (
              <li key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/tenants/${t.id}`} className="min-w-0 py-0.5">
                    <div className="truncate text-base font-semibold text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500">
                      {t.category ?? "—"} · Unit {t.unit ?? "—"} · {t.rent_rate_pct === null ? "no % rent" : `${Number(t.rent_rate_pct)}% rent`}
                    </div>
                  </Link>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Today</div>
                    <div className="text-sm font-semibold tabular-nums">{rm(m.get(today) ?? 0)}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Last 14 days</div>
                    {m.size ? (
                      <Sparkline data={lastNDays(m, today, 14)} href={`/tenants/${t.id}`} className="mt-1 h-8 w-full max-w-40" />
                    ) : (
                      <div className="mt-1 text-xs text-slate-400">No sales yet</div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Next week (proj.)</div>
                    {p ? (
                      <div className="flex items-center justify-end gap-1.5 text-sm font-semibold tabular-nums">
                        {p.lowConfidence && <Badge tone="amber">low conf.</Badge>}
                        {rm(p.projectedAmount)}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">Not enough data</div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 *:flex-1">
                  <TenantButton tenant={t} />
                  <DeleteTenant tenant={t} />
                </div>
              </li>
            );
          })}
        </ul>
        <Card className="hidden sm:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Tenant</th>
                  <th className="py-2 pr-3 font-medium">Unit</th>
                  <th className="py-2 pr-3 text-right font-medium">% rent</th>
                  <th className="py-2 pr-3 text-right font-medium">Today</th>
                  <th className="py-2 pr-3 font-medium">Last 14 days</th>
                  <th className="py-2 pr-3 text-right font-medium">Next week (proj.)</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((t) => {
                  const m = by.get(t.id) ?? new Map<string, number>();
                  const p = projectFromDaily(m, today, "weekly");
                  return (
                    <tr key={t.id}>
                      <td className="py-3 pr-3">
                        <Link href={`/tenants/${t.id}`} className="font-medium text-slate-900 hover:underline">
                          {t.name}
                        </Link>
                        <div className="text-xs text-slate-500">{t.category ?? "—"}</div>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{t.unit ?? "—"}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{t.rent_rate_pct === null ? "—" : `${Number(t.rent_rate_pct)}%`}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{rm(m.get(today) ?? 0)}</td>
                      <td className="py-3 pr-3">
                        {m.size ? <Sparkline data={lastNDays(m, today, 14)} href={`/tenants/${t.id}`} /> : <span className="text-xs text-slate-400">No sales yet</span>}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">
                        {p ? (
                          <>
                            {rm(p.projectedAmount)} {p.lowConfidence && <Badge tone="amber">low conf.</Badge>}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Not enough data</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          <TenantButton tenant={t} />
                          <DeleteTenant tenant={t} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        </>
      )}
    </>
  );
}
