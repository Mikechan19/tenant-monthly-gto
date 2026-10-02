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
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
        {items.map((i) => (
          <div
            key={i.id}
            role="status"
            className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${i.tone === "ok" ? "bg-slate-900" : "bg-rose-700"}`}
          >
            {i.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
