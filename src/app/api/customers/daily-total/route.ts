import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/firebase-admin";
import { admin } from "@/lib/firebase-admin";
import { authenticateRequest, requireRole, TokenPayload } from "@/lib/auth";
import { getDayBoundsUTC3 } from "@/lib/timeUtils";
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

  const countFromSnapshot = (snap: any) => {
    const uniqueCustomers = new Set<string>();
    const stationSet = new Set<string>();
    const uniqueTransactions = new Set<string>();
    snap.forEach((doc: any) => {
      const data = doc.data();
      const txId = data.transactionId || doc.id;
      if (uniqueTransactions.has(txId)) return;
      uniqueTransactions.add(txId);
      if (data.phoneNumber) uniqueCustomers.add(data.phoneNumber);
      if (data.imei) stationSet.add(data.imei);
    });
    return {
      customers: uniqueCustomers.size,
      rentals: uniqueTransactions.size,
      stations: stationSet.size,
    };
  };

  try {
    const payload = await cacheComponent.remember(
      `customers:daily:all:${dateStr}`,
      CACHE_TTL_MS,
      async () => {
        const Timestamp = admin.firestore.Timestamp;
        const snapshot = await db
          .collection("rentals")
          .where("timestamp", ">=", Timestamp.fromDate(startUtc))
          .where("timestamp", "<", Timestamp.fromDate(endUtc))
          .where("status", "in", ["rented", "returned"])
          .get();

        let result = countFromSnapshot(snapshot);
        let usedDate = dateStr;

        // If no customers today, show yesterday's data as fallback
        if (result.customers === 0) {
          const yesterdayStart = new Date(
            startUtc.getTime() - 24 * 60 * 60 * 1000,
          );
          const yesterdaySnap = await db
            .collection("rentals")
            .where("timestamp", ">=", Timestamp.fromDate(yesterdayStart))
            .where("timestamp", "<", Timestamp.fromDate(startUtc))
            .where("status", "in", ["rented", "returned"])
            .get();
          const yResult = countFromSnapshot(yesterdaySnap);
          if (yResult.customers > 0) {
            result = yResult;
            const yd = new Date(yesterdayStart.getTime() + 3 * 60 * 60 * 1000);
            usedDate = `${yd.getUTCFullYear()}-${String(yd.getUTCMonth() + 1).padStart(2, "0")}-${String(yd.getUTCDate()).padStart(2, "0")}`;
          }
        }

        return {
          date: usedDate,
          totalCustomersToday: result.customers,
          totalRentalsToday: result.rentals,
          stations: result.stations,
        };
      },
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": buildPrivateCacheControl(CACHE_TTL_MS),
      },
    });
  } catch (err: any) {
    console.error("❌ Daily-total error:", err);
    return NextResponse.json(
      { error: "Failed to fetch daily totals" },
      { status: 500 },
    );
  }
}
