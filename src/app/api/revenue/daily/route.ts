import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/firebase-admin";
import { admin } from "@/lib/firebase-admin";
import { authenticateRequest, requireRole, TokenPayload } from "@/lib/auth";
import { getDayBoundsUTC3, calculateUniqueRevenue } from "@/lib/timeUtils";
import { cacheComponent, buildPrivateCacheControl } from "@/lib/cacheComponent";

const CACHE_TTL_MS = 30_000;

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, [
    "user",
    "moderator",
    "admin",
  ]);
  if (roleCheck) return roleCheck;

  const { startUtc, endUtc, dateStr } = getDayBoundsUTC3();

  try {
    const payload = await cacheComponent.remember(
      `revenue:daily:all:${dateStr}`,
      CACHE_TTL_MS,
      async () => {
        const Timestamp = admin.firestore.Timestamp;
        const snapshot = await db
          .collection("rentals")
          .where("timestamp", ">=", Timestamp.fromDate(startUtc))
          .where("timestamp", "<", Timestamp.fromDate(endUtc))
          .where("status", "in", ["rented", "returned"])
          .get();

        let { total, count } = calculateUniqueRevenue(snapshot.docs);
        let usedDate = dateStr;

        // If no rentals today, show yesterday's data as fallback
        if (count === 0) {
          const yesterdayStart = new Date(
            startUtc.getTime() - 24 * 60 * 60 * 1000,
          );
          const yesterdaySnap = await db
            .collection("rentals")
            .where("timestamp", ">=", Timestamp.fromDate(yesterdayStart))
            .where("timestamp", "<", Timestamp.fromDate(startUtc))
            .where("status", "in", ["rented", "returned"])
            .get();
          const yResult = calculateUniqueRevenue(yesterdaySnap.docs);
          if (yResult.count > 0) {
            total = yResult.total;
            count = yResult.count;
            const yd = new Date(yesterdayStart.getTime() + 3 * 60 * 60 * 1000);
            usedDate = `${yd.getUTCFullYear()}-${String(yd.getUTCMonth() + 1).padStart(2, "0")}-${String(yd.getUTCDate()).padStart(2, "0")}`;
          }
        }

        return {
          totalRevenueToday: total,
          totalRentalsToday: count,
          date: usedDate,
        };
      },
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": buildPrivateCacheControl(CACHE_TTL_MS),
      },
    });
  } catch (error: any) {
    console.error("❌ Error calculating total daily revenue:", error);
    return NextResponse.json(
      { error: "Failed to calculate total daily revenue ❌" },
      { status: 500 },
    );
  }
}
