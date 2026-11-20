#!/bin/sh
# Upload apps/landing/dist to GoDaddy hosting over SFTP. Reads .env.deploy (never committed).
set -e
cd "$(dirname "$0")/.."
[ -f .env.deploy ] || { echo "Missing .env.deploy. Copy .env.deploy.example and fill it in."; exit 1; }
set -a; . ./.env.deploy; set +a
for v in GODADDY_SFTP_HOST GODADDY_SFTP_USER GODADDY_REMOTE_DIR LANDING_DOMAIN; do
  eval "val=\${$v:-}"
  [ -n "$val" ] || { echo "$v is empty in .env.deploy"; exit 1; }
done
[ -n "${GODADDY_SFTP_PASSWORD:-}" ] || [ -n "${GODADDY_SFTP_KEY:-}" ] || { echo "Set GODADDY_SFTP_PASSWORD or GODADDY_SFTP_KEY in .env.deploy"; exit 1; }
[ -f apps/landing/dist/index.html ] || { echo "Run pnpm build:landing first."; exit 1; }
command -v lftp >/dev/null || { echo "Install lftp first (brew install lftp)."; exit 1; }
SETTINGS="set sftp:auto-confirm yes;"
[ -n "${GODADDY_SFTP_KEY:-}" ] && SETTINGS="$SETTINGS set sftp:connect-program \"ssh -a -x -i $GODADDY_SFTP_KEY\";"
lftp -u "$GODADDY_SFTP_USER","${GODADDY_SFTP_PASSWORD:-x}" "sftp://$GODADDY_SFTP_HOST" -e "$SETTINGS mirror -R --delete --verbose apps/landing/dist $GODADDY_REMOTE_DIR; bye"
echo "Uploaded. Open https://$LANDING_DOMAIN"
