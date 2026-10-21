/** Centralized authentication navigation rules. */

export type ApplicationRole = 'admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

export type RouteContext = {
  pathname: string;
};

const PUBLIC_ROUTE_PREFIXES = ['/', '/login', '/forgot-password', '/signup'];
const ROLE_RESTRICTED_ROUTES: ReadonlyArray<{ prefix: string; allowedRoles: readonly ApplicationRole[] }> = [
  { prefix: '/dashboards/school-admin', allowedRoles: ['admin', 'school_admin'] },
  { prefix: '/dashboards/teacher', allowedRoles: ['admin', 'teacher'] },
  { prefix: '/dashboards/student', allowedRoles: ['student'] },
  { prefix: '/dashboards/parent', allowedRoles: ['parent'] },
];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some(
    (route) => pathname === route || (route !== '/' && pathname.startsWith(`${route}/`))
  );
}

export function getDashboardPathForRole(role: unknown): string {
  if (role === 'admin' || role === 'school_admin') return '/dashboards/school-admin';
  if (role === 'teacher') return '/dashboards/teacher';
  if (role === 'student') return '/dashboards/student';
  if (role === 'parent') return '/dashboards/parent';

  return '/';
}

export function getRoles(payload: Record<string, unknown>): ApplicationRole[] {
  const roleClaims = [payload.role, payload.roles, payload['x-hasura-allowed-roles']];
  const applicationRoles: ApplicationRole[] = ['admin', 'school_admin', 'teacher', 'student', 'parent'];

  return roleClaims.flatMap((claim) => {
    const values = Array.isArray(claim) ? claim : typeof claim === 'string' ? [claim] : [];
    return values.filter((value): value is ApplicationRole => applicationRoles.includes(value as ApplicationRole));
  });
}

export function canAccessRoute(roles: readonly ApplicationRole[], pathname: string): boolean {
  const restriction = ROLE_RESTRICTED_ROUTES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  return !restriction || restriction.allowedRoles.some((role) => roles.includes(role));
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
