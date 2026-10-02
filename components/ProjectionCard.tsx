import type { ProjectionResult } from "@/lib/logic/projection";
import { projectedRent } from "@/lib/logic/projection";
import { rm } from "@/lib/format";
import { Badge } from "./ui";

export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence === undefined) return <Badge>—</Badge>;
  const tone = confidence >= 0.7 ? "emerald" : "amber";
  return (
    <Badge tone={tone}>
      {confidence >= 0.6 ? "" : "Low confidence · "}
      {confidence.toFixed(1)}
    </Badge>
  );
}

export function ProjectionCard({
  title,
  p,
  ratePct,
  action,
}: {
  title: string;
  p: ProjectionResult | null;
  ratePct: number | null;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" data-testid={`projection-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {p && <ConfidenceBadge confidence={p.confidence} />}
      </div>
      {p ? (
        <>
          <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{rm(p.projectedAmount)}</div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
            <dt>Avg / trading day</dt>
            <dd className="text-right tabular-nums">{rm(p.avgDaily, { cents: true })}</dd>
            <dt>Days with data</dt>
            <dd className="text-right tabular-nums">
              {p.daysWithData} of last {p.windowDays}
            </dd>
            <dt>Est. % rent{ratePct !== null ? ` (${Number(ratePct)}%)` : ""}</dt>
            <dd className="text-right tabular-nums">{rm(projectedRent(p.projectedAmount, ratePct))}</dd>
            <dt>Method</dt>
            <dd className="text-right">{p.method === "trailing_avg_7d" ? "Trailing 7-day avg" : "Trailing 28-day avg"}</dd>
          </dl>
          {p.lowConfidence && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Low confidence — only {p.daysWithData} day{p.daysWithData === 1 ? "" : "s"} of sales in the window.
            </p>
          )}
          {action && <div className="mt-4">{action}</div>}
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Not enough data to project.</p>
      )}
    </section>
  );
}
