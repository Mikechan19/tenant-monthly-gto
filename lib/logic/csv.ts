import type { PeriodType, Tenant } from "@/lib/data/types";
import { parseSalesFields, periodTimestamp } from "./records";
import { parseOutlet } from "./terms";

export type ImportRow = {
  line: number;
  raw: Record<string, string>;
  tenantName?: string;
  record?: { tenant_id: string; period_type: PeriodType; amount: number; recorded_at: string; outlet: string | null };
  error?: string;
};

/** Minimal RFC-4180 CSV splitter (quotes, escaped quotes, CRLF). */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const ALIASES: Record<string, string> = {
  tenant: "tenant",
  tenant_name: "tenant",
  name: "tenant",
  unit: "unit",
  period: "period_type",
  period_type: "period_type",
  type: "period_type",
  amount: "amount",
  sales: "amount",
  gto: "amount",
  date: "date",
  day: "date",
  recorded_at: "date",
  hour: "hour",
  outlet: "outlet",
  outlet_name: "outlet",
  branch: "outlet",
};

/** Accepts YYYY-MM-DD, DD/MM/YYYY (Malaysian format) or an ISO timestamp. */
export function normaliseDate(v: string): { date: string; hour?: number } | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):\d{2})?/);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, hour: m[4] !== undefined ? Number(m[4]) : undefined };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):\d{2})?$/);
  if (m)
    return {
      date: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`,
      hour: m[4] !== undefined ? Number(m[4]) : undefined,
    };
  return null;
}

/**
 * Parses CSV text into validated rows. Columns (header required, case-insensitive):
 * tenant (name) or unit, amount, date, period_type (default "daily"), hour (hourly rows), outlet (optional).
 */
export function parseCsv(text: string, tenants: Tenant[]): ImportRow[] {
  const rows = splitCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((h) => ALIASES[h.trim().toLowerCase().replace(/\s+/g, "_")] ?? h.trim().toLowerCase());
  if (!header.includes("amount") || !header.includes("date") || !(header.includes("tenant") || header.includes("unit"))) {
    return [
      {
        line: 1,
        raw: {},
        error: "Header must include tenant (or unit), amount and date columns.",
      },
    ];
  }
  const byName = new Map(tenants.map((t) => [t.name.trim().toLowerCase(), t]));
  const byUnit = new Map(tenants.filter((t) => t.unit).map((t) => [t.unit!.trim().toLowerCase(), t]));

  return rows.slice(1).map((cells, i) => {
    const raw: Record<string, string> = {};
    header.forEach((h, j) => (raw[h] = (cells[j] ?? "").trim()));
    const line = i + 2;
    const tenant =
      (raw.tenant && byName.get(raw.tenant.toLowerCase())) || (raw.unit && byUnit.get(raw.unit.toLowerCase())) || null;
    if (!tenant) return { line, raw, error: `Unknown tenant "${raw.tenant || raw.unit || ""}".` };
    const d = normaliseDate(raw.date ?? "");
    if (!d) return { line, raw, tenantName: tenant.name, error: `Invalid date "${raw.date ?? ""}".` };
    const period = (raw.period_type || "daily").toLowerCase();
    const hour = raw.hour !== undefined && raw.hour !== "" ? raw.hour : d.hour;
    const parsed = parseSalesFields({ tenant_id: tenant.id, period_type: period, amount: raw.amount, date: d.date, hour });
    if (!parsed.ok)
      return { line, raw, tenantName: tenant.name, error: Object.values(parsed.errors).join(" ") };
    const outlet = parseOutlet(raw.outlet);
    if (!outlet.ok) return { line, raw, tenantName: tenant.name, error: outlet.error };
    const v = parsed.value;
    return {
      line,
      raw,
      tenantName: tenant.name,
      record: {
        tenant_id: v.tenant_id,
        period_type: v.period_type,
        amount: v.amount,
        recorded_at: periodTimestamp(v.period_type, v.date, v.hour).toISOString(),
        outlet: outlet.value,
      },
    };
  });
}
