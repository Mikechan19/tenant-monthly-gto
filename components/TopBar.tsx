"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "./Workspace";

/** "GTO LEASING • <active team>" eyebrow with a live dot (Stitch app-bar style). */
export function TeamEyebrow() {
  const ws = useWorkspace();
  const team = ws?.active?.name;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-emerald opacity-50 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-chart-emerald" />
      </span>
      <span className="label-caps truncate text-primary">
        GTO Leasing{team ? <> • {team}</> : null}
      </span>
    </div>
  );
}

/** Round account chip in the phone app bar → team settings (members, roles, invites). */
export function AccountAvatar({ className = "" }: { className?: string }) {
  const ws = useWorkspace();
  if (!ws) return null;
  const letter = (ws.email[0] ?? "?").toUpperCase();
  return (
    <Link
      href="/team"
      aria-label={`Team & account (${ws.email})`}
      className={`num grid h-10 w-10 shrink-0 touch-manipulation place-items-center rounded-full bg-gradient-to-br from-primary to-[#134e4a] text-sm font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] ring-2 ring-white ${className}`}
    >
      {letter}
    </Link>
  );
}

const SECTION: [RegExp, string][] = [
  [/^\/(dashboard)?$/, "Portfolio dashboard"],
  [/^\/daily-report/, "Daily Report"],
  [/^\/tenants\/./, "Tenant"],
  [/^\/tenants/, "Tenants"],
  [/^\/projections/, "Projections"],
  [/^\/import/, "CSV import"],
  [/^\/team/, "Team"],
];

/**
 * Phone app bar for screens that have no <PageHeader> (loading, error and not-found states):
 * same look, with the section name taken from the URL. Hidden from `md` up.
 */
export function MobileTopBar() {
  const path = usePathname();
  const title = SECTION.find(([re]) => re.test(path))?.[1] ?? "Tenant GTO";
  return (
    <div className="sticky top-0 z-30 -mx-4 -mt-5 mb-4 bg-white/85 px-4 pt-[env(safe-area-inset-top)] shadow-bar backdrop-blur-xl sm:-mx-6 sm:px-6 md:hidden">
      <div className="flex h-16 items-center justify-between gap-3">
        <div className="min-w-0">
          <TeamEyebrow />
          <div className="truncate text-xl leading-7 font-semibold tracking-tight text-ink">{title}</div>
        </div>
        <AccountAvatar />
      </div>
    </div>
  );
}
