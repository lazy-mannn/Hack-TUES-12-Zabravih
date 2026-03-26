"use client";

import { useState, useEffect } from "react";

const HEX_W = 130;
const HEX_H = Math.round(HEX_W * (2 / Math.sqrt(3)));
const ROW_OVERLAP = Math.round(HEX_H * 0.25);
const GAP = 5;
const ROW_STEP = HEX_H - ROW_OVERLAP + GAP;

const hexStyle = {
  width: HEX_W,
  height: HEX_H,
  clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  flexShrink: 0,
} as const;

export default function HoneycombBackground() {
  const [cols, setCols] = useState(0);
  const [rows, setRows] = useState(0);

  useEffect(() => {
    function recalculate() {
      // +2 extra cols/rows to cover the negative offset margins
      setCols(Math.ceil((window.innerWidth + 2 * (HEX_W + GAP)) / (HEX_W + GAP)) + 2);
      setRows(Math.ceil((window.innerHeight + HEX_H) / ROW_STEP) + 2);
    }
    recalculate();
    window.addEventListener("resize", recalculate);
    return () => window.removeEventListener("resize", recalculate);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none bg-black">
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
              <div key={cIdx} className="bg-amber-400/85" style={hexStyle} />
            ))}
          </div>
        ))}
      </div>

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,220,50,0.3) 0%, transparent 50%, rgba(180,83,9,0.35) 100%)",
        }}
      />
    </div>
  );
}
