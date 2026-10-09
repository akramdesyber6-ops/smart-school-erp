import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isPublicRoute, processSecureRedirects } from '@/lib/routes/routing_security';

function copyCookies(source: NextResponse, target: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

function redirectWithCookies(request: NextRequest, response: NextResponse, pathname: string): NextResponse {
  return copyCookies(response, NextResponse.redirect(new URL(pathname, request.url)));
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isPublicRoute(pathname)) return response;
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 });
    }
    return redirectWithCookies(request, response, '/login');
  }

  const supabase = createMiddlewareClient({ req: request, res: response });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    if (isPublicRoute(pathname)) return response;
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return copyCookies(response, NextResponse.redirect(loginUrl));
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Unable to load role for authenticated request:', profileError.message);
    if (isPublicRoute(pathname)) return response;
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unable to verify account access.' }, { status: 503 });
    }
    return redirectWithCookies(request, response, '/login');
  }

  if (!profile || profile.is_active !== true) {
    if (isPublicRoute(pathname)) return response;
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'An active school profile is required.' }, { status: 403 });
    }
    return redirectWithCookies(request, response, '/login');
  }

  const redirectPath = await processSecureRedirects(profile, { pathname });
  if (redirectPath) return redirectWithCookies(request, response, redirectPath);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
