import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: "#f59e0b",
          borderRadius: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 120, lineHeight: 1 }}>🐝</span>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
