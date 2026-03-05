import { NextRequest, NextResponse } from "next/server";
import { updateStationStats } from "@/lib/stationStatsJob";
import { cacheComponent } from "@/lib/cacheComponent";

export async function GET(req: NextRequest) {
  // Vercel Cron sends CRON_SECRET via Authorization header automatically
  const CRON_SECRET = process.env.CRON_SECRET;

  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    console.log("⏱️ Cron: Updating station stats...");
    const result = await updateStationStats();
    cacheComponent.invalidatePrefix("stations:stats:");
    return NextResponse.json({
      message: "Station stats updated",
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("❌ Cron station stats error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
