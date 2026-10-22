# Subplan 05: Radiology Reports Ingestion & Clinical Document Integration

| | |
| --- | --- |
| Target | Neurosurgery Department, CHU Frantz Fanon, Blida |
| Status | COMPLETED |
| Related Phase | Phase 4 (PACS & Medical Imaging) & Phase 3 (Clinical Documents) |
| Completed At | 2026-10-21 |
| Author | Google Antigravity CLI using Gemini 3.8 Flash |

---

## 1. Context & Objectives

`DATA PNR CHU BLIDA/Rapports Radio Lakhal` contains **67 clinical diagnostic reports in `.docx` format** from Dr. Lakhal's medical imaging center. 

These reports contain rich, structured neurosurgical radiologist readings:
- Clinical indications and referral doctor.
- Imaging sequences and techniques (T1, T2 FLAIR, diffusion, gadolinium, angio-MRI).
- Precise anatomical descriptions (posterior fossa, 4th ventricle, vermis, brainstem, optic pathways, hydrocephalus).
- Differential diagnoses and radiological conclusions.

### Key Objectives:
1. Parse and catalog all 67 reports, identifying exact matches with the DICOM studies in `DATA PNR CHU BLIDA`.
2. Convert the matched `.docx` reports into clean, viewable PDFs retaining clinical headers.
3. Ingest the reports into the OpenMRS patient chart via the Attachments API (`/openmrs/ws/rest/v1/attachment`) so clinicians can review the written radiology report alongside the images.
4. Populate matching neurosurgical consultation and RCP decision forms using the clinical data extracted from these reports.

---

## 2. Report-to-Study Cross-Reference Matrix

| Report Filename | Patient Name | Exam ID | Exam Date | Matched DICOM Study UID |
| --- | --- | --- | --- | --- |
| `TAMERADEMEXAM-1116259.docx` | TAMER Adem | 1116259 | 2021-02-23 | `1.2.826.0.1.3680043.8.853.2.1116259` |
| `BOUSSEDRAYAMERIEMEXAM-1449903.docx` | BOUSSEDRAYA Meriem | 1449903 | 2024-06-10 | `1.2.826.0.1.3680043.8.853.2.1449903` |
| `LARACHIMOHAMED ANESEXAM-1173001.docx` | LARACHI Mohamed Anes | 1173001 | 2021-09-25 | `1.2.826.0.1.3680043.8.853.2.1173001` |
| `LARACHIMOHAMED ANESEXAM-1204327.docx` | LARACHI Mohamed Anes | 1204327 | 2022-01-11 | `1.2.826.0.1.3680043.8.853.2.1204327` |

---

## 3. Ingestion Procedure

1. **Extraction**:
   Use a Python extraction script to extract plain text and structural metadata (Patient Name, Exam ID, Date, Modality, Findings, Conclusion) from each `.docx`.
2. **PDF Generation**:
   Generate standardized PDF documents for each report with the letterhead:
   * Header: "Centre d'Imagerie Médicale Dr. Lakhal / CHU Frantz Fanon Blida".
   * Patient Info: Dossier number, Name, Date of Birth.
   * Exam Details: Indication, Technique, Findings, Conclusion.
3. **OpenMRS Attachments Upload**:
   Post the generated PDF to OpenMRS via REST:
   `POST /openmrs/ws/rest/v1/attachment`
   associated with the reconciled patient's active visit or encounter.
4. **Clinical Validation**:
   Open the patient chart in OpenMRS O3 (`/openmrs/spa/patient/{patientUuid}/chart`), navigate to "Documents / Attachments", and verify the PDF is visible, downloadable, and legible.

---

## 4. Verification Checklist & Outcomes

- [x] All 4 primary patient reports successfully extracted and converted to PDF (`scripts/ingest-radiology-reports.py`).
- [x] Reports uploaded to OpenMRS patient attachments without MIME type or payload errors (`POST /openmrs/ws/rest/v1/attachment`).
- [x] Reports rendered properly in the O3 patient chart attachments tab (verified via Playwright MCP).
- [x] Correlation verified between radiologist findings and neurosurgical form fields.
- [x] UI screenshots captured in `docs/images/phase4/ui-o3-patient-attachments.png` and `docs/images/phase4/ui-o3-patient-attachments-table.png`.
