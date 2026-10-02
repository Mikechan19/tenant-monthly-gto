// All business-day bucketing uses Malaysia time (UTC+8, no DST).
export const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of the Malaysia-time calendar day containing `d`. */
export function dayKey(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  return new Date(t + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** Hour (0–23) in Malaysia time. */
export function myHour(d: Date | string): number {
  const t = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  return new Date(t + TZ_OFFSET_MS).getUTCHours();
}

/** UTC instant for a Malaysia-time wall clock (date YYYY-MM-DD, hour). */
export function myWallToUtc(date: string, hour = 0, minute = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - TZ_OFFSET_MS);
}

export function todayKey(now = new Date()): string {
  return dayKey(now);
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

/** ISO weekday 1 (Mon) … 7 (Sun) for a day key. */
export function isoDow(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  return addDays(key, 1 - isoDow(key));
}

export function monthStart(key: string): string {
  return key.slice(0, 8) + "01";
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function prevMonthStart(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}-01`;
}

export function nextMonthStart(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
