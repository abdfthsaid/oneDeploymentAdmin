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
    const { username, password, role, email } = await req.json();

    if (!username || !password || !role || !email) {
      return NextResponse.json(
        { error: 'username, password, role, and email are required ❌' },
        { status: 400 }
      );
    }

    if (!['admin', 'moderator', 'user'].includes(role)) {
      return NextResponse.json(
        { error: "Role must be 'admin', 'moderator', or 'user' ❌" },
        { status: 400 }
      );
    }

    const usernameSnap = await db.collection('system_users').where('username', '==', username).get();
    if (!usernameSnap.empty) {
      return NextResponse.json({ error: 'Username already exists ❌' }, { status: 409 });
    }

    const emailSnap = await db.collection('system_users').where('email', '==', email).get();
    if (!emailSnap.empty) {
      return NextResponse.json({ error: 'Email already exists ❌' }, { status: 409 });
    }

    const newUserRef = await db.collection('system_users').add({
      username,
      password,
      role,
      email,
      createdAt: new Date(),
    });

    cacheComponent.invalidatePrefix('users:');

    return NextResponse.json({ message: 'User added ✅', id: newUserRef.id }, { status: 201 });
  } catch (error: any) {
    console.error('Add user error:', error);
    return NextResponse.json({ error: 'Failed to add user ❌' }, { status: 500 });
  }
}
