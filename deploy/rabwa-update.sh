#!/usr/bin/env bash
# تحديث ربوة بإصدار جديد من /root/rabwa-release.tgz. يرجع تلقائيًا للإصدار السابق إذا فشل الموقع.
# يرفض التحديث إذا فيه تحديثات قاعدة بيانات جديدة؛ تلك تحتاج نسخة احتياطية وتجربة مثل التبديل الأول.
set -euo pipefail
ROOT=/var/www/rboh
TS=$(date +%Y%m%d_%H%M%S)
PREV=$(readlink -f "$ROOT/current")
R=$ROOT/releases/$TS-update
SWITCHED=0
publish() {
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete --exclude 'downloads/' "$1/" "$2/"
  else
    find "$2" -mindepth 1 -maxdepth 1 ! -name downloads -exec rm -rf {} +
    (cd "$1" && tar --exclude='./downloads' -cf - .) | (cd "$2" && tar -xf -)
  fi
}
rollback() {
  echo "=== أرجع الإصدار السابق: $PREV"
  ln -sfn "$PREV" "$ROOT/current.next" && mv -Tf "$ROOT/current.next" "$ROOT/current"
  publish "$PREV/dist/rabwa" "$ROOT/domain-dist"
  publish "$PREV/dist/rabwa-path" "$ROOT/dist"
  pm2 restart rboh --update-env >/dev/null; pm2 restart rboh-notifications-worker --update-env >/dev/null || true
  echo "=== فحص الموقع بعد الرجوع: $(curl -s -o /dev/null -w '%{http_code}' https://rboh.cc/api/health)"
}
trap 'echo "=== خطأ عند السطر $LINENO"; [ "$SWITCHED" = "1" ] && rollback' ERR
echo "=== الإصدار الجديد: $R"
mkdir -p "$R"
tar -xzf /root/rabwa-release.tgz -C "$R"
cp -a "$PREV/.env" "$R/.env"; chmod 600 "$R/.env"
cd "$R"
# ملفات المصحف غير المرفوعة تُنسخ من الإصدار السابق (روابط صلبة، بلا مساحة إضافية) بعد التأكد أنها نفسها.
if [ ! -d public/quran ]; then
  PREV_FP=$(cd "$PREV" && find public/quran -type f -printf '%P %s\n' | LC_ALL=C sort | sha256sum | cut -c1-64)
  if [ ! -f quran.fingerprint ] || [ "$(cat quran.fingerprint)" != "$PREV_FP" ]; then
    echo "خطأ: ملفات المصحف تغيرت عن الإصدار السابق. ارفع كاملًا: FULL=1 bash deploy/rabwa-publish.sh"; exit 1
  fi
  for dir in public/quran dist/rabwa/quran dist/rabwa-path/quran; do
    [ -d "$dir" ] || cp -al "$PREV/$dir" "$dir"
  done
  echo "=== ملفات المصحف نُسخت من الإصدار السابق"
fi
grep -q "ربوة" dist/rabwa/index.html || { echo "خطأ: البناء لا يحمل اسم ربوة"; exit 1; }
if cmp -s package-lock.json "$PREV/package-lock.json" && [ -d "$PREV/node_modules" ]; then
  cp -a "$PREV/node_modules" node_modules; echo "=== المكتبات نفسها، نُسخت"
else
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/tmp/rabwa-npm.log 2>&1 || { tail -30 /tmp/rabwa-npm.log; exit 1; }
  echo "=== المكتبات ثُبّتت"
