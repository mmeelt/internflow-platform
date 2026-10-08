#!/bin/sh
set -eu

# Run one protected backup on startup, then repeat on the configured UTC cron
# schedule. This container has read-only access to uploads and cannot alter the
# database or the originals.
SCHEDULE="${BACKUP_CRON:-15 2 * * *}"
printf '%s /usr/local/bin/backup.sh >>/proc/1/fd/1 2>&1\n' "$SCHEDULE" > /etc/crontabs/root

/usr/local/bin/backup.sh
exec crond -f -l 8
