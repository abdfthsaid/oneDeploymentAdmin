import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { admin } from '@/lib/firebase-admin';
import { authenticateRequest, requireRole, TokenPayload } from '@/lib/auth';
import { getMonthBoundsUTC3, calculateUniqueRevenue } from '@/lib/timeUtils';
import { imeiToStationCode } from '@/lib/imeiMap';

export async function GET(req: NextRequest, { params }: { params: { imei: string } }) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ['user', 'moderator', 'admin']);
  if (roleCheck) return roleCheck;

  const { imei } = params;
  const stationCode = imeiToStationCode[imei];

  if (!stationCode) {
    return NextResponse.json({ error: `Unknown IMEI ${imei}` }, { status: 400 });
  }

  const { startUtc, monthKey } = getMonthBoundsUTC3();

  try {
    const Timestamp = admin.firestore.Timestamp;
    const snapshot = await db
      .collection('rentals')
      .where('stationCode', '==', stationCode)
      .where('timestamp', '>=', Timestamp.fromDate(startUtc))
      .where('status', 'in', ['rented', 'returned'])
      .get();

    const { total, count } = calculateUniqueRevenue(snapshot.docs);

    return NextResponse.json({
      imei,
      stationCode,
      totalRevenueMonthly: total,
      totalRentalsThisMonth: count,
      month: monthKey,
    });
  } catch (error: any) {
    console.error('❌ Error calculating monthly revenue:', error);
    return NextResponse.json({ error: 'Failed to calculate monthly revenue ❌' }, { status: 500 });
  }
}
