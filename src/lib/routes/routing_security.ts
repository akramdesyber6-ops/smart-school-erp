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
export async function processSecureRedirects(
  payload: JWTPayload | Record<string, any> | null,
  context: RouteContext
): Promise<string | null | undefined> {
  // If no payload (unauthenticated), redirect to login for protected routes
  if (!payload) {
    // Allow public routes like /login, /forgot-password, etc.
    const publicRoutes = ['/login', '/forgot-password', '/signup'];
    if (publicRoutes.some((route) => context.pathname.startsWith(route))) {
      return null; // Allow access to public routes
    }
    return '/login'; // Redirect to login for all other routes
  }

  // Extract roles from payload (try multiple common patterns)
  const roles = (payload?.role || payload?.roles || payload?.['x-hasura-allowed-roles'] || []) as string[];

  // If authenticated, check role-based routing
  // Example: admins go to /admin, teachers to /teacher-dashboard, students to /dashboard
  if (roles.includes('admin')) {
    if (!context.pathname.startsWith('/admin')) {
      return '/admin';
    }
  } else if (roles.includes('teacher')) {
    if (!context.pathname.startsWith('/teacher-dashboard')) {
      return '/teacher-dashboard';
    }
  } else if (roles.includes('student')) {
    if (!context.pathname.startsWith('/dashboard')) {
      return '/dashboard';
    }
  }

  // Default: no redirect needed, allow the request
  return null;
}
