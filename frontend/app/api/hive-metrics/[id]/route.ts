import { fetchHiveMetrics } from "@/lib/django";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") ?? "24h") as "24h" | "7d" | "14d";

  try {
    const data = await fetchHiveMetrics(Number(id), period);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
