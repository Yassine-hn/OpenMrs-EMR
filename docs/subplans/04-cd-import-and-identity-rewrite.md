# Subplan 04: CD/USB Import & Patient Identity Rewrite Workflow

| | |
| --- | --- |
| Target | Neurosurgery Department, CHU Frantz Fanon, Blida |
| Status | DRAFT / READY FOR REVIEW |
| Related Phase | Phase 4 (PACS & Medical Imaging) — Core Feature C5 |
| Author | Google Antigravity CLI using Gemini 3.8 Flash |

---

## 1. Clinical Context & Hospital Requirement

As established in `docs/neurosurgery-o3-plan.md` (§2 Assumption A5, §3 Feature C5):
> "Many patients come from other wilayas with CDs/USB from private imaging centers or outside hospitals. **Import + identification is the primary imaging path**; network transmission from radiology is secondary."

When a patient arrives with a CD from an external clinic:
- The external DICOM tags contain foreign identifiers (e.g., `PAT-1020881`, `PAT-1329397`, `MIX.1641889837.27605`).
- The patient's name might be misspelled, truncated, or formatted differently.
- **Rule**: Studies must NEVER be linked to a patient record automatically by guessing.
- A controlled workflow must:
  1. Upload the raw external DICOM files into a temporary staging area in Orthanc.
  2. Perform an explicit side-by-side verification (CD Name/ID/DOB vs. OpenMRS Official Record).
  3. Execute an **atomic DICOM modification** rewriting:
     - `PatientID` -> OpenMRS Hospital ID (e.g. `100001A`)
     - `PatientName` -> OpenMRS Official Formatted Name (e.g. `TAMER^Adem`)
     - `OtherPatientIDs` -> Preserve original external ID (`PAT-1020881`) for clinical auditability.
  4. Ensure the study immediately becomes queryable by the patient's OpenMRS identifier in DICOMweb and OHIF.

---

## 2. Orthanc Modification API & Architecture

Orthanc provides the REST endpoint `/studies/{id}/modify` to modify DICOM tags across all series and instances of a study atomically.

### Modification Payload Specification:
```json
{
  "Replace": {
    "PatientID": "100001A",
    "PatientName": "TAMER^Adem",
    "OtherPatientIDs": "PAT-1020881"
  },
  "Keep": [
    "StudyInstanceUID",
    "SeriesInstanceUID",
    "SOPInstanceUID"
  ],
  "KeepSource": false,
  "Force": true
}
```

- `KeepSource: false`: Automatically deletes the old unlinked resource from Orthanc and replaces it with the reconciled resource, conserving storage and avoiding duplicate entries.
- `Keep: [...]`: Preserves the original UIDs so that external cross-references (such as radiology reports) remain valid.
- `OtherPatientIDs`: Guaranteed audit trail preserving the external clinic reference.

---

## 3. Test Procedure with Real CHU Blida Cases

We will validate the complete identity rewrite pipeline using the 3 CHU Blida clinical cases:

### Pipeline Execution Steps:
1. **Initial Upload (External Staging)**:
   Upload studies with raw external DICOM tags into Orthanc.
   Confirm Orthanc index lists them under external IDs (`PAT-1020881`, `PAT-1329397`, `PAT-1076054`).
2. **Reconciliation Check**:
   A verification script queries OpenMRS for patient `100001A` (`Adem Tamer`), compares with DICOM header:
   * DICOM Name: `TAMER ADEM` vs OpenMRS: `TAMER Adem` -> MATCH
   * DICOM DOB: `2016-11-30` vs OpenMRS: `2016-11-30` -> MATCH
3. **Trigger Orthanc Modify**:
   Send POST request to `/studies/{orthancStudyId}/modify` with the reconciliation payload.
4. **Post-Rewrite DICOMweb Validation**:
   - Query `GET /dicom-web/studies?PatientID=100001A`.
   - Verify study `1.2.826.0.1.3680043.8.853.2.1116259` is returned with `PatientID: 100001A` and `PatientName: TAMER^Adem`.
   - Verify `OtherPatientIDs: PAT-1020881` is preserved in the DICOM metadata.
   - Query `GET /dicom-web/studies?PatientID=PAT-1020881` -> returns empty `[]` (since old study was cleaned up).
5. **OHIF Verification**:
   Open study in OHIF viewer; verify header banner displays the patient's official OpenMRS ID `100001A`.

---

## 4. Automation Tooling

Create script `scripts/reconcile-dicom-patient.py` capable of:
- Inspecting an Orthanc study ID.
- Fetching target OpenMRS patient details by ID or NIN.
- Prompting or executing the atomic tag rewrite.
- Verifying the final state via DICOMweb.

---

## 5. Verification Checklist

- [ ] Successful atomic tag modification on real CHU Blida studies.
- [ ] No file corruption or pixel loss during tag rewrite.
- [ ] Old external patient resource cleanly removed from Orthanc index.
- [ ] New patient resource properly linked to OpenMRS Dossier ID (`100001A`, `100002B`, `100003C`).
- [ ] DICOMweb queries by OpenMRS ID return exact study matches.
