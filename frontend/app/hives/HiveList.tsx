"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Hive } from "@/lib/django";

const GAP = 10;
const MIN_HEX_W = 100; // smallest a hex will ever be drawn
const MAX_HEX_W = 180; // desktop size
const MAX_EVEN_COUNT = 4; // cap even rows at 4 hexes

function calcLayout(containerW: number) {
  // How many hexes fit at minimum size?
  const maxFit = Math.max(1, Math.floor((containerW + GAP) / (MIN_HEX_W + GAP)));
  const evenCount = Math.min(maxFit, MAX_EVEN_COUNT);
  // Expand hex width to fill available container width evenly
  const hexW = Math.min(
    MAX_HEX_W,
    Math.floor((containerW - (evenCount - 1) * GAP) / evenCount),
  );
  const hexH = Math.round(hexW * (2 / Math.sqrt(3)));
  const rowOverlap = Math.round(hexH * 0.25);
  const gridW = evenCount * hexW + (evenCount - 1) * GAP;
  return { evenCount, hexW, hexH, rowOverlap, gridW };
}

type Props = {
  initialHives: Hive[];
  fetchError: string | null;
};

export default function HiveList({ initialHives, fetchError }: Props) {
  const router = useRouter();
  const [nameQuery, setNameQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<ReturnType<typeof calcLayout> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setLayout(calcLayout(entry.contentRect.width));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const filtered = initialHives.filter(
    (h) =>
      h.name.toLowerCase().includes(nameQuery.toLowerCase()) &&
      h.location.toLowerCase().includes(locationQuery.toLowerCase()),
  );

  const rows: Hive[][] = [];
  if (layout) {
    let i = 0;
    let rowIdx = 0;
    while (i < filtered.length) {
      const size = rowIdx % 2 === 0 ? layout.evenCount : Math.max(1, layout.evenCount - 1);
      rows.push(filtered.slice(i, i + size));
      i += size;
      rowIdx++;
    }
  }

  return (
    <div className="w-full px-6">
      {/* Search bars */}
      <div className="flex flex-col sm:flex-row gap-3 mb-12 max-w-lg mx-auto">
        <input
          type="text"
          placeholder="Search by name…"
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          className="flex-1 bg-white/35 border-2 border-gray-900/50 text-gray-950 placeholder-gray-600/70 rounded-lg px-5 py-3 outline-none focus:border-gray-900 text-base"
        />
        <input
          type="text"
          placeholder="Search by location…"
          value={locationQuery}
          onChange={(e) => setLocationQuery(e.target.value)}
          className="flex-1 bg-white/35 border-2 border-gray-900/50 text-gray-950 placeholder-gray-600/70 rounded-lg px-5 py-3 outline-none focus:border-gray-900 text-base"
        />
      </div>

      {/* Measurement anchor — full inner width, no padding */}
      <div ref={containerRef} className="w-full">
        {fetchError && (
          <p className="text-black text-center mt-20 text-lg">
            Error: {fetchError}
          </p>
        )}

        {!fetchError && filtered.length === 0 && (
          <p className="text-gray-800/70 text-center mt-20 text-lg tracking-wide">
            No hives match your search.
          </p>
        )}

        {!fetchError && filtered.length > 0 && layout && (
          <div className="flex justify-center">
            <div className="flex flex-col" style={{ width: layout.gridW }}>
              {rows.map((row, rIdx) => (
                <div
                  key={rIdx}
                  className="flex"
                  style={{
                    marginTop: rIdx === 0 ? 0 : -(layout.rowOverlap - GAP),
                    paddingLeft:
                      rIdx % 2 === 1 ? layout.hexW / 2 + GAP / 2 : 0,
                    gap: GAP,
                  }}
                >
                  {row.map((hive) => (
                    <button
                      key={hive.id}
                      onClick={() => router.push(`/hives/${hive.id}`)}
                      style={{
                        width: layout.hexW,
                        height: layout.hexH,
                        flexShrink: 0,
                        clipPath:
                          "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                        background:
                          "linear-gradient(160deg, #fefce8 0%, #fde68a 100%)",
                        boxShadow:
                          "0 4px 28px rgba(234,179,8,0.3), 0 0 0 3px rgba(0,0,0,0.15)",
                        transition: "transform 0.15s ease, filter 0.15s ease",
                      }}
                      className="cursor-pointer flex flex-col items-center justify-center border-0 p-0 hover:scale-105 hover:brightness-125"
                      aria-label={`Open hive ${hive.name}`}
                    >
                      <span
                        className="font-black leading-tight text-center break-words"
                        style={{ fontSize: Math.max(13, layout.hexW * 0.1), padding: `0 ${layout.hexW * 0.12}px`, color: "#92400e" }}
                      >
                        {hive.name}
                      </span>
                      <span
                        className="mt-1 text-center break-words"
                        style={{ fontSize: Math.max(11, layout.hexW * 0.082), padding: `0 ${layout.hexW * 0.12}px`, color: "#b45309" }}
                      >
                        {hive.location}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
