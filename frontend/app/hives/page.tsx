import Link from "next/link";
import HiveList from "./HiveList";
import UserMenu from "@/app/components/UserMenu";
import { fetchHives, fetchHiveMetrics, type Hive, type AggregatedMeasurement } from "@/lib/django";

export default async function HivesPage() {
  let hives: Hive[] = [];
  let fetchError: string | null = null;
  let latestMetrics: Record<number, AggregatedMeasurement | null> = {};

  try {
    hives = await fetchHives();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to load hives";
  }

  if (hives.length > 0) {
    const results = await Promise.allSettled(
      hives.map((h) => fetchHiveMetrics(h.id, "24h"))
    );
    results.forEach((result, i) => {
      const hiveId = hives[i].id;
      if (result.status === "fulfilled") {
        const buckets = result.value.aggregated_measurements;
        latestMetrics[hiveId] = buckets.length ? buckets[buckets.length - 1] : null;
      } else {
        latestMetrics[hiveId] = null;
      }
    });
  }

  return (
    <div className="relative min-h-screen">
      <div className="flex flex-col items-center py-6 sm:py-10 px-4">
        <div
          className="w-full max-w-5xl rounded-3xl px-4 sm:px-8 py-6 sm:py-10 flex flex-col items-center"
          style={{
            background: "rgba(255, 255, 255, 0.40)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.70)",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.90), inset 0 -1px 0 rgba(0,0,0,0.04), 0 24px 48px rgba(0,0,0,0.08)",
          }}
        >
          <div className="w-full flex flex-col sm:grid sm:grid-cols-3 items-center gap-3 mb-1">
            <div className="hidden sm:block" />
            <h1
              className="text-3xl sm:text-5xl font-black tracking-widest uppercase text-gray-900 text-center order-first"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.1)" }}
            >
              SmeeHive
            </h1>
            <div className="flex justify-center sm:justify-end items-center gap-2 flex-wrap">
              <Link
                href="/hives/register"
                className="text-xs font-semibold tracking-widest uppercase px-4 py-2 h-8 flex items-center rounded-lg text-amber-800 border-2 border-amber-300 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-400 transition-all whitespace-nowrap"
              >
                Register New Hive
              </Link>
              <UserMenu />
            </div>
          </div>
          <p className="text-gray-700/70 text-sm tracking-widest uppercase mb-10">
            Select a hive to inspect
          </p>
          <HiveList
            initialHives={hives}
            fetchError={fetchError}
            latestMetrics={latestMetrics}
          />
        </div>
      </div>
    </div>
  );
}
