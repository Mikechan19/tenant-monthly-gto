import Link from "next/link";
import type { ReactNode } from "react";
import { AccountAvatar, TeamEyebrow } from "./TopBar";

/**
 * Page title block. On phones it *is* the sticky app bar (eyebrow "GTO LEASING • <team>" + title,
 * Stitch style); from `md` up it is a regular header above the content. Returned as a fragment so the
 * sticky bar's containing block is the whole page, not just this header.
 */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <header
        className="sticky top-0 z-30 -mx-4 -mt-5 mb-4 bg-white/85 px-4 pt-[env(safe-area-inset-top)] shadow-bar backdrop-blur-xl sm:-mx-6 sm:px-6 md:static md:z-auto md:mx-0 md:mt-0 md:mb-2 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none"
        data-testid="page-header"
      >
        <div className="flex h-16 items-center justify-between gap-3 md:h-auto">
          <div className="min-w-0">
            <TeamEyebrow />
            <h1 className="truncate text-xl leading-7 font-semibold tracking-tight text-ink md:mt-1 md:text-[2rem] md:leading-10 md:font-bold md:tracking-[-0.025em] md:whitespace-normal md:break-words">
              {title}
            </h1>
          </div>
          <AccountAvatar className="md:hidden" />
        </div>
      </header>
      {(subtitle || actions) && (
        <div className="mb-5 flex flex-col gap-3 sm:mb-6 md:flex-row md:items-center md:justify-between">
          {subtitle ? <div className="min-w-0 text-sm text-muted">{subtitle}</div> : <span />}
          {actions && (
            // On phones every action grows to share the row, so wrapped buttons stay full, even targets.
            <div className="flex flex-wrap items-center gap-2 *:grow md:shrink-0 md:*:grow-0">{actions}</div>
          )}
        </div>
      )}
    </>
  );
}

/** Level-1 surface: white, 16px corners, 1px subtle border, soft dual-tone shadow. */
export const cardCls = "min-w-0 rounded-2xl border border-line bg-card shadow-card";

