import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { authenticateRequest, requireRole, TokenPayload } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ['user', 'moderator', 'admin']);
  if (roleCheck) return roleCheck;

  try {
    const stationsSnap = await db.collection('stations').get();

    if (stationsSnap.empty) {
      return NextResponse.json({ error: 'No stations found ❌' }, { status: 404 });
    }

    const stations = stationsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        imei: data.imei || '',
        name: data.name || 'Unnamed Station',
        iccid: data.iccid || 'Unknown',
        location: data.location || 'Not Set',
        totalSlots: data.totalSlots || 0,
      };
    });

    return NextResponse.json({ stations });
  } catch (error: any) {
    console.error('❌ Error fetching basic station info:', error.message);
    return NextResponse.json({ error: 'Failed to fetch station basics ❌' }, { status: 500 });
  }
}
