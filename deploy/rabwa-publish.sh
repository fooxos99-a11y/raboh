#!/usr/bin/env bash
# رفع أي تعديل على ربوة الحية بأمر واحد. شغّله من Git Bash داخل «ربوة الجديد»:  bash deploy/rabwa-publish.sh
set -euo pipefail
cd "$(dirname "$0")/.."
KEY=~/.ssh/codex_rabwa_deploy
HOST=root@161.97.171.108
echo "=== 1/4 الفحص الكامل (verify)"
npm run verify > verify-log.txt 2>&1 || { echo "فشل الفحص، آخر الأسطر:"; tail -40 verify-log.txt; exit 1; }
echo "=== 2/4 بناء نسخة المسار /rboh/"
npm run build:rabwa:path > build-log.txt 2>&1 || { tail -40 build-log.txt; exit 1; }
echo "=== 3/4 تجهيز الحزمة ورفعها"
rm -f rabwa-release.tgz
tar --exclude='*/downloads' -czf rabwa-release.tgz server shared src scripts config public dist/rabwa dist/rabwa-path \
  package.json package-lock.json index.html vite.config.js tailwind.config.js postcss.config.js
scp -i "$KEY" rabwa-release.tgz deploy/rabwa-update.sh "$HOST":/root/
echo "=== 4/4 التحديث على السيرفر"
ssh -i "$KEY" "$HOST" "sed -i 's/\r\$//' /root/rabwa-update.sh && bash /root/rabwa-update.sh"
