import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, JWTPayload } from 'jose';
import { processSecureRedirects } from '@/lib/routes/routing_security';

// Environment variable used to verify Supabase JWTs. Must be set in your deployment.
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_JWT_SECRET || '';

async function verifyJwtToken(token: string): Promise<{ payload: JWTPayload } | null> {
  if (!token || !SUPABASE_JWT_SECRET) return null;
  try {
    const encoder = new TextEncoder();
    const { payload } = await jwtVerify(token, encoder.encode(SUPABASE_JWT_SECRET));
    return { payload };
  } catch (err) {
    // verification failed
    return null;
  }
}

function getTokenFromRequest(req: NextRequest): string | null {
  // Try common Supabase cookie/localStorage keys that may contain the JWT for SSR/edge contexts.
  // The exact cookie name depends on your Supabase helpers/version and configuration.
  const cookieCandidates = ['supabase-auth-token', 'sb:token', 'sb-access-token', 'sb:session'];
  for (const name of cookieCandidates) {
    const cookie = req.cookies.get(name);
    if (cookie?.value) return cookie.value;
  }

  // Also check Authorization header if present (Bearer <token>)
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') return parts[1];
  }

  return null;
}

export async function middleware(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);

    // If no token, redirect to login immediately (but allow public routes as defined by processSecureRedirects)
    if (!token) {
      // Let processSecureRedirects decide where public users should go. If it returns a redirect, use it.
      try {
        const redirect = await processSecureRedirects(null, { pathname: req.nextUrl.pathname });
        if (redirect) return NextResponse.redirect(new URL(redirect, req.url));
      } catch (e) {
        // fallback: send to /login
        const loginUrl = new URL('/login', req.url);
        return NextResponse.redirect(loginUrl);
      }

      // default redirect
      const loginUrl = new URL('/login', req.url);
      return NextResponse.redirect(loginUrl);
    }

    const result = await verifyJwtToken(token);
    if (!result) {
      const loginUrl = new URL('/login', req.url);
      return NextResponse.redirect(loginUrl);
    }

    const payload = result.payload as Record<string, any>;

    // Call into your routing security helper with the verified jwt payload to determine routing behavior.
    // processSecureRedirects is expected to accept the user's claims (or null) and return a redirect path if needed.
    try {
      const redirect = await processSecureRedirects(payload, { pathname: req.nextUrl.pathname });
      if (redirect) return NextResponse.redirect(new URL(redirect, req.url));
    } catch (e) {
      // If the helper throws, block by redirecting to login.
      const loginUrl = new URL('/login', req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Allow the request to proceed
    return NextResponse.next();
  } catch (error) {
    // Any unexpected error should result in a conservative redirect to login
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  // Run middleware on all routes except Next internals and static files.
  matcher: [
    '/((?!_next/static|_next/image|api|favicon.ico).*)'
  ]
};
