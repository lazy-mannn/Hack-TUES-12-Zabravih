import Link from "next/link";
import HiveList from "./HiveList";
import HoneycombBackground from "./HoneycombBackground";
import { fetchHives, type Hive } from "@/lib/django";

export default async function HivesPage() {
  let hives: Hive[] = [];
  let fetchError: string | null = null;

  try {
    hives = await fetchHives();
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Failed to load hives";
  }

  return (
    <div className="relative min-h-screen bg-black">
      <HoneycombBackground />
      <div className="relative z-10 flex flex-col items-center py-10 px-4">
        <div className="w-full max-w-5xl rounded-3xl backdrop-blur-md bg-white/30 border border-white/50 shadow-2xl px-8 py-10 flex flex-col items-center">
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 items-center gap-3 mb-1">
            <div className="hidden sm:block" />
            <h1
              className="text-3xl sm:text-5xl font-black tracking-widest uppercase text-gray-900 text-center"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.1)" }}
            >
              SmeeHive
            </h1>
            <div className="flex justify-center sm:justify-end">
              <Link
                href="/hives/register"
                className="text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-xl text-gray-800 border-2 border-gray-900/30 bg-white/20 hover:bg-white/40 hover:border-gray-900/50 transition-all"
              >
                Register New Hive
              </Link>
            </div>
          </div>
          <p className="text-gray-700/70 text-sm tracking-widest uppercase mb-10">
            Select a hive to inspect
          </p>
          <HiveList initialHives={hives} fetchError={fetchError} />
        </div>
      </div>
    </div>
  );
}
