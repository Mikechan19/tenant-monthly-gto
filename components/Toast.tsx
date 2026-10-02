"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<(msg: string, tone?: "ok" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; tone: "ok" | "error" }[]>([]);
  const push = useCallback((msg: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(8rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:right-4 md:bottom-4 md:items-end" aria-live="polite">
        {items.map((i) => (
          <div
            key={i.id}
            role="status"
            className={`flex items-center gap-2.5 rounded-2xl py-2.5 pr-4 pl-3 text-sm font-semibold text-white shadow-modal ring-1 ring-white/10 ${i.tone === "ok" ? "bg-ink" : "bg-neg"}`}
          >
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${i.tone === "ok" ? "bg-chart-emerald/20 text-chart-emerald" : "bg-white/20 text-white"}`} aria-hidden>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <path d={i.tone === "ok" ? "M5 12.5l4.5 4.5L19 7.5" : "M12 7v6M12 16.5v.01"} />
              </svg>
            </span>
            {i.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
