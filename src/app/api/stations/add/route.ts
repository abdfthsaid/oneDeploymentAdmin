import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { authenticateRequest, requireRole, TokenPayload } from '@/lib/auth';
import { cacheComponent } from '@/lib/cacheComponent';

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ['admin']);
  if (roleCheck) return roleCheck;

  try {
    const { imei, name, iccid, location = '', totalSlots = 6 } = await req.json();

    if (!imei || !name || !iccid) {
      return NextResponse.json({ error: 'imei, name, and iccid are required ❌' }, { status: 400 });
    }

    const imeiSnap = await db.collection('stations').where('imei', '==', imei).get();
    if (!imeiSnap.empty) {
      return NextResponse.json({ error: 'Station with this IMEI already exists ❌' }, { status: 409 });
    }

    const nameSnap = await db.collection('stations').where('name', '==', name).get();
    if (!nameSnap.empty) {
      return NextResponse.json({ error: 'Station with this Name already exists ❌' }, { status: 409 });
    }

    const iccidSnap = await db.collection('stations').where('iccid', '==', iccid).get();
    if (!iccidSnap.empty) {
      return NextResponse.json({ error: 'Station with this ICCID already exists ❌' }, { status: 409 });
    }

    await db.collection('stations').doc(imei).set({
      imei,
      name,
      iccid,
      location,
      totalSlots,
      createdAt: new Date(),
    });

    cacheComponent.invalidatePrefix('stations:');
    cacheComponent.invalidate('transactions:latest');

    return NextResponse.json({ message: 'Station added ✅' }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding station:', error);
    return NextResponse.json({ error: 'Failed to add station ❌' }, { status: 500 });
  }
}
