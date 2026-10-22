#!/usr/bin/env python3
"""
Registers the 3 clinical neurosurgery patients from DATA PNR CHU BLIDA into OpenMRS:
1. TAMER Adem (100001W)
2. BOUSSEDRAYA Meriem (100002U)
3. LARACHI Mohamed Anes (100003R)
"""

import sys
import json
import urllib.request
import base64

BASE_URL = "http://localhost/openmrs/ws/rest/v1"
AUTH_USER = "test-medecin"
AUTH_PASS = "Test-Neuro-2026"

AUTH_HEADER = "Basic " + base64.b64encode(f"{AUTH_USER}:{AUTH_PASS}".encode("utf-8")).decode("utf-8")

DOSSIER_ID_TYPE = "05a29f94-c0ed-11e2-94be-8c13b969e334"
NIN_ID_TYPE = "753dee49-6b64-4ab1-95d7-1fd1e0e32223"
LOCATION_CONSULTATION = "795d1d96-f5fb-4966-bea0-753525a24d71"

PATIENTS = [
    {
        "givenName": "Adem",
        "familyName": "TAMER",
        "gender": "M",
        "birthdate": "2016-11-30",
        "cityVillage": "Blida",
        "stateProvince": "Blida",
        "address1": "Centre Ville",
        "dossierId": "100001W",
        "nin": "116090100000000001",
        "externalId": "PAT-1020881",
        "indication": "Processus expansif solido-kystique de la FCP (toit du V4 / vermis)"
    },
    {
        "givenName": "Meriem",
        "familyName": "BOUSSEDRAYA",
        "gender": "F",
        "birthdate": "2021-09-18",
        "cityVillage": "Boufarik",
        "stateProvince": "Blida",
        "address1": "Boufarik Centre",
        "dossierId": "100002U",
        "nin": "221090100000000002",
        "externalId": "PAT-1329397",
        "indication": "Processus de la fosse cérébrale postérieure + bilan médullaire"
    },
    {
        "givenName": "Mohamed Anes",
        "familyName": "LARACHI",
        "gender": "M",
        "birthdate": "2020-07-15",
        "cityVillage": "Ouled Yaïch",
        "stateProvince": "Blida",
        "address1": "Cité 500 logts",
        "dossierId": "100003R",
        "nin": "120090100000000003",
        "externalId": "PAT-1076054, PAT-1106079",
        "indication": "Suivi longitudinal IRM tumeur cérébrale pédiatrique"
    }
]

def check_existing(dossier_id):
    url = f"{BASE_URL}/patient?q={dossier_id}"
    req = urllib.request.Request(url, headers={"Authorization": AUTH_HEADER})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        results = data.get("results", [])
        if results:
            return results[0]["uuid"]
    return None

def register_patient(p):
    existing_uuid = check_existing(p["dossierId"])
    if existing_uuid:
        print(f"Patient {p['familyName']} {p['givenName']} ({p['dossierId']}) already exists with UUID {existing_uuid}")
        return existing_uuid

    payload = {
        "person": {
            "names": [
                {
                    "givenName": p["givenName"],
                    "familyName": p["familyName"],
                    "preferred": True
                }
            ],
            "gender": p["gender"],
            "birthdate": p["birthdate"],
            "birthdateEstimated": False,
            "addresses": [
                {
                    "address1": p["address1"],
                    "cityVillage": p["cityVillage"],
                    "stateProvince": p["stateProvince"],
                    "country": "Algérie",
                    "preferred": True
                }
            ]
        },
        "identifiers": [
            {
                "identifier": p["dossierId"],
                "identifierType": DOSSIER_ID_TYPE,
                "location": LOCATION_CONSULTATION,
                "preferred": True
            },
            {
                "identifier": p["nin"],
                "identifierType": NIN_ID_TYPE,
                "location": LOCATION_CONSULTATION,
                "preferred": False
            }
        ]
    }

    req = urllib.request.Request(
        f"{BASE_URL}/patient",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": AUTH_HEADER,
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            uuid = data.get("uuid")
            print(f"SUCCESS: Registered {p['familyName']} {p['givenName']} -> N° de dossier: {p['dossierId']}, UUID: {uuid}")
            return uuid
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"ERROR registering {p['familyName']}: HTTP {e.code}: {error_body}", file=sys.stderr)
        raise

if __name__ == "__main__":
    print("Registering CHU Blida clinical patients...")
    results = {}
    for p in PATIENTS:
        uuid = register_patient(p)
        results[p["dossierId"]] = {
            "name": f"{p['familyName']} {p['givenName']}",
            "uuid": uuid,
            "externalId": p["externalId"],
            "indication": p["indication"]
        }

    with open("config/imaging-patients-map.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"Wrote mapping to config/imaging-patients-map.json")
