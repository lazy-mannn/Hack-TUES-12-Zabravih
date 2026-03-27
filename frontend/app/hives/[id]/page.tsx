import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchHiveDetail, fetchHiveMetrics } from "@/lib/django";
import type { AggregatedMeasurement } from "@/lib/django";
import HoneycombBackground from "../HoneycombBackground";
import GaugeCircle from "./GaugeCircle";
import MetricGraph from "./MetricGraph";


export default async function HivePage(props: PageProps<"/hives/[id]">) {
  const { id } = await props.params;
  const numId = Number(id);

  let hive;
  let latest: AggregatedMeasurement | null = null;

  try {
    hive = await fetchHiveDetail(numId);
  } catch {
    notFound();
  }

  try {
    const metrics = await fetchHiveMetrics(numId, "24h");
    const buckets = metrics.aggregated_measurements;
    latest = buckets.length ? buckets[buckets.length - 1] : null;
  } catch {
    // gauges stay empty
  }

  return (
    <div className="relative min-h-screen" style={{ background: "#fef3c7" }}>
      <HoneycombBackground />

      <div className="relative z-10 px-6 py-10 max-w-4xl mx-auto">
        {/* Liquid glass card */}
        <div
          className="rounded-3xl px-8 py-8 flex flex-col gap-8"
          style={{
            background: "rgba(255, 255, 255, 0.40)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255, 255, 255, 0.70)",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.90), inset 0 -1px 0 rgba(0,0,0,0.04), 0 24px 48px rgba(0,0,0,0.08)",
          }}
        >
          {/* Back link */}
          <Link
            href="/hives"
            className="text-amber-900/60 text-sm tracking-widest uppercase hover:text-amber-900 transition-colors font-medium self-start"
          >
            ← Back
          </Link>

          {/* Title */}
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-widest uppercase">
              {hive.name}
            </h1>
            <p className="mt-1 text-gray-600 text-sm tracking-wide">
              {hive.location}
              {hive.exists_since && (
                <span className="ml-3 opacity-70">· since {hive.exists_since}</span>
              )}
            </p>
          </div>

          {/* Gauges */}
          <div className="flex justify-center gap-10 flex-wrap">
            <GaugeCircle
              value={latest?.avg_temperature ?? null}
              type="temperature"
              label="Temperature"
              unit="°C"
            />
            <GaugeCircle
              value={latest?.avg_humidity ?? null}
              type="humidity"
              label="Humidity"
              unit="%"
            />
            <GaugeCircle
              value={latest?.avg_co2_level ?? null}
              type="co2"
              label="CO₂"
              unit="ppm"
            />
          </div>

          <div className="border-t border-black/10" />

          {/* Graphs */}
          <MetricGraph
            hiveId={hive.id}
            metric="avg_temperature"
            label="Temperature"
            unit="°C"
            color="#ef4444"
          />
          <div className="border-t border-black/10" />
          <MetricGraph
            hiveId={hive.id}
            metric="avg_humidity"
            label="Humidity"
            unit="%"
            color="#3b82f6"
          />
          <div className="border-t border-black/10" />
          <MetricGraph
            hiveId={hive.id}
            metric="avg_co2_level"
            label="CO₂ Level"
            unit=" ppm"
            color="#8b5cf6"
          />
        </div>
      </div>
    </div>
  );
}
