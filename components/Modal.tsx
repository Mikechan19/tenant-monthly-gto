"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Footer row for forms inside <Modal>. It sticks to the bottom of the sheet's scroll area so the
 * submit button stays reachable above the on-screen keyboard; buttons go full-width on phones.
 */
export const modalFooterCls =
  "sticky bottom-0 z-10 -mx-5 -mb-5 flex gap-2 border-t border-slate-100 bg-white px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] *:flex-1 sm:static sm:mx-0 sm:mb-0 sm:justify-end sm:border-0 sm:px-0 sm:pt-1 sm:pb-0 sm:*:flex-none";

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
      className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-slate-900/40 p-0 sm:items-center sm:p-4"
      style={kb.bottom ? { bottom: kb.bottom } : undefined}
      onMouseDown={onClose}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
        style={kb.bottom ? { maxHeight: kb.height - 8 } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 py-2 pr-2 pl-5 sm:border-0 sm:px-6 sm:pt-5 sm:pb-0">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 sm:h-8 sm:w-8"
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
