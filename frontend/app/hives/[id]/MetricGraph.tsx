"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AggregatedMeasurement } from "@/lib/django";
import { getHiveMetrics } from "./actions";

type Period = "24h" | "7d" | "14d";
type MetricKey = "avg_temperature" | "avg_humidity" | "avg_co2_level";

type Props = {
  hiveId: number;
  metric: MetricKey;
  label: string;
  unit: string;
  color: string;
};

type ChartPoint = { t: number; v: number };

function formatTime(ts: number, period: Period) {
  const d = new Date(ts);
  return period === "24h"
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MetricGraph({ hiveId, metric, label, unit, color }: Props) {
  const [period, setPeriod] = useState<Period>("24h");
  const [rawData, setRawData] = useState<AggregatedMeasurement[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // domain drives zoom/pan — null means "show everything"
  const [domain, setDomain] = useState<{ min: number; max: number } | null>(null);
  const [panning, setPanning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  // Refs let event handlers read latest values without stale closures
  const domainRef = useRef<{ min: number; max: number } | null>(null);
  const fullRef = useRef<{ min: number; max: number }>({ min: 0, max: 1 });
  const dragRef = useRef<{ startX: number; startMin: number; startMax: number } | null>(null);

  useEffect(() => { domainRef.current = domain; }, [domain]);

  // Fetch on period change
  useEffect(() => {
    setLoading(true);
    setRawData(null);
    setError(null);
    setDomain(null);
    domainRef.current = null;
    getHiveMetrics(hiveId, period)
      .then((m) => setRawData(m.aggregated_measurements))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [hiveId, period]);

  // All data as {t, v} pairs
  const chartData = useMemo<ChartPoint[]>(
    () => (rawData ?? []).map((d) => ({ t: new Date(d.bucket_start).getTime(), v: d[metric] })),
    [rawData, metric],
  );

  // Full time span
  const fullMin = chartData.length ? chartData[0].t : 0;
  const fullMax = chartData.length ? chartData[chartData.length - 1].t : 1;
  fullRef.current = { min: fullMin, max: fullMax };

  // Current visible range — driven by React state so renders are reactive
  const visMin = domain?.min ?? fullMin;
  const visMax = domain?.max ?? fullMax;

  // Slice to visible range + 1 buffer point each side so recharts rescales Y-axis
  // and renders smooth edges. Passing filtered data (not all data) is what makes
  // the chart actually zoom — recharts Y-axis only sees the visible subset.
  const visibleData = useMemo<ChartPoint[]>(() => {
    if (!chartData.length) return [];
    let lo = 0;
    let hi = chartData.length - 1;
    for (let i = 0; i < chartData.length; i++) {
      if (chartData[i].t >= visMin) { lo = Math.max(0, i - 1); break; }
    }
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i].t <= visMax) { hi = Math.min(chartData.length - 1, i + 1); break; }
    }
    return chartData.slice(lo, hi + 1);
  }, [chartData, visMin, visMax]);

  const visVals = visibleData.map((d) => d.v);
  const avg = visVals.length ? visVals.reduce((a, b) => a + b, 0) / visVals.length : null;

  // ─── Non-passive wheel listener for zoom ─────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const full = fullRef.current;
      if (full.max <= full.min) return;

      const rect = el.getBoundingClientRect();
      const plotLeft = 52;
      const plotWidth = Math.max(1, rect.width - plotLeft - 12);
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - plotLeft) / plotWidth));

      const cur = domainRef.current ?? full;
      const range = cur.max - cur.min;
      const factor = e.deltaY > 0 ? 1.35 : 1 / 1.35;
      const fullSpan = full.max - full.min;
      const newRange = Math.max(fullSpan * 0.005, Math.min(range * factor, fullSpan));

      const pivot = cur.min + ratio * range;
      let newMin = pivot - ratio * newRange;
      let newMax = newMin + newRange;

      if (newMin < full.min) { newMax = Math.min(full.max, newMax + full.min - newMin); newMin = full.min; }
      if (newMax > full.max) { newMin = Math.max(full.min, newMin - (newMax - full.max)); newMax = full.max; }
      newMin = Math.max(full.min, newMin);
      newMax = Math.min(full.max, newMax);

      // Spread into new object so React always detects the change
      const next = { min: newMin, max: newMax };
      domainRef.current = next;
      setDomain({ ...next });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []); // empty — uses refs, no stale closure risk

  // ─── Drag-to-pan ─────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const cur = domainRef.current ?? fullRef.current;
    dragRef.current = { startX: e.clientX, startMin: cur.min, startMax: cur.max };
    setPanning(true);
    e.preventDefault();
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current || !containerRef.current) return;
    const full = fullRef.current;
    const plotWidth = Math.max(1, containerRef.current.getBoundingClientRect().width - 64);
    const dx = e.clientX - dragRef.current.startX;
    const range = dragRef.current.startMax - dragRef.current.startMin;
    const shift = -(dx / plotWidth) * range;

    let newMin = dragRef.current.startMin + shift;
    let newMax = dragRef.current.startMax + shift;
    if (newMin < full.min) { newMax = Math.min(full.max, newMax + full.min - newMin); newMin = full.min; }
    if (newMax > full.max) { newMin = Math.max(full.min, newMin - (newMax - full.max)); newMax = full.max; }
    newMin = Math.max(full.min, newMin);
    newMax = Math.min(full.max, newMax);

    const next = { min: newMin, max: newMax };
    domainRef.current = next;
    setDomain({ ...next });
  };

  const onMouseUp = () => { dragRef.current = null; setPanning(false); };
  const resetZoom = () => { setDomain(null); domainRef.current = null; };

  // ─── Custom tooltip ───────────────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: { value: number }[];
    label?: number;
  }) => {
    if (!active || !payload?.length || label == null) return null;
    return (
      <div className="bg-white/90 backdrop-blur border border-gray-100 rounded-xl px-3 py-2 shadow-xl text-sm pointer-events-none">
        <p className="text-gray-400 text-xs mb-0.5">{formatTime(label, period)}</p>
        <p className="font-bold text-gray-900">
          {payload[0].value?.toFixed(2)}
          <span className="font-normal text-gray-500 ml-0.5">{unit}</span>
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="font-semibold text-gray-800 truncate">{label}</span>
          {domain && (
            <button
              onClick={resetZoom}
              className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors font-medium"
            >
              ↺ Reset
            </button>
          )}
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="flex-shrink-0 text-sm border border-white/50 bg-white/60 backdrop-blur rounded-lg px-3 py-1.5 text-gray-700 outline-none cursor-pointer shadow-sm hover:border-amber-300 transition-colors"
        >
          <option value="24h">Last 24 h</option>
          <option value="7d">Last 7 days</option>
          <option value="14d">Last 14 days</option>
        </select>
      </div>

      {/* Chart area */}
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden"
        style={{
          height: 220,
          cursor: panning ? "grabbing" : "crosshair",
          userSelect: "none",
          background: "rgba(255,255,255,0.35)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.5)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px rgba(120,60,0,0.06)",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={resetZoom}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="block w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        {!loading && error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-red-500 bg-red-50/80 px-4 py-2 rounded-lg border border-red-100">
              {error}
            </span>
          </div>
        )}
        {!loading && !error && chartData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-gray-400">No data for this period</span>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={visibleData}
            margin={{ top: 12, right: 14, left: 0, bottom: 4 }}
          >
            <defs>
              <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.28} />
                <stop offset="95%" stopColor={color} stopOpacity={0.03} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 5" stroke="rgba(0,0,0,0.06)" vertical={false} />

            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[visMin, visMax]}
              tickFormatter={(t) => formatTime(t as number, period)}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              minTickGap={52}
            />

            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(+v).toFixed(0)}`}
              width={46}
              domain={["auto", "auto"]}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#grad-${metric})`}
              dot={false}
              activeDot={{ r: 5, fill: color, stroke: "white", strokeWidth: 2.5 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats + hint */}
      {!loading && avg !== null && visVals.length > 0 && (
        <div className="flex items-center gap-5 text-sm px-1">
          <span className="text-gray-500">
            Min{" "}
            <strong className="text-gray-800 font-semibold">
              {Math.min(...visVals).toFixed(1)}{unit}
            </strong>
          </span>
          <span className="text-gray-500">
            Avg{" "}
            <strong className="text-gray-800 font-semibold">
              {avg.toFixed(1)}{unit}
            </strong>
          </span>
          <span className="text-gray-500">
            Max{" "}
            <strong className="text-gray-800 font-semibold">
              {Math.max(...visVals).toFixed(1)}{unit}
            </strong>
          </span>
          <span className="ml-auto text-xs text-gray-300 hidden sm:block tracking-wide">
            scroll · drag · dbl-click to reset
          </span>
        </div>
      )}
    </div>
  );
}
