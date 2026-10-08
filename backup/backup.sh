#!/bin/sh
set -eu
umask 077

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="$(mktemp -d /tmp/intern-portal-backup.XXXXXX)"
RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-/backups/restic}"

if [ -z "${RESTIC_PASSWORD:-}" ]; then
  echo "RESTIC_PASSWORD must be set. Refusing to create an unencrypted backup." >&2
  exit 1
fi

cleanup() {
  # Only known temporary files are removed; never recursively delete a path.
  rm -f -- "$WORK_DIR/database.sql.gz" "$WORK_DIR/uploads.tar.gz" "$WORK_DIR/backup-created-at.txt"
  rmdir "$WORK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[$(date -u +%FT%TZ)] Starting encrypted backup"
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "${DB_HOST:-postgres-db}" \
  -U "$DB_USERNAME" \
  -d "$DB_NAME" \
  --no-owner --no-privileges \
  | gzip -c > "$WORK_DIR/database.sql.gz"

# Uploads are mounted read-only. The temporary archive is removed after Restic
# encrypts it, so plain documents and SQL dumps never remain in /backups.
tar -C /data/uploads -czf "$WORK_DIR/uploads.tar.gz" .
printf '%s\n' "$STAMP" > "$WORK_DIR/backup-created-at.txt"

restic snapshots >/dev/null 2>&1 || restic init
restic backup --tag intern-portal --tag database-and-uploads "$WORK_DIR"
restic forget --keep-daily "${RESTIC_KEEP_DAILY:-7}" --keep-weekly "${RESTIC_KEEP_WEEKLY:-4}" --keep-monthly "${RESTIC_KEEP_MONTHLY:-12}" --prune

echo "[$(date -u +%FT%TZ)] Encrypted backup completed"
