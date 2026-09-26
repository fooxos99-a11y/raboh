import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExecutionSheetRows, buildExecutionSheetWorkbook, getExecutionSheetDays, resolveExecutionSheetRange } from '../server/services/executionSheet.js';

const task = (overrides) => ({
  id: 1, planId: 7, studentId: 1, taskType: 'memorization', track: 'memorization',
  studentStatus: 'pending', executionState: null, executionActorRole: null, teacherCompleted: null, nazemManaged: 0,
  ...overrides,
});

const build = (overrides = {}) => buildExecutionSheetRows({
  students: [{ id: 1, name: 'طالب', committeeId: 3, committeeName: 'حلقة' }],
  tasks: [],
  attendance: [],
  evaluations: [],
  isSessionDay: true,
  canStudentExecute: () => true,
  ...overrides,
})[0];

test('range defaults to the last seven days and never passes today', () => {
  const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  assert.deepEqual(resolveExecutionSheetRange({ today: '2026-09-26', isValidDate }), { from: '2026-09-19', to: '2026-09-26' });
  assert.deepEqual(resolveExecutionSheetRange({ from: '2026-09-30', to: '2026-10-05', today: '2026-09-26', isValidDate }), { from: '2026-09-26', to: '2026-09-26' });
  assert.equal(resolveExecutionSheetRange({ from: '2026-01-01', to: '2026-09-26', today: '2026-09-26', isValidDate }).from, '2026-07-27');
});

test('range days skip holidays and mark session days', () => {
  const days = getExecutionSheetDays('2026-09-19', '2026-09-26', { holidayDays: [5, 6], sessionDays: [0, 3] });
  assert.deepEqual(days.map((day) => day.date), ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24']);
  assert.deepEqual(days.map((day) => day.label), ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']);
  assert.deepEqual(days.filter((day) => day.isSessionDay).map((day) => day.date), ['2026-09-20', '2026-09-23']);
});

test('total counts only required work: assigned cells plus tasmee on a session day', () => {
  const row = build({
    tasks: [
      task({ id: 1, studentStatus: 'done' }),
      task({ id: 2, taskType: 'review', track: 'review', studentStatus: 'done' }),
    ],
    attendance: [{ studentId: 1, status: 'present' }],
    evaluations: [{ studentId: 1, score: 9, maxScore: 10 }],
  });
  assert.equal(row.columns.repeat.status, 'done');
  assert.equal(row.columns.link, null);
  assert.equal(row.tasmee, 9);
  assert.equal(row.total, 29);
  assert.equal(row.max, 30);
});

test('mastery alone fills the repetition column, and partial work counts half', () => {
  const row = build({
    isSessionDay: false,
    tasks: [task({ id: 5, track: 'mastery', studentStatus: 'done', executionState: 'partial' })],
  });
  assert.equal(row.attendance, 'no_session');
  assert.equal(row.tasmee, null);
  assert.equal(row.columns.repeat.status, 'partial');
  assert.equal(row.total, 5);
  assert.equal(row.max, 10);
});

test('excused students are not charged for the tasmee; teacher approval locks the cell', () => {
  const row = build({
    tasks: [task({ teacherCompleted: 1, studentStatus: 'done' })],
    attendance: [{ studentId: 1, status: 'excused' }],
  });
  assert.equal(row.max, 10);
  assert.equal(row.columns.repeat.canEdit, false);
  assert.match(row.columns.repeat.lockedReason, /جلسة التسميع/);
});

test('week workbook is built right-to-left', async () => {
  const buffer = await buildExecutionSheetWorkbook({
    title: 'متابعة التنفيذ',
    subtitle: 'اختبار',
    days: [{ date: '2026-09-20', label: 'الأحد', rows: [build({ tasks: [task({ studentStatus: 'done' })] })] }],
  });
  assert.ok(buffer.length > 1000);
});
