import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { authenticateRequest, requireRole, TokenPayload } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: { imei: string } }) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ['admin']);
  if (roleCheck) return roleCheck;

  try {
    const { imei } = params;
    const stationRef = db.collection('stations').doc(imei);
    const doc = await stationRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Station not found ❌' }, { status: 404 });
    }

    await stationRef.delete();
    return NextResponse.json({ message: 'Station deleted successfully 🗑️✅' });
  } catch (error: any) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete station ❌' }, { status: 500 });
  }
}
