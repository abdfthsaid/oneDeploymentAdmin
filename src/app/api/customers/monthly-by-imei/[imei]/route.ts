import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { admin } from '@/lib/firebase-admin';
import { authenticateRequest, requireRole, TokenPayload } from '@/lib/auth';
import { getMonthBoundsUTC3 } from '@/lib/timeUtils';

export async function GET(req: NextRequest, { params }: { params: { imei: string } }) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ['user', 'moderator', 'admin']);
  if (roleCheck) return roleCheck;

  const { imei } = params;
  const { startUtc, monthKey } = getMonthBoundsUTC3();

  try {
    const Timestamp = admin.firestore.Timestamp;
    const snapshot = await db
      .collection('rentals')
      .where('imei', '==', imei)
      .where('timestamp', '>=', Timestamp.fromDate(startUtc))
      .where('status', 'in', ['rented', 'returned'])
      .get();

    const phones = new Set<string>();
    snapshot.forEach((doc: any) => {
      const num = doc.data().phoneNumber;
      if (num) phones.add(num);
    });

    return NextResponse.json({
      imei,
      month: monthKey,
      totalCustomersThisMonth: phones.size,
      totalRentalsThisMonth: snapshot.size,
    });
  } catch (err: any) {
    console.error('❌ Monthly customer error:', err);
    return NextResponse.json({ error: 'Failed to fetch monthly customer count' }, { status: 500 });
  }
}
