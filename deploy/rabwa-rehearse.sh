#!/usr/bin/env bash
# الخطوة 3: تجهيز الإصدار الجديد وتجربته على نسخة مؤقتة من القاعدة. لا يلمس الموقع الحي ولا قاعدته.
set -euo pipefail
ROOT=/var/www/rboh
TS=$(cat /root/rabwa-new-ts)
B=$ROOT/runtime/database-backups/pre-rabwa-new-$TS
R=$ROOT/releases/$TS-rabwa-new
CUR=$(cat "$B/previous-release.txt")
RDB="rabwa_rehearsal_$TS"
echo "=== الإصدار الجديد: $R"
mkdir -p "$R"
tar -xzf /root/rabwa-release.tgz -C "$R"
cp -a "$CUR/.env" "$R/.env"; chmod 600 "$R/.env"
cd "$R"
test -f dist/rabwa/index.html && test -f dist/rabwa-path/index.html || { echo "خطأ: ملفات البناء ناقصة"; exit 1; }
grep -q "ربوة" dist/rabwa/index.html || { echo "خطأ: البناء لا يحمل اسم ربوة"; exit 1; }
echo "=== تثبيت المكتبات"
npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/tmp/rabwa-npm.log 2>&1 || { tail -20 /tmp/rabwa-npm.log; exit 1; }
APPUSER=$(grep -E '^MYSQL_USER=' .env | cut -d= -f2- | tr -d '"'"'"'')
echo "=== إنشاء قاعدة التجربة $RDB"
mysql -e "CREATE DATABASE \`$RDB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gunzip < "$B/rabwa_main_v2.sql.gz" | mysql "$RDB"
mysql -e "GRANT ALL PRIVILEGES ON \`$RDB\`.* TO '$APPUSER'@'localhost'"
Q() { mysql -N -B "$RDB" -e "$1"; }
Q "SELECT id, points FROM students ORDER BY id" > /tmp/rabwa-points-before.txt
echo "=== تشغيل تحديثات القاعدة على نسخة التجربة فقط"
MYSQL_DATABASE="$RDB" NOTIFICATION_PUSH_CONFIG_JSON="" WHATSAPP_AUTH_PATH="/tmp/rabwa-rehearsal-wa" \
  timeout 600 node --input-type=module -e "const m = await import('./server/db.js'); await m.initDatabase(process.env.MYSQL_DATABASE); console.log('init-ok'); process.exit(0);"
{
  for T in students supervisors committees student_quran_tasks attendance_records student_point_transactions; do
    echo "$T=$(Q "SELECT COUNT(*) FROM $T")"
  done
  echo "points=$(Q "SELECT COALESCE(SUM(points),0) FROM students")"
} > "$B/stats-rehearsal.txt"
Q "SELECT id, points FROM students ORDER BY id" > /tmp/rabwa-points-after.txt
echo "=== قبل:"; cat "$B/stats-before.txt"
echo "=== بعد التجربة:"; cat "$B/stats-rehearsal.txt"
CHANGED=$(diff /tmp/rabwa-points-before.txt /tmp/rabwa-points-after.txt | grep -c '^>' || true)
echo "طلاب تغيّرت نقاطهم: $CHANGED"
echo "=== آخر التحديثات المطبقة:"; Q "SELECT version FROM schema_migrations ORDER BY applied_at DESC, version DESC LIMIT 8"
mysql -e "REVOKE ALL PRIVILEGES ON \`$RDB\`.* FROM '$APPUSER'@'localhost'; DROP DATABASE \`$RDB\`"
if diff -q "$B/stats-before.txt" "$B/stats-rehearsal.txt" >/dev/null && [ "$CHANGED" = "0" ]; then
  touch "$R/.rehearsal-ok"; echo "=== REHEARSAL OK"
else
  echo "=== REHEARSAL MISMATCH - توقف ولا تفعّل"
fi
