"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useOpenAddSales } from "./AddSales";
import { Modal } from "./Modal";
import { isBarePath } from "@/lib/logic/team";
import { WorkspaceMenu } from "./WorkspaceMenu";
import { useCanWrite } from "./Workspace";

type NavItem = { href: string; label: string; short: string; icon: string };

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Dashboard", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/tenants", label: "Tenants", short: "Tenants", icon: "M4 21V7l8-4 8 4v14M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01" },
  { href: "/daily-report", label: "Daily Report", short: "Daily", icon: "M4 19h16M6 15l4-4 3 3 5-6" },
  { href: "/projections", label: "Projections", short: "Projections", icon: "M4 19h16M6 16l4-6 4 3 4-7M18 6h-3m3 0v3" },
  { href: "/import", label: "CSV Import", short: "Import", icon: "M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3" },
];

/** Bottom tab bar order on phones (thumb reach); everything else lives under "More". */
const TABS = ["/", "/daily-report", "/tenants", "/projections"];
const MORE = NAV.filter((n) => !TABS.includes(n.href));

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" || path === "/dashboard" : path.startsWith(href);
}

function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Sidebar() {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const openAddSales = useOpenAddSales();
  const canWrite = useCanWrite();
  useEffect(() => setMore(false), [path]);
  if (isBarePath(path)) return null; // login / signup / onboarding / invite pages have no app chrome

  const links = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Main">
      {NAV.map((n) => {
        const active = isActive(path, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon d={n.icon} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2 px-6 py-5">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-xs font-bold text-white">GTO</div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-slate-900">Tenant GTO</div>
        <div className="text-xs text-slate-500">Leasing &amp; Finance</div>
      </div>
    </div>
  );

  const moreActive = MORE.some((n) => isActive(path, n.href));
  const tab = "flex min-h-14 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium leading-none";

  return (
    <>
      {/* Desktop / tablet: fixed left sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-slate-200 bg-white md:block">
        {brand}
        {links}
        <WorkspaceMenu />
      </aside>

      {/* Phone: slim sticky top bar (brand only; navigation lives in the bottom tab bar) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <div className="flex h-12 items-center gap-2 px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Tenant GTO — dashboard">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-teal-700 text-[10px] font-bold text-white">GTO</span>
            <span className="text-sm font-semibold text-slate-900">Tenant GTO</span>
          </Link>
          <span className="ml-auto truncate text-xs text-slate-500">Leasing &amp; Finance</span>
        </div>
      </header>

      {/* Phone: floating Add Sales action, always above the tab bar (hidden for viewers) */}
      {canWrite && <button
        type="button"
        onClick={openAddSales}
        data-testid="fab-add-sales"
        className="fixed right-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 inline-flex h-12 touch-manipulation items-center gap-2 rounded-full bg-teal-700 pr-5 pl-4 text-sm font-semibold text-white shadow-lg shadow-teal-900/25 ring-1 ring-teal-800/20 active:bg-teal-800 md:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add Sales
      </button>}

      {/* Phone: bottom tab bar */}
      <nav
        aria-label="Main"
        data-testid="bottom-nav"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-md px-1">
          {TABS.map((href) => {
            const n = NAV.find((x) => x.href === href)!;
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`${tab} ${active ? "text-teal-800" : "text-slate-500 active:text-slate-900"}`}
              >
                <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${active ? "bg-teal-50" : ""}`}>
                  <Icon d={n.icon} className="h-5 w-5" />
                </span>
                {n.short}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMore(true)}
            aria-haspopup="dialog"
            aria-expanded={more}
            className={`${tab} ${moreActive ? "text-teal-800" : "text-slate-500 active:text-slate-900"}`}
          >
            <span className={`grid h-7 w-12 place-items-center rounded-full ${moreActive ? "bg-teal-50" : ""}`}>
              <Icon d="M5 12h.01M12 12h.01M19 12h.01" className="h-5 w-5" />
            </span>
            More
          </button>
        </div>
      </nav>

      <Modal title="More" open={more} onClose={() => setMore(false)}>
        <nav aria-label="More" className="-mx-2 flex flex-col">
          {MORE.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium ${
                  active ? "bg-teal-50 text-teal-800" : "text-slate-700 active:bg-slate-100"
                }`}
              >
                <Icon d={n.icon} className="h-5 w-5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="-mx-2 mt-2 border-t border-slate-100 pt-2">
          <WorkspaceMenu />
        </div>
      </Modal>
    </>
  );
}
