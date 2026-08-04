#!/bin/bash
# Backup Wasla SQLite database
set -e

DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)/data"
BACKUP_DIR="${DATA_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_FILE="${DATA_DIR}/wasla.db"
BACKUP_FILE="${BACKUP_DIR}/wasla_${TIMESTAMP}.db"

mkdir -p "${BACKUP_DIR}"

cp "${DB_FILE}" "${BACKUP_FILE}"

# Keep only the last 30 backups
ls -t "${BACKUP_DIR}"/wasla_*.db | tail -n +31 | xargs -r rm

echo "Backup created: ${BACKUP_FILE}"
