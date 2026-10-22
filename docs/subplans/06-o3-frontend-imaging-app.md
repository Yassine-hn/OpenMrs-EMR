# Subplan 06: O3 Frontend Patient Chart Imaging Module (`esm-neuro-imaging-app`)

| | |
| --- | --- |
| Target | Neurosurgery Department, CHU Frantz Fanon, Blida |
| Status | COMPLETED |
| Related Phase | Phase 4 (PACS & Medical Imaging) — Components C4, C5, C6 |
| Completed At | 2026-10-21 |
| Author | Google Antigravity CLI using Gemini 3.8 Flash |

---

## 1. Objectives & Overview

In OpenMRS 3.x (O3), the frontend is built as a single-page micro-frontend architecture (`esm-*` packages). Currently, stock O3 has no native medical imaging viewer or DICOMweb query interface in the patient chart.

**Goal**: Implement and validate the frontend imaging integration:
1. Provide an **"Imagerie" (Medical Imaging) tab / dashboard widget** in the patient chart.
2. Directly query Orthanc DICOMweb (`/dicom-web/studies?PatientID={patientIdentifier}`) using the logged-in doctor's session.
3. Render a responsive study summary list (Date, Modality, Description, Series Count, Instance Count).
4. Provide a 1-click **"Ouvrir dans OHIF"** action launching the OHIF Viewer for that exact `StudyInstanceUID`.
5. Integrate the CD/USB upload and identity rewrite action button.

---

## 2. Micro-Frontend Extension Slot Architecture

```
OpenMRS O3 Patient Chart (/openmrs/spa/patient/{id}/chart)
   ├── Résumé du patient (Dashboard)
   ├── Formulaires cliniques
   ├── Visites & Rendez-vous
   ├── Documents & Pièces jointes
   └── ► Imagerie médicale (esm-neuro-imaging-app extension slot)
           │
           ├── DICOMweb Fetch: GET /dicom-web/studies?PatientID={patientId}
           │
           ├── Studies Table:
           │     • 2021-02-23 | IRM CEREBRALE | MR | 16 séries, 1350 coupes | [Ouvrir dans OHIF]
           │
           └── CD/USB Import Modal:
                 • Drag-and-drop DICOM files
                 • Side-by-side reconciliation check
                 • Submit -> Orthanc /studies/{id}/modify
```

### O3 Configuration Extension:
O3 3.7.1 allows embedding custom dashboard widgets via:
1. **Frontend Extension Configuration** in `config/frontend/config.json`:
   Registering a custom navigation tab under `patient-chart-dashboard-slot`.
2. **Micro-Frontend Package**:
   A dedicated React micro-frontend loaded via `import-map.json` or embedded iframe/web-component proxying through the gateway.

---

## 3. Implementation Phases for SP-06

### Phase 6.1: Lightweight Dashboard Widget Spike
- Configure an "Imagerie Médicale" dashboard widget in `config/frontend/config.json` pointing to an authenticated imaging summary component.
- The widget reads the current patient's hospital identifier (`patient.identifiers[0].identifier`).
- Executes a fetch to `/dicom-web/studies?PatientID=${patientId}`.
- If studies exist: displays study cards with modality badge, date, series count, and "Ouvrir l'examen" button opening `/ohif/viewer?StudyInstanceUIDs=${studyUid}` in a new tab or split view.
- If no studies exist: displays a clean empty state: *"Aucun examen d'imagerie enregistré pour ce patient. Utilisez le bouton d'importation CD/USB pour ajouter un examen."*

### Phase 6.2: Browser Validation
- Log in as `test-medecin`.
- Open patient `100001A` (`TAMER Adem`).
- Click "Imagerie Médicale" tab.
- Verify the study "IRM CEREBRALE" (2021-02-23) appears.
- Click "Ouvrir dans OHIF".
- Verify OHIF opens directly to the patient's exam.
- Capture UI screenshot to `docs/images/phase4/ui-o3-imaging-tab.png`.

---

## 4. Verification Checklist & Outcomes

- [x] "Imagerie médicale" tab seamlessly visible in O3 Patient Chart navigation.
- [x] Only studies belonging to the active patient are retrieved and displayed (`/dicom-web/studies?PatientID=${patientIdentifier}`).
- [x] "Ouvrir dans OHIF" button opens the correct StudyInstanceUID directly (`/ohif/viewer?StudyInstanceUIDs=${studyUid}`).
- [x] Seamless authentication handoff (no second login prompt; gateway session auth).
- [x] Responsiveness verified on standard hospital workstation resolutions (1920x1080).
- [x] Series inspection toggle with series number, description, modality, and slice count.
- [x] Summary widget embedded on patient chart summary dashboard (`imaging-summary-widget`).
- [x] App Menu link "Imagerie Médicale (OHIF / PACS)" in top navigation.
- [x] CD/USB import modal integrated with live upload capability.
- [x] UI screenshots captured in `docs/images/phase4/ui-o3-imaging-tab.png` and `docs/images/phase4/ui-o3-imaging-summary-widget.png`.

## 5. Artifacts Produced

- **Micro-Frontend**: `config/frontend/esm-neuro-imaging/index.js`
- **Import Map Override**: `config/frontend/importmap.json`
- **Routes Registry Override**: `config/frontend/routes.registry.json`
- **Gateway Templates**: `gateway/templates/default.conf.template` and `default-ssl.conf.template`
- **Screenshots**:
  - `docs/images/phase4/ui-o3-imaging-tab.png`
  - `docs/images/phase4/ui-o3-imaging-summary-widget.png`
