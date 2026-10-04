import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try {for(const width of [360,768,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 page.setDefaultTimeout(15_000);
 const students=[
  {id:101,name:'طالب الاختبار الأول',committeeName:'حلقة الاختبار'},
  {id:102,name:'طالب الاختبار الثاني',committeeName:null},
 ];
 let savedSettings={memorizationExecutionSource:'student',executionReminderExcludedStudentIds:['101']};
 let studentsRequested=false;
 await page.route('**/api/settings/execution-reminder-students', async route=>{
  studentsRequested=true;
  await route.fulfill({json:{students}});
 });
 await page.route('**/api/settings', async route=>{
  if(route.request().method()==='PUT') savedSettings=route.request().postDataJSON();
  await route.fulfill({json:savedSettings});
 });
 await page.goto((globalThis.process.env.PORTAL_TEST_URL||'http://127.0.0.1:33471')+'/tests/fixtures/notification-settings.html');
 await page.getByText('قوالب التسجيل',{exact:true}).waitFor();
 const selectedLabel='طالب الاختبار الأول — حلقة الاختبار';
 const dropdown=page.getByRole('button',{name:selectedLabel,exact:true});
 await dropdown.waitFor();
 assert.equal(studentsRequested,true,'Names must load through the real students API');
 await dropdown.click();
 const first=page.getByRole('button',{name:selectedLabel,exact:true}).last();
 const second=page.getByRole('button',{name:'طالب الاختبار الثاني',exact:true});
 assert.equal(await first.getAttribute('aria-pressed'),'true');
 assert.equal(await second.getAttribute('aria-pressed'),'false');
 await second.click();
 await page.waitForFunction(()=>globalThis.notificationFixture.executionReminderExcludedStudentIds.includes('102'));
 assert.equal(await second.getAttribute('aria-pressed'),'true');
 await first.click();
 await page.waitForFunction(()=>!globalThis.notificationFixture.executionReminderExcludedStudentIds.includes('101'));
 assert.deepEqual(savedSettings.executionReminderExcludedStudentIds,['102']);
 await page.reload();
 await page.getByRole('button',{name:'طالب الاختبار الثاني',exact:true}).waitFor();
 for (const label of ['طلب جديد من المتجر','انتقال الطالب إلى مدينة جديدة','تسجيل مخالفة للطالب','إضافة محطة','إضافة برنامج','الإداريون المستلمون']) {
  assert.equal(await page.getByText(label,{exact:true}).count(),0,label);
 }
 const absent=page.getByLabel('قالب رسالة الغياب',{exact:true});
 await absent.fill('اختبار الغياب');
 await page.waitForFunction(()=>globalThis.notificationFixture.attendanceAbsentTemplate==='اختبار الغياب');
 assert.equal(await page.evaluate(()=>globalThis.notificationFixture.attendanceAbsentTemplate),'اختبار الغياب');
 const acceptance=page.getByLabel('قبول التسجيل',{exact:true});
 await acceptance.fill('اختبار القبول');
 await page.waitForFunction(()=>globalThis.notificationFixture.registrationAcceptTemplate==='اختبار القبول');
 assert.equal(await page.evaluate(()=>globalThis.notificationFixture.registrationAcceptTemplate),'اختبار القبول');
 assert.equal(await page.getByText('قوالب التسجيل',{exact:true}).count(),1);
 assert.equal(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth>globalThis.innerWidth),false);
 await page.close();
 globalThis.console.log(`Notification names, selection and persistence passed at ${width}px`);
}}finally{await browser.close();}
