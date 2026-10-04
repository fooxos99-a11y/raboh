import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import NotificationSettings from '@/components/dashboard/NotificationSettings';import '@/index.css';
function Fixture(){const [settings,setSettings]=useState({memorizationExecutionSource:'student'});globalThis.notificationFixture=settings;return <main className="mx-auto max-w-4xl"><NotificationSettings settings={settings} setSettings={setSettings} executionReminderStudents={[]} toggleListValue={()=>{}}/></main>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
