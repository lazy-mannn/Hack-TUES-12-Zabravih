"use client";

import { useEffect, useRef } from "react";

type Props = {
  lat: number;
  lng: number;
  label: string;
};

export default function HiveLocationMap({ lat, lng, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

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

      const map = L.map(containerRef.current!, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      L.marker([lat, lng])
        .addTo(map)
        .bindPopup(
          `<div style="font-family:sans-serif;line-height:1.4;">
            <strong style="font-size:13px;">${label}</strong><br/>
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer"
               style="display:inline-flex;align-items:center;gap:5px;margin-top:6px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1d4ed8;text-decoration:none;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              Directions
            </a>
          </div>`
        )
        .openPopup();

      mapRef.current = map;
    });

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <style>{`
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        .leaflet-container { font-family: inherit; border-radius: 12px; }
        .leaflet-control-attribution { font-size: 10px !important; }
      `}</style>
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-white/60"
        style={{ height: 220 }}
      />
    </div>
  );
}
