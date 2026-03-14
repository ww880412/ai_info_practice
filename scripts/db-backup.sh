#!/bin/sh
set -e

# Database backup script for ai_info_practice
# Usage: ./scripts/db-backup.sh (from host) or /backup.sh (inside container)

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${PGDATABASE:-ai_practice}"
DB_USER="${PGUSER:-ai_practice}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="ai_practice_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting: $FILENAME"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" | gzip > "${BACKUP_DIR}/${FILENAME}"
echo "[backup] Done: $(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)"

# Clean up backups older than retention period
DELETED=$(find "$BACKUP_DIR" -name "ai_practice_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[backup] Cleaned $DELETED file(s) older than ${RETENTION_DAYS} days"
fi
