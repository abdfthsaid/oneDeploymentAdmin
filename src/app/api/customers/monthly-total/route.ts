import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { admin } from '@/lib/firebase-admin';
import { authenticateRequest, requireRole, TokenPayload } from '@/lib/auth';
import { getMonthBoundsUTC3 } from '@/lib/timeUtils';

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

    const uniqueCustomers = new Set<string>();
    const stationSet = new Set<string>();
    const uniqueTransactions = new Set<string>();

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const txId = data.transactionId || doc.id;
      if (uniqueTransactions.has(txId)) return;
      uniqueTransactions.add(txId);
      if (data.phoneNumber) uniqueCustomers.add(data.phoneNumber);
      if (data.imei) stationSet.add(data.imei);
    });

    return NextResponse.json({
      month: monthKey,
      totalCustomersThisMonth: uniqueCustomers.size,
      totalRentalsThisMonth: uniqueTransactions.size,
      stations: stationSet.size,
    });
  } catch (err: any) {
    console.error('❌ Monthly-total error:', err);
    return NextResponse.json({ error: 'Failed to fetch monthly totals' }, { status: 500 });
  }
}
