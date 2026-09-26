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
  echo "=== توقف: الإصدار فيه تحديثات قاعدة بيانات جديدة:"; comm -13 <(echo "$OLD") <(echo "$NEW")
  echo "=== هذا يحتاج نسخة احتياطية وتجربة قبل الرفع. لم يتغير شيء في الموقع."
  exit 1
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
