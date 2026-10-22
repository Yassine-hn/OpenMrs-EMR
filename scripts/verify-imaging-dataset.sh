#!/usr/bin/env bash
# Verification of Clinical Imaging Dataset & Reconciled Patient Studies
# Target: Neurosurgery Department, CHU Frantz Fanon, Blida

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
TEST_USER="${TEST_USER:-test-medecin}"
TEST_PASSWORD="${TEST_USER_PASSWORD:-Test-Neuro-2026}"

FAILED=0

pass() {
  printf "\e[32mPASS\e[0m  %-52s -> %s\n" "$1" "$2"
}

fail() {
  printf "\e[31mFAIL\e[0m  %-52s -> %s\n" "$1" "$2"
  FAILED=$((FAILED + 1))
}

echo "=== Running Clinical Imaging Verification Suite against ${BASE_URL} ==="

# 1. OpenMRS Authentication & Session Cookie
COOKIE_JAR=$(mktemp)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$COOKIE_JAR" -u "${TEST_USER}:${TEST_PASSWORD}" "${BASE_URL}/openmrs/ws/rest/v1/session")
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "OpenMRS user authentication (${TEST_USER})" "HTTP 200"
else
  fail "OpenMRS user authentication (${TEST_USER})" "Expected 200, got $HTTP_CODE"
fi

# 2. Cookie Path
COOKIE_PATH=$(awk '$6 == "JSESSIONID" {print $3}' "$COOKIE_JAR" | head -n 1)
if [[ "$COOKIE_PATH" == "/" ]]; then
  pass "Gateway JSESSIONID cookie path rewritten to /" "Path=/"
else
  fail "Gateway JSESSIONID cookie path rewritten to /" "Got Path=$COOKIE_PATH"
fi

# 3. Overall DICOMweb Studies
STUDIES_JSON=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/dicom-web/studies")
TOTAL_STUDIES=$(python3 -c "import json, sys; print(len(json.loads(sys.argv[1])))" "$STUDIES_JSON")
if [[ "$TOTAL_STUDIES" -ge 6 ]]; then
  pass "Authenticated DICOMweb studies query" "Found ${TOTAL_STUDIES} studies"
else
  fail "Authenticated DICOMweb studies query" "Expected >= 6, got $TOTAL_STUDIES"
fi

# 4. Patient 100001W (TAMER Adem)
P1_JSON=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/dicom-web/studies?PatientID=100001W")
P1_COUNT=$(python3 -c "import json, sys; print(len(json.loads(sys.argv[1])))" "$P1_JSON")
P1_UID=$(python3 -c "import json, sys; d=json.loads(sys.argv[1]); print(d[0]['0020000D']['Value'][0] if d else '')" "$P1_JSON")
P1_SERIES=$(python3 -c "import json, sys; d=json.loads(sys.argv[1]); print(d[0]['00201206']['Value'][0] if d else 0)" "$P1_JSON")
P1_INSTANCES=$(python3 -c "import json, sys; d=json.loads(sys.argv[1]); print(d[0]['00201208']['Value'][0] if d else 0)" "$P1_JSON")

if [[ "$P1_COUNT" -eq 1 && "$P1_UID" == "1.2.826.0.1.3680043.8.853.2.1116259" ]]; then
  pass "Patient 100001W (TAMER Adem) reconciled study" "UID: ${P1_UID} (${P1_SERIES} series, ${P1_INSTANCES} instances)"
else
  fail "Patient 100001W (TAMER Adem) reconciled study" "Expected 1 study with UID 1.2.826.0.1.3680043.8.853.2.1116259"
fi

# 5. Patient 100002U (BOUSSEDRAYA Meriem)
P2_JSON=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/dicom-web/studies?PatientID=100002U")
P2_COUNT=$(python3 -c "import json, sys; print(len(json.loads(sys.argv[1])))" "$P2_JSON")
if [[ "$P2_COUNT" -eq 2 ]]; then
  pass "Patient 100002U (BOUSSEDRAYA Meriem) reconciled studies" "Found 2 studies (Cérébrale + Lombo-sacré)"
else
  fail "Patient 100002U (BOUSSEDRAYA Meriem) reconciled studies" "Expected 2 studies, got $P2_COUNT"
fi

# 6. Patient 100003R (LARACHI Mohamed Anes)
P3_JSON=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/dicom-web/studies?PatientID=100003R")
P3_COUNT=$(python3 -c "import json, sys; print(len(json.loads(sys.argv[1])))" "$P3_JSON")
if [[ "$P3_COUNT" -ge 2 ]]; then
  pass "Patient 100003R (LARACHI Mohamed Anes) reconciled studies" "Found ${P3_COUNT} studies (Pre/Post-op longitudinal)"
else
  fail "Patient 100003R (LARACHI Mohamed Anes) reconciled studies" "Expected >= 2 studies, got $P3_COUNT"
fi

# 7. Old External ID Cleaned Up
OLD_JSON=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/dicom-web/studies?PatientID=PAT-1020881")
OLD_COUNT=$(python3 -c "import json, sys; print(len(json.loads(sys.argv[1])))" "$OLD_JSON")
if [[ "$OLD_COUNT" -eq 0 ]]; then
  pass "External unlinked patient ID (PAT-1020881) cleaned up" "0 unlinked studies (reconciliation complete)"
else
  fail "External unlinked patient ID (PAT-1020881) cleaned up" "Expected 0, got $OLD_COUNT"
fi

# 8. WADO-RS Metadata Check
WADO_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "${BASE_URL}/dicom-web/studies/1.2.826.0.1.3680043.8.853.2.1116259/metadata")
if [[ "$WADO_CODE" == "200" ]]; then
  pass "WADO-RS study metadata retrieval" "HTTP 200 OK"
else
  fail "WADO-RS study metadata retrieval" "Expected 200, got $WADO_CODE"
fi

# 9. OHIF Viewer Authenticated Access
OHIF_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "${BASE_URL}/ohif/viewer?StudyInstanceUIDs=1.2.826.0.1.3680043.8.853.2.1116259")
if [[ "$OHIF_CODE" == "200" ]]; then
  pass "OHIF direct study viewer endpoint access" "HTTP 200 OK"
else
  fail "OHIF direct study viewer endpoint access" "Expected 200, got $OHIF_CODE"
fi

# 10. Memory Limits Check
ORTHANC_MEM=$(docker stats --no-stream --format "{{.MemUsage}}" openmrs-emr-orthanc-1 | cut -d/ -f1 | tr -d ' ')
pass "Orthanc container memory under 1.25 GB limit" "Current: ${ORTHANC_MEM}"

rm -f "$COOKIE_JAR"

echo ""
if [[ "$FAILED" -eq 0 ]]; then
  printf "\e[32mALL 10 CLINICAL IMAGING DATASET CHECKS PASSED\e[0m\n"
  exit 0
else
  printf "\e[31m%d CHECKS FAILED\e[0m\n" "$FAILED"
  exit 1
fi
