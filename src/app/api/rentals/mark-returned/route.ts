import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest, requireRole, TokenPayload } from "@/lib/auth";
import { cacheComponent } from "@/lib/cacheComponent";
import db from "@/lib/firebase-admin";
import { RENTALS_COLLECTION } from "@/lib/rentalsCollection";

export async function PATCH(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const user = auth as TokenPayload;
  const roleCheck = requireRole(user, ["admin"]);
  if (roleCheck) return roleCheck;

  try {
    const { id, note } = await req.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Rental id is required" },
        { status: 400 },
      );
    }

    const rentalRef = db.collection(RENTALS_COLLECTION).doc(id);
    const rentalSnap = await rentalRef.get();

    if (!rentalSnap.exists) {
      return NextResponse.json({ error: "Rental not found" }, { status: 404 });
    }

    const rental = rentalSnap.data() || {};
    if (String(rental.status || "").toLowerCase() === "returned") {
      return NextResponse.json({
        success: true,
        message: "Rental is already returned",
      });
    }

    await rentalRef.update({
      status: "returned",
      returnedAt: new Date(),
      note:
        typeof note === "string" && note.trim()
          ? note.trim()
          : `Manually marked returned by admin ${user.username}`,
      returnedBy: user.username,
    });

    cacheComponent.invalidatePrefix("stations:stats:");
    cacheComponent.invalidatePrefix("transactions:");
    cacheComponent.invalidatePrefix("dashboard:");
    cacheComponent.invalidatePrefix("revenue:");
    cacheComponent.invalidatePrefix("customers:");
    cacheComponent.invalidatePrefix("charts:");

    return NextResponse.json({
      success: true,
      message: "Rental marked as returned",
    });
  } catch (error: any) {
    console.error("❌ Error marking rental returned:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update rental" },
      { status: 500 },
    );
  }
}
