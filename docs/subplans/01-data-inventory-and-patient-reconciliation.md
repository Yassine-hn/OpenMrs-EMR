# Subplan 01: Clinical Data Inventory & Patient Reconciliation

| | |
| --- | --- |
| Target | Neurosurgery Department, CHU Frantz Fanon, Blida |
| Status | DRAFT / READY FOR REVIEW |
| Related Phase | Phase 4 (PACS & Medical Imaging) |
| Author | Google Antigravity CLI using Gemini 3.8 Flash |

---

## 1. Objectives

1. Catalog all imaging studies, series, modalities, and slices located in `DATA PNR CHU BLIDA/DICOMA` and `DATA PNR CHU BLIDA/DICOMC`.
2. Cross-reference imaging studies with the 67 diagnostic radiology reports in `DATA PNR CHU BLIDA/Rapports Radio Lakhal`.
3. Establish a reconciliation schema to register the patients into OpenMRS with proper CHU Blida metadata (OpenMRS Identifier, NIN, names, date of birth, gender, and neurosurgical pathology indication).

---

## 2. Inventory of Clinical Cases in `DATA PNR CHU BLIDA`

The directory contains **6,665 DICOM slices (~2.2 GB)** and **67 clinical radiology reports (.docx)** corresponding to real neurosurgical patients:

### Case 1: TAMER ADEM (Pediatric Brain Tumor)
- **Original DICOM Patient Name**: `TAMER ADEM`
- **Original DICOM Patient ID**: `PAT-1020881`
- **Gender**: Male (recorded as 'F' in external DICOM header, text in report states: "garçon de 4 ans")
- **Birth Date**: `2016-11-30`
- **Study Instance UID**: `1.2.826.0.1.3680043.8.853.2.1116259`
- **Study Date**: `2021-02-23`
- **Modality**: MR (Magnetic Resonance Imaging)
- **Exam Description**: `IRM CEREBRALE`
- **Volume**: 16 series, 1,350 DICOM slices (T2 FLAIR, Diffusion, T1 SE, T2*, 3D TOF Angio, 3D T1 Gado)
- **Matching Radiology Report**: `TAMERADEMEXAM-1116259.docx`
- **Clinical Indication**: Posterior fossa expanding mass centered on the 4th ventricle (V4), solid-cystic, vermian lesion with calcifications and hemosiderin deposits (suggestive of pilocytic astrocytoma or medulloblastoma).

### Case 2: BOUSSEDRAYA MERIEM (Pediatric Posterior Fossa Mass & Spinal MRI)
- **Original DICOM Patient Name**: `BOUSSEDRAYA MERIEM`
- **Original DICOM Patient ID**: `PAT-1329397`
- **Gender**: Female ('F')
- **Birth Date**: `2021-09-18`
- **Studies**:
  1. **Cerebral MRI**:
     - **Study UID**: `1.2.826.0.1.3680043.8.853.2.1449903`
     - **Study Date**: `2024-06-10`
     - **Description**: `IRM CEREBRALE` (Cérébro-médullaire)
     - **Volume**: 44 series, 3,766 DICOM slices
  2. **Lumbosacral Spinal MRI**:
     - **Study UID**: `1.2.826.0.1.3680043.8.853.2.1449904`
     - **Study Date**: `2024-06-10`
     - **Description**: `IRM LOMBO-SACRE`
     - **Volume**: 16 series, 486 DICOM slices
- **Matching Radiology Report**: `BOUSSEDRAYAMERIEMEXAM-1449903.docx`
- **Clinical Indication**: 2-year-old child referred by Dr. Bouzourène for posterior fossa mass (processus de la fosse cérébrale postérieure). Comprehensive neuro-axis staging (cerebral + whole-spine screening for leptomeningeal drop metastases).

### Case 3: LARACHI MOHAMED ANES (Pediatric Longitudinal Follow-up)
- **Original DICOM Patient Name**: `LARACHI MOHAMED ANES`
- **Original DICOM Patient IDs**: `PAT-1076054`, `PAT-1106079`, `MIX.1641889837.27605`
- **Gender**: Male (recorded as 'F' in external DICOM, text confirms male child)
- **Birth Date**: `2020-07-15` / `2020-09-25`
- **Studies**:
  1. **Pre-op / Initial MRI**:
     - **Study UID**: `1.2.826.0.1.3680043.8.853.2.1173001`
     - **Study Date**: `2021-09-25`
     - **Description**: `IRM CEREBRALE`
     - **Volume**: 6 series, 394 DICOM slices
     - **Report**: `LARACHIMOHAMED ANESEXAM-1173001.docx`
  2. **Follow-up / Post-op MRI**:
     - **Study UID**: `1.2.826.0.1.3680043.8.853.2.1204327`
     - **Study Date**: `2022-01-11`
     - **Description**: `IRM CEREBRALE`
     - **Volume**: 10 series, 598 DICOM slices
     - **Report**: `LARACHIMOHAMED ANESEXAM-1204327.docx`
  3. **Localizer / Verification Series**:
     - **Study UID**: `1.2.840.113619.2.246.114374075764304.27605.1641889837109.477`
     - **Study Date**: `2022-01-11`
     - **Volume**: 2 series, 71 DICOM slices

---

## 3. Patient Reconciliation Schema

To integrate these clinical cases into OpenMRS, we will register 3 official test patients in the OpenMRS database following the CHU Blida identifier rules:

| Attribute | Case 1 | Case 2 | Case 3 |
| --- | --- | --- | --- |
| **Family Name** | TAMER | BOUSSEDRAYA | LARACHI |
| **Given Name** | Adem | Meriem | Mohamed Anes |
| **Gender** | M | F | M |
| **Birthdate** | 2016-11-30 | 2021-09-18 | 2020-07-15 |
| **OpenMRS Identifier (N° Dossier)** | `100001A` | `100002B` | `100003C` |
| **NIN (18 digits, valid Alg)** | `116090100000000001` | `221090100000000002` | `120090100000000003` |
| **Address (Wilaya / Commune)** | 09 Blida / Blida | 09 Blida / Boufarik | 09 Blida / Ouled Yaïch |
| **External DICOM Patient ID** | `PAT-1020881` | `PAT-1329397` | `PAT-1076054`, `PAT-1106079` |
| **Neurosurgical Diagnosis** | Tumeur cérébrale de la FCP | Tumeur cérébrale de la FCP | Tumeur cérébrale pédiatrique |

---

## 4. Execution Steps

1. **Verify Patient Registration Script**: Create a lightweight python script using the OpenMRS REST API (`POST /openmrs/ws/rest/v1/patient`) to register the three clinical cases with full address hierarchy and NIN validation.
2. **Preserve External IDs in Person Attributes**: Store the original external clinic identifiers (`PAT-...`) as a person attribute or secondary identifier for traceability.
3. **Generate Mapping Configuration**: Output a deterministic JSON mapping file `config/imaging/patient-reconciliation-map.json` linking `external_patient_id` -> `openmrs_patient_id` -> `study_uids`.

---

## 5. Verification Checklist

- [ ] All 3 patients successfully registered in OpenMRS without schema or validation errors.
- [ ] Each patient assigned a valid CHU Blida Dossier Number (`100001A`, `100002B`, `100003C`).
- [ ] NIN validation passes standard 18-digit check.
- [ ] Patients searchable in OpenMRS O3 search bar.
