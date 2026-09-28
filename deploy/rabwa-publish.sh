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
# ملفات المصحف (أكثر من 100MB) لا تتغير عادةً، فتُنسخ على السيرفر من الإصدار السابق بدل رفعها.
# لرفعها كاملة بعد تغييرها:  FULL=1 bash deploy/rabwa-publish.sh
find public/quran -type f -printf '%P %s\n' | LC_ALL=C sort | sha256sum | cut -c1-64 > quran.fingerprint
SKIP_QURAN=()
[ "${FULL:-0}" = "1" ] || SKIP_QURAN=(--exclude='public/quran' --exclude='dist/rabwa/quran' --exclude='dist/rabwa-path/quran')
tar --exclude='*/downloads' "${SKIP_QURAN[@]}" -czf rabwa-release.tgz server shared src scripts config public dist/rabwa dist/rabwa-path \
  package.json package-lock.json index.html vite.config.js tailwind.config.js postcss.config.js quran.fingerprint
rm -f quran.fingerprint
echo "حجم الحزمة: $(du -h rabwa-release.tgz | cut -f1)"
scp -i "$KEY" rabwa-release.tgz deploy/rabwa-update.sh "$HOST":/root/
echo "=== 4/4 التحديث على السيرفر"
ssh -i "$KEY" "$HOST" "sed -i 's/\r\$//' /root/rabwa-update.sh && MIGRATE=${MIGRATE:-0} bash /root/rabwa-update.sh"
