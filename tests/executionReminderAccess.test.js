import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const server = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
const permissions = readFileSync(new URL('../server/services/dashboardPermissions.js', import.meta.url), 'utf8');

function defineFunction(context, source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  const end = source.indexOf('\n}', start) + 2;
  const asyncStart = source.slice(start - 6, start) === 'async ' ? start - 6 : start;
  vm.runInContext(source.slice(asyncStart, end), context);
}

test('execution reminder names pass both API gates only with settings access', async () => {
  for (const role of ['manager', 'admin', 'supervisor', 'reciter', 'student']) {
    for (const granted of [[], ['settings'], ['students']]) {
      const context = vm.createContext({
        getSharedApiAccess: () => ({}), getOwnAccountDeletionAccess: () => false,
        getSupervisorApiAccess: () => ({}), getStudentFeatureApiAccess: () => ({}),
        hasOfflineRecitationAccountAccess: () => false,
        hasSupervisorDashboardPermission: async (_id, keys) => (
          (Array.isArray(keys) ? keys : [keys]).some(key => granted.includes(key))
        ),
        cleanDashboardPermissions: keys => keys,
        requireUndoPermission: () => {},
      });
      for (const name of ['getDashboardPermissionKeysForRequest', 'canAccessDashboardApi', 'authorizeApiRequest']) {
        defineFunction(context, server, name);
      }
      for (const name of ['permissionDenied', 'requirePermission']) defineFunction(context, permissions, name);
      let status = 0;
      const req = { path: '/api/settings/execution-reminder-students', method: 'GET', auth: { role, id: 42 } };
      const res = { status(code) { status = code; return this; }, json() {} };
      await context.authorizeApiRequest(req, res, async error => {
        if (error) throw error;
        await context.requirePermission('settings')(req, res, routeError => {
          if (routeError) throw routeError;
          status = 200;
        });
      });
      const allowed = role === 'manager' || (role !== 'student' && granted.includes('settings'));
      assert.equal(status, allowed ? 200 : 403, `${role}: ${granted.join(',') || 'no permissions'}`);
    }
  }
});

test('the names route retains its settings permission and does not grant unknown settings actions', () => {
  assert.match(server, /app\.get\('\/api\/settings\/execution-reminder-students', requirePermission\('settings'\)/);
  const context = vm.createContext({});
  defineFunction(context, server, 'getDashboardPermissionKeysForRequest');
  for (const [path, method] of [['/api/settings/execution-reminder-students', 'POST'], ['/api/settings/reset-points', 'POST'], ['/api/settings/unknown', 'GET']]) {
    assert.deepEqual(Array.from(context.getDashboardPermissionKeysForRequest({ path, method })), []);
  }
});
