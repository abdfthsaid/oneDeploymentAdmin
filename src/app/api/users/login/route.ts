import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/firebase-admin";
import { signToken } from "@/lib/auth";

async function queryUser(
  username: string,
  attempt = 1,
): Promise<{ userId: string; userData: any } | null> {
  try {
    console.log(`🔍 Firebase query attempt ${attempt} for user: ${username}`);
    const userSnap = await db
      .collection("system_users")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (!userSnap.empty) {
      const userDoc = userSnap.docs[0];
      return { userId: userDoc.id, userData: userDoc.data() };
    }
    return null;
  } catch (error: any) {
    console.error(
      `❌ Firebase query attempt ${attempt} failed:`,
      error.message,
      error.code,
    );
    if (attempt < 3) {
      console.log(`⏳ Retrying in ${attempt * 2} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      return queryUser(username, attempt + 1);
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password required ❌" },
        { status: 400 },
      );
    }

    let result: { userId: string; userData: any } | null = null;

    try {
      result = await queryUser(username);
    } catch (error: any) {
      console.error(
        `🚨 All Firebase retries failed for ${username}:`,
        error.message,
      );
      return NextResponse.json(
        { error: `Database connection failed: ${error.message}` },
        { status: 503 },
      );
    }

    if (!result) {
      return NextResponse.json(
        { error: "Invalid username or password ❌" },
        { status: 401 },
      );
    }

    const { userId, userData } = result;

    if (userData.password !== password) {
      return NextResponse.json(
        { error: "Invalid username or password ❌" },
        { status: 401 },
      );
    }

    const token = signToken({
      id: userId,
      username: userData.username,
      role: userData.role,
    });

    const expiresAt = Date.now() + 1 * 60 * 60 * 1000;

    const totalTime = Date.now() - startTime;
    console.log(
      `✅ Login successful for ${username} - Total time: ${totalTime}ms`,
    );

    return NextResponse.json({
      message: "Login successful ✅",
      token,
      expiresAt,
      user: {
        id: userId,
        username: userData.username,
        role: userData.role,
        email: userData.email || null,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error.message, error.stack);
    return NextResponse.json(
      { error: `Login failed: ${error.message}` },
      { status: 500 },
    );
  }
}
