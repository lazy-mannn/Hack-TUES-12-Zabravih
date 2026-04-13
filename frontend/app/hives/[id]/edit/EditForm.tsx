"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateHive, type EditState } from "@/app/actions";
import HiveMapPicker, { type PickedLocation } from "@/app/components/HiveMapPicker";
import type { HiveDetail } from "@/lib/django";

type Props = { hive: HiveDetail };

export default function EditForm({ hive }: Props) {
  const router = useRouter();

  const initialLocation: PickedLocation | undefined =
    hive.latitude && hive.longitude
      ? { lat: parseFloat(hive.latitude), lng: parseFloat(hive.longitude), address: hive.address }
      : undefined;

  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(
    initialLocation ?? null,
  );

  const boundAction = updateHive.bind(null, hive.id);
  const [state, action, pending] = useActionState<EditState, FormData>(boundAction, null);

  const inputClass =
    "w-full bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-5 py-3 outline-none focus:border-amber-400 transition-colors text-base";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-lg rounded-3xl px-6 sm:px-8 py-10"
        style={{
          background: "rgba(255, 255, 255, 0.40)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.70)",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.90), inset 0 -1px 0 rgba(0,0,0,0.04), 0 24px 48px rgba(0,0,0,0.08)",
        }}
      >
        <button
          onClick={() => router.push(`/hives/${hive.id}`)}
          className="text-gray-400 text-sm tracking-widest uppercase mb-6 hover:text-gray-700 transition-colors flex items-center gap-2"
        >
          ← Back
        </button>

        <h1
          className="text-3xl font-black tracking-widest uppercase text-gray-900 mb-1"
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.1)" }}
        >
          Edit Hive
        </h1>
        <p className="text-gray-700/70 text-sm tracking-widest uppercase mb-8">
          {hive.name}
        </p>

        <form action={action} className="flex flex-col gap-5">
          <input
            type="text"
            name="name"
            placeholder="Hive name"
            defaultValue={hive.name}
            required
            className={inputClass}
          />

          <input
            type="text"
            name="location"
            placeholder="Location nickname"
            defaultValue={hive.location}
            required
            className={inputClass}
          />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-widest uppercase text-gray-500">
              Pin Location on Map
            </span>
            <HiveMapPicker
              onLocationChange={setPickedLocation}
              initialLocation={initialLocation}
            />
          </div>

          {/* Coords — use newly picked value, fall back to existing hive values */}
          <input type="hidden" name="address"   value={pickedLocation?.address   ?? hive.address   ?? ""} />
          <input type="hidden" name="latitude"  value={pickedLocation?.lat?.toString()  ?? hive.latitude  ?? ""} />
          <input type="hidden" name="longitude" value={pickedLocation?.lng?.toString() ?? hive.longitude ?? ""} />

          {state?.error && (
            <div className="rounded-xl bg-red-500/15 border border-red-600/30 px-4 py-3 text-sm text-gray-900 text-center tracking-wide font-mono">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full py-3 rounded-xl font-semibold tracking-widest uppercase text-amber-900 text-base cursor-pointer border-2 border-amber-400 bg-amber-100 hover:bg-amber-200 hover:border-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
