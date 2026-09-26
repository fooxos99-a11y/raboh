#!/usr/bin/env bash
# الخطوة 4: تفعيل ربوة الجديد. يرجع تلقائيًا للنسخة القديمة إذا فشل فحص الموقع.
set -euo pipefail
ROOT=/var/www/rboh
TS=$(cat /root/rabwa-new-ts)
B=$ROOT/runtime/database-backups/pre-rabwa-new-$TS
R=$ROOT/releases/$TS-rabwa-new
test -f "$R/.rehearsal-ok" || { echo "خطأ: التجربة لم تنجح، لن أفعّل"; exit 1; }
touch /run/madarij-web-release-in-progress
trap 'rm -f /run/madarij-web-release-in-progress' EXIT
publish() { # $1 مصدر $2 وجهة، مع الإبقاء على مجلد التحميلات
  rsync -a --delete --exclude 'downloads/' "$1/" "$2/"
}
echo "=== تبديل الإصدار"
ln -sfn "$R" "$ROOT/current.next" && mv -Tf "$ROOT/current.next" "$ROOT/current"
publish "$R/dist/rabwa" "$ROOT/domain-dist"
publish "$R/dist/rabwa-path" "$ROOT/dist"
pm2 restart rboh --update-env >/dev/null
pm2 restart rboh-notifications-worker --update-env >/dev/null || true
OK=0
for i in $(seq 1 40); do
  sleep 3
  if [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3040/api/health)" = "200" ] \
     && [ "$(curl -s -o /dev/null -w '%{http_code}' https://rboh.cc/api/health)" = "200" ]; then OK=1; break; fi
done
if [ "$OK" != "1" ]; then
  echo "=== فشل فحص الموقع، أرجع النسخة القديمة"
  pm2 logs rboh --lines 40 --nostream 2>&1 | tail -40
  bash /root/rabwa-rollback.sh
  exit 1
fi
pm2 stop rboh-nazem-worker >/dev/null 2>&1 || true
pm2 delete rboh-nazem-worker >/dev/null 2>&1 || true
pm2 save >/dev/null
touch "$R/RELEASE_ACTIVATED"
M="mysql -N -B rabwa_main_v2 -e"
{
  for T in students supervisors committees student_quran_tasks attendance_records student_point_transactions; do
    echo "$T=$($M "SELECT COUNT(*) FROM $T")"
  done
  echo "points=$($M "SELECT COALESCE(SUM(points),0) FROM students")"
} > "$B/stats-after.txt"
echo "=== قبل:"; cat "$B/stats-before.txt"
echo "=== بعد:"; cat "$B/stats-after.txt"
echo "=== آخر تحديث قاعدة: $($M "SELECT MAX(version) FROM schema_migrations")"
echo "=== الصفحة الرئيسية تحمل: $(curl -s https://rboh.cc/ | grep -o '<title>[^<]*</title>')"
echo "=== ACTIVATED OK"
