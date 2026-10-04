import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('removed event notification settings cannot be loaded, saved, or configured', async () => {
  const sources = await Promise.all([
    read('../src/components/dashboard/NotificationSettings.jsx'),
    read('../src/services/studentsApi.js'),
    read('../server/index.js'),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, /eventNotifications|eventNotificationDefinitions|normalizeEventNotifications|notification-administrators|getNotificationAdministrators/);
  }
});

test('programs, stations, city transitions and store orders no longer emit removed events', async () => {
  const sources = await Promise.all([
    read('../server/routes/programRoutes.js'),
    read('../server/routes/storeRoutes.js'),
    read('../server/services/studentPoints.js'),
    read('../server/index.js'),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, /notifyStudentsOfEvent|emitEventNotification|notifyCityTransition|services\/eventNotifications/);
  }
});
