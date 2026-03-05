import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/firebase-admin";
import { admin } from "@/lib/firebase-admin";
import { authenticateRequest, requireRole, TokenPayload } from "@/lib/auth";
import {
  calculateUniqueRevenue,
  getDayBoundsUTC3,
  getMonthBoundsUTC3,
} from "@/lib/timeUtils";
import { cacheComponent, buildPrivateCacheControl } from "@/lib/cacheComponent";

const CACHE_TTL_MS = 30_000;

function countFromSnapshot(snap: any) {
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
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, [
    "user",
    "moderator",
    "admin",
  ]);
  if (roleCheck) return roleCheck;

  const { startUtc, dateStr } = getDayBoundsUTC3();
  const { startUtc: monthStartUtc, monthKey } = getMonthBoundsUTC3();

  try {
    const payload = await cacheComponent.remember(
      `dashboard:summary:${dateStr}:${monthKey}`,
      CACHE_TTL_MS,
      async () => {
        const Timestamp = admin.firestore.Timestamp;

        const [dailySnap, monthlySnap] = await Promise.all([
          db
            .collection("rentals")
            .where("timestamp", ">=", Timestamp.fromDate(startUtc))
            .where("status", "in", ["rented", "returned"])
            .get(),
          db
            .collection("rentals")
            .where("timestamp", ">=", Timestamp.fromDate(monthStartUtc))
            .where("status", "in", ["rented", "returned"])
            .get(),
        ]);

        let dailyRevenue = calculateUniqueRevenue(dailySnap.docs);
        let dailyCounts = countFromSnapshot(dailySnap);
        let usedDate = dateStr;

        // Keep previous behavior: if today has no data, fallback to yesterday.
        if (dailyRevenue.count === 0 && dailyCounts.customers === 0) {
          const yesterdayStart = new Date(
            startUtc.getTime() - 24 * 60 * 60 * 1000,
          );
          const yesterdaySnap = await db
            .collection("rentals")
            .where("timestamp", ">=", Timestamp.fromDate(yesterdayStart))
            .where("timestamp", "<", Timestamp.fromDate(startUtc))
            .where("status", "in", ["rented", "returned"])
            .get();

          const yRevenue = calculateUniqueRevenue(yesterdaySnap.docs);
          const yCounts = countFromSnapshot(yesterdaySnap);
          if (yRevenue.count > 0 || yCounts.customers > 0) {
            dailyRevenue = yRevenue;
            dailyCounts = yCounts;
            const yd = new Date(yesterdayStart.getTime() + 3 * 60 * 60 * 1000);
            usedDate = `${yd.getUTCFullYear()}-${String(yd.getUTCMonth() + 1).padStart(2, "0")}-${String(yd.getUTCDate()).padStart(2, "0")}`;
          }
        }

        const monthlyRevenue = calculateUniqueRevenue(monthlySnap.docs);
        const monthlyCounts = countFromSnapshot(monthlySnap);

        return {
          daily: {
            date: usedDate,
            totalRevenueToday: dailyRevenue.total,
            totalRentalsToday: dailyRevenue.count,
            totalCustomersToday: dailyCounts.customers,
            stations: dailyCounts.stations,
          },
          monthly: {
            month: monthKey,
            totalRevenueMonthly: monthlyRevenue.total,
            totalRentalsThisMonth: monthlyRevenue.count,
            totalCustomersThisMonth: monthlyCounts.customers,
            stations: monthlyCounts.stations,
          },
        };
      },
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": buildPrivateCacheControl(CACHE_TTL_MS),
      },
    });
  } catch (error: any) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard summary" },
      { status: 500 },
    );
  }
}
