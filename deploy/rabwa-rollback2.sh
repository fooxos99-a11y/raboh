#!/usr/bin/env bash
# الرجوع للإصدار السابق. لا يلمس بيانات القاعدة.
set -euo pipefail
publish() { # $1 مصدر $2 وجهة، مع الإبقاء على مجلد التحميلات
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete --exclude 'downloads/' "$1/" "$2/"
  else
    find "$2" -mindepth 1 -maxdepth 1 ! -name downloads -exec rm -rf {} +
    (cd "$1" && tar --exclude='./downloads' -cf - .) | (cd "$2" && tar -xf -)
  fi
}
ROOT=/var/www/rboh
TS=$(cat /root/rabwa-new-ts)
B=$ROOT/runtime/database-backups/pre-rabwa-new-$TS
PREV=$(cat "$B/previous-release.txt")
ln -sfn "$PREV" "$ROOT/current.next" && mv -Tf "$ROOT/current.next" "$ROOT/current"
publish "$ROOT/domain-dist.rollback-rabwa-new-$TS" "$ROOT/domain-dist"
publish "$ROOT/dist.rollback-rabwa-new-$TS" "$ROOT/dist"
pm2 restart rboh --update-env >/dev/null
pm2 restart rboh-notifications-worker --update-env >/dev/null || true
if ! pm2 describe rboh-nazem-worker >/dev/null 2>&1; then
  (cd "$ROOT/current" && pm2 start server/workers/nazemSyncWorker.js --name rboh-nazem-worker >/dev/null) || true
fi
pm2 save >/dev/null
sleep 5
echo "=== رجعت إلى: $PREV"
echo "=== فحص الموقع: $(curl -s -o /dev/null -w '%{http_code}' https://rboh.cc/api/health)"
