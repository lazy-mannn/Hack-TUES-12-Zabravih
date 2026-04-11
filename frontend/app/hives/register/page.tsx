"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { registerHive, type RegisterState } from "@/app/actions";

export default function RegisterPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerHive,
    null
  );

  const inputClass =
    "w-full bg-white border-2 border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-5 py-3 outline-none focus:border-amber-400 transition-colors text-base";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <div
          className="w-full max-w-md rounded-3xl px-8 py-10"
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
            onClick={() => router.push("/hives")}
            className="text-gray-400 text-sm tracking-widest uppercase mb-6 hover:text-gray-700 transition-colors flex items-center gap-2"
          >
            ← Back
          </button>

          <h1
            className="text-3xl font-black tracking-widest uppercase text-gray-900 mb-1"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.1)" }}
          >
            Register Hive
          </h1>
          <p className="text-gray-700/70 text-sm tracking-widest uppercase mb-8">
            Add a new device
          </p>

          <form action={action} className="flex flex-col gap-4">
            <input
              type="text"
              name="name"
              placeholder="Name"
              required
              className={inputClass}
            />
            <input
              type="text"
              name="location"
              placeholder="Location"
              required
              className={inputClass}
            />
            <input
              type="text"
              name="macaddress"
              placeholder="MAC Address"
              required
              pattern="^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$"
              title="Format: AA:BB:CC:DD:EE:FF"
              className={inputClass}
            />

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
              {pending ? "Registering…" : "Register"}
            </button>
          </form>
        </div>
    </div>
  );
}
