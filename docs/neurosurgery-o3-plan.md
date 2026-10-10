# Neurosurgery on O3: functional plan (v2)

| | |
| --- | --- |
| Status | **v2, decisions recorded 2026-10-10 (§6). Phase 2 DONE on 2026-10-10 (§7); Phase 3 in progress (§7).** |
| Date | 2026-10-10 |
| Target | Neurosurgery department, CHU Frantz Fanon, Blida. Fresh deployment, no data migration. |
| Servers | **Server 1** (in the hospital, 8 GB RAM): O3 + Orthanc + OHIF. **Server 2** (GPU): AI, last phase. |
| Changes since v1 | Plan built around **functions** (documents, imaging, neurosurgery content, later AI), not around the old modules. Old code is not reused. Latest Orthanc/OHIF. Hospital questions replaced by stated **assumptions** (§2). |

Size scale: **S** = configuration only (days) · **M** = configuration + forms/concepts
(1–3 weeks) · **L** = one new module (3–6 weeks) · **XL** = several new components (6+
weeks). Rough effort for one developer.

---

## 0. Summary

**Most of what the department needs exists in O3 already, or is configuration.** New
code is needed in only three places, all built new in this repo:

| # | New component | Why stock O3 can't do it | Size |
| --- | --- | --- | --- |
| 1 | **Gateway extension** (our gateway image = upstream gateway + one nginx file) | Serve OHIF and the PACS through O3, protected by the OpenMRS login | M |
| 2 | **`esm-neuro-imaging-app`** (O3 frontend module) | O3 has no imaging. Imaging tab in the patient chart + import of CDs/USB with patient identification | L |
| 3 | **Worklist bridge** (Orthanc Python plugin), *optional* | Only if a CT/MRI scanner will take its worklist from us | L |

Everything else is stock O3 plus a **configuration package kept in this repo**
(concepts, forms, roles, locations, appointment services, translations, print layout).
Later, only if needed: a custom-layout documents app, an OR planning grid, and the AI
modules.

### Top recommendations

1. **Stay on the O3 3.7.1 release and remove the demo data by configuration.**
   *(Decided 2026-10-10. 3.8.0 is only a release candidate, and 3.7.1 is the final
   release we already tested.)* The demo is not built into the code: on every start, the
   backend copies `/openmrs/distribution/openmrs_config` into its data folder, and the
   50 fake patients exist only because a demo setting in that folder
   (`referencedemodata.createDemoPatientsOnNextStartup`) asks for them (✓ checked in the
   image). We **mount our own configuration folder in its place**: it keeps the useful
   base content (the CIEL concept packages behind vitals, allergies, diagnoses, visit
   note, procedures) and drops the fake patients, Cambodian addresses, demo locations,
   forms, programs and billing. The images stay the exact 3.7.1 digests. Upgrade to 3.8.x
   later through the README procedure, once it is released and has had a patch.
2. **Report generation largely comes with the forms.** Bundled in O3 3.7.1 (verified in
   the source): **"Print this encounter"** turns any filled form into a **PDF** with
   header, logo, footer and a custom layout file. Operative reports, discharge letters
   and consultation reports are therefore configuration. **Test this first** with a
   sample operative report (week 1), because document quality is the top priority.
3. **Imaging plan:** latest **Orthanc** (`orthancteam/orthanc` 26.9.1) and **OHIF
   3.13.12** (latest stable; 3.14 is still beta), both behind the O3 gateway and checked
   against the OpenMRS session. The **main imaging flow is "import a CD and identify
   the patient"**, since many patients come from other wilayas with CDs (§2, A5).
   Worklists are optional.
4. **Neurosurgery content = concepts + forms**, designed from neurosurgical practice:
   GCS, pupils, motor grading, KPS, mRS, WHO CNS5 pathology, surgical safety checklist,
   structured operative note. The bundled concepts have some brain diagnoses but **no
   GCS, mRS or neurosurgical procedures**, so these must be added (§3.A).
5. **Spike the three riskiest points first, 1–2 days each:** printed PDF quality, gateway
   authentication for OHIF, CD import with identity rewrite.
6. **AI last**, on Server 2, starting with the safest use: an LLM drafting a letter from
   structured data, edited by the doctor. The prompt-driven agent comes after that.

