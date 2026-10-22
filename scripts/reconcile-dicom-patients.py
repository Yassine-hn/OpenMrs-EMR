#!/usr/bin/env python3
"""
Executes the Patient Identity Rewrite pipeline (Subplan 04):
Reconciles external clinic DICOM tags in Orthanc with official OpenMRS identities:
- PatientID -> OpenMRS Dossier ID (e.g. 100001W)
- PatientName -> Formatted OpenMRS Name (e.g. TAMER^Adem)
- OtherPatientIDs -> Preserves external clinic ID (e.g. PAT-1020881) for medical auditability.
"""

import sys
import json
import subprocess
import urllib.request
import urllib.error

def get_orthanc_host():
    try:
        ip = subprocess.check_output(
            ["docker", "inspect", "openmrs-emr-orthanc-1", "--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"],
            text=True
        ).strip()
        if ip:
            return f"http://{ip}:8042"
    except Exception:
        pass
    return "http://localhost:8042"

RECONCILIATION_RULES = [
    {
        "external_id_match": ["PAT-1020881"],
        "replace_tags": {
            "PatientID": "100001W",
            "PatientName": "TAMER^Adem",
            "PatientBirthDate": "20161130",
            "PatientSex": "M",
            "OtherPatientIDs": "PAT-1020881"
        },
        "description": "TAMER Adem (Case 1)"
    },
    {
        "external_id_match": ["PAT-1329397"],
        "replace_tags": {
            "PatientID": "100002U",
            "PatientName": "BOUSSEDRAYA^Meriem",
            "PatientBirthDate": "20210918",
            "PatientSex": "F",
            "OtherPatientIDs": "PAT-1329397"
        },
        "description": "BOUSSEDRAYA Meriem (Case 2)"
    },
    {
        "external_id_match": ["PAT-1076054", "PAT-1106079", "MIX.1641889837.27605"],
        "replace_tags": {
            "PatientID": "100003R",
            "PatientName": "LARACHI^Mohamed Anes",
            "PatientBirthDate": "20200715",
            "PatientSex": "M",
            "OtherPatientIDs": "PAT-1076054, PAT-1106079, MIX.1641889837.27605"
        },
        "description": "LARACHI Mohamed Anes (Case 3)"
    }
]

def main():
    orthanc_url = get_orthanc_host()
    print(f"Connecting to Orthanc at {orthanc_url}...")

    # Fetch all studies
    with urllib.request.urlopen(f"{orthanc_url}/studies") as r:
        studies = json.load(r)

    print(f"Found {len(studies)} studies in Orthanc.")

    modified_count = 0
    for sid in studies:
        with urllib.request.urlopen(f"{orthanc_url}/studies/{sid}") as r:
            sdata = json.load(r)

        ptags = sdata.get("PatientMainDicomTags", {})
        mtags = sdata.get("MainDicomTags", {})
        cur_pid = ptags.get("PatientID", "")
        cur_pname = ptags.get("PatientName", "")
        study_desc = mtags.get("StudyDescription", "No Description")
        study_uid = mtags.get("StudyInstanceUID", "")

        matched_rule = None
        for rule in RECONCILIATION_RULES:
            if cur_pid in rule["external_id_match"]:
                matched_rule = rule
                break

        if not matched_rule:
            print(f"Skipping study {sid[:8]} (Patient: {cur_pname}, ID: {cur_pid}) - no rewrite rule.")
            continue

        print(f"\nReconciling {matched_rule['description']}:")
        print(f"  Study: {study_desc} ({study_uid})")
        print(f"  Current tags : ID={cur_pid}, Name={cur_pname}")
        print(f"  Target tags  : {matched_rule['replace_tags']}")

        payload = {
            "Replace": matched_rule["replace_tags"],
            "Keep": [
                "StudyInstanceUID",
                "SeriesInstanceUID",
                "SOPInstanceUID"
            ],
            "KeepSource": False,
            "Force": True
        }

        req = urllib.request.Request(
            f"{orthanc_url}/studies/{sid}/modify",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                res = json.load(resp)
                new_sid = res.get("ID")
                print(f"  SUCCESS -> Reconciled to Orthanc Study ID {new_sid}")
                modified_count += 1
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8")
            print(f"  ERROR modifying study {sid}: HTTP {e.code}: {err}", file=sys.stderr)

    print(f"\n--- Reconciliation Complete ---")
    print(f"Total studies rewritten: {modified_count}")

if __name__ == "__main__":
    main()
