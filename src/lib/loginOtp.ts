import crypto from "crypto";
import { Timestamp } from "firebase-admin/firestore";

import db from "@/lib/firebase-admin";

const LOGIN_CHALLENGES_COLLECTION = "admin_login_challenges";
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

export type LoginChallengeUser = {
  id: string;
  username: string;
  role: string;
  email: string;
};

function hashOtp(challengeId: string, otpCode: string): string {
  return crypto
    .createHash("sha256")
    .update(`${challengeId}:${otpCode}`)
    .digest("hex");
}

export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function getOtpExpiryMinutes(): number {
  return OTP_EXPIRY_MINUTES;
}

export async function createLoginChallenge(user: LoginChallengeUser) {
  const challengeId = user.id;
  const otpCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.collection(LOGIN_CHALLENGES_COLLECTION).doc(challengeId).set({
    userId: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    otpHash: hashOtp(challengeId, otpCode),
    attempts: 0,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromDate(expiresAt),
    updatedAt: Timestamp.now(),
  });

  return {
    challengeId,
    otpCode,
    expiresAt: expiresAt.getTime(),
  };
}

export async function verifyLoginChallenge(
  challengeId: string,
  otpCode: string,
): Promise<
  | { ok: true; user: LoginChallengeUser }
  | { ok: false; reason: "invalid" | "expired" | "missing" | "locked" }
> {
  const docRef = db.collection(LOGIN_CHALLENGES_COLLECTION).doc(challengeId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return { ok: false, reason: "missing" };
  }

  const data = doc.data() as Record<string, any>;
  const expiresAt = data.expiresAt?.toDate?.() as Date | undefined;
  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    await docRef.delete();
    return { ok: false, reason: "expired" };
  }

  const attempts = Number(data.attempts || 0);
  if (attempts >= MAX_OTP_ATTEMPTS) {
    await docRef.delete();
    return { ok: false, reason: "locked" };
  }

  const expectedHash = data.otpHash;
  if (expectedHash !== hashOtp(challengeId, otpCode)) {
    await docRef.update({
      attempts: attempts + 1,
      updatedAt: Timestamp.now(),
    });
    return { ok: false, reason: "invalid" };
  }

  await docRef.delete();
  return {
    ok: true,
    user: {
      id: String(data.userId || ""),
      username: String(data.username || ""),
      role: String(data.role || ""),
      email: String(data.email || ""),
    },
  };
}
