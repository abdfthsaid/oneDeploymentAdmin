import { NextRequest, NextResponse } from "next/server";

import db from "@/lib/firebase-admin";
import { authenticateRequest, requireRole, TokenPayload } from "@/lib/auth";
import {
  buildPrivateCacheControl,
  cacheComponent,
} from "@/lib/cacheComponent";

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
    const fresh = req.nextUrl.searchParams.get("fresh") === "1";

    if (fresh) {
      cacheComponent.invalidate("transactions:history");
    }

    const payload = await cacheComponent.remember(
      "transactions:history",
      CACHE_TTL_MS,
      async () => {
        const rentalsSnapshot = await db
          .collection("rentals")
          .orderBy("timestamp", "desc")
          .get();

        const rentals = rentalsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        if (rentals.length === 0) {
          return [];
        }

        const stationMap: Record<string, string> = {};
        const stationSnapshot = await db.collection("stations").get();

        stationSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.imei) {
            stationMap[data.imei] = data.name || data.imei;
          }
          if (data.stationCode) {
            stationMap[data.stationCode] = data.name || data.stationCode;
          }
        });

        return rentals.map((r: any) => ({
          ...r,
          stationName:
            stationMap[r.imei] ||
            stationMap[r.stationCode] ||
            r.stationCode ||
            r.imei ||
            null,
        }));
      },
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": fresh
          ? "no-store, max-age=0"
          : buildPrivateCacheControl(CACHE_TTL_MS),
      },
    });
  } catch (error: any) {
    console.error("❌ Error fetching transaction history:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction history" },
      { status: 500 },
    );
  }
}
