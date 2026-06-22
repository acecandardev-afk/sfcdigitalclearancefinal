import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { slidingWindowHit } from './src/lib/enterprise/slidingWindow';

/** In-process limiter (single Node instance). For multi-node production, use Redis / edge KV. */
const hits = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_CREDENTIAL_POSTS = 45;

export function middleware(request: NextRequest) {
  if (request.method !== 'POST') {
    return NextResponse.next();
  }
  const { pathname } = request.nextUrl;
  if (!pathname.includes('/api/auth/callback/credentials')) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const now = Date.now();
  const prev = hits.get(ip) ?? [];
  const { allowed, next } = slidingWindowHit(prev, now, MAX_CREDENTIAL_POSTS, WINDOW_MS);
  hits.set(ip, next);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/auth/:path*'],
};
