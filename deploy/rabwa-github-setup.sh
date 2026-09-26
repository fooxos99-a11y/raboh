#!/usr/bin/env bash
# تجهيز النشر التلقائي من GitHub بأمر واحد. شغّله من Git Bash داخل «ربوة الجديد»:
#   bash deploy/rabwa-github-setup.sh
# يفتح ملف github-secrets.txt فيه القيم الأربع لإعدادات GitHub. احذفه بعد النسخ.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY=~/.ssh/codex_rabwa_deploy
HOST=root@161.97.171.108
scp -i "$KEY" deploy/rabwa-update.sh deploy/rabwa-github-receiver.sh deploy/rabwa-github-server-setup.sh "$HOST":/root/
ssh -i "$KEY" "$HOST" "sed -i 's/\r\$//' /root/rabwa-github-server-setup.sh && bash /root/rabwa-github-server-setup.sh && rm -f /root/rabwa-github-server-setup.sh" > github-secrets.txt
echo "=== تم تجهيز السيرفر. انسخ القيم من github-secrets.txt إلى GitHub ثم احذف الملف."
notepad github-secrets.txt 2>/dev/null || start github-secrets.txt 2>/dev/null || true
