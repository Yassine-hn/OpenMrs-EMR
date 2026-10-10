#!/usr/bin/env python3
"""Build the Algerian address hierarchy CSV for the OpenMRS addresshierarchy module.

Levels: Pays > Wilaya > Daira > Commune (69 wilayas, Law 26-06 of 2026).

Input:  the "geoalgeria" npm package (MIT for names and codes), extracted, e.g.
        curl -O https://registry.npmjs.org/geoalgeria/-/geoalgeria-2.3.0.tgz
        tar -xzf geoalgeria-2.3.0.tgz        # -> package/data/csv/{wilayas,communes}.csv
Output: config/backend/addresshierarchy/chu-blida/addresshierarchy.csv

Usage:  python3 -I scripts/build-address-hierarchy.py <path to package/data/csv> <output csv>

Only names and administrative codes are used (MIT part of the dataset); the
OpenStreetMap-derived coordinates (ODbL) are ignored.

Codes after "%" go into address_hierarchy_entry.user_generated_id, which is VARCHAR(11):
country "DZ", wilaya "09", daira "09D02" (wilaya code + index of the daira in alphabetical
order within its wilaya), commune "0920" (official commune code).
"""
import csv
import sys

MAX_CODE_LENGTH = 11  # address_hierarchy_entry.user_generated_id


def main(data_dir, output):
    with open(f"{data_dir}/wilayas.csv", encoding="utf-8") as f:
        wilayas = {int(r["code"]): r["name_fr"].strip() for r in csv.DictReader(f)}
    with open(f"{data_dir}/communes.csv", encoding="utf-8") as f:
        communes = list(csv.DictReader(f))

    dairas_by_wilaya = {}
    for c in communes:
        dairas_by_wilaya.setdefault(int(c["wilaya_code"]), set()).add(c["daira"].strip())
    daira_code = {
        (w, d): f"{w:02d}D{i:02d}"
        for w, names in dairas_by_wilaya.items()
        for i, d in enumerate(sorted(names), start=1)
    }

    rows = []
    for c in communes:
        w = int(c["wilaya_code"])
        daira = c["daira"].strip()
        levels = [
            ("Algérie", "DZ"),
            (wilayas[w], f"{w:02d}"),
            (daira, daira_code[(w, daira)]),
            (c["name_fr"].strip(), f"{int(c['code_commune']):04d}"),
        ]
        for name, code in levels:
            if len(code) > MAX_CODE_LENGTH or "," in name or "%" in name:
                sys.exit(f"invalid entry: {name!r} / {code!r}")
        rows.append((w, daira, c["name_fr"].strip(), [f"{name}%{code}" for name, code in levels]))
    rows.sort(key=lambda r: (r[0], r[1], r[2]))

    with open(output, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        for row in rows:
            writer.writerow(row[3])

    print(f"wilayas={len({r[0] for r in rows})} dairas={len({(r[0], r[1]) for r in rows})} "
          f"communes={len(rows)} -> {output}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
