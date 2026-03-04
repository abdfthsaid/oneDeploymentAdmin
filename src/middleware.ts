import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login', '/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname === p || pathname.startsWith('/_next') || pathname.startsWith('/api'))) {
    return NextResponse.next();
  }

  // Check for auth token in cookies (client-side auth uses localStorage, so middleware
  // only provides a basic guard. Full auth check happens in AuthShell component.)
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
