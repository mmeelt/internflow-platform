FROM postgres:16-alpine

RUN apk add --no-cache restic

COPY backup.sh /usr/local/bin/backup.sh
COPY entrypoint.sh /usr/local/bin/backup-entrypoint.sh

RUN chmod 0755 /usr/local/bin/backup.sh /usr/local/bin/backup-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/backup-entrypoint.sh"]
