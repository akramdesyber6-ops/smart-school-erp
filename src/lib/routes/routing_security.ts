/** Centralized authentication navigation rules. */

export type ApplicationRole = 'admin' | 'school_admin' | 'super_admin' | 'teacher' | 'student' | 'parent';

export type RouteContext = {
  pathname: string;
};

type RoleRoute = {
  roles: readonly ApplicationRole[];
  target: string;
  routes: readonly string[];
  exactRoutes?: readonly string[];
};

const APPLICATION_ROLES: readonly ApplicationRole[] = [
  'admin',
  'school_admin',
  'super_admin',
  'teacher',
  'student',
  'parent',
];

const PUBLIC_ROUTE_PREFIXES = ['/', '/login', '/forgot-password', '/signup'];

const ROLE_ROUTES: readonly RoleRoute[] = [
  {
    roles: ['admin', 'school_admin', 'super_admin'],
    target: '/admin',
    routes: ['/admin', '/school-admin-dashboard', '/dashboards/school-admin', '/dashboards/admin'],
  },
  {
    roles: ['teacher'],
    target: '/teacher-dashboard',
    routes: ['/teacher-dashboard', '/dashboards/teacher', '/dashboard/marks'],
  },
  {
    roles: ['student'],
    target: '/dashboard',
    routes: ['/student-dashboard', '/dashboards/student'],
    exactRoutes: ['/dashboard'],
  },
  {
    roles: ['parent'],
    target: '/parent-dashboard',
    routes: ['/parent-dashboard', '/dashboards/parent'],
  },
];

export function normalizeRoles(values: unknown): string[] {
  const candidates = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split(',')
      : [];

  return candidates
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some(
    (route) => pathname === route || (route !== '/' && pathname.startsWith(`${route}/`))
  );
}

export function getRoles(payload: Record<string, unknown>): ApplicationRole[] {
  const values = [
    ...normalizeRoles(payload.role),
    ...normalizeRoles(payload.roles),
    ...normalizeRoles(payload['x-hasura-allowed-roles']),
  ];

  return [...new Set(values.filter((role): role is ApplicationRole =>
    APPLICATION_ROLES.includes(role as ApplicationRole)
  ))];
}

export function getDashboardPathForRole(role: unknown): string {
  const normalizedRole = typeof role === 'string' ? role.toLowerCase() : '';
  return ROLE_ROUTES.find((route) => route.roles.includes(normalizedRole as ApplicationRole))?.target ?? '/';
}

function routeForPath(pathname: string): RoleRoute | undefined {
  return ROLE_ROUTES.find((route) =>
    route.routes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    route.exactRoutes?.includes(pathname)
  );
}

export function canAccessRoute(roles: readonly ApplicationRole[], pathname: string): boolean {
  const route = routeForPath(pathname);
  return !route || route.roles.some((role) => roles.includes(role));
}

export async function processSecureRedirects(
  payload: Record<string, unknown> | null,
  context: RouteContext
): Promise<string | null> {
  const { pathname } = context;

  if (!payload) return isPublicRoute(pathname) ? null : '/login';

  const roles = getRoles(payload);
  const primaryRole = roles[0];
  const destination = getDashboardPathForRole(primaryRole);

  if (pathname === '/' || pathname === '/login') {
    return destination === '/' ? null : destination;
  }

  if (!routeForPath(pathname)) return null;
  if (roles.length === 0) return '/login';
  if (!canAccessRoute(roles, pathname)) return destination;

  return null;
}
