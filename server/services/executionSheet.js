import ExcelJS from 'exceljs';

/** Sheet columns in display order. `repeat` is the student's repetition of the new memorization. */
export const EXECUTION_SHEET_COLUMNS = Object.freeze([
  { key: 'repeat', label: 'التكرار', taskType: 'memorization' },
  { key: 'link', label: 'الربط', taskType: 'link' },
  { key: 'review', label: 'المراجعة', taskType: 'review' },
]);

export const EXECUTION_SHEET_CELL_POINTS = 10;
export const EXECUTION_SHEET_TASMEE_POINTS = 10;

const WEEK_DAY_LABELS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ATTENDANCE_LABELS = { present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'مستأذن' };
const ATTENDED_STATUSES = new Set(['present', 'late']);

const columnForTaskType = (taskType) => EXECUTION_SHEET_COLUMNS.find((column) => column.taskType === taskType)?.key || null;

const weekDayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

const addDays = (date, days) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const weekDayLabel = (date) => WEEK_DAY_LABELS[weekDayOf(date)] || '';

export const EXECUTION_SHEET_MAX_DAYS = 62;

/** List the study days from `from` to `to`, skipping weekly holidays and marking session days. */
export function getExecutionSheetDays(from, to, { holidayDays = [], sessionDays = [] } = {}) {
  const holidays = new Set(holidayDays.map(Number));
  const sessions = new Set(sessionDays.map(Number));
  const days = [];
  for (let day = from, count = 0; day <= to && count < EXECUTION_SHEET_MAX_DAYS; day = addDays(day, 1), count += 1) {
    if (holidays.has(weekDayOf(day))) continue;
    days.push({ date: day, label: weekDayLabel(day), isSessionDay: sessions.has(weekDayOf(day)) });
  }
  return days;
}

/** Clamp a requested range: defaults to the last seven days, never past today, at most 62 days. */
export function resolveExecutionSheetRange({ from, to, today, isValidDate }) {
  let end = isValidDate(to) ? String(to) : today;
  if (end > today) end = today;
  let start = isValidDate(from) ? String(from) : addDays(end, -7);
  if (start > end) start = end;
  if (start < addDays(end, -(EXECUTION_SHEET_MAX_DAYS - 1))) start = addDays(end, -(EXECUTION_SHEET_MAX_DAYS - 1));
  return { from: start, to: end };
}

/** Summarise one task group as done, partial or not done, keeping teacher locks. */
function summarizeGroup(groupRows, { studentExecutable }) {
  const done = groupRows.filter((row) => row.studentStatus === 'done');
  const partial = groupRows.some((row) => row.executionState === 'partial');
  let status = 'not_done';
  if (done.length === groupRows.length && !partial) status = 'done';
  else if (done.length > 0 || partial) status = 'partial';
  const teacherLocked = groupRows.some((row) => row.teacherCompleted != null || row.executionActorRole === 'teacher');
  const nazemLocked = Boolean(Number(groupRows[0].nazemManaged)) && groupRows[0].taskType === 'link';
  let lockedReason = '';
  if (!studentExecutable) lockedReason = 'هذه المهمة تُنفَّذ في جلسة التسميع.';
  else if (teacherLocked) lockedReason = 'اعتُمدت المهمة في جلسة التسميع ولا يمكن تعديل تنفيذ الطالب.';
  else if (nazemLocked) lockedReason = 'الربط مرتبط بناظم ويُعدّل من ناظم.';
  return {
    key: `${groupRows[0].planId}:${groupRows[0].taskType}:${groupRows[0].track}`,
    taskIds: groupRows.map((row) => Number(row.id)),
    taskType: groupRows[0].taskType,
    track: groupRows[0].track,
    status,
    canEdit: !lockedReason,
    lockedReason,
  };
}

/** Combine every group of a column into one cell; a cell is done only when all its groups are done. */
function summarizeCell(groups) {
  if (!groups.length) return null;
  let status = 'partial';
  if (groups.every((group) => group.status === 'done')) status = 'done';
  else if (groups.every((group) => group.status === 'not_done')) status = 'not_done';
  return {
    status,
    groups,
    canEdit: groups.every((group) => group.canEdit),
    lockedReason: groups.find((group) => group.lockedReason)?.lockedReason || '',
  };
}

const cellPoints = (cell) => {
  if (!cell) return 0;
  if (cell.status === 'done') return EXECUTION_SHEET_CELL_POINTS;
  if (cell.status === 'partial') return EXECUTION_SHEET_CELL_POINTS / 2;
  return 0;
};

const roundScore = (value) => Math.round(value * 100) / 100;

/** Convert the teacher's session evaluation to a mark out of ten. */
function tasmeeMark(evaluation) {
  const max = Number(evaluation?.maxScore || 0);
  if (!(max > 0)) return null;
  const score = Math.min(max, Math.max(0, Number(evaluation.score || 0)));
  return roundScore((score / max) * EXECUTION_SHEET_TASMEE_POINTS);
}

/**
 * Build one sheet row per student for a single day.
 * The total counts only what was required: assigned task cells, plus the tasmee on a session day
 * unless the student was excused.
 */
