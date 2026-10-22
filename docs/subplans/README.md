# Master Plan: Testing & Validation of the Imaging Module with CHU Blida Clinical Data

| | |
| --- | --- |
| Target | Neurosurgery Department, CHU Frantz Fanon, Blida |
| Data Source | `DATA PNR CHU BLIDA` (6,665 DICOM slices, 6 MRI studies, 67 radiology reports) |
| System | OpenMRS O3 (3.7.1) + Orthanc PACS (26.9.1 / Core 1.13.0) + OHIF Viewer (3.13.12) |
| Author | Google Antigravity CLI using Gemini 3.8 Flash |
| Date | 2026-10-21 |
| Status | **COMPLETED (SP-01 through SP-06 Fully Executed & Verified)** |

---

## 1. Executive Summary & Context

The OpenMRS-EMR project has successfully completed Phases 1, 2, and 3, establishing:
- Clean baseline deployment without demo data (Phase 1 & 2).
- Complete neurosurgical clinical configuration (Phase 3): 8 clinical forms, 34 CIEL diagnoses, consultation queues, 42 beds, and custom CHU Blida PDF encounter printing.
- Phase 4 infrastructure: Orthanc PACS, OHIF Viewer v3, and Nginx Gateway access control (`auth_request` via OpenMRS session).

### Where Progress Stopped
While Phase 4 infrastructure is running and passed synthetic automated checks (10/10 in `scripts/dev-test-imaging.sh` using 1 test study for `100000Y`), **the imaging module has not yet been tested against real clinical hospital datasets**. 

Specifically:
1. No real multi-series DICOM studies from CHU Blida have been ingested or benchmarked.
2. The core hospital workflow of **CD/USB import and Patient Identity Rewrite** (reconciling external clinic IDs like `PAT-1329397` to official OpenMRS identifiers) remains unverified.
3. Volumetric multi-series neurosurgical MRI (T1, T2 FLAIR, DWI, 3D TOF, Gado) has not been validated in the OHIF viewer under the subpath `/ohif/`.
4. The 67 radiology diagnostic reports in `DATA PNR CHU BLIDA/Rapports Radio Lakhal/` have not been connected to patient charts or imaging studies.
5. The frontend O3 micro-frontend module (`esm-neuro-imaging-app`) linking patient charts to Orthanc/OHIF has not yet been built.

To address this thoroughly and safely according to the project's working protocol (`CLAUDE.md`), the execution is divided into **six structured subplans**.

---

## 2. Subplan Architecture & Roadmap

```
DATA PNR CHU BLIDA (DICOM + Docx Reports)
   │
   ├── [Subplan 01] ──► Clinical Data Inventory & Patient Reconciliation (3 patients, 6 studies)
   │
   ├── [Subplan 02] ──► Orthanc PACS Ingestion & DICOMweb API Integrity (6,665 slices, 2.2 GB)
   │
   ├── [Subplan 03] ──► OHIF Viewer Validation (MPR, WebGL2, Multi-series T1/T2/DWI rendering)
   │
   ├── [Subplan 04] ──► CD/USB Import & Patient Identity Rewrite Pipeline (DICOM tag modification)
   │
   ├── [Subplan 05] ──► Radiology Reports Ingestion & Clinical Document Integration (67 reports)
   │
   └── [Subplan 06] ──► O3 Patient Chart Frontend Module Integration (esm-neuro-imaging-app)
```

---

## 3. Subplans Directory Index

| Subplan | Title | Scope & Key Objectives | Document | Status |
| --- | --- | --- | --- | --- |
| **Phase 3 Plan** | Phase 3 Completion Plan | Neurosurgical forms, concepts, PDF encounter printing layout, wards, and services. | [`PLAN-PHASE3-COMPLETION.md`](PLAN-PHASE3-COMPLETION.md) | **COMPLETED** |
| **Phase 4 Plan** | Phase 4 Imaging Infrastructure Plan | Orthanc PACS, OHIF Viewer v3, PostgreSQL index, and gateway access control architecture. | [`PLAN-PHASE4-IMAGING.md`](PLAN-PHASE4-IMAGING.md) | **COMPLETED** |
| **SP-01** | Data Inventory & Reconciliation | Comprehensive audit of `DATA PNR CHU BLIDA`, mapping 3 patients, 6 studies, and creating matching OpenMRS patient identities. | [`01-data-inventory-and-patient-reconciliation.md`](01-data-inventory-and-patient-reconciliation.md) | **COMPLETED** |
| **SP-02** | Orthanc Ingestion & DICOMweb | Incremental ingestion of 6,665 DICOM slices into Orthanc PACS; verification of PostgreSQL indexing, disk persistence, and DICOMweb QIDO/WADO endpoints. | [`02-orthanc-pacs-ingestion-and-dicomweb.md`](02-orthanc-pacs-ingestion-and-dicomweb.md) | **COMPLETED** |
| **SP-03** | OHIF Viewer Validation | Real browser validation of OHIF 3.13.12 under `/ohif/`: multi-planar reconstruction (MPR), 3D volumetric rendering, measurement tools, and CSP/CORS compliance. | [`03-ohif-viewer-validation.md`](03-ohif-viewer-validation.md) | **COMPLETED** |
| **SP-04** | CD Import & Identity Rewrite | Testing the critical hospital requirement: importing outside CDs, modifying DICOM tags (`PatientID`, `PatientName`) to match OpenMRS records, and preserving audit trails. | [`04-cd-import-and-identity-rewrite.md`](04-cd-import-and-identity-rewrite.md) | **COMPLETED** |
| **SP-05** | Radiology Reports Integration | Linking 67 Lakhal diagnostic reports with DICOM studies; converting `.docx` to clinical attachments and consultation notes in OpenMRS. | [`05-radiology-reports-and-clinical-records.md`](05-radiology-reports-and-clinical-records.md) | **COMPLETED** |
| **SP-06** | O3 Frontend Imaging App | Design and implementation of `esm-neuro-imaging-app`: patient chart imaging tab, study listing, OHIF launch button, and CD upload widget. | [`06-o3-frontend-imaging-app.md`](06-o3-frontend-imaging-app.md) | **COMPLETED** |

---

## 4. Safety & Protocol Rules (from `CLAUDE.md`)

1. **Plan First, Wait for Approval, Then Act**: No bulk modifications, database resets, or irreversible changes without explicit confirmation.
2. **Resource Constraints**: Server 1 has 8 GB RAM. DICOM ingestion must be throttled to prevent memory spikes in Orthanc or MariaDB.
3. **Read-Only Verification**: All data inspection must be non-destructive. Original files in `DATA PNR CHU BLIDA` remain untouched.
4. **Demonstrable Proof**: Every successful step must be proven with actual command output, DICOMweb response, and browser UI screenshots.
5. **Work Log**: All actions will be logged chronologically in `WORK-LOG.md`.
