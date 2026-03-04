import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { admin } from '@/lib/firebase-admin';
import { authenticateRequest, requireRole, TokenPayload } from '@/lib/auth';

function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.slice(-9);
}

// GET all blacklisted users
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ['user', 'moderator', 'admin']);
  if (roleCheck) return roleCheck;

  try {
    const snapshot = await db.collection('blacklist').get();
    const blacklist = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json(blacklist);
  } catch (err: any) {
    console.error('❌ Error fetching blacklist:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST add to blacklist
export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ['user', 'moderator', 'admin']);
  if (roleCheck) return roleCheck;

  try {
    const { phoneNumber, reason, customerName } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    const Timestamp = admin.firestore.Timestamp;

    const existing = await db
      .collection('blacklist')
      .where('normalizedPhone', '==', normalizedPhone)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({ error: 'Phone number already blacklisted' }, { status: 400 });
    }

    const docRef = await db.collection('blacklist').add({
      phoneNumber,
      normalizedPhone,
      reason: reason || 'Did not return battery',
      customerName: customerName || '',
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      message: 'User added to blacklist',
      id: docRef.id,
    });
  } catch (err: any) {
    console.error('❌ Error adding to blacklist:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
