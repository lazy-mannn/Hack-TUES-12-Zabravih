"use client";

import dynamic from "next/dynamic";

const HiveLocationMap = dynamic(
  () => import("@/app/components/HiveLocationMap"),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full rounded-xl bg-white/30 animate-pulse"
        style={{ height: 220 }}
      />
    ),
  }
);

type Props = {
  lat: number;
  lng: number;
  label: string;
};

export default function HiveLocationMapWrapper(props: Props) {
  return <HiveLocationMap {...props} />;
}
