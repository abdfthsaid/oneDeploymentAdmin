import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { imei: string } }) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { imei } = params;
    const doc = await db.collection('station_stats').doc(imei).get();

    if (!doc.exists) {
      return NextResponse.json({ error: `No stats found for station ${imei}` }, { status: 404 });
    }

    return NextResponse.json({ station: doc.data() });
  } catch (err: any) {
    console.error(`Get Station Stats Error:`, err.message);
    return NextResponse.json({ error: 'Failed to fetch station stats' }, { status: 500 });
  }
}
