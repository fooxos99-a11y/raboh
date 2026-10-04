import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try {for(const width of [360,768,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 await page.goto((globalThis.process.env.PORTAL_TEST_URL||'http://127.0.0.1:33471')+'/tests/fixtures/notification-settings.html');
 await page.getByText('قوالب التسجيل',{exact:true}).waitFor();
 for (const label of ['طلب جديد من المتجر','انتقال الطالب إلى مدينة جديدة','تسجيل مخالفة للطالب','إضافة محطة','إضافة برنامج','الإداريون المستلمون']) {
  assert.equal(await page.getByText(label,{exact:true}).count(),0,label);
 }
 const absent=page.getByLabel('قالب رسالة الغياب',{exact:true});
 await absent.fill('اختبار الغياب');
 assert.equal(await page.evaluate(()=>globalThis.notificationFixture.attendanceAbsentTemplate),'اختبار الغياب');
 const acceptance=page.getByLabel('قبول التسجيل',{exact:true});
 await acceptance.fill('اختبار القبول');
 assert.equal(await page.evaluate(()=>globalThis.notificationFixture.registrationAcceptTemplate),'اختبار القبول');
 assert.equal(await page.getByText('قوالب التسجيل',{exact:true}).count(),1);
 assert.equal(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth>globalThis.innerWidth),false);
 await page.close();
}}finally{await browser.close();}
