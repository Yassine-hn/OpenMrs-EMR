#!/usr/bin/env bash
# Phase 4 Imaging automated test suite: Orthanc PACS + OHIF Viewer + Gateway Access Control
# Target: Neurosurgery Department, CHU Frantz Fanon, Blida

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
TEST_USER="${TEST_USER:-test-medecin}"
TEST_PASSWORD="${TEST_USER_PASSWORD:-Test-Neuro-2026}"
PATIENT_ID="${1:-100000Y}"

FAILED=0

pass() {
  printf "\e[32mPASS\e[0m  %-50s -> %s\n" "$1" "$2"
}

fail() {
  printf "\e[31mFAIL\e[0m  %-50s -> %s\n" "$1" "$2"
  FAILED=$((FAILED + 1))
}

echo "Running Phase 4 Imaging test suite against ${BASE_URL}..."

# 1. Unauthenticated refusal on /dicom-web/studies
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/dicom-web/studies")
if [[ "$HTTP_CODE" == "401" ]]; then
  pass "Unauthenticated /dicom-web/studies refused" "HTTP 401"
else
  fail "Unauthenticated /dicom-web/studies refused" "Expected 401, got $HTTP_CODE"
fi

# 2. Unauthenticated refusal on /ohif/
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/ohif/")
if [[ "$HTTP_CODE" == "401" ]]; then
  pass "Unauthenticated /ohif/ refused" "HTTP 401"
else
  fail "Unauthenticated /ohif/ refused" "Expected 401, got $HTTP_CODE"
fi

# 3. Authenticate and obtain session cookie
COOKIE_JAR=$(mktemp)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" -u "${TEST_USER}:${TEST_PASSWORD}" "${BASE_URL}/openmrs/ws/rest/v1/session")
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "OpenMRS user authentication (${TEST_USER})" "HTTP 200"
else
  fail "OpenMRS user authentication (${TEST_USER})" "Expected 200, got $HTTP_CODE"
fi

# 4. Verify cookie path rewriting
if grep -q "JSESSIONID" "$COOKIE_JAR"; then
  COOKIE_PATH=$(awk '$6 == "JSESSIONID" {print $3}' "$COOKIE_JAR")
  if [[ "$COOKIE_PATH" == "/" ]]; then
    pass "Gateway JSESSIONID cookie path rewritten to /" "Path=/"
  else
    fail "Gateway JSESSIONID cookie path rewritten to /" "Got Path=$COOKIE_PATH"
  fi
else
  fail "Gateway JSESSIONID cookie received" "Cookie missing"
fi

# 5. Authenticated /dicom-web/studies
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "${BASE_URL}/dicom-web/studies")
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Authenticated /dicom-web/studies access" "HTTP 200"
else
  fail "Authenticated /dicom-web/studies access" "Expected 200, got $HTTP_CODE"
fi

# 6. Authenticated /dicom-web/studies filtered by patient ID
PATIENT_STUDIES=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/dicom-web/studies?PatientID=${PATIENT_ID}")
if echo "$PATIENT_STUDIES" | grep -q "${PATIENT_ID}"; then
  STUDY_UID=$(echo "$PATIENT_STUDIES" | jq -r '.[0]["0020000D"].Value[0]')
  pass "DICOMweb query for patient ${PATIENT_ID}" "Found Study UID: ${STUDY_UID}"
else
  fail "DICOMweb query for patient ${PATIENT_ID}" "Patient study not found"
fi

# 7. Authenticated /ohif/ loads index HTML
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "${BASE_URL}/ohif/")
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Authenticated /ohif/ viewer access" "HTTP 200"
else
  fail "Authenticated /ohif/ viewer access" "Expected 200, got $HTTP_CODE"
fi

# 8. Authenticated /ohif/app-config.js loads custom DICOMweb config
OHIF_CONFIG=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/ohif/app-config.js")
if echo "$OHIF_CONFIG" | grep -q "/dicom-web"; then
  pass "OHIF app-config.js configured for /dicom-web" "routerBasename: /ohif, wadoRoot: /dicom-web"
else
  fail "OHIF app-config.js configured for /dicom-web" "Missing /dicom-web config"
fi

# 9. Verify Orthanc PostgreSQL index tables
TABLE_COUNT=$(docker exec openmrs-emr-orthanc-db-1 psql -U orthanc -d orthanc -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d '[:space:]')
if [[ "$TABLE_COUNT" -ge 10 ]]; then
  pass "Orthanc PostgreSQL index tables verified" "${TABLE_COUNT} tables present in orthanc-db"
else
  fail "Orthanc PostgreSQL index tables verified" "Expected >= 10, got $TABLE_COUNT"
fi

# 10. DICOM storage files on disk volume
FILE_COUNT=$(docker exec openmrs-emr-orthanc-1 ls -1 /var/lib/orthanc/storage 2>/dev/null | wc -l | tr -d '[:space:]')
if [[ "$FILE_COUNT" -ge 1 ]]; then
  pass "DICOM files stored on persistent disk volume" "${FILE_COUNT} object directories found"
else
  fail "DICOM files stored on persistent disk volume" "No files found in /var/lib/orthanc/storage"
fi

rm -f "$COOKIE_JAR"

if [[ $FAILED -eq 0 ]]; then
  echo -e "\n\e[32mALL 10 PHASE 4 IMAGING CHECKS PASSED\e[0m"
  exit 0
else
  echo -e "\n\e[31m${FAILED} CHECKS FAILED\e[0m"
  exit 1
fi
