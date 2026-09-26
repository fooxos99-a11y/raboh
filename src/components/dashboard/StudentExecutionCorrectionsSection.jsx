import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, FileSpreadsheet, Lock, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DashboardLoader from '@/components/dashboard/DashboardLoader';
import DashboardDateRange from '@/components/dashboard/DashboardDateRange';
import ExecutionCorrectionDialog from '@/components/dashboard/ExecutionCorrectionDialog';
import { studentsApi } from '@/services/studentsApi';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getBusinessDate } from '../../../shared/business-date.js';

const sheetColumns = [
  { key: 'repeat', label: 'التكرار' },
  { key: 'link', label: 'الربط' },
  { key: 'review', label: 'المراجعة' },
];

const attendanceOptions = [
  { key: 'present', label: 'حاضر' },
  { key: 'late', label: 'متأخر' },
  { key: 'absent', label: 'غائب' },
  { key: 'excused', label: 'مستأذن' },
];

const attendanceLabel = (status) => attendanceOptions.find((option) => option.key === status)?.label || '';

const addDays = (date, days) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const formatScore = (value) => {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2)));
};

const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** One task cell: done, partial, not done or not assigned, using the site colour for every state. */
const TaskCell = ({ cell, label, studentName, editable, saving, onToggle }) => {
  if (!cell) {
    return <span className="text-muted-foreground" aria-label={`${label}: غير مطلوب`}>—</span>;
  }
  const locked = !editable || !cell.canEdit;
  const title = cell.lockedReason || (cell.status === 'partial' ? 'تنفيذ جزئي — اضغط الاسم للتفاصيل' : '');
  return (
    <button
      type="button"
      disabled={locked || saving}
      onClick={onToggle}
      title={title}
      aria-label={`${label} ${studentName}`}
      aria-pressed={cell.status === 'done'}
      className={cn(
        'relative mx-auto flex h-7 w-7 items-center justify-center rounded-md border-2 transition-colors',
        cell.status === 'done' && 'border-primary bg-primary text-primary-foreground',
        cell.status === 'partial' && 'border-primary bg-primary/20 text-primary',
        cell.status === 'not_done' && 'border-primary/40 bg-card text-transparent',
        !locked && 'hover:border-primary hover:shadow-sm',
        locked && !editable && 'cursor-default',
        locked && editable && 'opacity-60',
        saving && 'animate-pulse',
      )}
    >
      {cell.status === 'done' && <Check className="h-4 w-4" strokeWidth={3} />}
      {cell.status === 'partial' && <Minus className="h-4 w-4" strokeWidth={3} />}
      {locked && editable && cell.canEdit === false && (
        <Lock className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-card text-primary" />
      )}
    </button>
  );
};

const totalClassName = (row) => {
  if (!row.max) return 'text-muted-foreground';
  if (row.total >= row.max) return 'bg-primary text-primary-foreground';
  if (row.total > 0) return 'bg-primary/15 text-primary';
  return 'bg-muted text-muted-foreground';
};

/**
 * «متابعة التنفيذ»: one day of the week at a time, names on the right like the paper sheet.
 * Management edits cells directly; teachers see their own circles read-only.
 */
