"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Footer row for forms inside <Modal>. It sticks to the bottom of the sheet's scroll area so the
 * submit button stays reachable above the on-screen keyboard; buttons go full-width on phones.
 */
export const modalFooterCls =
  "sticky bottom-0 z-10 -mx-5 -mb-5 flex gap-2 border-t border-line bg-white/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur *:flex-1 sm:static sm:mx-0 sm:mb-0 sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:pt-2 sm:pb-0 sm:backdrop-blur-none sm:*:flex-none";

let locks = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

/** Locks page scroll while any modal is open (ref-counted so nested/stacked modals are safe). */
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const el = document.documentElement;
    if (locks++ === 0) {
      saved = { overflow: el.style.overflow, paddingRight: el.style.paddingRight };
      const gap = window.innerWidth - el.clientWidth; // avoid layout shift where scrollbars take space
      el.style.overflow = "hidden";
      if (gap > 0) el.style.paddingRight = `${gap}px`;
    }
    return () => {
      if (--locks === 0 && saved) {
        el.style.overflow = saved.overflow;
        el.style.paddingRight = saved.paddingRight;
        saved = null;
      }
    };
  }, [active]);
}

/**
 * Tracks how much of the layout viewport the on-screen keyboard covers (iOS Safari overlays the
 * keyboard instead of resizing), so the bottom sheet can sit on top of it.
 */
function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState({ bottom: 0, height: 0 });
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () => {
      const bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset({ bottom: bottom > 80 ? bottom : 0, height: vv.height });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return inset;
}

export function Modal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  const kb = useKeyboardInset(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Keep the focused field visible inside the sheet when the keyboard opens.
  useEffect(() => {
    if (!open || !kb.bottom) return;
    const a = document.activeElement as HTMLElement | null;
    if (a && dialog.current?.contains(a)) a.scrollIntoView({ block: "center" });
  }, [open, kb.bottom]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-slate-900/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      style={kb.bottom ? { bottom: kb.bottom } : undefined}
      onMouseDown={onClose}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-modal sm:max-w-lg sm:rounded-3xl"
        style={kb.bottom ? { maxHeight: kb.height - 8 } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* grab handle (phones) */}
        <span className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-1.5 pr-2 pl-5 sm:border-0 sm:px-6 sm:pt-6 sm:pb-0">
          <div className="min-w-0">
            <div className="label-caps text-[10px] text-primary">GTO Leasing</div>
            <h2 className="truncate text-lg leading-7 font-bold tracking-tight text-ink sm:text-xl">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-canvas text-muted ring-1 ring-line hover:bg-row hover:text-ink sm:h-9 sm:w-9"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:px-6 sm:pt-4 sm:pb-6">{children}</div>
      </div>
    </div>
  );
}