---

## 1. Ground rules

1. Stock O3 first, then configuration, and **new code only when neither is enough**.
   New modules are written from scratch in this repo. Nothing is imported from the old
   system.
2. **Latest stable versions**, pinned by digest (repo rule). No betas in production.
3. **Clinical data = concepts + encounters/observations**, so it is printable,
   reportable, searchable and readable through FHIR. No private tables.
4. **Configuration as files in git**, loaded by Initializer. No configuration by SQL.
5. **One entry point** (the O3 gateway). PACS access depends on the OpenMRS login,
   never on a password shared by everyone.
6. **Patient identity in imaging is fixed once, in the PACS**: the DICOM PatientID is set
   to the O3 hospital ID, with explicit confirmation.

---

## 2. Assumptions about CHU Blida

The hospital questions can't be answered for now, so the plan rests on the assumptions
below. Each one says what it is based on and what changes if it is wrong.

| # | Assumption | Based on | If wrong |
| --- | --- | --- | --- |
| A1 | Neurosurgery department of CHU Frantz Fanon, head Pr Souhil Tliba; about 45 beds; patients from many wilayas; **cranial / tumour surgery is a major activity**; a StealthStation neuronavigation system was just installed | Press, Oct 2026 (Ouest Tribune/APS, Algerie360); DSP Blida listing (beds, old) | Forms are prioritised differently; the plan itself doesn't change |
| A2 | The Ministry is rolling out a **national electronic medical record (DME)** in public hospitals (reported deadline 15 Nov 2026). **Out of scope for now (decided 2026-10-10)**; to be mentioned in the user documentation. Our system is the department's specialty record and imaging system; it stores the national ID number so a link remains possible later. | APS 2026-09-08; El Moudjahid; Capmad (single source for the date) | Revisit if the hospital requires integration or double entry becomes a problem |
| A3 | **French** interface and documents. Arabic only as an optional second spelling of the patient's name. | Old system was French; hospital usage | Arabic documents are possible later (Patient Documents ships an Arabic font and Arabic messages) |
| A4 | Diagnoses coded in **ICD-10** (via CIEL mappings); procedures from a local coded list; no national procedure nomenclature required | Common practice in Algerian public hospitals | Add a code source later; no redesign |
| A5 | CT/MRI belong to the **radiology department**. Many patients bring **CDs/USB** from private centres or other hospitals. **Import + identification** is the main imaging path; network sending from radiology is secondary; worklists are optional | Patients "from different wilayas" (APS); typical organisation | If radiology can send everything over the network, CD import becomes a fallback and the worklist moves up |
| A6 | Neurosurgery has fixed OR days in a shared theatre suite; the programme is built weekly by the department; emergencies are added on the day | Typical CHU organisation | The OR planning grid (D5) may be needed earlier |
| A7 | About 30–60 users (surgeons, residents, nurses, secretaries) on ordinary PCs with an up-to-date Chrome/Firefox/Edge (OHIF needs WebGL2) | Department size | Check a few workstations before the imaging go-live |
| A8 | **No billing, stock, pharmacy or lab apps** (public hospital; lab and pharmacy are other services). They are hidden by configuration | Public care, department scope | Re-enable by configuration |
| A9 | About 10 studies a day (≈ 0.5 TB/year). Server 1 has **about 1 TB** (2026-10-10), which is enough for roughly the first 1.5–2 years of images if backups go elsewhere | Rough estimate for one department | Monitor disk use from day one; plan a larger disk or archiving before it fills |
| A10 | Hospital LAN only, internal name + our own certificate authority; no internet exposure | Same model as before | Nothing |
| A11 | **Law 18-07** (personal data): data stays on hospital servers; AI runs on Server 2, never in the cloud | Algerian law | Nothing |
| A12 | "Staff management" = users, roles and providers only | Your answer | Nothing |

---

## 3. Features: how each is done in O3

✓ = verified in the O3 source or on the running stack · ○ = documented upstream, still
to test here.

### Foundation (Tier 1)

