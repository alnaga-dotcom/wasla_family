#!/bin/bash
# Backup Wasla MySQL database (mysqldump)
set -e

# Read DB connection values from .env if present, else use defaults
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

DB_HOST="${WASLA_DB_HOST:-127.0.0.1}"
DB_PORT="${WASLA_DB_PORT:-3306}"
DB_USER="${WASLA_DB_USER:-root}"
DB_PASS="${WASLA_DB_PASSWORD:-}"
DB_NAME="${WASLA_DB_NAME:-wasla}"

BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql"

MYSQL_PWD="${DB_PASS}" mysqldump -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" \
  --single-transaction --routines --triggers "${DB_NAME}" > "${BACKUP_FILE}"

# Keep only the last 30 backups
ls -t "${BACKUP_DIR}"/*.sql | tail -n +31 | xargs -r rm

echo "Backup created: ${BACKUP_FILE}"
