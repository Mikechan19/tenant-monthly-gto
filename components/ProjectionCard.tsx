import type { ProjectionResult } from "@/lib/logic/projection";
import { projectedRent } from "@/lib/logic/projection";
import { rm } from "@/lib/format";
import { Badge, cardCls } from "./ui";

/** Confidence as a status pill: ≥0.7 high (emerald), 0.6–0.7 moderate (amber), <0.6 low (amber). */
export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence === undefined) return <Badge>—</Badge>;
  const tone = confidence >= 0.7 ? "emerald" : "amber";
  const label = confidence >= 0.7 ? "High" : confidence >= 0.6 ? "Moderate" : "Low";
  return (
    <Badge tone={tone} dot>
      {label}
      <span className="sr-only"> confidence</span> · <span className="num">{confidence.toFixed(1)}</span>
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
    <section className={`${cardCls} relative overflow-hidden p-5`} data-testid={`projection-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full bg-primary/10 blur-2xl" aria-hidden />
      <div className="relative flex items-center justify-between gap-2">
        <div>
          <div className="label-caps text-[11px] text-primary">Projected GTO</div>
          <h2 className="text-base font-bold tracking-tight text-ink">{title}</h2>
        </div>
        {p && <ConfidenceBadge confidence={p.confidence} />}
      </div>
      {p ? (
        <div className="relative">
          <div className="num mt-3 text-3xl leading-9 font-bold tracking-[-0.02em] text-ink">{rm(p.projectedAmount)}</div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-panel p-3 text-xs text-ink-2">
            <dt>Avg / trading day</dt>
            <dd className="num text-right font-semibold text-ink">{rm(p.avgDaily, { cents: true })}</dd>
            <dt>Days with data</dt>
            <dd className="num text-right font-semibold text-ink">
              {p.daysWithData} of last {p.windowDays}
            </dd>
            <dt>Est. % rent{ratePct !== null ? ` (${Number(ratePct)}%)` : ""}</dt>
            <dd className="num text-right font-semibold text-pos">{rm(projectedRent(p.projectedAmount, ratePct))}</dd>
            <dt>Method</dt>
            <dd className="text-right font-medium">{p.method === "trailing_avg_7d" ? "Trailing 7-day avg" : "Trailing 28-day avg"}</dd>
          </dl>
          {p.lowConfidence && (
            <p className="mt-3 rounded-xl bg-warn-bg px-3 py-2 text-xs font-medium text-warn">
              Low confidence — only {p.daysWithData} day{p.daysWithData === 1 ? "" : "s"} of sales in the window.
            </p>
          )}
          {action && <div className="mt-4 [&>button]:w-full sm:[&>button]:w-auto">{action}</div>}
        </div>
      ) : (
        <p className="relative mt-3 text-sm text-muted">Not enough data to project.</p>
      )}
    </section>
  );
}