| # | Feature | How in O3 | New code? | Size |
| --- | --- | --- | --- | --- |
| F1 | **Base system** | O3 **3.7.1** (same digests), **our configuration folder mounted over the image's demo configuration** ✓ (startup copies it on every start). **Initializer package** in the repo ✓ (supported: concepts, OCL packages, forms + form translations, appointment services, encounter types/roles, locations, roles, privileges, ID types, person attributes, address hierarchy, queues, procedure types, global properties). Frontend config: CHU logo ✓, French translation overrides ✓, hide unused apps (A8). Time zone **Africa/Algiers**, longer session timeout, all default passwords changed | no | M |
| F2 | **Registration** | Stock app, configured: auto-generated hospital ID, **national ID number (NIN)** as an extra identifier (format to verify), phone, profession, optional Arabic name. **Address hierarchy with 69 wilayas / 1,541 communes** (Law 06-26, Official Journal n°25/2026; the official list must be sourced, and the transition runs until end 2026) | no | S–M |
| F3 | **Appointments & clinic day** | Bahmni appointments ✓: one service per clinic (*Consultation neurochirurgie*, *Post-op*, *Neuro-oncologie*) with **weekly availability and max load, set once** ✓, recurring appointments ✓; check-in → visit → **service queue** | no | S |
| F4 | **Wards & beds** | Ward app + bed management ✓ (tested end to end in the 3.7.1 report): the department's wards, beds and bed types; admission request from the visit note | no | S |
| F5 | **Staff (simple)** | Users and providers via the legacy admin page (O3 has no user screen ✓). **5–6 roles built from scratch** (secretary, nurse, resident, neurosurgeon, admin, imaging viewer), **not** derived from the stock roles, which all carry 301 privileges (test report, finding 1). Each role tested | no | S–M |

### A. Neurosurgery clinical content (Tier 1)

| # | Feature | How in O3 | New code? | Size |
| --- | --- | --- | --- | --- |
| A1 | **Concepts** | The bundled packages ✓ contain some brain diagnoses (brain tumour, SAH, TBI, spinal cord injury, seizure…) but **no GCS, mRS or neurosurgical procedures**. Plan: a **"CHU Blida – Neurochirurgie" collection built from CIEL in OCL**, exported as a zip into the Initializer `ocl/` folder; local concepts (CSV) only for the gaps. **The OCL API now requires an account** (anonymous access refused, checked 2026-10-10) | no | M |
| A2 | **Forms** (Form Builder JSON, in the repo, French labels) | *Consultation neurochirurgicale*; ***Évaluation neurologique*** (GCS E/V/M + calculated total ○, pupils size/reactivity, motor deficit per limb MRC 0–5, cranial nerves, raised-ICP signs, KPS, mRS); *Admission*; *Diagnostic neurochirurgical* (site, side, size, number of lesions); ***Anatomopathologie*** (WHO CNS5 integrated diagnosis, CNS WHO grade, IHC, molecular markers: IDH, 1p/19q, MGMT, H3 K27, ATRX, Ki-67); *Décision RCP*; *Consultation de suivi* (mRS, complications) | no | M |
| A3 | **"Neurochirurgie" dashboard** in the patient chart | Configuration only ✓: conditions, allergies, vitals, **procedures app** ✓, forms, **graph of GCS/KPS over time** and table of neuro exams (generic obs widgets ✓), attachments, the imaging tab (C4) | no | S |
| A4 | **Coded diagnoses** | Visit-note diagnosis (CIEL → ICD-10). Note: O3 marks diagnoses "provisional" with no confirm step (test report, finding 13); acceptable for now | no | S |

### B. Report generation

| # | Feature | How in O3 | New code? | Size | Tier |
| --- | --- | --- | --- | --- | --- |
| B1 | **Clinical documents as PDF** (consultation report, **operative report**, **discharge letter**, medical certificate) | **Patient Documents "encounter printing"**, bundled ✓: a **"Print this encounter"** button in the visit's encounter list ✓ (privilege `App: Print encounter forms`), PDF with configurable header (patient, identifiers, dates, location), **CHU logo**, footer text and a **custom layout file (XSL) in the data folder**, no rebuild needed ✓. Arabic font bundled ✓. 3.8 adds an admin screen for it ○. Each document = one form designed to read well when printed | no (layout = config file) | S–M | 1 |
| B2 | **Requests and labels** | Patient ID sticker (bundled ✓); imaging requests from the order basket (C7) | no | S | 1 |
| B3 | **Free-layout documents** (narrative letter, choice of sections, bilingual) | **Only if B1's layout isn't good enough:** a new O3 module that builds the letter from the patient's data and prints it | yes | L | 3 |
| B4 | **Statistics** (monthly activity, operations by type/surgeon, bed occupancy, length of stay, delay before surgery, complications, mortality, tumour types, patients by wilaya) | Reporting module + **Reports app** ✓ (run, schedule, download Excel/CSV). Reports defined as **SQL queries + Excel templates** in the reporting admin page: configuration, not code. Downside: stored in the database, not git, so export and back them up | no | M | 2 |
| B5 | **Dashboards** (KPIs on the home page) | Later, built on B4 | maybe | M | 3 |

