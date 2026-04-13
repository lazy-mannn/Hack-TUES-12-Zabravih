import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#f59e0b",
          borderRadius: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 320, lineHeight: 1 }}>🐝</span>
      </div>
    ),
    { ...size }
  );
}