const StudentExecutionCorrectionsSection = ({ teacherScoped = false, canEditAttendance = false }) => {
  const { toast } = useToast();
  const today = useMemo(() => getBusinessDate(new Date()), []);
  const [fromDate, setFromDate] = useState(() => addDays(today, -7));
  const [toDate, setToDate] = useState(today);
  const [date, setDate] = useState(today);
  const [sheet, setSheet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingKeys, setPendingKeys] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [detail, setDetail] = useState(null);

  const loadSheet = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setIsLoading(true);
    try {
      const data = await studentsApi.getExecutionSheet({ date, from: fromDate, to: toDate });
      setSheet(data);
      if (data?.date && data.date !== date) setDate(data.date);
    } catch (error) {
      toast({ title: 'تعذر تحميل متابعة التنفيذ', description: error.message, variant: 'destructive' });
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [date, fromDate, toDate, toast]);

  useEffect(() => {
    void loadSheet();
  }, [loadSheet]);

  const days = useMemo(() => sheet?.days || [], [sheet]);
  const editable = Boolean(sheet?.editable) && !teacherScoped;
  const selectedDay = days.find((day) => day.date === date);

  const changeFrom = (value) => {
    if (!value) return;
    setFromDate(value);
    if (value > toDate) setToDate(value);
  };

  const changeTo = (value) => {
    if (!value) return;
    const next = value > today ? today : value;
    setToDate(next);
    if (next < fromDate) setFromDate(next);
    setDate(next);
  };

  const withPending = async (key, action) => {
    setPendingKeys((current) => [...current, key]);
    try {
      await action();
    } finally {
      setPendingKeys((current) => current.filter((item) => item !== key));
    }
  };

  const toggleCell = (row, columnKey) => {
    const cell = row.columns[columnKey];
    if (!cell) return;
    const status = cell.status === 'done' ? 'not_done' : 'done';
    const key = `${row.studentId}:${columnKey}`;
    void withPending(key, async () => {
      try {
        for (const group of cell.groups.filter((item) => item.canEdit)) {
          await studentsApi.saveStudentExecutionCorrection(row.studentId, { taskIds: group.taskIds, date, status });
        }
        await loadSheet({ quiet: true });
      } catch (error) {
        toast({ title: 'تعذر حفظ التنفيذ', description: error.message, variant: 'destructive' });
        await loadSheet({ quiet: true });
      }
    });
  };

  const changeAttendance = (row, status) => {
    if (row.attendance === status) return;
    const key = `${row.studentId}:attendance`;
    void withPending(key, async () => {
      try {
        const payload = { date, mode: 'manual', status };
        if (status === 'absent') await studentsApi.markStudentAbsent(row.studentId, payload);
        else await studentsApi.checkInStudent(row.studentId, payload);
        await loadSheet({ quiet: true });
      } catch (error) {
        toast({ title: 'تعذر تحديث الحضور', description: error.message, variant: 'destructive' });
      }
    });
  };

  const exportWeek = async () => {
    setIsExporting(true);
    try {
      const file = await studentsApi.exportExecutionSheet({ from: sheet?.from || fromDate, to: sheet?.to || toDate });
      downloadFile(file.blob, file.filename);
      toast({ title: 'تم التصدير', description: 'تم تجهيز ملف Excel للفترة المحددة.' });
    } catch (error) {
      toast({ title: 'تعذر التصدير', description: error.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const renderAttendance = (row) => {
    if (row.attendance === 'no_session') return <span className="text-muted-foreground">—</span>;
    if (editable && canEditAttendance) {
      return (
        <Select
          value={row.attendance || ''}
          onValueChange={(value) => changeAttendance(row, value)}
          disabled={pendingKeys.includes(`${row.studentId}:attendance`)}
        >
          <SelectTrigger aria-label={`حضور ${row.name}`} className="mx-auto h-8 w-[5.25rem] px-2 text-xs font-bold sm:w-[5.5rem]">
            <SelectValue placeholder="—">
              {row.attendance ? attendanceLabel(row.attendance) : '—'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {attendanceOptions.map((option) => (
              <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return <span className="text-xs font-bold">{attendanceLabel(row.attendance) || '—'}</span>;
  };

  const renderBody = () => {
    if (isLoading) return <DashboardLoader className="min-h-48" />;
    if (!days.length) {
      return <div className="rounded-xl border border-dashed border-primary/20 p-8 text-center text-sm text-muted-foreground">لا توجد أيام دراسية في هذه الفترة.</div>;
    }
    const rows = sheet?.rows || [];
    if (!rows.length) {
      return <div className="rounded-xl border border-dashed border-primary/20 p-8 text-center text-sm text-muted-foreground">لا يوجد طلاب لديهم خطط.</div>;
    }
    return (
      <div className="space-y-1.5">
      <p className="text-[0.7rem] font-bold text-muted-foreground sm:hidden">اسحب الجدول يسارًا لرؤية المجموع.</p>
      <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-primary/20">
        <table className="w-full min-w-[33rem] border-collapse text-sm" dir="rtl">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th scope="col" className="sticky right-0 z-10 min-w-[7.5rem] bg-primary px-3 py-2 text-right font-black sm:min-w-[9rem]">الاسم</th>
              <th scope="col" className="whitespace-nowrap px-2 py-2 font-black">الحضور</th>
              <th scope="col" className="whitespace-nowrap px-2 py-2 font-black">التسميع</th>
              {sheetColumns.map((column) => (
                <th key={column.key} scope="col" className="whitespace-nowrap px-2 py-2 font-black">{column.label}</th>
              ))}
              <th scope="col" className="whitespace-nowrap px-2 py-2 font-black">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.studentId} className="border-t border-primary/10 bg-card">
                <th scope="row" className="sticky right-0 z-10 bg-card px-3 py-1.5 text-right font-bold shadow-[-6px_0_8px_-6px_hsl(var(--primary)/0.25)]">
                  <button
                    type="button"
                    className="block max-w-[8rem] truncate text-right sm:max-w-[11rem] hover:text-primary hover:underline disabled:hover:no-underline"
                    disabled={!editable}
                    onClick={() => setDetail(row)}
                    title={editable ? 'تفاصيل التنفيذ' : row.committeeName}
                  >
                    {row.name}
                  </button>
                  {row.committeeName && (
                    <span className="block truncate text-[0.7rem] font-normal text-muted-foreground">{row.committeeName}</span>
                  )}
                </th>
                <td className="px-2 py-1.5 text-center">{renderAttendance(row)}</td>
                <td className="px-2 py-1.5 text-center font-bold">
                  {row.tasmee === null ? <span className="text-muted-foreground">—</span> : formatScore(row.tasmee)}
                </td>
                {sheetColumns.map((column) => (
                  <td key={column.key} className="px-2 py-1.5 text-center">
                    <TaskCell
                      cell={row.columns[column.key]}
                      label={column.label}
                      studentName={row.name}
                      editable={editable}
                      saving={pendingKeys.includes(`${row.studentId}:${column.key}`)}
                      onToggle={() => toggleCell(row, column.key)}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center">
                  <span className={cn('inline-flex min-w-[3.75rem] justify-center whitespace-nowrap rounded-md px-2 py-0.5 font-black', totalClassName(row))}>
                    {row.max ? `${formatScore(row.total)}/${row.max}` : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    );
  };

  return (
    <Card className="border-primary/30 bg-card [font-family:var(--font-ui)]" dir="rtl">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-primary/15 p-4">
        <h2 className="text-xl font-black text-primary">متابعة التنفيذ</h2>
        <Button type="button" variant="outline" className="min-h-10 gap-2" disabled={isExporting || isLoading} onClick={exportWeek}>
          <FileSpreadsheet className="h-4 w-4" />
          {isExporting ? 'جارٍ التصدير...' : 'تصدير'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem] sm:gap-3">
          <div className="min-w-0 space-y-2">
            <Label>الفترة</Label>
            <DashboardDateRange sessionDates={false} from={fromDate} to={toDate} onFromChange={changeFrom} onToChange={changeTo} />
          </div>
          <div className="min-w-0 space-y-2">
            <Label>اليوم</Label>
            <Select value={date} onValueChange={setDate} disabled={!days.length}>
              <SelectTrigger aria-label="اليوم" className="h-11 min-w-0 text-sm">
                <SelectValue placeholder="اختر اليوم">
                  {selectedDay ? `${selectedDay.label} ${selectedDay.date.slice(5).replace('-', '/')}` : 'اختر اليوم'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {days.map((day) => (
                  <SelectItem key={day.date} value={day.date}>
                    {day.label} {day.date.slice(5).replace('-', '/')}{day.isSessionDay ? ' — جلسة تسميع' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedDay && !selectedDay.isSessionDay && !isLoading && (
          <p className="text-xs font-bold text-muted-foreground">لا توجد جلسة تسميع في هذا اليوم، فالحضور والتسميع لا يُحسبان في المجموع.</p>
        )}

        {renderBody()}
      </CardContent>

      {detail && (
        <ExecutionCorrectionDialog
          open={Boolean(detail)}
          onOpenChange={(open) => { if (!open) setDetail(null); }}
          studentId={detail.studentId}
          studentName={detail.name}
          date={date}
          dateLabel={selectedDay?.label || date}
          onSaved={() => loadSheet({ quiet: true })}
        />
      )}
    </Card>
  );
};

export default StudentExecutionCorrectionsSection;