### C. Imaging (Tier 2, recommended in the first hospital go-live)

```
CD / USB ──► esm-neuro-imaging-app (browser) ──upload + identify──► Orthanc
radiology / modality ──DICOM C-STORE (port 4242, known senders only)──► Orthanc ──► PostgreSQL (index)
                                                                         └─► disk (DICOM files)
browser ──► O3 gateway ──[OpenMRS login checked]──► /…/dicom-web ──► Orthanc
                                                └──► /…/ohif ──► OHIF 3.13 (static)
```

| # | Feature | How | New code? | Size |
| --- | --- | --- | --- | --- |
| C1 | **PACS** | `orthancteam/orthanc` **26.9.1** (2026-09-21; Orthanc **1.13.0** was announced 2026-08-15, check `/system` after install) with DICOMweb, Orthanc Explorer 2 (admins only), the **new Worklists plugin** (REST API since 1.12.10 ○), Python. **PostgreSQL index, DICOM files on disk** (not inside the database). Only port 4242 open on the LAN, for known AE titles | no (config) | M |
| C2 | **Viewer** | **OHIF 3.13.12** (`ohif/app`, 2026-10-01) as a small static container with our config. Not Orthanc's OHIF plugin, which still bundles 3.12.0. MPR, volume rendering, segmentation | no (config) | M |
| C3 | **Access control** | Our gateway image = the pinned upstream O3 gateway + one nginx file: every OHIF/DICOMweb request is first **checked against the OpenMRS session** (nginx `auth_request`), with a short cache. Read-only for everyone; saving segmentations only for an imaging role. **Spike needed:** cookie path, OHIF content-security policy (workers/wasm), speed | small | M |
| C4 | **Imaging tab in the patient chart** | `esm-neuro-imaging-app`: lists the patient's studies from Orthanc (DICOMweb query by PatientID = hospital ID); date, modality, description, series; **"Open in OHIF"**; external radiology report shown from attachments | yes | L |
| C5 | **Import CD/USB + identify** (main path, A5) | Same module: choose files or a DICOMDIR folder → upload to Orthanc → **side-by-side check** (name/ID/date of birth on the CD vs the O3 patient) → after confirmation, Orthanc rewrites PatientID/name to the O3 values and keeps the originals in another tag → the study shows in the patient's tab. No study is ever linked by guessing. | yes (same module) | incl. in L |
| C6 | **Studies received over the network** | Studies whose PatientID isn't an O3 ID go to an **"À identifier"** list and use the C5 identification flow | yes (same module) | S |
| C7 | **Imaging requests + worklist** *(optional)* | The request itself is configuration: an "Imagerie" order type in the order basket ✓ (`additionalTestOrderTypes`). The worklist is only useful if a scanner queries us: a new Orthanc Python plugin reads active requests (FHIR `ServiceRequest`), creates worklist entries, and marks the request done when the study arrives | plugin | L |
| C8 | **Imaging interpretation** | *Interprétation imagerie* form (with the study ID); paper/PDF radiology reports scanned into **attachments** ✓ | no | S |

### D. Surgical pathway (Tier 2)

