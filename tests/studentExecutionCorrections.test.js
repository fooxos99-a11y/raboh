import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('execution reminder exclusions are persisted and skipped by the automatic sender', async () => {
  const [server, settings] = await Promise.all([
    readFile(new URL('../server/index.js', import.meta.url), 'utf8'),
    Promise.all(['SettingsSection.jsx', 'NotificationSettings.jsx'].map(name => readFile(new URL('../src/components/dashboard/' + name, import.meta.url), 'utf8'))).then(parts => parts.join('\n')),
  ]);

  assert.match(server, /executionReminderExcludedStudentIds: normalizePositiveIdList/);
  assert.match(server, /VALUES \('executionReminderExcludedStudentIds', \?\)/);
  assert.match(server, /excludedStudentIds\.has\(Number\(row\.studentId\)\)/);
  assert.match(server, /\/api\/settings\/execution-reminder-students/);
  assert.match(settings, /<Label>استثناء طلاب<\/Label>/);
  assert.match(settings, /toggleListValue\('executionReminderExcludedStudentIds', studentId\)/);
  assert.match(settings, /settings\.memorizationExecutionSource/);
});

test('management can correct student execution up to today while preserving later progress', async () => {
  const [server, api, dialog] = await Promise.all([
    readFile(new URL('../server/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/studentsApi.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/dashboard/ExecutionCorrectionDialog.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(server, /app\.get\('\/api\/quran-execution-corrections'/);
  assert.match(server, /!isValidDateOnly\(date\) \|\| date > today/);
  assert.match(server, /first\.taskDate > today/);
  assert.match(server, /administrativeCorrection/);
  assert.match(server, /student_execution_corrected/);
  assert.match(server, /invalidatePendingTasksAfterExecutionCorrection/);
  assert.match(server, /recomputePlanMemorizationCursor/);
  const acceptance = server.slice(server.indexOf('function acceptedMemorizationSql('), server.indexOf('async function normalizePriorMemorizationRanges(')).replaceAll('${prefix}', '');
  assert.match(acceptance, /teacher_completed = 1[\s\S]*teacher_completed IS NULL\s+AND student_status = 'done'/);
  assert.match(server, /const next = await getNextUnmemorizedPlanPosition\(connection, plan\)/);
  assert.match(api, /administrativeCorrection: true/);
  assert.match(dialog, /<DialogContent/);
  assert.match(dialog, /taskIds: task\.taskIds/);
  assert.match(dialog, /RepeatCountSelector/);
  assert.match(dialog, /onSaved\?\.\(\)/);
});

test('execution sheet shows one chosen day with names on the right', async () => {
  const [server, api, sheet] = await Promise.all([
    readFile(new URL('../server/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/studentsApi.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/dashboard/StudentExecutionCorrectionsSection.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(server, /app\.get\('\/api\/quran-execution-corrections\/sheet', requireExecutionSheetAccess/);
  assert.match(server, /app\.get\('\/api\/quran-execution-corrections\/sheet\/export', requireExecutionSheetAccess/);
  assert.match(server, /if \(req\.auth\?\.role === 'supervisor'\) return \{ allowed: true, editable: false/);
  assert.match(server, /DATE_FORMAT\(evaluated_at, '%Y-%m-%d'\) = \?/);
  assert.match(api, /getExecutionSheet:/);
  assert.match(api, /exportExecutionSheet:/);
  assert.match(sheet, />متابعة التنفيذ<\/h2>/);
  assert.match(sheet, /aria-label="اليوم"/);
  assert.match(sheet, /<DashboardDateRange sessionDates=\{false\}/);
  assert.match(sheet, /addDays\(today, -7\)/);
  assert.doesNotMatch(sheet, /aria-label="الحلقة"|aria-label="الأسبوع"/);
  assert.match(sheet, /'جارٍ التصدير\.\.\.' : 'تصدير'/);
  assert.match(sheet, /sticky right-0/);
  assert.match(sheet, /dir="rtl"/);
  assert.match(sheet, /label: 'التكرار'[\s\S]*label: 'الربط'[\s\S]*label: 'المراجعة'/);
  assert.match(sheet, /bg-primary text-primary-foreground/);
  assert.doesNotMatch(sheet, /type="date"/);
});

test('execution sheet page is hidden unless student execution is enabled', async () => {
  const [dashboard, routes] = await Promise.all([
    readFile(new URL('../src/pages/WajehDashboard.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/sectionRoutes.js', import.meta.url), 'utf8'),
  ]);

  assert.match(dashboard, /key: 'studentExecutionCorrections'[\s\S]*label: 'متابعة التنفيذ'[\s\S]*permissionKey: 'studentPlans'/);
  assert.doesNotMatch(dashboard, /تصحيح تنفيذ الطلاب/);
  assert.match(dashboard, /section\.key === 'studentExecutionCorrections' && settings\.hasStudentQuranExecution === false/);
  assert.match(dashboard, /case 'studentExecutionCorrections':[\s\S]*<StudentExecutionCorrectionsSection/);
  assert.match(routes, /\['studentExecutionCorrections', 'execution-followup'\]/);
});