export function Card({
  children,
  className = "",
  title,
  action,
  eyebrow,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <section className={`${cardCls} p-4 sm:p-5 ${className}`}>
      {(title || action || eyebrow) && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            {eyebrow && <div className="label-caps mb-0.5 text-primary">{eyebrow}</div>}
            {title && <h2 className="text-base leading-6 font-bold tracking-tight text-ink sm:text-[1.0625rem]">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Caps section label (Space Grotesk), e.g. above a list of cards. */
export function SectionLabel({ children, action, className = "" }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`mb-3 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="label-caps text-ink-2">{children}</h2>
      {action}
    </div>
  );
}

type SparkPoint = number | { amount: number };

/**
 * Financial KPI card: caps label, big Space Grotesk figure, delta pill + hint, and an optional
 * micro sparkline along the lower edge with a gradient fill that fades to zero opacity.
 */
export function Stat({
  label,
  value,
  delta,
  hint,
  spark,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  hint?: ReactNode;
  spark?: SparkPoint[];
}) {
  const hasSpark = !!spark && spark.length > 1;
  return (
    <div className={`${cardCls} relative overflow-hidden p-3.5 sm:p-4 ${hasSpark ? "pb-10 sm:pb-12" : ""}`}>
      <div className="label-caps truncate text-[11px] text-muted sm:text-xs">{label}</div>
      <div className="num mt-1.5 text-xl leading-tight font-bold tracking-[-0.02em] break-words text-ink min-[400px]:text-2xl lg:text-[1.875rem] lg:leading-9">
        {value}
      </div>
      {(delta !== undefined || hint) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {delta !== undefined && <Delta value={delta} />}
          {hint}
        </div>
      )}
      {hasSpark && <MiniArea data={spark!.map((p) => (typeof p === "number" ? p : p.amount))} seed={label} className="absolute inset-x-0 bottom-0 h-9 w-full sm:h-10" />}
    </div>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Decorative area sparkline (server-renderable SVG). */
export function MiniArea({ data, seed = "s", className = "" }: { data: number[]; seed?: string; className?: string }) {
  const w = 200;
  const h = 40;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * w, h - (v / max) * (h - 8) - 3] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const id = `spark-${hash(seed)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="#0d9488" strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Inline delta pill: tinted background, chevron, Space Grotesk percent. */
export function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">no comparison</span>;
  const up = value >= 0;
  return (
    <span
      className={`num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
        up ? "bg-pos-bg text-pos" : "bg-neg-bg text-neg"
      }`}
    >
      <svg viewBox="0 0 12 12" className={`h-3 w-3 ${up ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 7.5 6 4.5l3 3" />
      </svg>
      <span className="sr-only">{up ? "up" : "down"}</span>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-card/70 px-6 py-12 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-primary-tint text-primary">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 20h16M6 16v-4M10 16V8M14 16v-6M18 16V5" />
        </svg>
      </div>
      <div className="text-base font-bold tracking-tight text-ink">{title}</div>
      {body && <div className="mt-1 max-w-sm text-sm text-muted">{body}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div role="alert" className="flex gap-3 rounded-2xl border border-rose-200 bg-neg-bg p-5 text-sm text-rose-900 shadow-card">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-neg ring-1 ring-rose-200" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M12 8v5M12 16.5v.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </span>
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <div className="font-bold">Couldn’t load data</div>
        <div className="mt-1">{message}</div>
      </div>
    </div>
  );
}

export type Tone = "slate" | "teal" | "amber" | "emerald" | "rose";
const TONES: Record<Tone, { pill: string; dot: string }> = {
  slate: { pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  teal: { pill: "bg-primary-tint text-primary", dot: "bg-primary" },
  amber: { pill: "bg-warn-bg text-warn ring-1 ring-amber-200/70", dot: "bg-chart-amber" },
  emerald: { pill: "bg-pos-bg text-pos ring-1 ring-emerald-200/70", dot: "bg-chart-emerald" },
  rose: { pill: "bg-neg-bg text-neg ring-1 ring-rose-200/70", dot: "bg-chart-rose" },
};

/** Status pill: ≥24px, uppercase label-badge, tinted background (optional dot indicator). */
export function Badge({ children, tone = "slate", dot = false }: { children: ReactNode; tone?: Tone; dot?: boolean }) {
  const t = TONES[tone];
  return (
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] leading-4 font-semibold tracking-[0.04em] whitespace-nowrap uppercase ${t.pill}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden />}
      {children}
    </span>
  );
}

const PALETTE = [
  "from-[#059669] to-[#065f46]", // emerald
  "from-[#0d9488] to-[#134e4a]", // teal
  "from-[#7c3aed] to-[#4c1d95]", // violet
  "from-[#d97706] to-[#92400e]", // amber
  "from-[#e11d48] to-[#881337]", // rose
];

export function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s&]/gu, " ").split(/\s+/).filter((w) => w && w !== "&");
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

/** Initials tile coloured from the chart palette (no external images). Decorative. */
export function Avatar({ name, seed, size = "md" }: { name: string; seed?: string; size?: "sm" | "md" | "lg" }) {
  const g = PALETTE[hash(seed ?? name) % PALETTE.length];
  const dims = size === "lg" ? "h-16 w-16 rounded-2xl text-xl" : size === "sm" ? "h-9 w-9 rounded-xl text-sm" : "h-12 w-12 rounded-xl text-lg";
  return (
    <span
      aria-hidden
      className={`num relative grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br font-bold tracking-tight text-white shadow-inner ${g} ${dims}`}
    >
      <span className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-white/20 blur-md" />
      <span className="relative">{initials(name)}</span>
    </span>
  );
}

/** Horizontal share / progress bar (teal → emerald). */
export function Meter({ value, className = "" }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-panel-strong ${className}`} aria-hidden>
      <div className="h-full rounded-full bg-gradient-to-r from-primary to-chart-emerald" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ButtonLink({ href, children, variant = "secondary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? btnPrimary : btnSecondary}>
      {children}
    </Link>
  );
}

/** Ghost / tertiary text link in the primary colour. */
export const linkCls = "font-semibold text-primary underline-offset-4 hover:underline";

// Buttons are pills, at least 44px tall on touch-sized screens (WCAG / Apple HIG target), compact from `sm` up.
const touch = "min-h-11 touch-manipulation sm:min-h-10";
const btnBase = `inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 ${touch}`;
export const btnPrimary = `${btnBase} bg-primary text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] hover:-translate-y-px hover:bg-primary-hover hover:shadow-cta active:translate-y-px active:bg-primary-press disabled:translate-y-0 disabled:shadow-none`;
export const btnSecondary = `${btnBase} border border-line bg-canvas text-ink hover:bg-row active:bg-slate-200/70`;
export const btnDanger = `${btnBase} border border-rose-200 bg-white text-neg hover:bg-neg-bg active:bg-rose-100`;
// 16px text on phones stops iOS Safari zooming into focused fields; 44px tall for touch.
export const inputCls =
  "block w-full min-h-11 rounded-xl border border-line-strong bg-white px-3.5 py-2.5 text-base text-ink shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15 disabled:bg-canvas sm:text-sm";

export function Field({ label, error, children, htmlFor }: { label: string; error?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label-caps mb-1.5 block text-[11px] text-muted">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-sm font-medium text-neg" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/60 ${className}`} />;
}
