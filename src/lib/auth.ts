import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'danab_power_secret_key_2024';
const TOKEN_EXPIRY = '1h';

export interface TokenPayload {
  id: string;
  username: string;
  role: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

export function authenticateRequest(req: NextRequest): TokenPayload | NextResponse {
  const token = getTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: 'Access denied. No token provided.' }, { status: 401 });
  }
  try {
    return verifyToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 403 });
  }
}

export function requireRole(user: TokenPayload, roles: string[]): NextResponse | null {
  if (!roles.includes(user.role)) {
    return NextResponse.json({ error: `${roles[0]} access required.` }, { status: 403 });
  }
  return null;
}
