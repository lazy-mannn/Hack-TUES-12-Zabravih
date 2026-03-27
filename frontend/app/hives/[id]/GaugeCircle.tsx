"use client";

const R = 46;
const CIRC = 2 * Math.PI * R;

type GaugeType = "temperature" | "humidity" | "co2" | "battery";

function getColor(value: number, type: GaugeType): string {
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
  // co2 ppm
  if (value < 1000) return "#22c55e";
  if (value < 3000) return "#eab308";
  return "#ef4444";
}

type Props = {
  value: number | null;
  type: GaugeType;
  label: string;
  unit: string;
};

export default function GaugeCircle({ value, type, label, unit }: Props) {
  const maxVal = type === "temperature" ? 50 : type === "humidity" ? 100 : type === "battery" ? 100 : 5000;
  const fraction = value !== null ? Math.min(1, Math.max(0, value / maxVal)) : 0;
  const color = value !== null ? getColor(value, type) : "#6b7280";
  const dash = CIRC * fraction;

  const displayValue =
    value === null
      ? "—"
      : type === "co2"
        ? Math.round(value).toString()
        : type === "battery"
          ? Math.round(value).toString()
          : value.toFixed(1);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 120 120" width={130} height={130}>
        {/* Track */}
        <circle
          cx={60} cy={60} r={R}
          fill="none"
          stroke="rgba(0,0,0,0.12)"
          strokeWidth={10}
        />
        {/* Arc */}
        <circle
          cx={60} cy={60} r={R}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={`${dash} ${CIRC}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.6s ease" }}
        />
        {/* Value */}
        <text
          x={60} y={52}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(0,0,0,0.85)"
          fontSize={22}
          fontWeight="bold"
          fontFamily="sans-serif"
        >
          {displayValue}
        </text>
        <text
          x={60} y={74}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(0,0,0,0.45)"
          fontSize={13}
          fontFamily="sans-serif"
        >
          {unit}
        </text>
      </svg>
      <span className="text-gray-600 text-xs tracking-widest uppercase">{label}</span>
    </div>
  );
}
