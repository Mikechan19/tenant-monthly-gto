"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { inputCls } from "./ui";

export function ReportControls({
  mode,
  tenantId,
  tenants,
}: {
  mode: "wow" | "mom";
  tenantId?: string;
  tenants: { id: string; name: string }[];
}) {
  const router = useRouter();
  const href = (m: string, t?: string) => {
    const p = new URLSearchParams();
    p.set("mode", m);
    if (t) p.set("tenant", t);
    return `/daily-report?${p}`;
  };
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Segmented pill of filter chips: selected = teal text on a 12% teal tint with a dot indicator. */}
      <div className="grid grid-cols-2 gap-1 rounded-full border border-line bg-white p-1 text-sm shadow-card sm:inline-grid" role="group" aria-label="Comparison window">
        {(
          [
            ["wow", "Week over week"],
            ["mom", "Month over month"],
          ] as const
        ).map(([m, label]) => (
          <Link
            key={m}
            href={href(m, tenantId)}
            aria-pressed={mode === m}
            className={`flex min-h-10 touch-manipulation items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-center font-semibold whitespace-nowrap transition-colors sm:min-h-9 ${
              mode === m ? "bg-primary-tint text-primary ring-1 ring-primary/20" : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            {mode === m && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
            {label}
          </Link>
        ))}
      </div>
      <label className="sr-only" htmlFor="tenant-filter">
        Tenant
      </label>
      <select
        id="tenant-filter"
        className={`${inputCls.replace("w-full", "w-full sm:w-72").replace("rounded-xl", "rounded-full")} font-semibold`}
        value={tenantId ?? ""}
        onChange={(e) => router.push(href(mode, e.target.value || undefined))}
      >
        <option value="">All tenants (portfolio)</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