| # | Feature | How | New code? | Size |
| --- | --- | --- | --- | --- |
| D1 | **Pre-op** | Forms: anaesthesia consultation (ASA), pre-op checklist (blood tests, blood group, recent imaging, signed consent); signed consent scanned into attachments ✓ | no | S–M |
| D2 | **Surgical safety checklist** (WHO / French HAS version, 3 phases) | Form | no | S |
| D3 | **Structured operative report** | Form: indication, coded procedure, approach, side, position, **neuronavigation / microscope**, findings, actions, implants (shunt valve type/setting, spinal hardware), pathology samples, blood loss, transfusion, intra-op complications, closure, drains, post-op instructions. Also recorded in the **procedures app** ✓ (surgical history). Surgical team via encounter roles. **Printed via B1** | no | M |
| D4 | **Post-op & discharge** | Neuro exam form reused for post-op checks; complications (Clavien-Dindo); **discharge letter printed via B1** | no | S–M |
| D5 | **OR programme & waiting list** | Stock building blocks: each OR = an appointment service with its weekly slots; booking form (procedure, surgeon, estimated duration, ICU bed, navigation needed); **waiting list = patient list with priority**; **day of surgery = a queue** (*admis → pré-op → en salle → SSPI → retour*). A dedicated weekly OR grid only if this isn't enough (new module, L) | no / later yes | M |
| D6 | **Neuro-oncology MDT (RCP)** | One patient list per meeting + RCP decision form; "pathology result pending" flag (patient flags ✓) | no | S |

### E. AI (Tier 3, Server 2, last)

| # | Feature | How | Size |
| --- | --- | --- | --- |
| E1 | **Draft documents with an LLM** (e.g. Mistral) | A "Rédiger un brouillon" button on the operative report / discharge letter: the structured form data goes to the LLM on Server 2, the draft text comes back into the form, **the doctor edits and signs**. Safest first AI use: text from structured data, not reading images | L |
| E2 | **Dictation** (e.g. Whisper) | A microphone in long text fields; the transcript is an editable draft, never sent automatically | L |
| E3 | **AI imaging** (OHIF-AI: segmentation, volumetry) | A second viewer, behind the same login check; results saved to Orthanc as DICOM SEG; volumetry copied into a form after validation | XL |
| E4 | **Prompt-driven agent** (search, create, record) | Acts **with the user's own permissions**, confirmation before every write, full audit trail. Lowest priority | XL |

What is already on Server 2, and whether Server 1 can reach it, must be checked before
this phase (Q3).

---

## 4. Server 1 layout and memory (8 GB)

| Container | Role | Memory plan |
| --- | --- | --- |
| gateway (our image) | single entry point, TLS, login check for imaging | < 50 MB |
| frontend | O3 app (static) | < 50 MB |
| backend | OpenMRS (Java) | **cap at ~2.5 GB** (currently ~930 MB at idle, measured) |
| db (MariaDB) | OpenMRS data | ~0.75 GB (currently ~110 MB at idle, measured) |
| orthanc | PACS | ~1 GB, more while importing large studies |
| orthanc-db (PostgreSQL) | PACS index | ~0.3 GB |
| ohif | viewer (static) | < 50 MB |
| system + disk cache | | ≥ 2 GB |

About 5 GB at peak, which fits in 8 GB if **each container gets a memory limit**.
Images go on a dedicated disk or volume (A9). Backups go to another disk or to a NAS,
and the restore is tested.

---

## 5. Implementation sequence

| Phase | Content | Done when (demonstrated) |
| --- | --- | --- |
| **2 Base** | Our configuration folder replaces the demo (3.7.1 images unchanged); fresh database; French; time zone; roles; locations; registration fields; 69-wilaya address list; hide unused apps | No demo patients/locations/forms; stock screens (vitals, visit note, allergies) still work; smoke test passes; each role tested (allowed **and** refused actions) |
| **3 Neurosurgery record + documents** | **Spike B1 first** (print a sample operative report as a PDF with the CHU letterhead); OCL concept collection; forms A2; dashboard A3; clinic services F3; wards F4 | A complete consultation → admission on test data; all its documents print correctly; data visible in FHIR |
| **4 Imaging** | **Spikes C3 (login check) and C5 (identity rewrite)**; Orthanc + OHIF; `esm-neuro-imaging-app` (tab, CD import, "À identifier" list) | Import a real anonymised CD for a test patient; view it in OHIF from another PC in a private window; logged out → refused |
| **5 Hospital pilot** | Install on Server 1 in Blida: certificate, internal name, backups + **restore drill**, memory limits, short user training | Restore tested; system reachable from department PCs |
| **6 Surgical pathway** | D1–D6: pre-op, checklist, operative report, post-op, discharge, OR programme, waiting list, RCP | One full surgical episode recorded, all documents printed |
| **7 Statistics** | B4 activity and quality reports | A monthly report matches a manual count on test data |
| **8 AI** | E1 → E2 → E3 → E4 on Server 2 | Each with its own plan and approval |

