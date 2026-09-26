#!/usr/bin/env bash
# يستقبل حزمة النشر من GitHub Actions عبر مفتاح SSH مقيّد، ثم يشغّل rabwa-update.sh.
# لا يقبل أي أمر غير: deploy <sha> <sha256>
set -euo pipefail
exec 9>/run/rabwa-github-deploy.lock
flock -n 9 || { echo "نشر آخر قيد التنفيذ"; exit 1; }
read -r verb sha digest extra <<< "${SSH_ORIGINAL_COMMAND:-}"
if [[ "${verb:-}" != "deploy" || ! "${sha:-}" =~ ^[0-9a-f]{40}$ || ! "${digest:-}" =~ ^[0-9a-f]{64}$ || -n "${extra:-}" ]]; then
  echo "أمر مرفوض"; exit 1
fi
tmp=/root/rabwa-release.tgz.incoming
cat > "$tmp"
if ! echo "$digest  $tmp" | sha256sum -c --status; then
  rm -f "$tmp"; echo "الحزمة تالفة (sha256 غير مطابق)"; exit 1
fi
mv -f "$tmp" /root/rabwa-release.tgz
echo "=== نشر من GitHub: $sha"
bash /root/rabwa-update.sh
echo "$sha" > /root/rabwa-last-github-sha
