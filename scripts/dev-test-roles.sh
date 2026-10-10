#!/usr/bin/env bash
# DEVELOPMENT ONLY. Checks what each CHU role may and may not do, through the REST API,
# with the test users of scripts/dev-create-test-users.sh. Never run on the hospital server.
#
# Runs on the HOST, from the repo root:
#   TEST_USER_PASSWORD='...' ./scripts/dev-test-roles.sh <patient uuid>
# Every record a test user manages to create is removed again (voided/retired) as admin,
# so the script can be re-run. Exit code 0 = every result matched the expectation.
set -uo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
: "${TEST_USER_PASSWORD:?set TEST_USER_PASSWORD}"
: "${OMRS_ADMIN_PASSWORD:?OMRS_ADMIN_PASSWORD missing from .env}"
PATIENT="${1:?usage: $0 <patient uuid>}"
BASE="${BASE_URL:-http://localhost:${HTTP_PORT:-80}}/openmrs/ws/rest/v1"
fail=0

# concepts from the configuration (CIEL)
PENICILLINS=162297AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA  # drug allergen "Penicillins" (member of set 162552)
SEVERE=1500AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
HEADACHE=139084AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA     # also a diagnosis concept

call() { # call <user> <method> <path> [body] -> prints "<http code> <body>"
  local user="$1" pass="$TEST_USER_PASSWORD"
  [ "$1" = admin ] && pass="$OMRS_ADMIN_PASSWORD"
  curl -s -m 30 -u "$user:$pass" -X "$2" -H 'Content-Type: application/json' ${4:+-d "$4"} \
    -w '\n%{http_code}' "$BASE/$3" | python3 -c '
import sys; d=sys.stdin.read().rsplit("\n",1); print(d[1], d[0].replace("\n"," ")[:3000])'
}

uuid_of() { python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("uuid",""))' "$1" 2>/dev/null; }

check() { # check <user> <expected code> <label> <method> <path> [body] [cleanup path prefix]
  local user="$1" expected="$2" label="$3" out code body uuid
  out=$(call "$user" "$4" "$5" "${6:-}"); code=${out%% *}; body=${out#* }
  if [ "$code" = "$expected" ]; then printf 'PASS  %-17s %-32s -> %s\n' "$user" "$label" "$code"
  else printf 'FAIL  %-17s %-32s -> %s (expected %s) %s\n' "$user" "$label" "$code" "$expected" "${body:0:160}"; fail=1; fi
  if [[ "$code" =~ ^20[01]$ ]] && [ -n "${7:-}" ]; then
    uuid=$(uuid_of "$body"); [ -n "$uuid" ] && call admin DELETE "$7/$uuid" >/dev/null
  fi
}

ALLERGY="{\"allergen\":{\"allergenType\":\"DRUG\",\"codedAllergen\":{\"uuid\":\"$PENICILLINS\"}},\"severity\":{\"uuid\":\"$SEVERE\"},\"reactions\":[{\"reaction\":{\"uuid\":\"$HEADACHE\"}}]}"
CONDITION="{\"patient\":\"$PATIENT\",\"condition\":{\"coded\":\"$HEADACHE\"},\"clinicalStatus\":\"ACTIVE\"}"
PERSON='{"names":[{"givenName":"Role","familyName":"Test"}],"gender":"M","birthdate":"1990-01-01"}'
NEWUSER='{"username":"should-not-exist","password":"Xx123456789","person":{"names":[{"givenName":"No","familyName":"Way"}],"gender":"M"},"roles":[]}'

for u in test-secretariat test-infirmier test-medecin; do
  check "$u" 200 "read the patient"            GET  "patient/$PATIENT"
  check "$u" 200 "read the visits"             GET  "visit?patient=$PATIENT"
done
check test-secretariat 201 "create a person"      POST person "$PERSON" person
check test-infirmier   403 "create a person"      POST person "$PERSON" person
check test-medecin     201 "create a person"      POST person "$PERSON" person
check test-secretariat 403 "record an allergy"    POST "patient/$PATIENT/allergy" "$ALLERGY" "patient/$PATIENT/allergy"
check test-infirmier   201 "record an allergy"    POST "patient/$PATIENT/allergy" "$ALLERGY" "patient/$PATIENT/allergy"
check test-medecin     201 "record an allergy"    POST "patient/$PATIENT/allergy" "$ALLERGY" "patient/$PATIENT/allergy"
check test-secretariat 403 "record a condition"   POST condition "$CONDITION" condition
check test-infirmier   403 "record a condition"   POST condition "$CONDITION" condition
check test-medecin     201 "record a condition"   POST condition "$CONDITION" condition
for u in test-secretariat test-infirmier test-medecin; do
  check "$u" 403 "create a user (admin task)"  POST user "$NEWUSER" user
done

[ $fail = 0 ] && echo "ALL ROLE CHECKS PASSED" || echo "SOME ROLE CHECKS FAILED"
exit $fail
