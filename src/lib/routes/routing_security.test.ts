import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAccessRoute,
  getDashboardPathForRole,
  getRoles,
  isPublicRoute,
  processSecureRedirects,
  type ApplicationRole,
} from './routing_security';

test('known roles map only to their existing dashboards', () => {
  assert.equal(getDashboardPathForRole('admin'), '/dashboards/school-admin');
  assert.equal(getDashboardPathForRole('school_admin'), '/dashboards/school-admin');
  assert.equal(getDashboardPathForRole('teacher'), '/dashboards/teacher');
  assert.equal(getDashboardPathForRole('student'), '/dashboards/student');
  assert.equal(getDashboardPathForRole('parent'), '/dashboards/parent');
  assert.equal(getDashboardPathForRole('bursar'), '/');
  assert.equal(getDashboardPathForRole(undefined), '/');
});

test('route-role policy blocks cross-role dashboard access', () => {
  assert.equal(canAccessRoute(['student'], '/dashboards/student'), true);
  assert.equal(canAccessRoute(['student'], '/dashboards/parent'), false);
  assert.equal(canAccessRoute(['parent'], '/dashboards/student'), false);
  assert.equal(canAccessRoute(['teacher'], '/dashboards/school-admin'), false);
  assert.equal(canAccessRoute(['school_admin'], '/dashboards/school-admin/accounts'), true);
  assert.equal(canAccessRoute(['teacher'], '/dashboards/teacher/attendance'), true);
  assert.equal(canAccessRoute([], '/login'), true);
});

test('public route matching does not accidentally make similarly prefixed routes public', () => {
  assert.equal(isPublicRoute('/'), true);
  assert.equal(isPublicRoute('/login'), true);
  assert.equal(isPublicRoute('/forgot-password/reset'), true);
  assert.equal(isPublicRoute('/dashboards/student'), false);
  assert.equal(isPublicRoute('/login-admin'), false);
});

test('role claims are reduced to recognized application roles', () => {
  const roles = getRoles({
    role: 'student',
    roles: ['parent', 'super_admin', 'teacher'],
    'x-hasura-allowed-roles': ['school_admin', 12, null],
  });
  assert.deepEqual(roles, ['student', 'parent', 'teacher', 'school_admin'] satisfies ApplicationRole[]);
});

test('authenticated users are redirected to role dashboards from login and landing pages', async () => {
  assert.equal(
    await processSecureRedirects({ role: 'student' }, { pathname: '/login' }),
    '/dashboards/student'
  );
  assert.equal(
    await processSecureRedirects({ role: 'parent' }, { pathname: '/' }),
    '/dashboards/parent'
  );
  assert.equal(
    await processSecureRedirects({ role: 'unrecognized' }, { pathname: '/login' }),
    null
  );
});

test('unauthenticated users are redirected away from protected routes', async () => {
  assert.equal(
    await processSecureRedirects(null, { pathname: '/dashboards/teacher' }),
    '/login'
  );
  assert.equal(await processSecureRedirects(null, { pathname: '/login' }), null);
});
