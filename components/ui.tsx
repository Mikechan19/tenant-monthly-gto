import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight break-words text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && (
        // On phones every action grows to share the row, so wrapped buttons stay full, even targets.
        <div className="flex flex-wrap items-center gap-2 *:grow sm:shrink-0 sm:*:grow-0">{actions}</div>
      )}
    </div>
  );
}

export function Card({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, delta, hint }: { label: string; value: ReactNode; delta?: number | null; hint?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">{label}</div>
      <div className="mt-1 text-lg leading-tight font-semibold tabular-nums break-words text-slate-900 min-[400px]:text-xl sm:text-2xl">{value}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
        {delta !== undefined && <Delta value={delta} />}
        {hint}
      </div>
    </div>
  );
}

export function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">no comparison</span>;
  const up = value >= 0;
  return (
    <span className={`font-medium tabular-nums ${up ? "text-emerald-700" : "text-rose-700"}`}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      <svg viewBox="0 0 64 64" className="mb-3 h-14 w-14 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <rect x="8" y="14" width="48" height="38" rx="4" />
        <path d="M8 24h48M18 40l8-8 6 6 10-10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      {body && <div className="mt-1 max-w-sm text-sm text-slate-500">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
      <div className="font-semibold">Couldn’t load data</div>
      <div className="mt-1">{message}</div>
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "teal" | "amber" | "emerald" | "rose" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    teal: "bg-teal-50 text-teal-800",
    amber: "bg-amber-50 text-amber-800",
    emerald: "bg-emerald-50 text-emerald-800",
    rose: "bg-rose-50 text-rose-800",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function ButtonLink({ href, children, variant = "secondary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? btnPrimary : btnSecondary}>
      {children}
    </Link>
  );
}

// Buttons are at least 44px tall on touch-sized screens (WCAG / Apple HIG target), compact from `sm` up.
const touch = "min-h-11 touch-manipulation sm:min-h-0";
export const btnPrimary =
  `inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium whitespace-nowrap text-white shadow-sm hover:bg-teal-800 active:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60 ${touch}`;
export const btnSecondary =
  `inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium whitespace-nowrap text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 ${touch}`;
export const btnDanger =
  `inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-rose-700 hover:bg-rose-50 active:bg-rose-100 disabled:opacity-60 ${touch}`;
// 16px text on phones stops iOS Safari zooming into focused fields; 44px tall for touch.
export const inputCls =
  "block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 sm:min-h-0 sm:text-sm";

export function Field({ label, error, children, htmlFor }: { label: string; error?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}
