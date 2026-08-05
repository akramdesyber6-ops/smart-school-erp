/** Centralized authentication navigation rules. */

export type ApplicationRole = 'admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

export type RouteContext = {
  pathname: string;
};

const PUBLIC_ROUTE_PREFIXES = ['/', '/login', '/forgot-password', '/signup'];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some(
    (route) => pathname === route || (route !== '/' && pathname.startsWith(`${route}/`))
  );
}

export function getDashboardPathForRole(role: unknown): string {
  if (role === 'admin' || role === 'school_admin') return '/dashboards/school-admin';
  if (role === 'teacher') return '/dashboards/teacher';

  // Student and parent portals are not implemented yet. Keep them on the public
  // landing page instead of navigating them to a route that does not exist.
  return '/';
}

function getRoles(payload: Record<string, unknown>): string[] {
  const roleClaims = [payload.role, payload.roles, payload['x-hasura-allowed-roles']];
  return roleClaims.flatMap((claim) => (Array.isArray(claim) ? claim : typeof claim === 'string' ? [claim] : []));
}

export async function processSecureRedirects(
  payload: Record<string, unknown> | null,
  context: RouteContext
): Promise<string | null> {
  if (!payload) return isPublicRoute(context.pathname) ? null : '/login';

  const destination = getDashboardPathForRole(getRoles(payload)[0]);
  if (context.pathname === '/' || context.pathname === '/login') return destination === '/' ? null : destination;

  return null;
}
