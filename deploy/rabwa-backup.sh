#!/usr/bin/env bash
# الخطوة 2: نسخة احتياطية كاملة لقواعد ربوة وواجهاتها. لا يغيّر الموقع الحالي.
set -euo pipefail
ROOT=/var/www/rboh
TS=$(date +%Y%m%d_%H%M%S)
B=$ROOT/runtime/database-backups/pre-rabwa-new-$TS
mkdir -p "$B"; chmod 700 "$B"
echo "$TS" > /root/rabwa-new-ts
readlink -f "$ROOT/current" > "$B/previous-release.txt"
echo "=== مجلد النسخة: $B"
echo "=== الإصدار الحالي: $(cat "$B/previous-release.txt")"
if ! mysql -N -e "SELECT 1" >/dev/null 2>&1; then echo "خطأ: دخول mysql كمدير غير متاح"; exit 1; fi
for DB in rabwa_main_v2 rabwa_platform_v2; do
  mysqldump --single-transaction --routines --triggers --hex-blob "$DB" | gzip > "$B/$DB.sql.gz"
  gunzip -t "$B/$DB.sql.gz"
  ( cd "$B" && sha256sum "$DB.sql.gz" >> SHA256SUMS )
  echo "$DB: $(du -h "$B/$DB.sql.gz" | cut -f1) - سليم"
done
M="mysql -N -B rabwa_main_v2 -e"
{
  for T in students supervisors committees student_quran_tasks attendance_records student_point_transactions; do
    echo "$T=$($M "SELECT COUNT(*) FROM $T")"
  done
  echo "points=$($M "SELECT COALESCE(SUM(points),0) FROM students")"
} > "$B/stats-before.txt"
echo "=== إحصاءات قبل:"; cat "$B/stats-before.txt"
cp -a "$ROOT/domain-dist" "$ROOT/domain-dist.rollback-rabwa-new-$TS"
cp -a "$ROOT/dist" "$ROOT/dist.rollback-rabwa-new-$TS"
echo "=== نسخ الواجهات: domain-dist.rollback-rabwa-new-$TS و dist.rollback-rabwa-new-$TS"
echo "=== BACKUP OK $TS"
