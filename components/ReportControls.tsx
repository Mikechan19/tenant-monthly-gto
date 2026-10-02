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
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="grid grid-cols-2 rounded-lg border border-slate-300 bg-white p-0.5 text-sm shadow-sm sm:inline-grid" role="group" aria-label="Comparison window">
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
            className={`flex min-h-10 touch-manipulation items-center justify-center rounded-md px-3 py-1.5 text-center font-medium whitespace-nowrap sm:min-h-0 ${mode === m ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <label className="sr-only" htmlFor="tenant-filter">
        Tenant
      </label>
      <select
        id="tenant-filter"
        className={inputCls.replace("w-full", "w-full sm:w-72")}
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
