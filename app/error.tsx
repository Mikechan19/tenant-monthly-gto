"use client";

import { MobileTopBar } from "@/components/TopBar";
import { btnSecondary } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <MobileTopBar />
      <div role="alert" className="flex gap-4 rounded-2xl border border-rose-200 bg-neg-bg p-6 shadow-card">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-neg ring-1 ring-rose-200" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M12 8v5M12 16.5v.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
        <div className="min-w-0 [overflow-wrap:anywhere]">
          <h1 className="text-lg font-bold tracking-tight text-rose-900">Something went wrong loading this page</h1>
          <p className="mt-1 text-sm text-rose-800">{error.message || "Unexpected error."}</p>
          <button className={`${btnSecondary} mt-4`} onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </>
  );
}
