"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isBarePath } from "@/lib/logic/team";
import { WorkspaceMenu } from "./WorkspaceMenu";

const NAV = [
  { href: "/", label: "Dashboard", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/tenants", label: "Tenants", icon: "M4 21V7l8-4 8 4v14M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01" },
  { href: "/daily-report", label: "Daily Report", icon: "M4 19h16M6 15l4-4 3 3 5-6" },
  { href: "/projections", label: "Projections", icon: "M4 19h16M6 16l4-6 4 3 4-7M18 6h-3m3 0v3" },
  { href: "/import", label: "CSV Import", icon: "M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" || path === "/dashboard" : path.startsWith(href);
}

export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
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
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={n.icon} />
            </svg>
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

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-slate-200 bg-white md:block">
        {brand}
        {links}
        <WorkspaceMenu />
      </aside>

      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 md:hidden">
        <div className="-ml-4">{brand}</div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      {open && (
        <div className="border-b border-slate-200 bg-white pb-3 md:hidden">
          {links}
          <WorkspaceMenu />
        </div>
      )}
    </>
  );
}
