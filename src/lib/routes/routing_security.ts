/**
 * src/lib/routes/routing_security.ts
 * 
 * Centralized routing security logic for both server-side middleware
 * and client-side login/auth flows.
 */

import type { JWTPayload } from 'jose';

export type RouteContext = {
  pathname: string;
};

/**
 * Process secure redirects based on JWT payload and current route context.
 * 
 * This function is used by both the middleware (server-side) and login page (client-side)
 * to determine where a user should be routed based on their authentication state and roles.
 * 
 * @param payload - Decoded JWT payload (null if unauthenticated)
 * @param context - Current route context (pathname)
 * @returns Redirect path if routing should be enforced, null/undefined otherwise
 */
export function normalizeRoles(values: unknown): string[] {
  if (!values) return [];

  if (Array.isArray(values)) {
    return values.filter((value): value is string => typeof value === 'string').map((value) => value.toLowerCase());
  }

  if (typeof values === 'string') {
    return values
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

export async function processSecureRedirects(
  payload: JWTPayload | Record<string, unknown> | null,
  context: RouteContext
): Promise<string | null | undefined> {
  const { pathname } = context;

  if (!payload) {
    const publicRoutes = ['/', '/login', '/forgot-password', '/signup'];
    if (publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
      return null;
    }
    return '/login';
  }

  const rawRoles = payload['x-hasura-allowed-roles'];
  const role = typeof payload.role === 'string' ? payload.role.toLowerCase() : null;
  const roles = normalizeRoles(payload.roles ?? rawRoles ?? payload.role ?? []);
  const allRoles = new Set([role, ...roles].filter(Boolean) as string[]);

  const roleRoutes = [
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
      routes: ['/dashboard', '/student-dashboard', '/dashboards/student'],
    },
    {
      roles: ['parent'],
      target: '/parent-dashboard',
      routes: ['/parent-dashboard', '/dashboards/parent'],
    },
  ];

  const dashboardPaths = roleRoutes.flatMap((entry) => entry.routes);
  const isDashboardPath = dashboardPaths.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const selectedRole = roleRoutes.find((entry) => entry.roles.some((name) => allRoles.has(name)));
  if (!selectedRole) return isDashboardPath ? '/login' : null;

  const isMarksEntryPath = pathname === '/dashboard/marks' || pathname.startsWith('/dashboard/marks/');
  const isOwnDashboardPath =
    selectedRole.routes.some((route) => pathname === route || pathname.startsWith(`${route}/`)) &&
    !(isMarksEntryPath && selectedRole.target !== '/teacher-dashboard');

  if (pathname === '/' || pathname === '/login') return selectedRole.target;
  if (isDashboardPath && !isOwnDashboardPath) return selectedRole.target;

  return null;
}
