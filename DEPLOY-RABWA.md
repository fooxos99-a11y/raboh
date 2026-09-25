# دليل تبديل ربوة إلى «ربوة الجديد»

هذا الدليل لوكيل يعمل على جهاز المستخدم (Claude Code أو غيره) ولديه طرفية ووصول إلى بيانات الاعتماد المحفوظة في Windows Credential Manager. المستخدم طلب الرفع صراحةً. نفّذ الخطوات بالترتيب ولا تتجاوز أي نقطة توقف.

## الثوابت

- الوجهة الوحيدة: `rabwa` في `data1.yml`. لا تلمس مدارج أو الحبيب أو أي مسار خارج `/var/www/rboh`.
- الدخول: `root@161.97.171.108`، وكلمة المرور من بيانات الاعتماد `madarij-production-ssh`. تحقق من `host_key` قبل أول اتصال. لا تطبع كلمة المرور ولا محتوى `.env`.
- القواعد: `rabwa_main_v2` و`rabwa_platform_v2`، وأي قواعد مجمعات مسجلة في قاعدة المنصة.
- آخر إصدار منشور على ربوة: `2026.09.11.1` (بيانات `last_release` في `data1.yml`).
- الترحيلات الجديدة التي ستعمل تلقائيًا عند التشغيل: `2026.09.22.1` و`2026.09.22.2` و`2026.09.22.3` و`2026.09.23.1` و`2026.09.23.2` و`2026.09.25.1`. كلها إضافية، ما عدا `2026.09.22.1` التي تضبط قيم نقاط التكرار والسماع إلى 5 وتحفظ القيم السابقة في `practiceCompletionPointsPreviousSettings`. المستخدم طلب أن تطابق ربوة الحبيب ماب.
- ممنوع: استعادة قاعدة كاملة فوق بيانات حية، وحذف جداول، ونسخ `.env` من جهاز المستخدم، وإعادة كتابة `.env` على السيرفر.

## 1. فحص مسبق (قراءة فقط)

1. `pm2 list`: سجّل حالة `rboh` و`rboh-nazem-worker` و`rboh-notifications-worker`.
2. `readlink -f /var/www/rboh/current`: سجّل مسار الإصدار الحالي، فهو مسار الرجوع.
3. من `.env` الإصدار الحالي اطبع أسماء المفاتيح فقط، وتأكد أن `SITE_KEY=rabwa` وأن `MYSQL_DATABASE` هي `rabwa_main_v2`. قارن القيم دون طباعتها.
4. اجمع كل قواعد ربوة: الرئيسية، والمنصة، وقواعد المجمعات من جدول المجمعات في `rabwa_platform_v2`.
5. **نقطة توقف ناظم:** في كل قاعدة شغّل `SELECT setting_value FROM app_settings WHERE setting_key='nazemIntegrationEnabled'`. إذا كانت `true` في أي قاعدة فتوقف وأبلغ المستخدم: ربوة تستخدم ناظم فعليًا، وتعطيله يغيّر طريقة توليد مهام الخطط المدارة من ناظم. لا تكمل دون قرار صريح منه.
6. سجّل لكل قاعدة: عدد `students` و`supervisors` و`committees` و`student_plans` و`student_quran_tasks` و`attendance_records` و`student_point_transactions`، ومجموع `students.points`، وأحدث إصدار في `schema_migrations`.

## 2. نسخ احتياطي

1. `touch /run/madarij-web-release-in-progress`، وفي النهاية مهما حصل: `rm -f /run/madarij-web-release-in-progress`.
2. مجلد جديد: `/var/www/rboh/runtime/database-backups/pre-rabwa-new-<ts>`.
3. لكل قاعدة: `mysqldump --single-transaction --routines --triggers --hex-blob <db> | gzip > <db>.sql.gz`، ثم `sha256sum`، وتأكد أن `gunzip -t` ينجح وأن الحجم معقول.
4. انسخ الواجهات الحالية: `cp -a /var/www/rboh/domain-dist /var/www/rboh/domain-dist.rollback-<ts>`، ومثلها لـ `/var/www/rboh/dist`.

## 3. تجربة على نسخة (إلزامية)

