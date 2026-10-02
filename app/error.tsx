"use client";

import { btnSecondary } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6">
      <h1 className="text-lg font-semibold text-rose-900">Something went wrong loading this page</h1>
      <p className="mt-1 text-sm text-rose-800">{error.message || "Unexpected error."}</p>
      <button className={`${btnSecondary} mt-4`} onClick={reset}>
        Try again
      </button>
    </div>
  );
}
