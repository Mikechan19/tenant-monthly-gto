export function rm(n: number | null | undefined, opts: { compact?: boolean; cents?: boolean } = {}): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (opts.compact && Math.abs(n) >= 10000) {
    return "RM " + new Intl.NumberFormat("en-MY", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  }
  return (
    "RM " +
    new Intl.NumberFormat("en-MY", {
      minimumFractionDigits: opts.cents ? 2 : 0,
      maximumFractionDigits: opts.cents ? 2 : 0,
    }).format(n)
  );
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/** Plain amount without "RM", e.g. 18,750.05; `cents: false` for whole-ringgit figures; null → "—". */
export function money(n: number | null | undefined, cents = true): string {
  return n === null || n === undefined || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-MY", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
}
/** money() with sen only when the figure has them. */
export const moneyAuto = (n: number | null | undefined) => money(n, n !== null && n !== undefined && !Number.isInteger(n));
