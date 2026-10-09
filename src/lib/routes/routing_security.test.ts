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

    await expect(
      processSecureRedirects({ role: 'admin' }, { pathname: '/admin' })
    ).resolves.toBeNull();

    await expect(
      processSecureRedirects({ role: 'school_admin' }, { pathname: '/school-admin-dashboard' })
    ).resolves.toBeNull();

    await expect(
      processSecureRedirects({ role: 'teacher' }, { pathname: '/teacher-dashboard' })
    ).resolves.toBeNull();
  });

  it('redirects a teacher away from a student dashboard', async () => {
    await expect(
      processSecureRedirects({ role: 'teacher', roles: ['teacher'] }, { pathname: '/dashboards/student' })
    ).resolves.toBe('/teacher-dashboard');
  });

  it('allows teachers but not students on the marks-entry route', async () => {
    await expect(
      processSecureRedirects({ role: 'teacher' }, { pathname: '/dashboard/marks' })
    ).resolves.toBeNull();

    await expect(
      processSecureRedirects({ role: 'student' }, { pathname: '/dashboard/marks' })
    ).resolves.toBe('/dashboard');
  });

  it('allows authenticated users to reach non-dashboard application routes', async () => {
    await expect(
      processSecureRedirects({ role: 'parent' }, { pathname: '/report-card/123' })
    ).resolves.toBeNull();
  });

  it('redirects unauthenticated users away from protected routes', async () => {
    await expect(
      processSecureRedirects(null, { pathname: '/dashboard' })
    ).resolves.toBe('/login');

    await expect(
      processSecureRedirects(null, { pathname: '/login' })
    ).resolves.toBeNull();

    await expect(
      processSecureRedirects(null, { pathname: '/' })
    ).resolves.toBeNull();
  });

  it('does not allow profiles with unknown roles to open role dashboards', async () => {
    await expect(
      processSecureRedirects({ role: 'unknown' }, { pathname: '/dashboards/teacher' })
    ).resolves.toBe('/login');
  });
});
