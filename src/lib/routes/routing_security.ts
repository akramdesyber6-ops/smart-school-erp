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
function normalizeRoles(values: unknown): string[] {
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
  payload: JWTPayload | Record<string, any> | null,
  context: RouteContext
): Promise<string | null | undefined> {
  // If no payload (unauthenticated), redirect to login for protected routes
  if (!payload) {
    // Allow public routes like /login, /forgot-password, etc.
    const publicRoutes = ['/login', '/forgot-password', '/signup'];
    if (publicRoutes.some((route) => context.pathname.startsWith(route))) {
      return null;
    }
    return '/login';
  }

  const role = typeof payload.role === 'string' ? payload.role.toLowerCase() : null;
  const roles = normalizeRoles(payload.roles ?? payload['x-hasura-allowed-roles'] ?? payload.role ?? []);
  const allRoles = new Set([role, ...roles].filter(Boolean) as string[]);

  if (allRoles.has('admin') || allRoles.has('school_admin') || allRoles.has('super_admin')) {
    const target = '/admin';
    const isAllowed =
      context.pathname === '/admin' ||
      context.pathname.startsWith('/admin/') ||
      context.pathname === '/school-admin-dashboard' ||
      context.pathname.startsWith('/school-admin-dashboard/') ||
      context.pathname.startsWith('/dashboards/school-admin') ||
      context.pathname.startsWith('/dashboards/admin');
    if (!isAllowed) return target;
    return null;
  }

  if (allRoles.has('teacher')) {
    const target = '/teacher-dashboard';
    const isAllowed =
      context.pathname === '/teacher-dashboard' ||
      context.pathname.startsWith('/teacher-dashboard/') ||
      context.pathname.startsWith('/dashboards/teacher');
    if (!isAllowed) return target;
    return null;
  }

  if (allRoles.has('student')) {
    const target = '/dashboard';
    const isAllowed =
      context.pathname === '/dashboard' ||
      context.pathname.startsWith('/dashboard/') ||
      context.pathname === '/student-dashboard' ||
      context.pathname.startsWith('/student-dashboard/') ||
      context.pathname.startsWith('/dashboards/student');
    if (!isAllowed) return target;
    return null;
  }

  if (allRoles.has('parent')) {
    const target = '/parent-dashboard';
    const isAllowed =
      context.pathname === '/parent-dashboard' ||
      context.pathname.startsWith('/parent-dashboard/') ||
      context.pathname.startsWith('/dashboards/parent');
    if (!isAllowed) return target;
    return null;
  }

  return null;
}
