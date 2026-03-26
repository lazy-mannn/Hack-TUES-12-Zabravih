"use client";

import { useState, useEffect } from "react";
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

const VW = 600;
const VH = 180;
const PAD = { top: 15, right: 20, bottom: 32, left: 48 };
const CW = VW - PAD.left - PAD.right;
const CH = VH - PAD.top - PAD.bottom;

export default function MetricGraph({ hiveId, metric, label, unit, color }: Props) {
  const [period, setPeriod] = useState<Period>("24h");
  const [data, setData] = useState<AggregatedMeasurement[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError(null);
    getHiveMetrics(hiveId, period)
      .then((m) => setData(m.aggregated_measurements))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [hiveId, period]);

  const values = data?.map((d) => d[metric]) ?? [];
  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 1;
  const range = maxVal - minVal || 1;

  const toX = (i: number) =>
    PAD.left + (values.length <= 1 ? CW / 2 : (i / (values.length - 1)) * CW);
  const toY = (v: number) =>
    PAD.top + CH - ((v - minVal) / range) * CH;

  const linePoints = values.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const areaPoints =
    values.length > 1
      ? `${PAD.left},${PAD.top + CH} ${linePoints} ${toX(values.length - 1)},${PAD.top + CH}`
      : "";

  // 5 evenly-spaced y-axis labels
  const yLabels = Array.from({ length: 5 }, (_, i) => ({
    v: minVal + (i / 4) * range,
    y: PAD.top + CH - (i / 4) * CH,
  }));

  // 5 x-axis labels
  const xLabels =
    data && data.length > 1
      ? Array.from({ length: 5 }, (_, i) => {
          const idx = Math.round((i / 4) * (data.length - 1));
          const d = new Date(data[idx].bucket_start);
          const lbl =
            period === "24h"
              ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : d.toLocaleDateString([], { month: "short", day: "numeric" });
          return { x: toX(idx), lbl };
        })
      : [];

  const avg =
    values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-gray-900 font-bold tracking-wide">{label}</span>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="bg-white/50 border border-gray-900/25 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none cursor-pointer"
        >
          <option value="24h">24h</option>
          <option value="7d">7 days</option>
          <option value="14d">14 days</option>
        </select>
      </div>

      {/* Chart */}
      <div className="relative" style={{ minHeight: VH }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-gray-500 text-sm">Loading…</span>
          </div>
        )}
        {!loading && error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-red-600 text-sm">Error: {error}</span>
          </div>
        )}
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full"
          style={{ height: VH, display: "block" }}
          preserveAspectRatio="none"
        >
          {/* Y grid + labels */}
          {yLabels.map(({ v, y }, i) => (
            <g key={i}>
              <line
                x1={PAD.left} y1={y}
                x2={VW - PAD.right} y2={y}
                stroke="rgba(0,0,0,0.07)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6} y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fill="rgba(0,0,0,0.45)"
                fontSize={11}
              >
                {Math.round(v * 10) / 10}
              </text>
            </g>
          ))}

          {/* X labels */}
          {xLabels.map(({ x, lbl }, i) => (
            <text
              key={i}
              x={x} y={VH - 4}
              textAnchor="middle"
              fill="rgba(0,0,0,0.45)"
              fontSize={11}
            >
              {lbl}
            </text>
          ))}

          {/* Area fill */}
          {!loading && values.length > 1 && (
            <polygon
              points={areaPoints}
              fill={color}
              fillOpacity={0.12}
            />
          )}

          {/* Line */}
          {!loading && values.length > 1 && (
            <polyline
              points={linePoints}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Dots at each data point (only when few points) */}
          {!loading && values.length > 1 && values.length <= 30 &&
            values.map((v, i) => (
              <circle
                key={i}
                cx={toX(i)} cy={toY(v)}
                r={3}
                fill={color}
              />
            ))
          }

          {/* No data */}
          {!loading && values.length === 0 && (
            <text
              x={VW / 2} y={VH / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(0,0,0,0.35)"
              fontSize={14}
            >
              No data for this period
            </text>
          )}
        </svg>
      </div>

      {/* Stats */}
      {avg !== null && values.length > 0 && (
        <div className="flex gap-6 text-sm text-gray-700/80">
          <span>Min: <strong>{Math.min(...values).toFixed(1)}{unit}</strong></span>
          <span>Avg: <strong>{avg.toFixed(1)}{unit}</strong></span>
          <span>Max: <strong>{Math.max(...values).toFixed(1)}{unit}</strong></span>
        </div>
      )}
    </div>
  );
}
