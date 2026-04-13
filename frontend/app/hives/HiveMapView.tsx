"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Hive } from "@/lib/django";
import type { AggregatedMeasurement } from "@/lib/django";

const BULGARIA_CENTER: [number, number] = [42.7339, 25.4858];
const DEFAULT_ZOOM = 7;

type Props = {
  hives: Hive[];
  latestMetrics: Record<number, AggregatedMeasurement | null>;
};

// ---------- gauge SVG helpers (DOM-safe, no React) ----------

function gaugeColor(value: number, type: string): string {
  if (type === "temperature") {
    if (value >= 32 && value <= 36) return "#22c55e";
    if (value >= 20 && value <= 40) return "#eab308";
    return "#ef4444";
  }
  if (type === "humidity") {
    if (value >= 50 && value <= 70) return "#22c55e";
    if (value >= 30 && value <= 80) return "#eab308";
    return "#ef4444";
  }
  if (type === "battery") {
    if (value >= 50) return "#22c55e";
    if (value >= 20) return "#eab308";
    return "#ef4444";
  }
  // co2
  if (value < 1000) return "#22c55e";
  if (value < 3000) return "#eab308";
  return "#ef4444";
}

function gaugeSVG(
  value: number | null,
  type: string,
  label: string,
  unit: string,
): string {
  const R = 34;
  const CIRC = 2 * Math.PI * R;
  const maxVal =
    type === "temperature" ? 50 : type === "humidity" ? 100 : type === "battery" ? 100 : 5000;
  const fraction =
    value !== null ? Math.min(1, Math.max(0, value / maxVal)) : 0;
  const color = value !== null ? gaugeColor(value, type) : "#9ca3af";
  const dash = CIRC * fraction;

  let displayValue: string;
  if (value === null) displayValue = "—";
  else if (type === "co2" || type === "battery") displayValue = Math.round(value).toString();
  else displayValue = value.toFixed(1);

  return `<svg viewBox="0 0 88 112" width="88" height="112" xmlns="http://www.w3.org/2000/svg">
    <circle cx="44" cy="44" r="${R}" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="7"/>
    <circle cx="44" cy="44" r="${R}" fill="none" stroke="${color}" stroke-width="7"
      stroke-dasharray="${dash} ${CIRC}" stroke-linecap="round"
      transform="rotate(-90 44 44)"/>
    <text x="44" y="40" text-anchor="middle" dominant-baseline="middle"
      fill="rgba(0,0,0,0.85)" font-size="16" font-weight="bold" font-family="sans-serif">
      ${displayValue}
    </text>
    <text x="44" y="55" text-anchor="middle" dominant-baseline="middle"
      fill="rgba(0,0,0,0.45)" font-size="10" font-family="sans-serif">
      ${unit}
    </text>
    <text x="44" y="97" text-anchor="middle" dominant-baseline="middle"
      fill="rgba(0,0,0,0.55)" font-size="9" font-family="sans-serif" letter-spacing="1">
      ${label.toUpperCase()}
    </text>
  </svg>`;
}

function buildPopupHTML(hive: Hive, metrics: AggregatedMeasurement | null, hiveId: number): string {
  const temp = metrics?.avg_temperature ?? null;
  const hum = metrics?.avg_humidity ?? null;
  const co2 = metrics?.avg_co2_level ?? null;
  const bat = metrics?.avg_battery_level ?? null;

  const STATE_LABELS: Record<string, { label: string; color: string }> = {
    QPO:  { label: "Queen Present (Original)",       color: "#16a34a" },
    QPNA: { label: "Queen Present — Newly Accepted", color: "#ca8a04" },
    QPR:  { label: "Queen Present — Rejected",       color: "#dc2626" },
    QNP:  { label: "Queen Not Present",              color: "#dc2626" },
  };
  const s = metrics?.dominant_state ? STATE_LABELS[metrics.dominant_state] : null;
  const queenHTML = s
    ? `<div style="display:flex;align-items:center;gap:6px;justify-content:center;margin-bottom:6px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0;"></span>
        <span style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${s.color};">${s.label}</span>
       </div>`
    : "";

  const gauges = [
    gaugeSVG(temp, "temperature", "Temp", "°C"),
    gaugeSVG(hum,  "humidity",    "Humidity", "%"),
    gaugeSVG(co2,  "co2",         "CO₂", "ppm"),
    gaugeSVG(bat,  "battery",     "Battery", "%"),
  ].join("");

  return `
    <div style="font-family:sans-serif;width:196px;padding:4px 2px;">
      <div style="font-weight:900;font-size:15px;letter-spacing:2px;text-transform:uppercase;color:#1c1917;margin-bottom:2px;">
        ${hive.name}
      </div>
      ${hive.location ? `<div style="font-size:11px;color:#78716c;letter-spacing:1px;margin-bottom:2px;">${hive.location}</div>` : ""}
      ${hive.address ? `<div style="font-size:10px;color:#a8a29e;margin-bottom:8px;">📍 ${hive.address}</div>` : ""}
      ${queenHTML}
      <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;max-width:188px;margin:0 auto 10px;">
        ${gauges}
      </div>
      <div style="display:flex;gap:8px;justify-content:center;align-items:center;">
        <a href="/hives/${hiveId}"
           style="display:inline-block;padding:7px 20px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;border:2px solid #fbbf24;background:#fef3c7;text-decoration:none;">
          Open Hive →
        </a>
        <a href="/hives/${hiveId}/edit"
           style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;border:2px solid #d1d5db;background:#f9fafb;text-decoration:none;"
           title="Edit hive">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </a>
      </div>
    </div>`;
}

