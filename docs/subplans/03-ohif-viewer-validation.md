# Subplan 03: OHIF Viewer Clinical Rendering & Performance Validation

| | |
| --- | --- |
| Target | Neurosurgery Department, CHU Frantz Fanon, Blida |
| Status | DRAFT / READY FOR REVIEW |
| Related Phase | Phase 4 (PACS & Medical Imaging) |
| Author | Google Antigravity CLI using Gemini 3.8 Flash |

---

## 1. Objectives

1. Validate that the zero-footprint OHIF Viewer (v3.13.12) reliably renders high-resolution multi-series MRI studies from CHU Blida under the subpath `/ohif/`.
2. Verify Cornerstone3D WebGL2 rendering pipeline and WebAssembly codecs for uncompressed and compressed DICOM transfer syntaxes.
3. Validate Multi-Planar Reconstruction (MPR) across axial, coronal, and sagittal viewports for 3D volumetric acquisitions (3D T1 Post-Gadolinium and 3D TOF).
4. Verify neurosurgical clinical measurement tools (Length, Bidirectional tumor diameter, Elliptical ROI signal intensity).
5. Capture browser screenshots to document clinical visualization quality for the department.

---

## 2. Technical Validation Matrix

| Feature | Clinical Use Case | Technical Requirement |
| --- | --- | --- |
| **Multi-series Layout (2x2 / 1x2)** | Simultaneous comparison of T2 FLAIR, DWI, T1 pre-contrast, and T1 post-contrast | Cornerstone3D multi-viewport synchronization |
| **MPR (Orthogonal Reslicing)** | Assessing 3D relationship of posterior fossa mass to the 4th ventricle and brainstem | Volumetric interpolation from 3D T1 isotropic slices |
| **Bidirectional Measurement** | Measuring WHO CNS tumor dimensions (axial longest diameter x perpendicular diameter) | OHIF measurement tool panel & annotation persistence |
| **Windowing / Leveling (W/L)** | Optimizing soft-tissue brain contrast vs bone vs CSF | Preset window levels + manual mouse drag adjustment |
| **CSP & Web Workers** | Fast parallel decoding of multi-slice series without UI freezing | Browser CSP permits `blob:` and `data:` workers |

---

## 3. Browser Verification Procedure

Using headless/remote Chrome via Chrome DevTools Protocol (CDP) or Playwright:
1. **Authentication**: Authenticate via OpenMRS session as `test-medecin` (`http://localhost/openmrs/spa/login`).
2. **Study List Navigation**:
   - Access `http://localhost/ohif/`.
   - Verify all ingested patients appear in the OHIF study list table:
     * `TAMER ADEM` (16 series, 1,350 instances)
     * `BOUSSEDRAYA MERIEM` (44 series, 3,766 instances + 16 series, 486 instances)
     * `LARACHI MOHAMED ANES` (10 series, 598 instances)
3. **Volumetric MPR Viewing**:
   - Open study `1.2.826.0.1.3680043.8.853.2.1116259` (`TAMER ADEM`).
   - Load the 3D T1 Gadolinium series into the active viewport.
   - Switch mode to **MPR (Multi-Planar Reconstruction)**.
   - Verify simultaneous rendering of Axial, Coronal, and Sagittal cross-sections with crosshairs.
4. **Clinical Tumor Measurement**:
   - Locate the posterior fossa mass in the 4th ventricle.
   - Draw bidirectional calipers on the axial plane.
   - Verify caliper readouts in millimeters.
5. **Console & Performance Audit**:
   - Verify zero CSP violations in Chrome DevTools console.
   - Verify WebGL context creation and absence of WebAssembly compilation failures.
   - Record time-to-first-slice and time-to-full-series render.

---

## 4. Deliverables & Screenshots

All visual proofs will be captured and saved to `OpenMrs-EMR/docs/images/phase4/`:
- `ui-ohif-dataset-studies.png`: OHIF Study list showing all CHU Blida clinical studies.
- `ui-ohif-tamer-multiseries.png`: Multi-viewport layout (T2 FLAIR, DWI, T1 Gado).
- `ui-ohif-tamer-mpr.png`: 3-axis MPR reconstruction of the 4th ventricle tumor.
- `ui-ohif-boussedraya-spine.png`: Sagittal lumbosacral screening series.

---

## 5. Verification Checklist

- [ ] All CHU Blida studies render smoothly in OHIF without black viewports or decode errors.
- [ ] MPR reconstructed views render without distortion or aspect ratio skew.
- [ ] Caliper measurements work accurately in millimeters.
- [ ] No browser memory leaks or WebGL context losses during long viewing sessions.
