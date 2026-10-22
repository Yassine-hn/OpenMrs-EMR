#!/usr/bin/env bash
# backup-all.sh - Consistent online backup of all 4 Server 1 data volumes
# Volumes backed up:
#   1. openmrs-emr_db-data         -> MariaDB SQL dump (single-transaction)
#   2. openmrs-emr_orthanc-db-data -> PostgreSQL SQL dump (Orthanc PACS index)
#   3. openmrs-emr_openmrs-data    -> OpenMRS data dir tarball (runtime keys, attachments)
#   4. openmrs-emr_orthanc-storage -> Orthanc DICOM Part 10 raw storage tarball

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/backups"

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)

echo "=== OpenMRS-EMR Server 1 Backup ==="
echo "Timestamp : $TS"
echo "Destination: $BACKUP_DIR"
echo

# 1. MariaDB Database
echo "[1/4] Dumping MariaDB (openmrs)..."
docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T db sh -c \
  'mariadb-dump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines openmrs' \
  | gzip > "$BACKUP_DIR/openmrs-db-$TS.sql.gz"
echo "      Done: openmrs-db-$TS.sql.gz ($(du -h "$BACKUP_DIR/openmrs-db-$TS.sql.gz" | cut -f1))"

# 2. PostgreSQL Orthanc Index
echo "[2/4] Dumping PostgreSQL (orthanc-db)..."
docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T orthanc-db sh -c \
  'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "$BACKUP_DIR/orthanc-db-$TS.sql.gz"
echo "      Done: orthanc-db-$TS.sql.gz ($(du -h "$BACKUP_DIR/orthanc-db-$TS.sql.gz" | cut -f1))"

# 3. OpenMRS Data Directory (skips .openmrs-lib-cache)
echo "[3/4] Archiving OpenMRS Data volume..."
docker run --rm -v openmrs-emr_openmrs-data:/data:ro mariadb:10.11.7 \
  tar czf - -C /data --exclude=./.openmrs-lib-cache . > "$BACKUP_DIR/openmrs-data-$TS.tar.gz"
echo "      Done: openmrs-data-$TS.tar.gz ($(du -h "$BACKUP_DIR/openmrs-data-$TS.tar.gz" | cut -f1))"

# 4. Orthanc DICOM Storage
echo "[4/4] Archiving Orthanc Raw DICOM Storage volume..."
docker run --rm -v openmrs-emr_orthanc-storage:/data:ro mariadb:10.11.7 \
  tar czf - -C /data . > "$BACKUP_DIR/orthanc-storage-$TS.tar.gz"
echo "      Done: orthanc-storage-$TS.tar.gz ($(du -h "$BACKUP_DIR/orthanc-storage-$TS.tar.gz" | cut -f1))"

echo
echo "=== Backup Complete ==="
ls -lh "$BACKUP_DIR"/*"$TS"*
