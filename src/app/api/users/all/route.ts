import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/firebase-admin";
import { authenticateRequest, requireRole, TokenPayload } from "@/lib/auth";
import { cacheComponent, buildPrivateCacheControl } from "@/lib/cacheComponent";

const CACHE_TTL_MS = 30_000;

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ["admin"]);
  if (roleCheck) return roleCheck;

  try {
    const fresh = req.nextUrl.searchParams.get("fresh") === "1";
    if (fresh) cacheComponent.invalidatePrefix("users:");

    const users = await cacheComponent.remember(
      "users:all",
      CACHE_TTL_MS,
      async () => {
        const snapshot = await db.collection("system_users").get();
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      },
    );
    return NextResponse.json(users, {
      headers: {
        "Cache-Control": fresh
          ? "no-store"
          : buildPrivateCacheControl(CACHE_TTL_MS),
      },
    });
  } catch (err: any) {
    console.error("Fetch all users error:", err);
    return NextResponse.json(
      { error: "Failed to fetch users ❌" },
      { status: 500 },
    );
  }
}
