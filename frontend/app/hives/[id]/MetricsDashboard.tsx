"use client";

import { useState, useEffect } from "react";
import type { AggregatedMeasurement } from "@/lib/django";
import { getHiveMetrics } from "./actions";
import MetricGraph from "./MetricGraph";

type Period = "24h" | "7d" | "14d";

type Props = {
  hiveId: number;
};

export default function MetricsDashboard({ hiveId }: Props) {
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

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Single shared period picker */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold tracking-widest uppercase text-gray-500">
          Metrics
        </span>
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

      <MetricGraph
        data={data}
        period={period}
        loading={loading}
        error={error}
        metric="avg_temperature"
        label="Temperature"
        unit="°C"
        color="#ef4444"
      />
      <div className="border-t border-black/10" />
      <MetricGraph
        data={data}
        period={period}
        loading={loading}
        error={error}
        metric="avg_humidity"
        label="Humidity"
        unit="%"
        color="#3b82f6"
      />
      <div className="border-t border-black/10" />
      <MetricGraph
        data={data}
        period={period}
        loading={loading}
        error={error}
        metric="avg_co2_level"
        label="CO₂ Level"
        unit=" ppm"
        color="#8b5cf6"
      />
    </div>
  );
}
