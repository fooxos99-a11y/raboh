#!/usr/bin/env bash
# فحص قراءة فقط لسيرفر ربوة قبل التبديل. لا يغيّر أي ملف أو قاعدة.
set -u
ROOT=/var/www/rboh
echo "=== الوقت: $(date -Is)"
echo "=== المساحة"; df -h "$ROOT" | tail -1
echo "=== مجلد ربوة"; ls -la "$ROOT" 2>&1 | head -40
echo "=== الإصدار الحالي"; readlink -f "$ROOT/current" 2>&1
echo "=== آخر الإصدارات"; ls -1t "$ROOT/releases" 2>/dev/null | head -8
echo "=== pm2"
pm2 jlist 2>/dev/null | python3 -c '
import json,sys
try:
    for p in json.load(sys.stdin):
        e=p.get("pm2_env",{})
        print(p.get("name"), e.get("status"), e.get("pm_cwd"), e.get("pm_exec_path"))
except Exception as x: print("pm2 read failed", x)'

CUR=$(readlink -f "$ROOT/current" 2>/dev/null || echo "$ROOT/current")
ENVF="$CUR/.env"
echo "=== مفاتيح .env (الأسماء فقط)"
if [ -f "$ENVF" ]; then grep -oE '^[A-Z0-9_]+' "$ENVF" | sort | tr '\n' ' '; echo; else echo "لا يوجد $ENVF"; fi
val() { grep -E "^$1=" "$ENVF" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//'; }
echo "SITE_KEY=$(val SITE_KEY)"
echo "MYSQL_DATABASE=$(val MYSQL_DATABASE)"
echo "PLATFORM_MYSQL_DATABASE=$(val PLATFORM_MYSQL_DATABASE)"
echo "API_PORT=$(val API_PORT) PORT=$(val PORT)"

export MYSQL_PWD="$(val MYSQL_PASSWORD)"
MH="$(val MYSQL_HOST)"; MP="$(val MYSQL_PORT)"; MU="$(val MYSQL_USER)"
M="mysql -h ${MH:-127.0.0.1} -P ${MP:-3306} -u ${MU:-root} -N -B"
echo "=== قواعد ربوة"
DBS=$($M -e "SHOW DATABASES" 2>&1 | grep -iE 'rabwa|rboh')
echo "$DBS"
for DB in $DBS; do
  echo "--- $DB"
  $M "$DB" -e "SELECT CONCAT('آخر ترحيل: ', MAX(version)) FROM schema_migrations" 2>&1
  $M "$DB" -e "SELECT CONCAT('ناظم: ', setting_value) FROM app_settings WHERE setting_key='nazemIntegrationEnabled'" 2>&1
  for T in students supervisors committees student_plans student_quran_tasks attendance_records student_point_transactions; do
    printf '%s: ' "$T"; $M "$DB" -e "SELECT COUNT(*) FROM $T" 2>/dev/null || echo "-"
  done
  printf 'مجموع النقاط: '; $M "$DB" -e "SELECT COALESCE(SUM(points),0) FROM students" 2>/dev/null || echo "-"
done
unset MYSQL_PWD
echo "=== فحص الموقع"
curl -s -o /dev/null -w "health %{http_code}\n" https://rboh.cc/api/health
echo "=== انتهى الفحص"