export function buildExecutionSheetRows({ students, tasks, attendance, evaluations, isSessionDay, canStudentExecute }) {
  const tasksByStudent = new Map();
  for (const task of tasks) {
    const studentId = Number(task.studentId);
    if (!tasksByStudent.has(studentId)) tasksByStudent.set(studentId, []);
    tasksByStudent.get(studentId).push(task);
  }
  const attendanceByStudent = new Map(attendance.map((row) => [Number(row.studentId), row.status]));
  const evaluationByStudent = new Map(evaluations.map((row) => [Number(row.studentId), row]));

  return students.map((student) => {
    const studentId = Number(student.id);
    const groups = new Map();
    for (const task of tasksByStudent.get(studentId) || []) {
      if (!columnForTaskType(task.taskType)) continue;
      const key = `${task.planId}:${task.taskType}:${task.track}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(task);
    }
    const cells = Object.fromEntries(EXECUTION_SHEET_COLUMNS.map((column) => [column.key, []]));
    for (const groupRows of groups.values()) {
      const taskType = groupRows[0].taskType;
      cells[columnForTaskType(taskType)].push(summarizeGroup(groupRows, {
        studentExecutable: canStudentExecute(taskType),
      }));
    }
    const columns = Object.fromEntries(Object.entries(cells).map(([key, list]) => [key, summarizeCell(list)]));

    const attendanceStatus = isSessionDay ? (attendanceByStudent.get(studentId) || null) : 'no_session';
    const tasmee = isSessionDay ? tasmeeMark(evaluationByStudent.get(studentId)) : null;
    const tasmeeRequired = isSessionDay && attendanceStatus !== 'excused'
      && (tasmee !== null || attendanceStatus !== null);

    const assigned = EXECUTION_SHEET_COLUMNS.filter((column) => columns[column.key]);
    const total = roundScore(assigned.reduce((sum, column) => sum + cellPoints(columns[column.key]), 0)
      + (tasmeeRequired ? Number(tasmee || 0) : 0));
    const max = assigned.length * EXECUTION_SHEET_CELL_POINTS + (tasmeeRequired ? EXECUTION_SHEET_TASMEE_POINTS : 0);

    return {
      studentId,
      name: student.name,
      committeeId: student.committeeId == null ? null : Number(student.committeeId),
      committeeName: student.committeeName || '',
      attendance: attendanceStatus,
      attended: ATTENDED_STATUSES.has(attendanceStatus),
      tasmee,
      columns,
      total,
      max,
    };
  });
}

const cellText = (cell) => {
  if (!cell) return '—';
  if (cell.status === 'done') return '✓';
  if (cell.status === 'partial') return 'جزئي';
  return '✗';
};

const attendanceText = (status) => {
  if (status === 'no_session') return '—';
  return ATTENDANCE_LABELS[status] || '—';
};

/** Build a week workbook that mirrors the on-screen sheet: names on the right, one block per day. */
export async function buildExecutionSheetWorkbook({ title, subtitle, days, creator }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = creator || '';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('متابعة التنفيذ', { views: [{ rightToLeft: true, state: 'frozen', xSplit: 1, ySplit: 4 }] });
  const dayColumns = ['الحضور', 'التسميع', ...EXECUTION_SHEET_COLUMNS.map((column) => column.label), 'المجموع'];
  const width = 1 + days.length * dayColumns.length;

  sheet.mergeCells(1, 1, 1, width);
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { bold: true, size: 16 };
  sheet.mergeCells(2, 1, 2, width);
  sheet.getCell(2, 1).value = subtitle;
  sheet.getCell(2, 1).font = { size: 11, color: { argb: 'FF555555' } };

  sheet.mergeCells(3, 1, 4, 1);
  sheet.getCell(3, 1).value = 'الاسم';
  sheet.getColumn(1).width = 24;

  const names = new Map();
  days.forEach((day) => day.rows.forEach((row) => names.set(row.studentId, row.name)));
  const studentIds = [...names.keys()].sort((a, b) => String(names.get(a)).localeCompare(String(names.get(b)), 'ar'));

  days.forEach((day, dayIndex) => {
    const firstColumn = 2 + dayIndex * dayColumns.length;
    sheet.mergeCells(3, firstColumn, 3, firstColumn + dayColumns.length - 1);
    sheet.getCell(3, firstColumn).value = `${day.label} ${day.date}`;
    dayColumns.forEach((label, offset) => {
      sheet.getCell(4, firstColumn + offset).value = label;
      sheet.getColumn(firstColumn + offset).width = offset === 0 ? 10 : 9;
    });
    const rowsById = new Map(day.rows.map((row) => [row.studentId, row]));
    studentIds.forEach((studentId, index) => {
      const row = rowsById.get(studentId);
      const excelRow = 5 + index;
      if (!row) return;
      const values = [
        attendanceText(row.attendance),
        row.tasmee === null ? '—' : row.tasmee,
        ...EXECUTION_SHEET_COLUMNS.map((column) => cellText(row.columns[column.key])),
        row.max > 0 ? `${row.total} / ${row.max}` : '—',
      ];
      values.forEach((value, offset) => {
        sheet.getCell(excelRow, firstColumn + offset).value = value;
      });
    });
  });

  studentIds.forEach((studentId, index) => {
    sheet.getCell(5 + index, 1).value = names.get(studentId);
  });

  const lastRow = 4 + studentIds.length;
  for (let rowNumber = 3; rowNumber <= lastRow; rowNumber += 1) {
    for (let column = 1; column <= width; column += 1) {
      const cell = sheet.getCell(rowNumber, column);
      cell.alignment = { horizontal: column === 1 && rowNumber > 4 ? 'right' : 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBBD7DD' } },
        bottom: { style: 'thin', color: { argb: 'FFBBD7DD' } },
        left: { style: 'thin', color: { argb: 'FFBBD7DD' } },
        right: { style: 'thin', color: { argb: 'FFBBD7DD' } },
      };
      if (rowNumber <= 4) {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber === 3 ? 'FF0787A6' : 'FF08A9CE' } };
      }
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
