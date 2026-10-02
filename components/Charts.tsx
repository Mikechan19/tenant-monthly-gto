"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparePoint } from "@/lib/logic/aggregate";
import { formatDay } from "@/lib/logic/dates";
import { rm } from "@/lib/format";

// Stitch chart palette: primary teal line over a soft emerald gradient; prior period in dashed slate.
const CUR = "#0f766e"; // primary
const EMERALD = "#10b981"; // tertiary / chart-emerald
const PREV = "#94a3b8"; // slate-400
const GRID = "#e2e8f0";
const AMBER = "#f59e0b";
const NUM_FONT = "var(--font-numeric)";
const axis = { fontSize: 12, fill: "#64748b", fontFamily: NUM_FONT };
const axisSm = { fontSize: 11, fill: "#64748b", fontFamily: NUM_FONT };

/** SVG-safe unique id for gradient defs. */
function useGradId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

/** Tooltip card shared by all charts (level-2 floating surface). */
function TipCard({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-line bg-white/95 px-3 py-2 text-xs shadow-lift backdrop-blur">{children}</div>;
}
function TipRow({ color, label, value, dashed }: { color: string; label: ReactNode; value: ReactNode; dashed?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-1.5 text-muted">
        <span className={`inline-block h-0.5 w-3 rounded-full ${dashed ? "opacity-80" : ""}`} style={{ background: color }} />
        {label}
      </span>
      <span className="num font-bold text-ink">{value}</span>
    </div>
  );
}
function SimpleTip({ active, payload, label, title, name }: { active?: boolean; payload?: readonly { value?: unknown }[]; label?: unknown; title: (l: unknown) => ReactNode; name: string }) {
  if (!active || !payload?.length) return null;
  return (
    <TipCard>
      <div className="label-caps mb-1 text-[10px] text-muted">{title(label)}</div>
      <TipRow color={CUR} label={name} value={rm(Number(payload[0].value))} />
    </TipCard>
  );
}
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
  const grad = useGradId("cur");
  return (
    <ChartBox height={height} testId="sales-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: narrow ? 6 : 12, bottom: 0, left: narrow ? -4 : 0 }}>
          <defs>
            <linearGradient id={grad} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={EMERALD} stopOpacity={0.3} />
              <stop offset="70%" stopColor={EMERALD} stopOpacity={0.06} />
              <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={narrow ? axisSm : axis}
            tickLine={false}
            axisLine={{ stroke: GRID }}
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
            cursor={{ stroke: CUR, strokeWidth: 1, strokeDasharray: "3 3", strokeOpacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ComparePoint;
              return (
                <TipCard>
                  {p.currentDate && <TipRow color={CUR} label={formatDay(p.currentDate)} value={p.current === null ? "—" : rm(p.current)} />}
                  {p.previousDate && <TipRow color={PREV} dashed label={formatDay(p.previousDate)} value={rm(p.previous)} />}
                </TipCard>
              );
            }}
          />
          <Legend
            iconType="plainline"
            verticalAlign="top"
            align="right"
            height={narrow ? 26 : 30}
            wrapperStyle={{ fontSize: narrow ? 11 : 12, lineHeight: "16px", color: "#334155", fontWeight: 600 }}
          />
          <Line
            name={previousLabel}
            type="monotone"
            dataKey="previous"
            stroke={PREV}
            strokeWidth={1.75}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 3.5, fill: "#fff", stroke: PREV, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Area
            name={currentLabel}
            type="monotone"
            dataKey="current"
            stroke={CUR}
            strokeWidth={2.75}
            fill={`url(#${grad})`}
            dot={dense ? false : { r: 3, fill: "#fff", stroke: CUR, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: EMERALD, stroke: "#fff", strokeWidth: 2.5, className: "chart-glow" }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
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
  const grad = useGradId("hbar");
  return (
    <ChartBox height={height} mobileHeight={mobileHeight}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: narrow ? 8 : 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={grad} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={CUR} />
              <stop offset="100%" stopColor={EMERALD} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={narrow ? axisSm : axis} tickLine={false} axisLine={false} tickFormatter={compactRm} />
          <YAxis type="category" dataKey="name" tick={{ ...(narrow ? axisSm : axis), fill: "#334155", fontFamily: "var(--font-sans)", fontWeight: 600 }} tickLine={false} axisLine={false} width={narrow ? 92 : 110} tickFormatter={clip} />
          <Tooltip cursor={{ fill: "rgb(15 118 110 / 0.06)" }} wrapperStyle={tipWrap} content={(p) => <SimpleTip {...p} title={(l) => String(l)} name="Today" />} />
          <Bar
            dataKey="amount"
            fill={`url(#${grad})`}
            radius={[0, 999, 999, 0]}
            maxBarSize={18}
            background={{ fill: "#eff4ff", radius: 999 } as never}
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
  const grad = useGradId("vbar");
  const withData = data.filter((d) => d.amount > 0);
  const avg = withData.length ? withData.reduce((s, d) => s + d.amount, 0) / withData.length : 0;
  return (
    <>
    {avg > 0 && (
      <div className="-mt-2 mb-2 flex justify-end">
        <span className="label-caps inline-flex items-center gap-1.5 text-[10px] text-warn">
          <span className="inline-block w-4 border-t-2 border-dashed border-chart-amber" aria-hidden />
          Avg / trading day <span className="num">{rm(Math.round(avg))}</span>
        </span>
      </div>
    )}
    <ChartBox height={height} mobileHeight={190}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: narrow ? -4 : 0 }}>
          <defs>
            <linearGradient id={grad} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={EMERALD} />
              <stop offset="100%" stopColor={CUR} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={narrow ? axisSm : axis}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval={narrow && data.length > 10 ? 1 : 0}
            tickFormatter={(d: string) => String(Number(d.slice(8)))}
          />
          <YAxis tick={narrow ? axisSm : axis} tickLine={false} axisLine={false} tickFormatter={compactRm} width={narrow ? 38 : 44} />
          <Tooltip cursor={{ fill: "rgb(15 118 110 / 0.06)" }} wrapperStyle={tipWrap} content={(p) => <SimpleTip {...p} title={(l) => formatDay(String(l))} name="GTO" />} />
          {avg > 0 && (
            <ReferenceLine
              y={avg}
              stroke={AMBER}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              strokeOpacity={0.9}
            />
          )}
          <Bar dataKey="amount" fill={`url(#${grad})`} radius={[6, 6, 2, 2]} maxBarSize={26} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
    </>
  );
}

export function HourlyBars({ data, height = 220 }: { data: { hour: number; amount: number }[]; height?: number }) {
  const first = data.findIndex((d) => d.amount > 0);
  const last = data.length - 1 - [...data].reverse().findIndex((d) => d.amount > 0);
  const slice = data.slice(Math.max(0, first - 1), Math.min(24, last + 2));
  const narrow = useNarrow();
  const grad = useGradId("hour");
  return (
    <ChartBox height={height} mobileHeight={200}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={slice} margin={{ top: 4, right: 4, bottom: 0, left: narrow ? -4 : 0 }}>
          <defs>
            <linearGradient id={grad} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={EMERALD} />
              <stop offset="100%" stopColor={CUR} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={narrow ? axisSm : axis}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval={narrow ? "preserveStartEnd" : 0}
            minTickGap={narrow ? 10 : 0}
            tickFormatter={(h: number) => `${String(h).padStart(2, "0")}h`}
          />
          <YAxis tick={narrow ? axisSm : axis} tickLine={false} axisLine={false} tickFormatter={compactRm} width={narrow ? 38 : 44} />
          <Tooltip cursor={{ fill: "rgb(15 118 110 / 0.06)" }} wrapperStyle={tipWrap} content={(p) => <SimpleTip {...p} title={(h) => `${String(h).padStart(2, "0")}:00`} name="Sales" />} />
          <Bar dataKey="amount" fill={`url(#${grad})`} radius={[6, 6, 2, 2]} maxBarSize={26} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

export function Sparkline({ data, href, className = "h-8 w-28" }: { data: { date: string; amount: number }[]; href?: string; className?: string }) {
  const grad = useGradId("spk");
  const max = Math.max(1, ...data.map((d) => d.amount));
  const w = 120;
  const h = 32;
  const pts = data.map((d, i) => [(i / Math.max(1, data.length - 1)) * w, h - (d.amount / max) * (h - 6) - 3] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const svg = (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={grad} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={EMERALD} stopOpacity={0.3} />
          <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${grad})`} />
      <path d={line} fill="none" stroke={CUR} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
  return href ? (
    <Link href={href} aria-label="Open tenant trend" tabIndex={-1}>
      {svg}
    </Link>
  ) : (
    svg
  );
}
