import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const server = await readFile(new URL('../server/index.js', import.meta.url), 'utf8');
function loadFunction(name, bindings = {}) {
  const source = server.match(new RegExp(`async function ${name}\\([^]*?^}`, 'm'))?.[0];
  assert.ok(source, `${name} exists`);
  return vm.runInNewContext(`(${source})`, bindings);
}

for (const role of ['admin', 'supervisor', 'reciter']) {
  test(`${role} can record manual attendance only with its permission`, async () => {
    for (const allowed of [true, false]) {
      const canUseManualAttendance = loadFunction('canUseManualAttendance', {
        hasSupervisorDashboardPermission: async (id, permission) => {
          assert.equal(id, 17);
          assert.equal(permission, 'manualAttendance');
          return allowed;
        },
      });
      assert.equal(await canUseManualAttendance({ auth: { role, id: 17 } }), allowed);
    }
  });
}

test('manager retains access while students and unknown roles cannot request manual attendance', async () => {
  const canUseManualAttendance = loadFunction('canUseManualAttendance');
  assert.equal(await canUseManualAttendance({ auth: { role: 'manager' } }), true);
  for (const role of ['student', 'unknown', undefined]) {
    assert.equal(await canUseManualAttendance({ auth: { role } }), false);
  }
});

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('authorized administrative attendance works with self attendance disabled', async () => {
  const req = { auth: { role: 'admin', id: 17 }, body: { mode: 'manual' } };
  const canUseManualAttendance = loadFunction('canUseManualAttendance', { hasSupervisorDashboardPermission: async () => true });
  const reject = loadFunction('rejectDisabledAttendanceMode');
  assert.equal(await reject({ req, res: response(), manualMode: await canUseManualAttendance(req), teacherMode: false,
    settings: { attendanceManualEnabled: true, attendanceAccountEnabled: false } }), null);
});

test('unauthorized manual attendance cannot fall back to enabled self attendance', async () => {
  const res = response();
  const reject = loadFunction('rejectDisabledAttendanceMode', { permissionDenied: (reply) => reply.status(403).json({ message: 'denied' }) });
  await reject({ req: { body: { mode: 'manual' } }, res, manualMode: false, teacherMode: false,
    settings: { attendanceManualEnabled: true, attendanceAccountEnabled: true } });
  assert.equal(res.statusCode, 403);
});

test('manual settings and assigned-student restrictions remain enforced', async () => {
  const reject = loadFunction('rejectDisabledAttendanceMode', { hasSupervisorStudentPlanAccess: async () => false });
  for (const role of ['admin', 'supervisor']) {
    const res = response();
    await reject({ req: { auth: { role }, params: { id: 10 }, body: { mode: 'manual' } }, res,
      manualMode: true, teacherMode: false, settings: { attendanceManualEnabled: role === 'supervisor' } });
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, role === 'supervisor' ? /طلاب حلقاتك/ : /التحضير اليدوي معطل/);
  }
});
