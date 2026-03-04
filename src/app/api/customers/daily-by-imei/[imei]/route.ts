import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { admin } from '@/lib/firebase-admin';
import { authenticateRequest, requireRole, TokenPayload } from '@/lib/auth';
import { getDayBoundsUTC3 } from '@/lib/timeUtils';

export async function GET(req: NextRequest, { params }: { params: { imei: string } }) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ['user', 'moderator', 'admin']);
  if (roleCheck) return roleCheck;

  const { imei } = params;
  const { startUtc, dateStr } = getDayBoundsUTC3();

  try {
    const Timestamp = admin.firestore.Timestamp;
    const snapshot = await db
      .collection('rentals')
      .where('imei', '==', imei)
      .where('timestamp', '>=', Timestamp.fromDate(startUtc))
      .where('status', 'in', ['rented', 'returned'])
      .get();

    const uniquePhones = new Set<string>();
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.phoneNumber) uniquePhones.add(data.phoneNumber);
    });

    return NextResponse.json({
      imei,
      date: dateStr,
      totalCustomersToday: uniquePhones.size,
      totalRentalsToday: snapshot.size,
    });
  } catch (err: any) {
    console.error('❌ Error calculating daily rentals:', err);
    return NextResponse.json({ error: 'Failed to fetch daily customer count' }, { status: 500 });
  }
}
