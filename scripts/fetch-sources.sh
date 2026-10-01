#!/usr/bin/env bash
# Clone the source code of EXACTLY the versions this stack runs, for reading and study.
# Runs on the HOST. Read-only towards the running system; writes only into the target folder.
#
#   ./scripts/fetch-sources.sh                 # into ../openmrs-source (next to this repo)
#   ./scripts/fetch-sources.sh /other/folder   # anywhere else
#
# Shallow clones (--depth 1): only the tagged version, no history, to keep it small.
# Safe to re-run: a component already at the right tag is skipped; one at another tag is
# reported and left alone (delete that folder yourself to re-fetch it).
#
# The list below matches O3 Reference Application 3.7.1 (see docker-compose.yml). Sources of
# the versions: distro/pom.xml and frontend/spa-assemble-config.json in
# openmrs-distro-referenceapplication at tag 3.7.1, cross-checked against the running
# system's module list. Tags were resolved with `git ls-remote --tags` because naming varies
# per repository (2.8.8, v4.1.0, queue-3.0.0, ...). On upgrade, update this list.
set -u

DEST="${1:-$(cd "$(dirname "$0")/../.." && pwd)/openmrs-source}"

#      folder            GitHub repository                                      tag
SOURCES="
distro            openmrs/openmrs-distro-referenceapplication            3.7.1
core              openmrs/openmrs-core                                   2.8.8
content           openmrs/openmrs-content-referenceapplication           1.4.0
content           openmrs/openmrs-content-referenceapplication-demo      1.9.2
backend-modules   openmrs/openmrs-module-addresshierarchy                2.21.0
backend-modules   Bahmni/openmrs-module-appointments                     2.1.0
backend-modules   openmrs/openmrs-module-attachments                     4.0.0
backend-modules   openmrs/openmrs-module-authentication                  authentication-2.3.0
backend-modules   openmrs/openmrs-module-bedmanagement                   7.2.0
backend-modules   openmrs/openmrs-module-billing                         v2.3.0
backend-modules   openmrs/openmrs-module-calculation                     2.0.0
backend-modules   openmrs/openmrs-module-cohort                          cohort-3.7.3
backend-modules   openmrs/openmrs-module-emrapi                          3.4.0
backend-modules   openmrs/openmrs-module-event                           4.0.0
backend-modules   openmrs/openmrs-module-fhir2                           4.2.0
backend-modules   openmrs/openmrs-module-htmlwidgets                     2.0.1
backend-modules   openmrs/openmrs-module-idgen                           5.0.4
backend-modules   mekomsolutions/openmrs-module-initializer              2.12.0
backend-modules   openmrs/openmrs-module-legacyui                        2.1.0
backend-modules   openmrs/openmrs-module-metadatamapping                 2.0.0
backend-modules   openmrs/openmrs-module-o3forms                         2.3.0
backend-modules   openmrs/openmrs-module-openconceptlab                  3.1.0
backend-modules   openmrs/openmrs-module-ordertemplates                  v2.2.0
backend-modules   openmrs/openmrs-module-patientdocuments                1.1.0
backend-modules   openmrs/openmrs-module-patientflags                    patientflags-3.0.10
backend-modules   openmrs/openmrs-module-queue                           queue-3.0.0
backend-modules   openmrs/openmrs-module-referencedemodata               2.6.1
backend-modules   openmrs/openmrs-module-reporting                       2.1.0
backend-modules   openmrs/openmrs-module-reportingrest                   2.0.0
backend-modules   openmrs/openmrs-module-serialization.xstream           0.3.0
backend-modules   openmrs/openmrs-module-stockmanagement                 stockmanagement-3.0.0
backend-modules   openmrs/openmrs-module-tasks                           2.1.0
backend-modules   Bahmni/openmrs-module-teleconsultation                 2.0.0
backend-modules   openmrs/openmrs-module-webservices.rest                3.5.0
frontend          openmrs/openmrs-esm-core                               v10.0.0
frontend          openmrs/openmrs-esm-patient-chart                      v12.3.4
frontend          openmrs/openmrs-esm-patient-management                 v11.1.0
frontend          openmrs/openmrs-esm-admin-tools                        v4.4.0
frontend          openmrs/openmrs-esm-user-onboarding                    v4.1.0
frontend          openmrs/openmrs-esm-cohortbuilder-app                  v4.0.6
frontend          openmrs/openmrs-esm-laboratory-app                     v1.5.1
frontend          openmrs/openmrs-esm-dispensing-app                     v1.11.1
frontend          openmrs/openmrs-esm-fast-data-entry-app                v1.5.0
frontend          openmrs/openmrs-esm-stock-management                   v3.2.1
frontend          openmrs/openmrs-esm-billing-app                        v1.3.1
frontend          openmrs/openmrs-esm-form-builder                       v3.5.1
"

mkdir -p "$DEST" || exit 1
echo "Destination: $DEST"
ok=0; skipped=0; failed=0; manifest=""

while read -r folder repo tag; do
  [ -z "$folder" ] && continue
  dir="$DEST/$folder/${repo#*/}"
  if [ -d "$dir/.git" ]; then
    have=$(git -C "$dir" describe --tags --exact-match 2>/dev/null)
    if [ "$have" = "$tag" ]; then echo "skip   $folder/${repo#*/} ($tag already there)"; skipped=$((skipped+1))
    else echo "WARN   $folder/${repo#*/} is at '${have:-unknown}', expected $tag - left alone"; failed=$((failed+1)); fi
  else
    mkdir -p "$DEST/$folder"
    if GIT_TERMINAL_PROMPT=0 git -c advice.detachedHead=false clone -q --depth 1 --branch "$tag" \
         "https://github.com/$repo.git" "$dir"; then
      echo "clone  $folder/${repo#*/} @ $tag"; ok=$((ok+1))
    else echo "FAIL   $repo @ $tag"; failed=$((failed+1)); continue; fi
  fi
  manifest+="| \`$folder/${repo#*/}\` | [$repo](https://github.com/$repo/tree/$tag) | \`$tag\` | \`$(git -C "$dir" rev-parse --short HEAD 2>/dev/null)\` |"$'\n'
done <<< "$SOURCES"

{
  echo "# OpenMRS source code - O3 Reference Application 3.7.1"
  echo
  echo "Generated by \`OpenMrs-EMR/scripts/fetch-sources.sh\` on $(date -u +%Y-%m-%dT%H:%MZ)."
  echo "Read-only study copies (shallow clones). Do not edit here; this folder is not part of OpenMrs-EMR."
  echo
  echo "| Folder | Repository | Tag | Commit |"
  echo "| --- | --- | --- | --- |"
  printf '%s' "$manifest"
} > "$DEST/VERSIONS.md"

echo "Done: $ok cloned, $skipped already present, $failed problems. Size: $(du -sh "$DEST" | cut -f1)"
echo "Manifest: $DEST/VERSIONS.md"
[ "$failed" = 0 ]
