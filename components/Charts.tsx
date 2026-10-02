"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparePoint } from "@/lib/logic/aggregate";
import { formatDay } from "@/lib/logic/dates";
import { rm } from "@/lib/format";

const CUR = "#0f766e"; // teal-700
const PREV = "#94a3b8"; // slate-400
const axis = { fontSize: 12, fill: "#64748b" };
const compactRm = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v));

export function SalesChart({
  data,
  currentLabel,
  previousLabel,
  height = 300,
}: {
  data: ComparePoint[];
  currentLabel: string;
  previousLabel: string;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full" data-testid="sales-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compactRm} width={44} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ComparePoint;
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                  {p.currentDate && (
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: CUR }} />
                        {formatDay(p.currentDate)}
                      </span>
                      <span className="font-semibold tabular-nums">{p.current === null ? "—" : rm(p.current)}</span>
                    </div>
                  )}
                  {p.previousDate && (
                    <div className="mt-1 flex justify-between gap-4">
                      <span className="text-slate-500">
                        <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: PREV }} />
                        {formatDay(p.previousDate)}
                      </span>
                      <span className="font-semibold tabular-nums">{rm(p.previous)}</span>
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Line
            name={previousLabel}
            type="monotone"
            dataKey="previous"
            stroke={PREV}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            name={currentLabel}
            type="monotone"
            dataKey="current"
            stroke={CUR}
            strokeWidth={2.5}
            dot={{ r: 3, fill: CUR }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TenantBars({ data, height = 260 }: { data: { id: string; name: string; amount: number }[]; height?: number }) {
  const router = useRouter();
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={compactRm} />
          <YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={110} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v) => [rm(Number(v)), "Today"]} />
          <Bar
            dataKey="amount"
            fill={CUR}
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
            cursor="pointer"
            isAnimationActive={false}
            onClick={(d: { id?: string; payload?: { id: string } }) => {
              const id = d?.payload?.id ?? d?.id;
              if (id) router.push(`/tenants/${id}`);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendBars({ data, height = 220 }: { data: { date: string; amount: number }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} tickFormatter={(d: string) => d.slice(8)} />
          <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compactRm} width={44} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} labelFormatter={(d) => formatDay(String(d))} formatter={(v) => [rm(Number(v)), "GTO"]} />
          <Bar dataKey="amount" fill={CUR} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HourlyBars({ data, height = 220 }: { data: { hour: number; amount: number }[]; height?: number }) {
  const first = data.findIndex((d) => d.amount > 0);
  const last = data.length - 1 - [...data].reverse().findIndex((d) => d.amount > 0);
  const slice = data.slice(Math.max(0, first - 1), Math.min(24, last + 2));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={slice} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="hour" tick={axis} tickLine={false} tickFormatter={(h: number) => `${String(h).padStart(2, "0")}h`} />
          <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compactRm} width={44} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} labelFormatter={(h) => `${String(h).padStart(2, "0")}:00`} formatter={(v) => [rm(Number(v)), "Sales"]} />
          <Bar dataKey="amount" fill={CUR} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ data, href }: { data: { date: string; amount: number }[]; href?: string }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  const w = 120;
  const h = 32;
  const pts = data.map((d, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - (d.amount / max) * (h - 4) - 2}`).join(" ");
  const svg = (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-28" aria-hidden>
      <polyline points={pts} fill="none" stroke={CUR} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
  return href ? <Link href={href}>{svg}</Link> : svg;
}