---

## 6. Decisions (2026-10-10)

| # | Question | Decision |
| --- | --- | --- |
| Q1 | National DME | **Ignored for now**; mentioned in the user documentation (A2) |
| Q2 | Disk and backups | About **1 TB** on Server 1; backup target decided later (A9) |
| Q3 | Server 2 (AI) | Checked at Phase 8 |
| Q4 | OCL account | **Available**: the neurosurgery concept collection is built from CIEL in OCL |
| Q5 | O3 version | **Stay on 3.7.1** (final release, already tested); no demo through our own configuration folder (§0, rec. 1) |
| Q6 | Clinical reviewer | Maybe; forms are reviewed when someone is available, ideally before the pilot |

---

## 7. Phase 2: first steps

Each step is proposed, approved, done and verified before the next one (working
protocol in `CLAUDE.md`).

| Step | What | Type | Verified by |
| --- | --- | --- | --- |
| 2.0 | Update `CLAUDE.md` scope (phase 2: configuration, then later Orthanc/OHIF and new modules) and mention this plan in the README | FILE CHANGE (docs) | Review |
| 2.1 | Sort every file of the image's demo configuration into **keep** (CIEL concept packages used by the stock screens, encounter/visit types, encounter roles, dispositions, ID types…) or **drop** (demo-patient setting, Cambodian address, demo locations, forms, programs, billing, stock, queues, appointment services, drugs). Result: a table for approval | READ-ONLY | The table |
| 2.2 | Create `config/backend/` (kept base + our minimal metadata: CHU Blida → Neurochirurgie → wards, consultation, operating theatre; French as default language) and `config/frontend/` (our frontend config replacing `config-core_demo.json`); mount both read-only in `docker-compose.yml` | FILE CHANGE | `docker compose config` valid |
| 2.3 | **Back up, then delete the current demo database and data volume** (`docker compose down -v`), and start fresh | **DESTRUCTIVE**, needs explicit approval | Backup files exist; fresh start completes |
| 2.4 | First start on our configuration | DATA-IMPACTING (new data) | **0 patients**; no demo locations/forms; vitals, visit note, allergies, conditions, appointments still work; smoke test passes |
| 2.5 | Time zone, admin password, simple roles and users | FILE CHANGE + DATA | Each role logs in and is refused what it shouldn't do |

**Phase 2 result (2026-10-10): done.** Details in
[`test-report-phase2.md`](test-report-phase2.md) and [`configuration.md`](configuration.md).
No demo data; French by default; CHU locations; 69-wilaya address hierarchy; N° de dossier +
NIN (18 digits, validated); registration fields (mother's name, profession, person to
notify); 4 roles built from scratch (18/18 role checks pass); time zone Africa/Algiers;
admin password from `.env`. Smoke test: 12/12. First start 74 min, restart about 50 s.

Carried over to phase 3:
- **Printing only works for Form Builder forms** (checked in the printing module's source and
  by test). So the B1 print test needs a first neurosurgery form, and that is how Phase 3
  starts: one form (e.g. *Compte rendu opératoire*), printed to PDF with a CHU layout file.
- A few stock labels are still in English (*Procedures*, vitals field labels): translation
  overrides.
- Clinic appointment services and queues (F3), wards' beds (F4), and the neurosurgery concepts
  (OCL collection, A1).

Phase 3 then starts with the **print spike (B1)**: a sample operative report printed as a
PDF with the CHU letterhead.

**Phase 3 progress (2026-10-10):** details in [`test-report-phase3.md`](test-report-phase3.md).
- **Done and tested:** the print spike (operative report → PDF on the CHU layout); forms
  *Compte rendu opératoire*, *Évaluation neurologique* (calculated Glasgow total) and
  *Demande d'admission*; Glasgow/Karnofsky and pupils/motor trends on the patient summary;
  3 consultation services; consultation queue with French statuses; 42 beds in 3 wards;
  admission to a bed; French translation overrides.
