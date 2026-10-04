import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsSection from '@/components/dashboard/SettingsSection';
import '@/index.css';

const captureSettings = (settings) => { globalThis.notificationFixture = settings; };

createRoot(document.getElementById('root')).render(
  <main className="mx-auto max-w-4xl">
    <SettingsSection activeCategory="settingsNotifications" onSettingsChange={captureSettings} />
  </main>,
);
