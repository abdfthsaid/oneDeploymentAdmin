import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/firebase-admin';
import { authenticateRequest, requireRole, TokenPayload } from '@/lib/auth';
import { cacheComponent } from '@/lib/cacheComponent';

export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const roleCheck = requireRole(auth as TokenPayload, ['admin']);
  if (roleCheck) return roleCheck;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const username = searchParams.get('username');

    if (!id && !username) {
      return NextResponse.json(
        { error: "Provide 'id' or 'username' to delete user ❌" },
        { status: 400 }
      );
    }

    if (id) {
      const docRef = db.collection('system_users').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return NextResponse.json({ error: 'User not found ❌' }, { status: 404 });
      }
      await docRef.delete();
    } else {
      const snap = await db.collection('system_users').where('username', '==', username).limit(1).get();
      if (snap.empty) {
        return NextResponse.json({ error: 'User not found ❌' }, { status: 404 });
      }
      await snap.docs[0].ref.delete();
    }

    cacheComponent.invalidatePrefix('users:');
    return NextResponse.json({ message: 'User deleted successfully ✅' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user ❌' }, { status: 500 });
  }
}
