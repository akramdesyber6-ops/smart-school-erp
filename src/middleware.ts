import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { processSecureRedirects } from '@/lib/routes/routing_security';

const PUBLIC_PATHS = new Set(['/', '/login', '/forgot-password', '/signup']);
const ROLE_PATHS = [
  '/admin',
  '/school-admin-dashboard',
  '/dashboards/school-admin',
  '/dashboards/admin',
  '/teacher-dashboard',
  '/dashboards/teacher',
  '/dashboard/marks',
  '/dashboard',
  '/student-dashboard',
  '/dashboards/student',
  '/parent-dashboard',
  '/dashboards/parent',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || [...PUBLIC_PATHS].some((path) => path !== '/' && pathname.startsWith(`${path}/`));
}

function isRolePath(pathname: string): boolean {
  return ROLE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

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
    if (isPublicPath(pathname)) return response;
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 });
    }
    return redirectWithCookies(request, response, '/login');
  }

  const supabase = createMiddlewareClient({
    req: request,
    res: response,
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    if (isPublicPath(pathname)) return response;
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    return redirectWithCookies(request, response, '/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Unable to load role for authenticated request:', profileError.message);
    if (isPublicPath(pathname)) return response;
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unable to verify account access.' }, { status: 503 });
    }
    return redirectWithCookies(request, response, '/login');
  }

  if (!profile || profile.is_active !== true) {
    if (isPublicPath(pathname)) return response;
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'An active school profile is required.' }, { status: 403 });
    }
    return redirectWithCookies(request, response, '/login');
  }

  if (isRolePath(pathname) || isPublicPath(pathname)) {
    const redirectPath = await processSecureRedirects(profile, { pathname });
    if (redirectPath) return redirectWithCookies(request, response, redirectPath);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
