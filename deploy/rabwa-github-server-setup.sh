#!/usr/bin/env bash
# يُشغَّل على السيرفر مرة واحدة: مفتاح نشر مقيّد لـ GitHub. يطبع قيم الأسرار الأربعة فقط.
set -euo pipefail
sed -i 's/\r$//' /root/rabwa-update.sh /root/rabwa-github-receiver.sh
chmod 700 /root/rabwa-update.sh /root/rabwa-github-receiver.sh
KEY=/root/.ssh/rabwa_github_deploy
mkdir -p /root/.ssh && chmod 700 /root/.ssh
[ -f "$KEY" ] || ssh-keygen -q -t ed25519 -N '' -C rabwa-github-deploy -f "$KEY"
AUTH=/root/.ssh/authorized_keys
touch "$AUTH" && chmod 600 "$AUTH"
sed -i '/rabwa-github-deploy$/d' "$AUTH"
echo "restrict,command=\"/root/rabwa-github-receiver.sh\" $(cat "$KEY.pub")" >> "$AUTH"
echo "===== WEB_SSH_PRIVATE_KEY ====="
cat "$KEY"
echo "===== WEB_SSH_KNOWN_HOSTS ====="
echo "161.97.171.108 $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
echo "===== WEB_SSH_DESTINATION ====="
echo "root@161.97.171.108"
echo "===== WEB_BUILD_COMMANDS ====="
echo '["npm run build:rabwa","npm run build:rabwa:path"]'
