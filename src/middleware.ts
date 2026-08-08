import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessRoute, getDashboardPathForRole, getRoles, isPublicRoute } from '@/lib/routes/routing_security';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res: response });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicRoute(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!user) return response;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  const roles = getRoles({ role: profile?.role });

  if (!canAccessRoute(roles, pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname === '/login') {
    return NextResponse.redirect(new URL(getDashboardPathForRole(roles[0]), request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
