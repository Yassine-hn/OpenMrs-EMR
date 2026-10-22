# Subplan 02: Orthanc PACS Ingestion & DICOMweb API Integrity

| | |
| --- | --- |
| Target | Neurosurgery Department, CHU Frantz Fanon, Blida |
| Status | DRAFT / READY FOR REVIEW |
| Related Phase | Phase 4 (PACS & Medical Imaging) |
| Author | Google Antigravity CLI using Gemini 3.8 Flash |

---

## 1. Objectives

1. Safely ingest the clinical neuroimaging dataset (6,665 DICOM files, ~2.2 GB) from `DATA PNR CHU BLIDA` into Orthanc PACS.
2. Verify persistent on-disk storage (`/var/lib/orthanc/storage`) and PostgreSQL indexing (`orthanc-db`).
3. Monitor memory consumption throughout ingestion to guarantee adherence to the 8 GB host budget (Orthanc cap: 1.2 GB RAM).
4. Validate DICOMweb endpoints (QIDO-RS, WADO-RS) across all 6 studies and 88 distinct series.

---

## 2. Ingestion Pipeline & Architecture

Orthanc provides two primary ingestion paths:
1. **HTTP REST API (`POST /instances`)**: High-reliability single-slice or bulk multipart POST via HTTP. Can be routed internally or via Gateway.
2. **DICOM C-STORE (Port 4242)**: Native DICOM protocol using `storescu` or Orthanc's internal DICOM receiver.

### Selected Approach: Controlled REST Batch Ingestion
To maintain strict memory boundaries and prevent HTTP timeouts or worker thread starvation:
- Implement a Python ingestion tool (`scripts/ingest-clinical-dicom.py`).
- Read files sequentially or in micro-batches (e.g. 50 slices per batch).
- POST raw DICOM bytes directly to Orthanc's internal HTTP endpoint (`http://localhost:8042/instances` or via authenticated Gateway `/dicom-web/studies`).
- Measure elapsed time, throughput (slices/sec), and memory usage before, during, and after ingestion.

---

## 3. Storage & Indexing Verification

After ingestion, verify:
1. **PostgreSQL Index Tables** in `orthanc-db`:
   ```sql
   SELECT count(*) FROM resources WHERE resourcetype = 0; -- Patients
   SELECT count(*) FROM resources WHERE resourcetype = 1; -- Studies
   SELECT count(*) FROM resources WHERE resourcetype = 2; -- Series
   SELECT count(*) FROM resources WHERE resourcetype = 3; -- Instances
   ```
   Expected: 3 patients (unmodified), 6 studies, 88 series, 6,665 instances.
2. **Disk Storage**:
   Verify physical file layout inside the named volume `openmrs-emr_orthanc-storage` mounted at `/var/lib/orthanc/storage`.
   Confirm total disk usage matches expected ~2.2 GB.

---

## 4. DICOMweb Compliance Verification

Execute automated QIDO-RS and WADO-RS checks via authenticated Gateway session:
1. **QIDO-RS Studies Query**:
   `GET /dicom-web/studies` -> HTTP 200, returns JSON array with all 6 studies including `StudyInstanceUID`, `PatientName`, `PatientID`, `Modality` (MR), and `NumberOfStudyRelatedSeries`.
2. **QIDO-RS Series Query**:
   `GET /dicom-web/studies/{studyUID}/series` -> HTTP 200, verifies all sequence types:
   - Axial T2 FLAIR
   - Axial Diffusion (DWI)
   - Axial T1 SE
   - Axial T2* / Gradient Echo
   - 3D TOF Angio
   - 3D T1 Post-Gadolinium
   - Sagittal T1 / T2 / STIR
3. **WADO-RS Metadata Query**:
   `GET /dicom-web/studies/{studyUID}/series/{seriesUID}/metadata` -> HTTP 200 with full DICOM header dictionary.
4. **WADO-RS Frame Retrieval**:
   `GET /dicom-web/studies/{studyUID}/series/{seriesUID}/instances/{sopUID}/frames/1` -> HTTP 200, binary transfer of pixel data.

---

## 5. Execution Steps

1. **Step 2.1**: Test-ingest one complete series (e.g., `TAMER ADEM` 3D T1 Gado, 176 slices) to verify latency and memory footprint.
2. **Step 2.2**: Perform complete ingestion of Case 1 (`TAMER ADEM`, 1,350 slices).
3. **Step 2.3**: Ingest Case 3 (`LARACHI MOHAMED ANES`, 1,063 slices across 3 studies).
4. **Step 2.4**: Ingest Case 2 (`BOUSSEDRAYA MERIEM`, 4,252 slices across 2 studies).
5. **Step 2.5**: Run automated test script `scripts/verify-dicomweb-dataset.sh` to validate all DICOMweb endpoints.

---

## 6. Verification Checklist

- [ ] 6,665 slices ingested without failure or dropped frames.
- [ ] Container `openmrs-emr-orthanc-1` stays well within 1.2 GB limit (< 600 MB expected).
- [ ] Container `openmrs-emr-orthanc-db-1` stays within 512 MB limit.
- [ ] DICOMweb QIDO queries return all studies and series.
- [ ] No database locks or connection pool exhaustion in PostgreSQL.
