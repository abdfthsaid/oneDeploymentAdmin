import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { admin } from '@/lib/firebase-admin';
import { authenticateRequest, requireRole, TokenPayload } from '@/lib/auth';
import { getMonthBoundsUTC3, calculateUniqueRevenue } from '@/lib/timeUtils';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ['user', 'moderator', 'admin']);
  if (roleCheck) return roleCheck;

  const { startUtc, monthKey } = getMonthBoundsUTC3();

  try {
    const Timestamp = admin.firestore.Timestamp;
    const snapshot = await db
      .collection('rentals')
      .where('timestamp', '>=', Timestamp.fromDate(startUtc))
      .where('status', 'in', ['rented', 'returned'])
      .get();

    const { total, count } = calculateUniqueRevenue(snapshot.docs);

    return NextResponse.json({
      totalRevenueMonthly: total,
      totalRentalsThisMonth: count,
      month: monthKey,
    });
  } catch (error: any) {
    console.error('❌ Error calculating total monthly revenue:', error);
    return NextResponse.json({ error: 'Failed to calculate total monthly revenue ❌' }, { status: 500 });
  }
}
