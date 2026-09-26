import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardLoader from '@/components/dashboard/DashboardLoader';
import ExecutionCorrectionEndSelector from '@/components/dashboard/ExecutionCorrectionEndSelector';
import RepeatCountSelector from '@/components/portal/RepeatCountSelector';
import { formatContinuousRecitationRange } from '@/lib/recitationTaskRanges';
import { studentsApi } from '@/services/studentsApi';
import { useToast } from '@/components/ui/use-toast';

const taskLabels = {
  memorization: 'الحفظ',
  mastery: 'الإتقان',
  review: 'المراجعة',
  link: 'الربط',
};

const taskLabel = (task) => (
  task.taskType === 'memorization' && task.track === 'mastery'
    ? taskLabels.mastery
    : taskLabels[task.taskType] || task.taskType
);

const initialForm = (task) => ({
  status: task.status,
  actualEnd: task.actualEnd,
  repeatCount: task.actualRepeatCount || task.expectedRepeatCount || 1,
  listeningCount: task.actualListeningCount || task.expectedListeningCount || 1,
});

/** Detailed correction of one student's day: partial amounts, repetition and listening counts. */
const ExecutionCorrectionDialog = ({ open, onOpenChange, studentId, studentName, date, dateLabel, onSaved }) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [referenceMode, setReferenceMode] = useState('ayah');
  const [forms, setForms] = useState({});
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [savingKey, setSavingKey] = useState('');

  const loadTasks = useCallback(async () => {
    if (!studentId || !date) {
      setTasks([]);
      setForms({});
      return;
    }
    setIsLoadingTasks(true);
    try {
      const data = await studentsApi.getStudentExecutionCorrections(studentId, date);
      const nextTasks = Array.isArray(data?.tasks) ? data.tasks : [];
      setReferenceMode(data?.referenceMode === 'page' ? 'page' : 'ayah');
      setTasks(nextTasks);
      setForms(Object.fromEntries(nextTasks.map((task) => [task.key, initialForm(task)])));
    } catch (error) {
      setTasks([]);
      setForms({});
      toast({ title: 'تعذر تحميل التنفيذ', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoadingTasks(false);
    }
  }, [date, studentId, toast]);

  useEffect(() => {
    if (open) void loadTasks();
  }, [loadTasks, open]);

  const updateForm = (key, patch) => {
    setForms((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  const save = async (task) => {
    const form = forms[task.key] || initialForm(task);
    setSavingKey(task.key);
    try {
      const _resolveSave = () => {
        if (form.status === 'done') {
          return {
          actualEnd: form.actualEnd,
          ...(task.taskType === 'memorization' ? {
            repeatCount: form.repeatCount,
            listeningCount: form.listeningCount,
          } : {}),
        };
        }
        return {};
      };
      await studentsApi.saveStudentExecutionCorrection(studentId, {
        taskIds: task.taskIds,
        date,
        status: form.status,
        ...(_resolveSave()),
      });
      toast({ title: 'حُفظ تصحيح التنفيذ' });
      await loadTasks();
      onSaved?.();
    } catch (error) {
      toast({ title: 'تعذر حفظ التصحيح', description: error.message, variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const renderTasks = () => {
    if (isLoadingTasks) {
      return <DashboardLoader className="min-h-48" />;
    }
    if (tasks.length === 0) {
      return <div className="rounded-xl border border-dashed border-primary/20 p-8 text-center text-sm text-muted-foreground">
            لا توجد مهام لهذا الطالب في هذا اليوم.
          </div>;
    }
    return <div className="space-y-3">
            {tasks.map((task) => {
              const form = forms[task.key] || initialForm(task);
              const label = taskLabel(task);
              return (
                <div key={task.key} className="space-y-3 rounded-xl border border-primary/15 bg-background/40 p-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-black text-primary">{label}:</span>
                    <span className="min-w-0 text-sm font-bold text-foreground">
                      {formatContinuousRecitationRange(task.rows || [], referenceMode)}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>حالة التنفيذ</Label>
                      <Select
                        value={form.status}
                        onValueChange={(status) => updateForm(task.key, { status })}
                        disabled={!task.canEdit}
                      >
                        <SelectTrigger aria-label={`حالة تنفيذ ${label}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="done">تم التنفيذ</SelectItem>
                          <SelectItem value="not_done">لم يتم التنفيذ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {form.status === 'done' && (
                      <div className="space-y-2">
                        <Label>نهاية المقدار المنفذ</Label>
                        <div className="flex min-h-12 items-center rounded-xl border border-primary/20 bg-card px-3">
                          <ExecutionCorrectionEndSelector
                            referenceMode={referenceMode}
                            disabled={!task.canEdit}
                            start={task.start}
                            options={task.options}
                            value={form.actualEnd}
                            onChange={(actualEnd) => updateForm(task.key, { actualEnd })}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {form.status === 'done' && task.taskType === 'memorization' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <RepeatCountSelector
                        label="التكرار"
                        editable
                        max={task.expectedRepeatCount}
                        value={form.repeatCount}
                        onChange={(repeatCount) => updateForm(task.key, { repeatCount })}
                      />
                      <RepeatCountSelector
                        label="السماع"
                        pluralLabel
                        editable
                        max={task.expectedListeningCount}
                        value={form.listeningCount}
                        onChange={(listeningCount) => updateForm(task.key, { listeningCount })}
                      />
                    </div>
                  )}

                  {task.lockedReason && <p className="text-xs font-bold text-amber-700">{task.lockedReason}</p>}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="min-h-11 min-w-28"
                      disabled={!task.canEdit || savingKey === task.key}
                      onClick={() => save(task)}
                    >
                      {savingKey === task.key ? 'جارٍ الحفظ...' : 'حفظ التصحيح'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>;
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl [font-family:var(--font-ui)]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-black text-primary">
            {studentName} — {dateLabel}
          </DialogTitle>
        </DialogHeader>
        {renderTasks()}
      </DialogContent>
    </Dialog>
  );
};

export default ExecutionCorrectionDialog;
