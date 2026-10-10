#!/usr/bin/env bash
# DEVELOPMENT ONLY. Creates one test user per CHU role, to test the roles in the browser:
#   test-secretariat (CHU - Secrétariat), test-infirmier (CHU - Infirmier),
#   test-medecin (CHU - Médecin). Each is also a provider. Default language: French.
# Never run on the hospital server.
#
# Runs on the HOST, from the repo root. Reads the admin password from .env.
# The test users' password is NOT stored anywhere: pass it in the environment.
#   TEST_USER_PASSWORD='...' ./scripts/dev-create-test-users.sh
# OpenMRS rule: at least 8 characters, with upper case, lower case and a digit.
# Users that already exist are left unchanged.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
: "${TEST_USER_PASSWORD:?set TEST_USER_PASSWORD (not stored anywhere)}"
: "${OMRS_ADMIN_PASSWORD:?OMRS_ADMIN_PASSWORD missing from .env}"
BASE="${BASE_URL:-http://localhost:${HTTP_PORT:-80}}/openmrs/ws/rest/v1"

api() { # api <method> <path> [json body]
  curl -sf -m 30 -u "admin:$OMRS_ADMIN_PASSWORD" -X "$1" -H 'Content-Type: application/json' \
    ${3:+-d "$3"} "$BASE/$2"
}

role_uuid() {
  api GET "role?v=custom:(uuid,display)&limit=100" | python3 -c '
import json,sys
name=sys.argv[1]; r=[x["uuid"] for x in json.load(sys.stdin)["results"] if x["display"]==name]
print(r[0] if r else "")' "$1"
}

create_user() { # create_user <username> <given> <family> <gender> <role name>
  local username="$1" given="$2" family="$3" gender="$4" role="$5" ruuid existing body user person
  existing=$(api GET "user?q=$username&v=custom:(username)" | python3 -c '
import json,sys; print(any(u["username"]==sys.argv[1] for u in json.load(sys.stdin)["results"]))' "$username")
  if [ "$existing" = "True" ]; then echo "exists   $username"; return; fi
  ruuid=$(role_uuid "$role")
  [ -n "$ruuid" ] || { echo "role not found: $role (is config/backend/roles loaded?)"; exit 1; }
  body=$(python3 -c '
import json,sys
u,g,f,s,r,p=sys.argv[1:7]
print(json.dumps({"username":u,"password":p,"roles":[{"uuid":r}],
  "userProperties":{"defaultLocale":"fr"},
  "person":{"names":[{"givenName":g,"familyName":f}],"gender":s}}))' \
    "$username" "$given" "$family" "$gender" "$ruuid" "$TEST_USER_PASSWORD")
  user=$(api POST user "$body")
  person=$(echo "$user" | python3 -c 'import json,sys; print(json.load(sys.stdin)["person"]["uuid"])')
  api POST provider "{\"person\":\"$person\",\"identifier\":\"$username\"}" >/dev/null
  echo "created  $username  ($role, provider)"
}

create_user test-secretariat Test Secretariat F "CHU - Secrétariat"
create_user test-infirmier   Test Infirmier   F "CHU - Infirmier"
create_user test-medecin     Test Medecin     M "CHU - Médecin"
