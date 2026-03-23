import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/firebase-admin";
import { assertJwtConfigured } from "@/lib/auth";
import { normalizeUsername } from "@/lib/inputValidation";
import { createLoginChallenge, getOtpExpiryMinutes } from "@/lib/loginOtp";
import { maskEmail, sendAdminOtpEmail } from "@/lib/mail";
import { hashPassword, verifyPassword } from "@/lib/passwords";

async function queryUser(
  username: string,
  attempt = 1,
): Promise<{ userId: string; userData: any } | null> {
  try {
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
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      return queryUser(username, attempt + 1);
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    const normalizedUsername = normalizeUsername(username);

    if (!normalizedUsername || !password) {
      return NextResponse.json(
        { error: "Username and password required ❌" },
        { status: 400 },
      );
    }

    let result: { userId: string; userData: any } | null = null;

    try {
      result = await queryUser(normalizedUsername);
    } catch (error: any) {
      return NextResponse.json(
        { error: "Database connection failed" },
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

    const passwordCheck = await verifyPassword(password, userData.password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: "Invalid username or password ❌" },
        { status: 401 },
      );
    }
    if (passwordCheck.needsRehash) {
      await db.collection("system_users").doc(userId).update({
        password: await hashPassword(password),
        updatedAt: new Date(),
      });
    }

    const email =
      typeof userData.email === "string" ? userData.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json(
        { error: "User email is missing. Contact another admin ❌" },
        { status: 400 },
      );
    }

    assertJwtConfigured();

    const challenge = await createLoginChallenge({
      id: userId,
      username: userData.username,
      role: userData.role,
      email,
    });

    await sendAdminOtpEmail({
      to: email,
      username: userData.username,
      otpCode: challenge.otpCode,
      expiresMinutes: getOtpExpiryMinutes(),
    });

    return NextResponse.json({
      message: "OTP sent ✅",
      otpRequired: true,
      challengeId: challenge.challengeId,
      otpExpiresAt: challenge.expiresAt,
      email: maskEmail(email),
    });
  } catch (error: any) {
    const message = typeof error?.message === "string" ? error.message : "";
    if (message.includes("JWT_SECRET")) {
      return NextResponse.json(
        { error: "JWT_SECRET is missing or too short in Vercel ❌" },
        { status: 503 },
      );
    }
    if (message.includes("SMTP_USER") || message.includes("SMTP_PASS") || message.includes("SMTP_FROM")) {
      return NextResponse.json(
        { error: "SMTP email settings are missing in Vercel ❌" },
        { status: 503 },
      );
    }
    if (message.toLowerCase().includes("invalid login") || message.toLowerCase().includes("authentication unsuccessful")) {
      return NextResponse.json(
        { error: "SMTP email login failed. Check Gmail app password ❌" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 },
    );
  }
}