// ---------- component ----------

export default function HiveMapView({ hives, latestMetrics }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const router = useRouter();

  const hivesWithCoords = hives.filter(
    (h) => h.latitude != null && h.longitude != null,
  );

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !containerRef.current || mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Custom amber hex-style icon
      const hexIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:36px;height:36px;
          background:#f59e0b;
          clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
          display:flex;align-items:center;justify-content:center;
          filter:drop-shadow(0 2px 4px rgba(120,53,15,0.4));
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#7c2d12">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -38],
      });

      const map = L.map(containerRef.current!, {
        center: BULGARIA_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add markers
      hivesWithCoords.forEach((hive) => {
        const lat = parseFloat(hive.latitude!);
        const lng = parseFloat(hive.longitude!);
        const metrics = latestMetrics[hive.id] ?? null;

        const marker = L.marker([lat, lng], { icon: hexIcon }).addTo(map);
        marker.bindPopup(
          L.popup({ maxWidth: 220, className: "hive-popup", keepInView: true, autoPanPadding: [16, 16] }).setContent(
            buildPopupHTML(hive, metrics, hive.id),
          ),
        );

        // Intercept popup link clicks to use Next router
        marker.on("popupopen", () => {
          setTimeout(() => {
            const openLink = document.querySelector(`.leaflet-popup-content a[href="/hives/${hive.id}"]`) as HTMLAnchorElement | null;
            if (openLink) {
              openLink.addEventListener("click", (e) => {
                e.preventDefault();
                router.push(`/hives/${hive.id}`);
              });
            }
            const editLink = document.querySelector(`.leaflet-popup-content a[href="/hives/${hive.id}/edit"]`) as HTMLAnchorElement | null;
            if (editLink) {
              editLink.addEventListener("click", (e) => {
                e.preventDefault();
                router.push(`/hives/${hive.id}/edit`);
              });
            }
          }, 50);
        });
      });

      // Fit bounds to markers if any
      if (hivesWithCoords.length > 0) {
        const bounds = L.latLngBounds(
          hivesWithCoords.map((h) => [parseFloat(h.latitude!), parseFloat(h.longitude!)] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
      } else {
        // Try geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (!isMounted) return;
              map.setView([pos.coords.latitude, pos.coords.longitude], 10);
            },
            () => {},
            { timeout: 5000 },
          );
        }
      }

      mapRef.current = map;
    });

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full flex flex-col gap-3">
      <style>{`
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        .leaflet-container { font-family: inherit; }
        .leaflet-control-attribution { font-size: 10px !important; }
        .hive-popup .leaflet-popup-content-wrapper {
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18);
          border: 1px solid rgba(255,255,255,0.7);
          background: rgba(255,255,255,0.97);
        }
        .hive-popup .leaflet-popup-tip { background: rgba(255,255,255,0.97); }
        .hive-popup .leaflet-popup-content { margin: 14px 16px; }
      `}</style>

      {hivesWithCoords.length < hives.length && hives.length > 0 && (
        <p className="text-center text-xs text-gray-500 tracking-wide">
          {hives.length - hivesWithCoords.length} hive{hives.length - hivesWithCoords.length !== 1 ? "s" : ""} without a pinned location won&apos;t appear on the map.
        </p>
      )}

      {hives.length === 0 && (
        <p className="text-center text-gray-500 tracking-wide text-sm mt-10">
          No hives yet. Register one to see it on the map.
        </p>
      )}

      <div
        ref={containerRef}
        className="w-full rounded-2xl overflow-hidden border border-white/60"
        style={{ height: "calc(100vh - 320px)", minHeight: 360 }}
      />
    </div>
  );
}
