"use client";

import { useState, useEffect } from "react";

const HEX_W = 130;
const HEX_H = Math.round(HEX_W * (2 / Math.sqrt(3)));
const ROW_OVERLAP = Math.round(HEX_H * 0.25);
const GAP = 6;
const ROW_STEP = HEX_H - ROW_OVERLAP + GAP;

const hexStyle = {
  width: HEX_W,
  height: HEX_H,
  clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  flexShrink: 0,
} as const;

function BeeSVG({ size = 44 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/bee.svg" width={size} height={size} alt="" />
  );
}

const BEES: {
  left: string; top: string; size: number; rotate: number; opacity: number;
}[] = [
  // Corners
  { left: "0%",   top: "2%",   size: 58, rotate: 20,  opacity: 1.00 },
  { left: "88%",  top: "1%",   size: 50, rotate: -18, opacity: 0.95 },
  { left: "92%",  top: "79%",  size: 62, rotate: 32,  opacity: 1.00 },
  { left: "-1%",  top: "77%",  size: 54, rotate: -14, opacity: 0.95 },
  // Edges
  { left: "43%",  top: "0%",   size: 42, rotate: -25, opacity: 0.88 },
  { left: "91%",  top: "41%",  size: 46, rotate: 22,  opacity: 0.90 },
  { left: "-1%",  top: "43%",  size: 44, rotate: -10, opacity: 0.88 },
  { left: "51%",  top: "91%",  size: 48, rotate: 15,  opacity: 0.90 },
  { left: "16%",  top: "89%",  size: 38, rotate: 8,   opacity: 0.85 },
  { left: "74%",  top: "90%",  size: 36, rotate: -28, opacity: 0.82 },
  // Scattered
  { left: "21%",  top: "6%",   size: 30, rotate: 38,  opacity: 0.75 },
  { left: "69%",  top: "5%",   size: 32, rotate: -12, opacity: 0.78 },
  { left: "84%",  top: "59%",  size: 28, rotate: 28,  opacity: 0.72 },
  { left: "4%",   top: "59%",  size: 30, rotate: -38, opacity: 0.75 },
];

export default function HoneycombBackground() {
  const [cols, setCols] = useState(0);
  const [rows, setRows] = useState(0);

  useEffect(() => {
    function recalculate() {
      setCols(Math.ceil((window.innerWidth + 2 * (HEX_W + GAP)) / (HEX_W + GAP)) + 2);
      setRows(Math.ceil((window.innerHeight + HEX_H) / ROW_STEP) + 2);
    }
    recalculate();
    window.addEventListener("resize", recalculate);
    return () => window.removeEventListener("resize", recalculate);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ background: "#fef3c7" }}>
      {/* Honeycomb grid — vibrant amber cells */}
      <div
        className="flex flex-col"
        style={{ marginLeft: -(HEX_W + GAP), marginTop: -(HEX_H / 2) }}
      >
        {Array.from({ length: rows }, (_, rIdx) => (
          <div
            key={rIdx}
            className="flex"
            style={{
              marginTop: rIdx === 0 ? 0 : -(ROW_OVERLAP - GAP),
              paddingLeft: rIdx % 2 === 1 ? HEX_W / 2 + GAP / 2 : 0,
              gap: GAP,
            }}
          >
            {Array.from({ length: cols }, (_, cIdx) => (
              <div
                key={cIdx}
                style={{
                  ...hexStyle,
                  background:
                    (rIdx + cIdx) % 5 === 0
                      ? "rgba(255,255,255,0.60)"   // white hex
                      : (rIdx + cIdx) % 5 === 1
                      ? "rgba(251,191,36,0.18)"    // amber-400 — very light
                      : (rIdx + cIdx) % 5 === 2
                      ? "rgba(255,255,255,0.45)"   // white hex
                      : (rIdx + cIdx) % 5 === 3
                      ? "rgba(252,211,77,0.13)"    // amber-300 — barely there
                      : "rgba(245,158,11,0.15)",   // amber-500 — very muted
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Subtle central vignette so content area reads well */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(254,243,199,0.55) 0%, transparent 100%)",
        }}
      />

      {/* Animations */}
      <style>{`
        @keyframes honey-drop {
          0%   { transform: scaleY(0.04); opacity: 0; }
          18%  { transform: scaleY(0.55); opacity: 1; }
          52%  { transform: scaleY(1.00); opacity: 1; }
          78%  { transform: scaleY(1.20) translateY(10px); opacity: 0.65; }
          100% { transform: scaleY(1.50) translateY(28px); opacity: 0; }
        }
        @keyframes bee-fly-1 {
          0%   { transform: rotate(var(--r)) translate(0px,  0px); }
          20%  { transform: rotate(var(--r)) translate(4px,  -7px); }
          45%  { transform: rotate(var(--r)) translate(-3px, -12px); }
          70%  { transform: rotate(var(--r)) translate(-5px, -5px); }
          100% { transform: rotate(var(--r)) translate(0px,  0px); }
        }
        @keyframes bee-fly-2 {
          0%   { transform: rotate(var(--r)) translate(0px,   0px); }
          25%  { transform: rotate(var(--r)) translate(-5px, -8px); }
          55%  { transform: rotate(var(--r)) translate(3px,  -14px); }
          80%  { transform: rotate(var(--r)) translate(6px,  -6px); }
          100% { transform: rotate(var(--r)) translate(0px,   0px); }
        }
        @keyframes bee-fly-3 {
          0%   { transform: rotate(var(--r)) translate(0px,  0px); }
          30%  { transform: rotate(var(--r)) translate(6px,  -5px); }
          60%  { transform: rotate(var(--r)) translate(2px,  -11px); }
          80%  { transform: rotate(var(--r)) translate(-4px, -8px); }
          100% { transform: rotate(var(--r)) translate(0px,  0px); }
        }
        @keyframes bee-fly-4 {
          0%   { transform: rotate(var(--r)) translate(0px,   0px); }
          35%  { transform: rotate(var(--r)) translate(-6px, -10px); }
          65%  { transform: rotate(var(--r)) translate(4px,  -14px); }
          85%  { transform: rotate(var(--r)) translate(5px,  -4px); }
          100% { transform: rotate(var(--r)) translate(0px,   0px); }
        }
      `}</style>

      {/* Bee decorations */}
      {BEES.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: b.left,
            top: b.top,
          }}
        >
          <div
            style={{
              opacity: b.opacity,
              filter: "contrast(1.6) saturate(1.5) drop-shadow(0 3px 6px rgba(0,0,0,0.30))",
              // CSS custom property carries the rotation into the keyframe
              ["--r" as string]: `${b.rotate}deg`,
              animation: `bee-fly-${(i % 4) + 1} ${3.2 + (i % 5) * 0.45}s ease-in-out infinite`,
              animationDelay: `${(i * 0.37) % 2.5}s`,
            }}
          >
            <BeeSVG size={b.size} />
          </div>
        </div>
      ))}
    </div>
  );
}
