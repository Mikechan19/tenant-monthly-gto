"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
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
const axisSm = { fontSize: 11, fill: "#64748b" };
const compactRm = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v));

/** True below Tailwind's `sm` breakpoint (phones). False during SSR / first paint. */
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639.98px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

/**
 * Chart box whose height is set in CSS (no layout shift on hydration): `height` from `sm` up,
 * a shorter `mobileHeight` on phones.
 */
function ChartBox({ height, mobileHeight, children, testId }: { height: number; mobileHeight?: number; children: ReactNode; testId?: string }) {
  const m = mobileHeight ?? Math.max(200, Math.round(height * 0.78));
  return (
    <div
      style={{ "--ch": `${height}px`, "--ch-m": `${m}px` } as CSSProperties}
      className="h-[var(--ch-m)] w-full min-w-0 touch-pan-y select-none sm:h-[var(--ch)]"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** Tooltip wrapper settings that keep tap-tooltips readable on phones (on top, not clipped). */
const tipWrap = { zIndex: 20, pointerEvents: "none" as const, outline: "none" };

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
  const narrow = useNarrow();
  const dense = data.length > 14; // month-over-month: up to 31 points
  // On phones a month shows day 1, 5, 10 … 30 so labels never collide.
  const ticks = narrow && dense ? data.map((d) => d.label).filter((l) => l === "1" || Number(l) % 5 === 0) : undefined;
  return (
    <ChartBox height={height} testId="sales-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: narrow ? 6 : 12, bottom: 0, left: narrow ? -4 : 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={narrow ? axisSm : axis}
            tickLine={false}
            axisLine={{ stroke: "#cbd5e1" }}
            ticks={ticks}
            padding={narrow ? { left: 12, right: 14 } : { left: 0, right: 0 }}
            interval={ticks ? 0 : dense ? "preserveStartEnd" : 0}
            minTickGap={dense ? 8 : 0}
          />
          <YAxis tick={narrow ? axisSm : axis} tickLine={false} axisLine={false} tickFormatter={compactRm} width={narrow ? 38 : 44} />
          <Tooltip
            wrapperStyle={tipWrap}
            allowEscapeViewBox={{ x: false, y: true }}
            position={narrow ? { y: -12 } : undefined}
            cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
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
          <Legend
            iconType="plainline"
            verticalAlign={narrow ? "top" : "bottom"}
            align={narrow ? "right" : "center"}
            height={narrow ? 26 : undefined}
            wrapperStyle={{ fontSize: narrow ? 11 : 12, lineHeight: "16px" }}
          />
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
            dot={{ r: dense ? 2 : 3, fill: CUR }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

export function TenantBars({ data, height = 260 }: { data: { id: string; name: string; amount: number }[]; height?: number }) {
  const router = useRouter();
  const narrow = useNarrow();
  const clip = (n: string) => (narrow && n.length > 13 ? `${n.slice(0, 12)}…` : n);
  // Roughly 36px per bar on phones so each bar is a comfortable tap target.
  const mobileHeight = Math.max(180, Math.min(height, data.length * 36 + 30));
  return (
    <ChartBox height={height} mobileHeight={mobileHeight}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: narrow ? 8 : 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={narrow ? axisSm : axis} tickLine={false} axisLine={false} tickFormatter={compactRm} />
          <YAxis type="category" dataKey="name" tick={narrow ? axisSm : axis} tickLine={false} axisLine={false} width={narrow ? 92 : 110} tickFormatter={clip} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} wrapperStyle={tipWrap} formatter={(v) => [rm(Number(v)), "Today"]} />
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
    </ChartBox>
  );
}

export function TrendBars({ data, height = 220 }: { data: { date: string; amount: number }[]; height?: number }) {
  const narrow = useNarrow();
  return (
    <ChartBox height={height} mobileHeight={190}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: narrow ? -4 : 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="date"
            tick={narrow ? axisSm : axis}
            tickLine={false}
            axisLine={{ stroke: "#cbd5e1" }}
            interval={narrow && data.length > 10 ? 1 : 0}
            tickFormatter={(d: string) => String(Number(d.slice(8)))}
          />
          <YAxis tick={narrow ? axisSm : axis} tickLine={false} axisLine={false} tickFormatter={compactRm} width={narrow ? 38 : 44} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} wrapperStyle={tipWrap} labelFormatter={(d) => formatDay(String(d))} formatter={(v) => [rm(Number(v)), "GTO"]} />
          <Bar dataKey="amount" fill={CUR} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

export function HourlyBars({ data, height = 220 }: { data: { hour: number; amount: number }[]; height?: number }) {
  const first = data.findIndex((d) => d.amount > 0);
  const last = data.length - 1 - [...data].reverse().findIndex((d) => d.amount > 0);
  const slice = data.slice(Math.max(0, first - 1), Math.min(24, last + 2));
  const narrow = useNarrow();
  return (
    <ChartBox height={height} mobileHeight={200}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={slice} margin={{ top: 4, right: 4, bottom: 0, left: narrow ? -4 : 0 }}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={narrow ? axisSm : axis}
            tickLine={false}
            interval={narrow ? "preserveStartEnd" : 0}
            minTickGap={narrow ? 10 : 0}
            tickFormatter={(h: number) => `${String(h).padStart(2, "0")}h`}
          />
          <YAxis tick={narrow ? axisSm : axis} tickLine={false} axisLine={false} tickFormatter={compactRm} width={narrow ? 38 : 44} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} wrapperStyle={tipWrap} labelFormatter={(h) => `${String(h).padStart(2, "0")}:00`} formatter={(v) => [rm(Number(v)), "Sales"]} />
          <Bar dataKey="amount" fill={CUR} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

export function Sparkline({ data, href, className = "h-8 w-28" }: { data: { date: string; amount: number }[]; href?: string; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  const w = 120;
  const h = 32;
  const pts = data.map((d, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - (d.amount / max) * (h - 4) - 2}`).join(" ");
  const svg = (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={CUR} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
  return href ? <Link href={href}>{svg}</Link> : svg;
}
