import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
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

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60";
export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60";
export const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20";

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
