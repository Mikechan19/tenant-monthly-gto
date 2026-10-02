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

// Outline icons drawn on a 24px grid in the spirit of the Stitch (Material Symbols) tab bar.
const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Home", icon: "M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z" },
  { href: "/daily-report", label: "Daily Report", short: "Daily", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" },
  { href: "/tenants", label: "Tenants", short: "Tenants", icon: "M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 1.7 1.3 3 3 3s2.5-1.3 2.5-3c0 1.7 1.1 3 2.5 3s2.5-1.3 2.5-3c0 1.7 1.3 3 2.5 3 1.7 0 3-1.3 3-3M10 20v-4h4v4" },
  { href: "/gto", label: "Monthly GTO", short: "GTO", icon: "M4 4h16v16H4zM4 9h16M9 9v11M14 13h3M14 16.5h3" },
  { href: "/projections", label: "Projections", short: "Forecast", icon: "M4 20h16M5 16l4-5 3 3 4-6 3 3M7 20v-2M11 20v-3M15 20v-4M19 20v-6" },
  { href: "/import", label: "CSV Import", short: "Import", icon: "M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3" },
];

/** Bottom tab bar order on phones (thumb reach); everything else lives under "More". */
const TABS = ["/", "/daily-report", "/tenants", "/gto"]; // Forecast + Import live under "More"
const MORE = NAV.filter((n) => !TABS.includes(n.href));

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" || path === "/dashboard" : path.startsWith(href);
}

function Icon({ d, className = "h-4 w-4", strong = false }: { d: string; className?: string; strong?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth={strong ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
    <nav className="flex flex-col gap-1 px-3 pb-3" aria-label="Main">
      <div className="label-caps px-3 pt-1 pb-2 text-[11px] text-muted">Workspace</div>
      {NAV.map((n) => {
        const active = isActive(path, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              active ? "bg-primary-tint text-primary" : "text-ink-2 hover:bg-canvas hover:text-ink"
            }`}
          >
            {active && <span className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-primary" aria-hidden />}
            <Icon d={n.icon} className="h-5 w-5" strong={active} />
            {n.label}
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-chart-emerald" aria-hidden />}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-3 px-6 pt-6 pb-5" aria-label="Tenant GTO — dashboard">
      <span className="num grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-[#134e4a] text-xs font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_4px_14px_rgb(15_118_110/0.25)]">
        GTO
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-ink">Tenant GTO</span>
        <span className="label-caps block text-[10px] text-primary">Leasing &amp; Finance</span>
      </span>
    </Link>
  );

  const moreActive = MORE.some((n) => isActive(path, n.href));
  const tab = "flex min-h-16 flex-1 touch-manipulation flex-col items-center justify-center gap-1 px-1 text-[11px] leading-none";

  return (
    <>
      {/* Desktop / tablet: fixed left sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-white/90 backdrop-blur-xl md:flex">
        {brand}
        {links}
        <div className="mt-auto pb-4">
          <WorkspaceMenu />
        </div>
      </aside>

      {/* Phone: the sticky app bar ("GTO LEASING • team" + title) is rendered by each page's <PageHeader>. */}

      {/* Phone: floating Add Sales action, always above the tab bar (hidden for viewers) */}
      {canWrite && <button
        type="button"
        onClick={openAddSales}
        data-testid="fab-add-sales"
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 inline-flex h-12 touch-manipulation items-center gap-2 rounded-full bg-primary pr-5 pl-4 text-sm font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_24px_-6px_rgb(15_118_110/0.55),0_2px_6px_rgb(15_23_42/0.12)] ring-1 ring-white/10 transition active:translate-y-px active:bg-primary-press md:hidden"
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
        className="fixed inset-x-0 bottom-0 z-40 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-tabbar backdrop-blur-xl md:hidden"
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
                className={`${tab} ${active ? "font-bold text-primary" : "font-medium text-muted active:text-ink"}`}
              >
                <span className={`grid h-7 w-14 place-items-center rounded-full transition-colors ${active ? "bg-primary-tint" : ""}`}>
                  <Icon d={n.icon} className="h-[22px] w-[22px]" strong={active} />
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
            className={`${tab} ${moreActive ? "font-bold text-primary" : "font-medium text-muted active:text-ink"}`}
          >
            <span className={`grid h-7 w-14 place-items-center rounded-full ${moreActive ? "bg-primary-tint" : ""}`}>
              <Icon d="M5 12h.01M12 12h.01M19 12h.01" className="h-[22px] w-[22px]" strong />
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
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold ${
                  active ? "bg-primary-tint text-primary" : "text-ink-2 active:bg-canvas"
                }`}
              >
                <Icon d={n.icon} className="h-5 w-5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="-mx-5 mt-3 border-t border-line pt-3">
          <WorkspaceMenu />
        </div>
      </Modal>
    </>
  );
}
