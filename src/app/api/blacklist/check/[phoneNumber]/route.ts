import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/auth';

function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.slice(-9);
}

export async function GET(req: NextRequest, { params }: { params: { phoneNumber: string } }) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { phoneNumber } = params;
  const normalized = normalizePhone(phoneNumber);

  if (normalized.length < 8) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
  }

  try {
    const snapshot = await db
      .collection('blacklist')
      .where('normalizedPhone', '==', normalized)
      .limit(1)
      .get();

    return NextResponse.json({
      phoneNumber,
      isBlacklisted: !snapshot.empty,
    });
  } catch (err: any) {
    console.error('❌ Error checking blacklist:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
