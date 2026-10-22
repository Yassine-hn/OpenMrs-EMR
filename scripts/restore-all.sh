#!/usr/bin/env bash
# restore-all.sh - Restore Server 1 databases and data directories from backups
# Restores:
#   1. openmrs-db-$TS.sql.gz      -> MariaDB openmrs database
#   2. orthanc-db-$TS.sql.gz      -> PostgreSQL orthanc database
#   3. openmrs-data-$TS.tar.gz    -> openmrs-emr_openmrs-data volume
#   4. orthanc-storage-$TS.tar.gz -> openmrs-emr_orthanc-storage volume

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/backups"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <TIMESTAMP> [--yes]"
  echo "Available backups in $BACKUP_DIR:"
  ls -1 "$BACKUP_DIR"/openmrs-db-*.sql.gz 2>/dev/null | sed -e 's/.*openmrs-db-//' -e 's/\.sql\.gz//' | sort -r | head -5
  exit 1
fi

TS="$1"
CONFIRM="${2:-}"

DB_FILE="$BACKUP_DIR/openmrs-db-$TS.sql.gz"
ORTHANC_DB_FILE="$BACKUP_DIR/orthanc-db-$TS.sql.gz"
DATA_FILE="$BACKUP_DIR/openmrs-data-$TS.tar.gz"
STORAGE_FILE="$BACKUP_DIR/orthanc-storage-$TS.tar.gz"

for f in "$DB_FILE" "$ORTHANC_DB_FILE" "$DATA_FILE" "$STORAGE_FILE"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing backup file: $f"
    exit 1
  fi
done

echo "=== Restore Server 1 from Backup ==="
echo "Timestamp : $TS"
echo "Target DB : MariaDB + PostgreSQL"
echo "Target Vol: openmrs-emr_openmrs-data, openmrs-emr_orthanc-storage"
echo

if [ "$CONFIRM" != "--yes" ]; then
  read -r -p "WARNING: This will overwrite existing data. Proceed? [y/N] " resp
  if [[ ! "$resp" =~ ^[yY]([eE][sS])?$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# 1. Stop application containers to prevent concurrent writes
echo "[1/6] Stopping application services (keeping db and orthanc-db up)..."
docker compose -f "$REPO_ROOT/docker-compose.yml" stop gateway frontend backend orthanc ohif

# Ensure databases are running
docker compose -f "$REPO_ROOT/docker-compose.yml" up -d db orthanc-db

# Wait for DB readiness
echo "[2/6] Waiting for databases to become ready..."
until docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1"' >/dev/null 2>&1; do
  sleep 2
done
until docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T orthanc-db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  sleep 2
done

# 3. Restore MariaDB
echo "[3/6] Restoring MariaDB (openmrs)..."
zcat "$DB_FILE" | docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" openmrs'

# 4. Restore PostgreSQL Orthanc Index
echo "[4/6] Restoring PostgreSQL (orthanc)..."
zcat "$ORTHANC_DB_FILE" | docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T orthanc-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# 5. Restore OpenMRS Data Directory volume
echo "[5/6] Restoring OpenMRS Data volume..."
docker run --rm -v openmrs-emr_openmrs-data:/data -v "$BACKUP_DIR":/backup:ro mariadb:10.11.7 \
  sh -c 'tar xzf "/backup/openmrs-data-'"$TS"'.tar.gz" -C /data'

# 6. Restore Orthanc Raw Storage volume
echo "[6/6] Restoring Orthanc Raw DICOM Storage volume..."
docker run --rm -v openmrs-emr_orthanc-storage:/data -v "$BACKUP_DIR":/backup:ro mariadb:10.11.7 \
  sh -c 'tar xzf "/backup/orthanc-storage-'"$TS"'.tar.gz" -C /data'

# Start full stack
echo
echo "Starting full Server 1 stack..."
docker compose -f "$REPO_ROOT/docker-compose.yml" up -d

echo "Waiting for OpenMRS REST API..."
until curl -sf http://localhost/openmrs/ws/rest/v1/session >/dev/null 2>&1; do
  sleep 3
done

echo
echo "=== Restore Complete. Running Smoke Test ==="
"$REPO_ROOT/scripts/smoke-test.sh"
