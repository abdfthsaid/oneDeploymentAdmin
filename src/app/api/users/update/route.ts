import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/firebase-admin";
import { authenticateRequest, requireRole, TokenPayload } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ["admin"]);
  if (roleCheck) return roleCheck;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const username = searchParams.get("username");
    const updates = await req.json();

    if (!id && !username) {
      return NextResponse.json(
        { error: "Provide 'id' or 'username' to update user ❌" },
        { status: 400 },
      );
    }

    if (
      updates.role &&
      !["admin", "moderator", "user"].includes(updates.role)
    ) {
      return NextResponse.json(
        { error: "Role must be 'admin', 'moderator', or 'user' ❌" },
        { status: 400 },
      );
    }

    let userDocRef: any;
    let currentData: any;

    if (id) {
      userDocRef = db.collection("system_users").doc(id);
      const doc = await userDocRef.get();
      if (!doc.exists) {
        return NextResponse.json(
          { error: "User not found ❌" },
          { status: 404 },
        );
      }
      currentData = doc.data();
    } else {
      const snap = await db
        .collection("system_users")
        .where("username", "==", username)
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json(
          { error: "User not found ❌" },
          { status: 404 },
        );
      }
      userDocRef = snap.docs[0].ref;
      currentData = snap.docs[0].data();
    }

    if (updates.username && updates.username !== currentData.username) {
      const usernameSnap = await db
        .collection("system_users")
        .where("username", "==", updates.username)
        .get();
      if (!usernameSnap.empty) {
        return NextResponse.json(
          { error: "Username already exists ❌" },
          { status: 409 },
        );
      }
    }

    if (updates.email && updates.email !== currentData.email) {
      const emailSnap = await db
        .collection("system_users")
        .where("email", "==", updates.email)
        .get();
      if (!emailSnap.empty) {
        return NextResponse.json(
          { error: "Email already exists ❌" },
          { status: 409 },
        );
      }
    }

    await userDocRef.update({ ...updates, updatedAt: new Date() });
    return NextResponse.json({ message: "User updated successfully ✅" });
  } catch (error: any) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Failed to update user ❌" },
      { status: 500 },
    );
  }
}
