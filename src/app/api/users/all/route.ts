import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { authenticateRequest, requireRole, TokenPayload } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ['admin']);
  if (roleCheck) return roleCheck;

  try {
    const snapshot = await db.collection('system_users').get();
    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json(users);
  } catch (err: any) {
    console.error('Fetch all users error:', err);
    return NextResponse.json({ error: 'Failed to fetch users ❌' }, { status: 500 });
  }
}
