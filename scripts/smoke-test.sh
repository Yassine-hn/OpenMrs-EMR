#!/usr/bin/env bash
# Read-only smoke test for the running stack. Changes nothing.
# Runs on the HOST, from the repo root:   ./scripts/smoke-test.sh
#
# Credentials: OMRS_USER / OMRS_PASS if given, otherwise "admin" with OMRS_ADMIN_PASSWORD
# from .env, otherwise the distribution's public default.
set -u

BASE="${BASE_URL:-http://localhost:${HTTP_PORT:-80}}"
USER_="${OMRS_USER:-admin}"
PASS_="${OMRS_PASS:-Admin123}"   # overridden below by OMRS_ADMIN_PASSWORD from .env
fail=0

check() { # check <description> <command...>
  local desc="$1"; shift
  if out=$("$@" 2>&1); then printf 'PASS  %s%s\n' "$desc" "${out:+ - $out}"
  else printf 'FAIL  %s%s\n' "$desc" "${out:+ - $out}"; fail=1; fi
}

api() { curl -sf -m 30 -u "$USER_:$PASS_" "$BASE/openmrs/$1"; }

containers_up() {
  local bad
  bad=$(docker compose ps --format '{{.Service}} {{.State}} {{.Health}}' | awk '$2!="running" || ($3!="" && $3!="healthy")')
  [ -z "$bad" ] || { echo "$bad"; return 1; }
  echo "$(docker compose ps -q | wc -l) running"
}

http_ok() { # http_ok <path>  (follows redirects: /openmrs/spa/ -> /openmrs/spa/home)
  local code; code=$(curl -sL -o /dev/null -m 30 -w '%{http_code}' "$BASE$1")
  echo "HTTP $code"; [ "$code" = 200 ]
}

login() {
  api ws/rest/v1/session | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["authenticated"], "not authenticated"; print("user", d["user"]["display"])'
}

core_version() {
  api "ws/rest/v1/systeminformation" | python3 -c '
import json,sys
d=json.load(sys.stdin)["systemInfo"]["SystemInfo.title.openmrsInformation"]
print(d.get("SystemInfo.OpenMRSInstallation.openmrsVersion","?"))'
}

modules() {
  api "ws/rest/v1/module?v=custom:(uuid,version,started)" | python3 -c '
import json,sys
m=json.load(sys.stdin)["results"]; stopped=[x["uuid"] for x in m if not x["started"]]
print(f"{len(m)} modules, {len(m)-len(stopped)} started" + (f", NOT started: {stopped}" if stopped else ""))
sys.exit(1 if stopped else 0)'
}

fhir() {
  api "ws/fhir2/R4/metadata" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["resourceType"], "FHIR", d["fhirVersion"])'
}

patients() {
  api "ws/fhir2/R4/Patient?_summary=count" | python3 -c 'import json,sys; print(json.load(sys.stdin)["total"], "patients")'
}

# --- our configuration (config/, docs/configuration.md) ---
default_locale() {
  api "ws/rest/v1/systemsetting?q=default_locale&v=custom:(property,value)" | python3 -c '
import json,sys
r=[x for x in json.load(sys.stdin)["results"] if x["property"]=="default_locale"]
v=r[0]["value"] if r else None; print("default_locale =", v); sys.exit(0 if v=="fr" else 1)'
}

chu_locations() {
  api "ws/rest/v1/location?tag=Login%20Location&v=custom:(display)" | python3 -c '
import json,sys
names=sorted(x["display"] for x in json.load(sys.stdin)["results"]); print(", ".join(names))
sys.exit(0 if "Consultations de neurochirurgie" in names and not any("Ubuntu" in n or "Ward" in n for n in names) else 1)'
}

address_hierarchy() {
  api "module/addresshierarchy/ajax/getChildAddressHierarchyEntries.form?searchString=Alg%C3%A9rie" | python3 -c '
import json,sys
w=json.load(sys.stdin); print(len(w), "wilayas under Algérie"); sys.exit(0 if len(w)==69 else 1)'
}

no_demo_users() {
  api "ws/rest/v1/user?q=clerk&v=custom:(username)" | python3 -c '
import json,sys
u=[x["username"] for x in json.load(sys.stdin)["results"]]; print("demo users found:", u if u else "none"); sys.exit(1 if u else 0)'
}

cd "$(dirname "$0")/.." || exit 1
[ -f .env ] && set -a && . ./.env && set +a && BASE="${BASE_URL:-http://localhost:${HTTP_PORT:-80}}"
PASS_="${OMRS_PASS:-${OMRS_ADMIN_PASSWORD:-$PASS_}}"

echo "Smoke test against $BASE"
check "containers running and healthy"      containers_up
check "O3 UI served         /openmrs/spa/"   http_ok /openmrs/spa/
check "legacy admin served  /openmrs/"       http_ok /openmrs/
check "REST login"                           login
check "OpenMRS core version"                 core_version
check "all modules started"                  modules
check "FHIR R4 endpoint"                     fhir
check "patient count (FHIR)"                 patients
check "config: French by default"            default_locale
check "config: CHU Blida login locations"    chu_locations
check "config: address hierarchy (DZ)"       address_hierarchy
check "config: no demo users"                no_demo_users

[ $fail = 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $fail
