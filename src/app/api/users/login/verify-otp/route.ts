import { NextRequest, NextResponse } from "next/server";

import { signToken } from "@/lib/auth";
import { verifyLoginChallenge } from "@/lib/loginOtp";

export async function POST(req: NextRequest) {
  try {
    const { challengeId, otp } = await req.json();

    if (
      typeof challengeId !== "string" ||
      !challengeId.trim() ||
      typeof otp !== "string" ||
      !/^\d{6}$/.test(otp.trim())
    ) {
      return NextResponse.json(
        { error: "Challenge and 6-digit OTP are required ❌" },
        { status: 400 },
      );
    }

    const result = await verifyLoginChallenge(challengeId.trim(), otp.trim());
    if (!result.ok) {
      const message =
        result.reason === "expired"
          ? "OTP expired. Please login again ❌"
          : result.reason === "locked"
            ? "Too many invalid OTP attempts. Please login again ❌"
            : "Invalid OTP ❌";
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const token = signToken({
      id: result.user.id,
      username: result.user.username,
      role: result.user.role,
    });

    const expiresAt = Date.now() + 1 * 60 * 60 * 1000;

    return NextResponse.json({
      message: "Login successful ✅",
      token,
      expiresAt,
      user: result.user,
    });
  } catch {
    return NextResponse.json({ error: "OTP verification failed" }, { status: 500 });
  }
}
