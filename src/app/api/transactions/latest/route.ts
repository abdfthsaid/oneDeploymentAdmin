import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/firebase-admin";
import { admin } from "@/lib/firebase-admin";
import { authenticateRequest, requireRole, TokenPayload } from "@/lib/auth";
import { cacheComponent, buildPrivateCacheControl } from "@/lib/cacheComponent";
import { RENTALS_COLLECTION } from "@/lib/rentalsCollection";

const CACHE_TTL_MS = 20_000;

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, [
    "user",
    "moderator",
    "admin",
  ]);
  if (roleCheck) return roleCheck;

  try {
    const enrichedRentals = await cacheComponent.remember(
      "transactions:latest",
      CACHE_TTL_MS,
      async () => {
        const Timestamp = admin.firestore.Timestamp;
        const twoDaysAgo = Timestamp.fromDate(
          new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        );

        const rentalsSnapshot = await db
          .collection(RENTALS_COLLECTION)
          .where("status", "in", ["rented", "returned"])
          .where("timestamp", ">=", twoDaysAgo)
          .orderBy("timestamp", "desc")
          .limit(10)
          .get();

        const rentals = rentalsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        if (rentals.length === 0) {
          return [];
        }

        const imeis = Array.from(new Set(rentals.map((r: any) => r.imei)));

        const stationSnapshot = await db
          .collection("stations")
          .where("imei", "in", imeis)
          .get();

        const stationMap: Record<string, string> = {};
        stationSnapshot.forEach((doc) => {
          const data = doc.data();
          stationMap[data.imei] = data.name || null;
        });

        return rentals.map((r: any) => ({
          ...r,
          stationName: stationMap[r.imei] || null,
        }));
      },
    );

    return NextResponse.json(enrichedRentals, {
      headers: {
        "Cache-Control": buildPrivateCacheControl(CACHE_TTL_MS),
      },
    });
  } catch (error: any) {
    console.error("❌ Error fetching latest rentals:", error);
    return NextResponse.json(
      { error: "Failed to fetch enriched rentals ❌" },
      { status: 500 },
    );
  }
}