- **Remaining:** the other forms (consultation, admission context, neurosurgical diagnosis,
  pathology WHO CNS5, MDT decision, follow-up); the OCL/CIEL mapping of the local concepts
  (with your OCL account); the services' weekly days; the relative-time translation; clinical
  review of the forms.

Repository layout from Phase 2 on: `config/` (Initializer, frontend config, print
layout), later `gateway/`, `modules/esm-neuro-imaging-app/` and `orthanc/`. One place,
one history.

---

## Sources

- Running stack and O3 source (`../openmrs-source/`, 3.7.1): Patient Documents
  encounter printing (README, `defaultEncounterFormFopStylesheet.xsl`, Arabic fonts),
  "Print this encounter" in `esm-patient-chart-app`; reports app; appointments
  `ServiceWeeklyAvailability`; tests app `additionalTestOrderTypes`; Initializer
  `Domain.java`; bundled OCL packages; O3 gateway `default.conf.template`.
- Docker Hub tags (checked 2026-10-10): `openmrs/openmrs-reference-application-3-backend`
  (`3.8.0-rc.1`, `3.8.x-no-demo`, `3.7.x-no-demo`), `orthancteam/orthanc` (`26.9.1`),
  `ohif/app` (`v3.13.12`, `v3.14.0-beta`). [O3 distro 3.8.0-rc.1](https://github.com/openmrs/openmrs-distro-referenceapplication)
- [Orthanc 1.13.0 announcement](https://discourse.orthanc-server.org/t/orthanc-1-13-0-is-now-available/6473) ·
  [orthancteam image release notes](https://github.com/orthanc-server/orthanc-builder/blob/master/release-notes-docker-images.md) ·
  [Worklists plugin](https://orthanc.uclouvain.be/book/plugins/worklists-plugin-new.html) ·
  [Orthanc OHIF plugin NEWS](https://orthanc.uclouvain.be/hg/orthanc-ohif/file/tip/NEWS)
- [OHIF release notes](https://ohif.org/release-notes/) · [OHIF v3.13.12](https://github.com/OHIF/Viewers/releases/tag/v3.13.12)
- CHU Blida: [neuronavigation, Oct 2026 (Ouest Tribune/APS)](https://ouest-tribune.dz/chu-frantz-fanon-de-blida-le-service-de-neurochirurgie-se-dote-dun-systeme-de-neuronavigation-de-derniere-generation/) ·
  [StealthStation (Algerie360)](https://www.algerie360.com/chu-blida-neurochirurgie-stealthstation-medtronic/) ·
  [DSP Blida listing](http://www.sante.dz/dsp-blida/sitedsp09/chu.htm)
- National DME: [APS, 2026-09-08](https://www.aps.dz/fr/algerie/sante-et-environnement/mtsp0upk-ait-messaoudene-preside-une-rencontre-sur-la-generalisation-de-la-numerisation-et-du-dossier-medical-electronique-dans-les-etablissements-de-sante) ·
  [El Moudjahid](https://www.elmoudjahid.com/fr/actualite/dossier-medical-electronique-dme-le-ministere-accelere-le-deploiement-256236) ·
  [Capmad (15 Nov deadline)](https://www.capmad.com/article/algerie-le-ministere-de-la-sante-impose-le-dossier-medical-electronique-au-15-novembre-2026)
- 69 wilayas: [Algerie360](https://www.algerie360.com/nouveau-decoupage-administratif-voici-ce-qui-change-avec-le-passage-a-69-wilayas/) ·
  [Official Journal n°25/2026](https://www.conformepro.dz/resources/joradp-sgg-algerie/journal-officiel-algerien-2026-25-التقسيم-الإقليمي-الجديد-للبلاد-بـ-69-ولاية-وقرارات-تنظيمية-أخرى)
- Neurosurgical documentation: [information gaps in the care pathway](https://brieflands.com/journals/jcrps/articles/172504) ·
  [operative note audit](https://sljm.sljol.info/articles/570) ·
  [structured operative records](https://npeu.ox.ac.uk/csor/workstreams/2a-development-of-structured-electronic-operative-records)
