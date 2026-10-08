import { describe, expect, it } from 'vitest';
import { normalizeRoles, processSecureRedirects } from './routing_security';

describe('normalizeRoles', () => {
  it('normalizes string and array role inputs', () => {
    expect(normalizeRoles('Teacher, Admin')).toEqual(['teacher', 'admin']);
    expect(normalizeRoles(['Student', 'Parent'])).toEqual(['student', 'parent']);
    expect(normalizeRoles(null)).toEqual([]);
  });
});

describe('processSecureRedirects', () => {
  it('keeps authenticated users on their own route', async () => {
    await expect(
      processSecureRedirects({ role: 'student', roles: ['student'] }, { pathname: '/dashboards/student' })
    ).resolves.toBeNull();

    await expect(
      processSecureRedirects({ role: 'parent', roles: ['parent'] }, { pathname: '/parent-dashboard' })
    ).resolves.toBeNull();
  });

  it('redirects a teacher away from a student dashboard', async () => {
    await expect(
      processSecureRedirects({ role: 'teacher', roles: ['teacher'] }, { pathname: '/dashboards/student' })
    ).resolves.toBe('/teacher-dashboard');
  });

  it('redirects unauthenticated users away from protected routes', async () => {
    await expect(
      processSecureRedirects(null, { pathname: '/dashboard' })
    ).resolves.toBe('/login');

    await expect(
      processSecureRedirects(null, { pathname: '/login' })
    ).resolves.toBeNull();
  });
});
