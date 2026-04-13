import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchHiveDetail, fetchHiveMetrics } from "@/lib/django";
import type { AggregatedMeasurement } from "@/lib/django";
import GaugeCircle from "./GaugeCircle";
import MetricsDashboard from "./MetricsDashboard";
import HiveLocationMapWrapper from "./HiveLocationMapWrapper";


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
    <div className="min-h-screen">
      <div className="px-4 sm:px-6 py-6 sm:py-10 max-w-4xl mx-auto">
        {/* Liquid glass card */}
        <div
          className="rounded-3xl px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8"
          style={{
            background: "rgba(255, 255, 255, 0.40)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(255, 255, 255, 0.70)",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.90), inset 0 -1px 0 rgba(0,0,0,0.04), 0 24px 48px rgba(0,0,0,0.08)",
          }}
        >
          {/* Back + Edit row */}
          <div className="flex items-center justify-between">
            <Link
              href="/hives"
              className="text-amber-900/60 text-sm tracking-widest uppercase hover:text-amber-900 transition-colors font-medium"
            >
              ← Back
            </Link>
            <Link
              href={`/hives/${hive.id}/edit`}
              className="text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-lg text-amber-800 border-2 border-amber-300 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-400 transition-all"
            >
              Edit
            </Link>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-widest uppercase">
              {hive.name}
            </h1>
            <p className="mt-1 text-gray-600 text-sm tracking-wide">
              {hive.location}
              {hive.exists_since && (
                <span className="ml-3 opacity-70">· since {hive.exists_since}</span>
              )}
            </p>
            {hive.address && (
              <p className="mt-0.5 text-gray-500 text-xs tracking-wide">📍 {hive.address}</p>
            )}
            {hive.latitude && hive.longitude && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${hive.latitude},${hive.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-lg text-blue-700 border border-blue-200 bg-blue-50/70 hover:bg-blue-100 hover:border-blue-300 transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                Directions
              </a>
            )}
          </div>

          {/* Location map */}
          {hive.latitude && hive.longitude && (
            <HiveLocationMapWrapper
              lat={parseFloat(hive.latitude)}
              lng={parseFloat(hive.longitude)}
              label={hive.name}
            />
          )}

          {/* Gauges */}
          <div className="flex justify-center gap-4 sm:gap-10 flex-wrap">
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
            <GaugeCircle
              value={latest?.avg_battery_level ?? null}
              type="battery"
              label="Battery"
              unit="%"
            />
          </div>

          {/* Queen state */}
          {(() => {
            const STATE_LABELS: Record<string, { label: string; color: string }> = {
              QPO:  { label: "Queen Present (Original)",       color: "#16a34a" },
              QPNA: { label: "Queen Present — Newly Accepted", color: "#ca8a04" },
              QPR:  { label: "Queen Present — Rejected",      color: "#dc2626" },
              QNP:  { label: "Queen Not Present",             color: "#dc2626" },
            };
            const state = latest?.dominant_state;
            const s = state ? STATE_LABELS[state] : null;
            if (s) {
              return (
                <div className="flex items-center justify-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: s.color }}>
                    {s.label}
                  </span>
                </div>
              );
            }
            return (
              <div className="flex items-center justify-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gray-300" />
                <span className="text-sm font-semibold tracking-widest uppercase text-gray-400">
                  Queen State Unknown
                </span>
              </div>
            );
          })()}

          <div className="border-t border-black/10" />

          {/* Graphs */}
          <MetricsDashboard hiveId={hive.id} />
        </div>
      </div>
    </div>
  );
}
