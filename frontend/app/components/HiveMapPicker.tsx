"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type PickedLocation = {
  lat: number;
  lng: number;
  address: string;
};

type Props = {
  onLocationChange: (loc: PickedLocation | null) => void;
  initialLocation?: PickedLocation;
};

const BULGARIA_CENTER: [number, number] = [42.7339, 25.4858];
const DEFAULT_ZOOM = 7;
const PIN_ZOOM = 14;

async function nominatimSearch(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      address: data[0].display_name,
    };
  } catch {
    return null;
  }
}

async function nominatimReverse(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export default function HiveMapPicker({ onLocationChange, initialLocation }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const [picked, setPicked] = useState<PickedLocation | null>(initialLocation ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Stable callback reference
  const handleLocationPick = useCallback(
    async (lat: number, lng: number) => {
      // Round to 6dp (≈11 cm precision) to stay within max_digits=9
      lat = Math.round(lat * 1e6) / 1e6;
      lng = Math.round(lng * 1e6) / 1e6;
      const address = await nominatimReverse(lat, lng);
      const loc: PickedLocation = { lat, lng, address };
      setPicked(loc);
      onLocationChange(loc);
    },
    [onLocationChange],
  );

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current || mapRef.current) return;

      // Fix default icon paths broken by bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initialCenter: [number, number] = initialLocation
        ? [initialLocation.lat, initialLocation.lng]
        : BULGARIA_CENTER;
      const initialZoom = initialLocation ? PIN_ZOOM : DEFAULT_ZOOM;

      const map = L.map(mapContainerRef.current!, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Pre-place marker if editing an existing hive
      if (initialLocation) {
        markerRef.current = L.marker([initialLocation.lat, initialLocation.lng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", async () => {
          const pos = markerRef.current!.getLatLng();
          await handleLocationPick(pos.lat, pos.lng);
        });
      }

      map.on("click", async (e: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current.on("dragend", async () => {
            const pos = markerRef.current!.getLatLng();
            await handleLocationPick(pos.lat, pos.lng);
          });
        }
        await handleLocationPick(lat, lng);
      });

      // Try browser geolocation only if no initial location provided
      if (!initialLocation && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!isMounted) return;
            map.setView([pos.coords.latitude, pos.coords.longitude], PIN_ZOOM);
          },
          () => {},
          { timeout: 5000 },
        );
      }

      mapRef.current = map;
    });

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep handleLocationPick fresh in the map click handler
  useEffect(() => {
    // Nothing to do — handleLocationPick is a ref-stable callback above
  }, [handleLocationPick]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    const result = await nominatimSearch(searchQuery.trim());
    setSearching(false);
    if (!result) {
      setSearchError("Location not found. Try a more specific address.");
      return;
    }

    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;
      if (markerRef.current) {
        markerRef.current.setLatLng([result.lat, result.lng]);
      } else {
        markerRef.current = L.marker([result.lat, result.lng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", async () => {
          const pos = markerRef.current!.getLatLng();
          await handleLocationPick(pos.lat, pos.lng);
        });
      }
      map.setView([result.lat, result.lng], PIN_ZOOM);
    });

    const loc: PickedLocation = {
      lat: Math.round(result.lat * 1e6) / 1e6,
      lng: Math.round(result.lng * 1e6) / 1e6,
      address: result.address,
    };
    setPicked(loc);
    onLocationChange(loc);
    setSearchQuery("");
  };

  const inputClass =
    "bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-4 py-2.5 outline-none focus:border-amber-400 transition-colors text-sm";

  return (
    <div className="flex flex-col gap-2">
      {/* Address search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
          placeholder="Search address or place…"
          className={`${inputClass} flex-1`}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="px-4 py-2.5 rounded-lg font-semibold text-sm tracking-widest uppercase text-amber-900 border-2 border-amber-400 bg-amber-100 hover:bg-amber-200 transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {searching ? "…" : "Search"}
        </button>
      </div>

      {searchError && (
        <p className="text-red-600 text-xs tracking-wide">{searchError}</p>
      )}

      {/* Map */}
      <div
        className="relative rounded-xl overflow-hidden border-2 border-gray-200"
        style={{ height: 280 }}
      >
        {/* Leaflet CSS injected once */}
        <style>{`
          @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
          .leaflet-container { font-family: inherit; }
          .leaflet-control-attribution { font-size: 10px !important; }
        `}</style>
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
        {!picked && (
          <div
            className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none"
            style={{ zIndex: 1000 }}
          >
            <span className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full tracking-wide">
              Tap the map to pin your hive location
            </span>
          </div>
        )}
      </div>

      {/* Selected address display */}
      {picked && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="text-amber-600 mt-0.5 flex-shrink-0">📍</span>
          <span className="text-xs text-gray-700 break-words leading-relaxed">{picked.address}</span>
        </div>
      )}

      <p className="text-xs text-gray-400 tracking-wide">
        Click the map or search to place the pin. You can drag the pin to adjust.
      </p>
    </div>
  );
}
