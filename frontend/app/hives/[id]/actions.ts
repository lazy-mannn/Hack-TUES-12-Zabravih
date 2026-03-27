"use server";

import { fetchHiveMetrics } from "@/lib/django";
import type { HiveMetrics } from "@/lib/django";

export async function getHiveMetrics(
  hiveId: number,
  period: "24h" | "7d" | "14d",
): Promise<HiveMetrics> {
  return fetchHiveMetrics(hiveId, period);
}
