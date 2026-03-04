import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { authenticateRequest, requireRole, TokenPayload } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { imei: string } }) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ['admin']);
  if (roleCheck) return roleCheck;

  try {
    const { imei } = params;
    const updates = await req.json();

    const stationRef = db.collection('stations').doc(imei);
    const doc = await stationRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Station not found ❌' }, { status: 404 });
    }

    await stationRef.update({ ...updates, updatedAt: new Date() });
    return NextResponse.json({ message: 'Station updated successfully ✅' });
  } catch (error: any) {
    console.error('Update Error:', error);
    return NextResponse.json({ error: 'Failed to update station ❌' }, { status: 500 });
  }
}
