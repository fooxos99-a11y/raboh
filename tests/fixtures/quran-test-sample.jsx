import React from 'react';
import { createRoot } from 'react-dom/client';
import MushafRecitationDialog from '../../src/components/portal/MushafRecitationDialog';
import '../../src/index.css';

if (!import.meta.env.DEV || !['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('Local only');
const tasks = [{ id: 1, fromSurahName: 'الفاتحة' }];
const wordMarks = [1, 2].map((page) => ({ page, startLocation: `1:${page}:1`, endLocation: `1:${page}:1`, markType: page === 1 ? 'warning' : 'mistake' }));
createRoot(document.getElementById('root')).render(
  <MushafRecitationDialog
    open
    tasks={tasks}
    randomMode
    randomSampleCount={2}
    loadTaskData={async () => ({ pages: [1, 2].map((page) => ({ page, words: [] })), wordMarks })}
    saveTaskResult={async (_task, payload) => {
      window.savedTestPayload = payload;
      return { teacherCompleted: true };
    }}
  />,
);
