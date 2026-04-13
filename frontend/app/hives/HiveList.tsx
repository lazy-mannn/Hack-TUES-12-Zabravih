"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import type { Hive, AggregatedMeasurement } from "@/lib/django";

type ContextMenu = { hiveId: number; x: number; y: number } | null;

const HiveMapView = dynamic(
  () => import("./HiveMapView"),
  { ssr: false, loading: () => <div className="w-full rounded-2xl bg-white/30 animate-pulse" style={{ height: 400 }} /> }
);

const GAP = 10;
const MIN_HEX_W = 100;
const MAX_HEX_W = 180;
const MAX_EVEN_COUNT = 4;

function calcLayout(containerW: number) {
  const maxFit = Math.max(1, Math.floor((containerW + GAP) / (MIN_HEX_W + GAP)));
  const evenCount = Math.min(maxFit, MAX_EVEN_COUNT);
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
  latestMetrics: Record<number, AggregatedMeasurement | null>;
};

export default function HiveList({ initialHives, fetchError, latestMetrics }: Props) {
  const router = useRouter();
  const [nameQuery, setNameQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [mounted, setMounted] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // containerRef lives on an always-present outer div so ResizeObserver
  // never disconnects when switching views.
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

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, { passive: true });
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close);
    };
  }, [contextMenu]);

  const openContextMenu = useCallback((hiveId: number, x: number, y: number) => {
    setContextMenu({ hiveId, x, y });
  }, []);

  const startLongPress = useCallback((hiveId: number, x: number, y: number) => {
    longPressTimer.current = setTimeout(() => openContextMenu(hiveId, x, y), 500);
  }, [openContextMenu]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const filtered = initialHives.filter(
    (h) =>
      h.name.toLowerCase().includes(nameQuery.toLowerCase()) &&
      (h.location.toLowerCase().includes(locationQuery.toLowerCase()) ||
        h.address.toLowerCase().includes(locationQuery.toLowerCase())),
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

  const searchInputs = (extraClass = "") => (
    <>
      <input
        type="text"
        placeholder="Search by name…"
        value={nameQuery}
        onChange={(e) => setNameQuery(e.target.value)}
        className={`bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-5 py-3 outline-none focus:border-amber-400 transition-colors text-base shadow-sm ${extraClass}`}
      />
      <input
        type="text"
        placeholder="Search by location…"
        value={locationQuery}
        onChange={(e) => setLocationQuery(e.target.value)}
        className={`bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-5 py-3 outline-none focus:border-amber-400 transition-colors text-base shadow-sm ${extraClass}`}
      />
    </>
  );

  const toggle = (
    <div className="flex rounded-lg border-2 border-gray-200 overflow-hidden bg-white shadow-sm shrink-0">
      <button
        type="button"
        onClick={() => setViewMode("list")}
        className={`px-4 py-2.5 text-sm font-semibold tracking-widest uppercase transition-colors ${
          viewMode === "list" ? "bg-amber-400 text-amber-900" : "text-gray-500 hover:bg-gray-50"
        }`}
      >
        List
      </button>
      <button
        type="button"
        onClick={() => setViewMode("map")}
        className={`px-4 py-2.5 text-sm font-semibold tracking-widest uppercase transition-colors ${
          viewMode === "map" ? "bg-amber-400 text-amber-900" : "text-gray-500 hover:bg-gray-50"
        }`}
      >
        Map
      </button>
    </div>
  );

  return (
    <div className="w-full px-2 sm:px-6">
      {/* Mobile: toggle row + animated search inputs below */}
      <div className="flex sm:hidden flex-col gap-3 mb-8">
        <div className="flex justify-end">{toggle}</div>
        <AnimatePresence initial={false}>
          {viewMode === "list" && (
            <motion.div
              key="mobile-search"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <div className="flex flex-col gap-2 pt-1">
                {searchInputs("w-full")}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop: centered searches (fade out when map) + toggle pinned right */}
      <div className="hidden sm:flex flex-row items-center gap-3 mb-8">
        <div className="flex-1" />
        <motion.div
          className="flex gap-3"
          animate={{ opacity: viewMode === "map" ? 0 : 1, pointerEvents: viewMode === "map" ? "none" : "auto" }}
          transition={{ duration: 0.2 }}
        >
          {searchInputs("w-56")}
        </motion.div>
        <div className="flex-1 flex justify-end">{toggle}</div>
      </div>

      {/* Always-present width-measuring wrapper — keeps ResizeObserver alive */}
      <div ref={containerRef} className="w-full">
        <AnimatePresence mode="wait">
          {viewMode === "map" ? (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <HiveMapView hives={initialHives} latestMetrics={latestMetrics} />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
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
                        <AnimatePresence mode="popLayout">
                          {row.map((hive) => (
                            <motion.div
                              key={hive.id}
                              layout
                              initial={{ opacity: 0, scale: 0.7 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.7 }}
                              transition={{ type: "spring", stiffness: 300, damping: 28, mass: 0.8 }}
                              style={{
                                width: layout.hexW,
                                height: layout.hexH,
                                flexShrink: 0,
                                clipPath:
                                  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                                background: "#f59e0b",
                                filter:
                                  "drop-shadow(0 0 5px rgba(245,158,11,0.55)) drop-shadow(0 4px 10px rgba(120,53,15,0.18))",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.96 }}
                            >
                              <button
                                onClick={() => router.push(`/hives/${hive.id}`)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  openContextMenu(hive.id, e.clientX, e.clientY);
                                }}
                                onTouchStart={(e) => {
                                  const t = e.touches[0];
                                  startLongPress(hive.id, t.clientX, t.clientY);
                                }}
                                onTouchEnd={cancelLongPress}
                                onTouchMove={cancelLongPress}
                                style={{
                                  width: layout.hexW - 3,
                                  height: layout.hexH - 3,
                                  clipPath:
                                    "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                                  background:
                                    "radial-gradient(ellipse 85% 55% at 50% 18%, rgba(255,251,235,0.72) 0%, transparent 100%), #fbbf24",
                                }}
                                className="cursor-pointer flex flex-col items-center justify-center border-0 p-0"
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
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Context menu — portalled into document.body to escape backdrop-filter ancestors */}
      {mounted && createPortal(
        <AnimatePresence>
          {contextMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.12 }}
              onClick={(e) => e.stopPropagation()}
              style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 9999, transformOrigin: "top left" }}
              className="min-w-[140px] rounded-xl overflow-hidden shadow-xl border border-white/70"
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                <button
                  className="w-full text-left px-4 py-3 text-sm font-semibold tracking-widest uppercase text-gray-700 hover:bg-amber-50 transition-colors"
                  onClick={() => { setContextMenu(null); router.push(`/hives/${contextMenu.hiveId}`); }}
                >
                  Open
                </button>
                <div className="border-t border-gray-100" />
                <button
                  className="w-full text-left px-4 py-3 text-sm font-semibold tracking-widest uppercase text-amber-800 hover:bg-amber-50 transition-colors"
                  onClick={() => { setContextMenu(null); router.push(`/hives/${contextMenu.hiveId}/edit`); }}
                >
                  Edit
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