fi
NEW=$(ls server/migrations/*.js | xargs -n1 basename | sort)
OLD=$(ls "$PREV"/server/migrations/*.js | xargs -n1 basename | sort)
if [ "$NEW" != "$OLD" ]; then
  echo "=== الإصدار فيه تحديثات قاعدة بيانات جديدة:"; comm -13 <(echo "$OLD") <(echo "$NEW")
  if [ "${MIGRATE:-0}" != "1" ]; then
    echo "=== لم يتغير شيء في الموقع. للنشر مع نسخة احتياطية وتجربة: MIGRATE=1 bash deploy/rabwa-publish.sh"
    exit 1
  fi
  # 1) نسخة احتياطية كاملة للقاعدتين قبل أي تغيير.
  B=$ROOT/runtime/database-backups/pre-update-$TS
  mkdir -p "$B"; chmod 700 "$B"; echo "$PREV" > "$B/previous-release.txt"
  PLATFORM_DB=$(grep -E '^PLATFORM_MYSQL_DATABASE=' .env | tail -1 | cut -d= -f2- | tr -d '"'"'"'\r ')
  for DB in rabwa_main_v2 ${PLATFORM_DB:-rabwa_platform_v2}; do
    mysqldump --single-transaction --routines --triggers --hex-blob "$DB" | gzip > "$B/$DB.sql.gz"
    gunzip -t "$B/$DB.sql.gz"
    echo "=== نسخة احتياطية: $DB $(du -h "$B/$DB.sql.gz" | cut -f1)"
  done
  # 2) تجربة التحديثات على نسخة مؤقتة من القاعدة ومقارنة الأعداد.
  RDB="rabwa_rehearsal_$TS"
  APPUSER=$(grep -E '^MYSQL_USER=' .env | tail -1 | cut -d= -f2- | tr -d '"'"'"'\r ')
  HOSTS=$(mysql -N -B -e "SELECT host FROM mysql.user WHERE user='$APPUSER'")
  [ -n "$HOSTS" ] || { echo "خطأ: لم أجد مستخدم القاعدة"; exit 1; }
  mysql -e "DROP DATABASE IF EXISTS \`$RDB\`; CREATE DATABASE \`$RDB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
  gunzip < "$B/rabwa_main_v2.sql.gz" | mysql "$RDB"
  for H in $HOSTS; do mysql -e "GRANT ALL PRIVILEGES ON \`$RDB\`.* TO '$APPUSER'@'$H'"; done
  stats() { for T in students supervisors committees student_quran_tasks attendance_records student_point_transactions; do echo "$T=$(mysql -N -B "$1" -e "SELECT COUNT(*) FROM $T")"; done; echo "points=$(mysql -N -B "$1" -e "SELECT COALESCE(SUM(points),0) FROM students")"; }
  stats "$RDB" > "$B/stats-before.txt"
  MYSQL_DATABASE="$RDB" NOTIFICATION_PUSH_CONFIG_JSON="" WHATSAPP_AUTH_PATH="/tmp/rabwa-rehearsal-wa" \
    timeout 600 node --input-type=module -e "const m = await import('./server/db.js'); await m.initDatabase(process.env.MYSQL_DATABASE); process.exit(0);"
  stats "$RDB" > "$B/stats-rehearsal.txt"
  APPLIED=$(mysql -N -B "$RDB" -e "SELECT MAX(version) FROM schema_migrations")
  for H in $HOSTS; do mysql -e "REVOKE ALL PRIVILEGES ON \`$RDB\`.* FROM '$APPUSER'@'$H'" || true; done
  mysql -e "DROP DATABASE \`$RDB\`"
  if ! diff -q "$B/stats-before.txt" "$B/stats-rehearsal.txt" >/dev/null; then
    echo "=== التجربة غيّرت الأعداد، توقف ولم يتغير شيء في الموقع:"; diff "$B/stats-before.txt" "$B/stats-rehearsal.txt" || true
    exit 1
  fi
  echo "=== التجربة نجحت، آخر تحديث قاعدة: $APPLIED، والأعداد مطابقة"
  echo "=== النسخة الاحتياطية في: $B"
fi
SWITCHED=1
ln -sfn "$R" "$ROOT/current.next" && mv -Tf "$ROOT/current.next" "$ROOT/current"
publish "$R/dist/rabwa" "$ROOT/domain-dist"
publish "$R/dist/rabwa-path" "$ROOT/dist"
pm2 restart rboh --update-env >/dev/null
pm2 restart rboh-notifications-worker --update-env >/dev/null || true
for i in $(seq 1 40); do
  sleep 3
  [ "$(curl -s -o /dev/null -w '%{http_code}' https://rboh.cc/api/health)" = "200" ] && { SWITCHED=0; break; }
done
if [ "$SWITCHED" = "1" ]; then trap - ERR; pm2 logs rboh --lines 30 --nostream 2>&1 | tail -30; rollback; exit 1; fi
trap - ERR
pm2 save >/dev/null
echo "=== UPDATE OK: $R"