1. أنشئ قواعد مؤقتة `rabwa_rehearsal_<ts>_*` واستعد فيها النسخ من الخطوة 2.
2. ارفع الإصدار الجديد (الخطوة 4) إلى مجلد تجربة منفصل، وانسخ إليه `.env` من السيرفر نفسه، وعدّل في النسخة المؤقتة فقط اسم القاعدة إلى القاعدة المؤقتة والمنفذ إلى منفذ غير مستخدم (مثل 3099).
3. شغّل الخادم مؤقتًا (`node server/index.js`) حتى يكتمل تشغيل الترحيلات، ثم أوقفه.
4. أعد إحصاءات الخطوة 1.6 على القواعد المؤقتة. المتوقع:
   - الأعداد مطابقة تمامًا.
   - مجموع النقاط مطابق. إذا اختلف فاعرض عدد الطلاب المتغيرين وأكبر فرق.
   - ظهور إصدارات الترحيل الستة.
5. **نقطة توقف:** أي اختلاف غير مفسّر في الأعداد أو النقاط، أو فشل ترحيل: توقف وأبلغ المستخدم بالتفاصيل.
6. احذف القواعد المؤقتة ومجلد التجربة بعد النجاح.

## 4. البناء والحزمة (على جهاز المستخدم)

1. داخل `ربوة الجديد`: `npm ci`، ثم `npm run verify`. يجب أن ينجح كله.
2. `npm run build:rabwa:path`: يبني `dist/rabwa-path` للمسار القديم `/rboh/`. أمر `build:rabwa` يبني `dist/rabwa` ضمن `verify`.
3. حزمة المصدر: المجلدات `server` و`shared` و`src` و`scripts` و`config` و`public`، والملفات `package.json` و`package-lock.json` و`index.html` و`vite.config.js` و`tailwind.config.js` و`postcss.config.js`. لا تضم `.env*` ولا `node_modules` ولا `dist` ولا `backups` ولا `outputs` ولا سجلات الاختبار. المجلد لم يعد مستودع Git، فلا تستخدم `scripts/web-release/package.py` لأنه يعتمد على `git ls-files`.

## 5. التفعيل

1. ارفع الحزمة إلى `/var/www/rboh/releases/<ts>-rabwa-new`.
2. على السيرفر: `cp -a <current>/.env <release>/.env` (نسخ من السيرفر إلى السيرفر فقط)، ثم `npm ci --omit=dev --ignore-scripts` داخل الإصدار.
3. بدّل الرابط: `ln -sfn <release> /var/www/rboh/current`.
4. الواجهات: انسخ `dist/rabwa` إلى `/var/www/rboh/domain-dist` و`dist/rabwa-path` إلى `/var/www/rboh/dist` مع **الإبقاء على مجلد `downloads/`** وملفات APK الموجودة. استخدم rsync مع `--exclude downloads/`.
5. `pm2 restart rboh`، ثم `pm2 restart rboh-notifications-worker` إن كان موجودًا.
6. ناظم محذوف من ربوة الجديد: `pm2 stop rboh-nazem-worker`، ثم `pm2 delete rboh-nazem-worker`، ثم `pm2 save`. هذا فقط بعد اجتياز نقطة توقف ناظم.
7. `touch /var/www/rboh/current/RELEASE_ACTIVATED`.

## 6. التحقق

- `https://rboh.cc/api/health` يرجع نجاحًا.
- `https://rboh.cc/` يعرض اسم «ربوة» وشعارها، وصفحة الدخول تعمل. جرّب `http://161.97.171.108/rboh/` أيضًا.
- `pm2 logs rboh --lines 100`: لا أخطاء ترحيل أو قاعدة.
- أعد إحصاءات الخطوة 1.6 على القواعد الحية: مطابقة لما قبل.
- المتجر والتحدي والخريطة والمسابقات وناظم لا تظهر، وطلباتها ترجع 410.

## 7. الرجوع عند أي خلل

1. `ln -sfn <المسار المسجل في 1.2> /var/www/rboh/current`، ثم `pm2 restart rboh`.
2. أعد `domain-dist.rollback-<ts>` و`dist.rollback-<ts>`.
3. أعد تشغيل `rboh-nazem-worker` إن كان يعمل قبل النشر.
4. القاعدة: الترحيلات إضافية، والكود القديم يتجاهل الجداول الجديدة. لإرجاع قيم النقاط استخدم `down` للترحيل `2026.09.22.1`. لا تستعد النسخة الكاملة إلا بقرار صريح من المستخدم، لأنها تمحو أي نشاط بعد النشر.

## 8. بعد النجاح

- حدّث `last_release` في `data1.yml` بمسار الإصدار ومسار النسخ الاحتياطي ومسار الرجوع وآخر ترحيل.
- أبلغ المستخدم باختصار: ما نُشر، ونتيجة كل تحقق، ومكان النسخ الاحتياطي.
