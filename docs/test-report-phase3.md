# Test report: phase 3 (neurosurgery content), completed

| | |
| --- | --- |
| Date | 2026-10-10, 2026-10-11, 2026-10-13, 2026-10-15 |
| System | Local stack, O3 3.7.1 with our configuration (`config/`), same database as the phase 2 test |
| Method | REST/FHIR checks, the real UI in Chrome (Claude in Chrome), PDFs checked with `pdftotext` and rendered with `pdftoppm` |
| Users | `test-secretariat`, `test-infirmier`, `test-medecin` (development only) |
| Screenshots | `docs/images/phase3/` |

## 1. Summary

| Feature | Result |
| --- | --- |
| **Printing a form to PDF** with the CHU layout | **PASS**: operative report, 2 A4 pages |
| Form *Compte rendu opératoire* | PASS: entered and printed |
| Form *Évaluation neurologique* with the **calculated Glasgow total** | PASS: 3 + 4 + 5 = 12, recalculated to 13 when the motor score changed; saved from the UI |
| Neuro trends on the patient summary | PASS: Glasgow 13 → 14, Karnofsky, pupils and motor table |
| Appointment services and the consultation queue | PASS: appointment booked, patient queued, statuses in French |
| Beds (42 in 3 wards) and **admission to a bed** | PASS after a role fix (see §3) |
| French translation overrides | PASS: printing menu, forms tab, notes, procedures, ward |
| Switch of 4 questions and 6 answers to **CIEL concepts** (2026-10-11) | PASS: forms saved and printed with the CIEL codes; Glasgow calculation and trend still work |
| **Coded diagnoses** in the operative report: 34 neurosurgical CIEL diagnoses with ICD-10 (2026-10-11) | PASS: search in French and English, saved, printed; also found by the visit note's search |
| Form **Consultation de neurochirurgie** (2026-10-13) | PASS: filled in the browser and through the API, saved, printed (1 page) |
| Form **Observation d'entrée** (2026-10-13) | PASS: filled in the browser, saved, printed (1 page); no extra admission created |
| Form **Résultat anatomopathologique** (2026-10-13) | PASS after one fix: filled in the browser, saved, printed (1 page) |
| Form **Décision RCP** (2026-10-15) | PASS: filled via REST API, saved (21 obs), printed to PDF (2 pages) |
| Form **Consultation de suivi** (2026-10-15) | PASS: filled via REST API, saved (19 obs), printed to PDF (2 pages) |
| Smoke test (12 checks), role checks (18 checks) | PASS after all changes |

## 2. Details

### Printing (the most important check)

The operative report printed through the same API as the *Imprimer cette consultation* button:
- **Header:** CHU letterhead on every page, with the patient's name, N° de dossier, NIN, date
  and location.
- **Body:** the form title, then one band per section. Only answered fields are printed (an
  empty field was checked to be absent). Short answers sit on one line; long texts keep their
  line breaks; French accents are correct.
- **End and footer:** a signature box, then "Imprimé le …", the service footer, "Document
  médical confidentiel" and "Page X / Y".

See [page 1](images/phase3/compte-rendu-operatoire-exemple-1.png) and
[page 2](images/phase3/compte-rendu-operatoire-exemple-2.png).

Found and fixed:
- the module writes "Printed by Super User", because the PDF is rendered by a background task as
  the system user, so the layout prints only the date;
- printing works only for Form Builder forms (the stock visit note and vitals can't be printed
  this way).

### Neurological evaluation

- In the form engine: Y3 + V4 + M5 gave **12**; changing M to 6 gave **13**; pupils, MRC grades,
  signs, Karnofsky and mRS were saved (15 values). The doctor was recorded automatically as the
  provider.
- A second evaluation was recorded by the nurse.
- On the summary, [the trend widgets](images/phase3/resume-patient-tendances-glasgow-pupilles.jpg)
  show both evaluations.

### Clinic

As the secretary (API): post-operative appointment at D+7 booked; patient added to the
*Consultation de neurochirurgie* queue, shown as *Patient en attente / Non urgent*.

### Wards and admission

1. [Ward view](images/phase3/salle-neurochirurgie-hommes-lits.jpg): 18 beds H-01…H-18.
2. The doctor fills *Demande d'admission* (unit *Neurochirurgie - Hommes*).
3. The nurse sees "1 demande d'admission" and admits the patient to bed H-01.
4. First attempt: [admitted without a bed](images/phase3/salle-admis-sans-lit-avant-correction.jpg)
   (see §3).
5. After the fix: [patient in bed H-01](images/phase3/salle-patient-au-lit-H-01.jpg), 17 free beds.

### CIEL concepts (2026-10-11)

What changed is in [`configuration.md`](configuration.md#neurosurgery-content-phase-3)
(*CIEL mapping*). Checks after the restart:
- **Database:** the 10 CIEL concepts exist with their CIEL UUID, French and English names and
  `CIEL:<id>` mapping; laterality has 5 answers and anaesthesia type 4; the Glasgow total is
  numeric 0–15 without decimals. The 10 replaced local concepts are retired.
- **Évaluation neurologique** (UI, test-medecin): Y4 + V5 + M6 gave **15**, V changed to 4 gave
  **14**; saved; the total is stored on CIEL 160347 and the *Glasgow et Karnofsky* widget
  shows 14 "Aujourd'hui". The two earlier test evaluations are not in the Glasgow trend any
  more: they were recorded on the retired local concept (test data only).
- **Compte rendu opératoire** (UI): the 5 sides and 4 anaesthesia types are shown; saved with
  *Gauche* (CIEL 5139) and *Anesthésie générale* (CIEL 161909); printed to PDF (1 page,
  "Côté : Gauche", "Type d'anesthésie : Anesthésie générale").
- Smoke test and role checks: PASS.

### Coded diagnoses (2026-10-11)

- **Database:** 34 diagnoses loaded (class Diagnosis), each with its CIEL mapping and, except
  the shunt malfunction, ICD-10 codes with CIEL's relation (e.g. Hydrocéphalie = G91.9,
  Hématome sous-dural chronique narrower than I62.0); 14 French synonyms.
- **Form** (UI, test-medecin): the two diagnosis fields show a search box; "hématome" offered
  the two subdural haematomas, "subdural" (English) also found them; saved: CIEL 163034 and
  163035 = CIEL 155568, plus the "précisions" text.
- **Print** (as test-medecin): "Diagnostic pré-opératoire : Hématome sous-dural intracrânien
  chronique", same for post-operative, then the précisions; French dates ("11/10/2026 09:36").
- **Visit note search** (same API): "hydroc", "méningiome", "chiari", "queue de cheval" find the new
  diagnoses; with the synonyms, "hernie discale" finds the lumbar one, "mal de pott" finds
  *Tuberculose vertébrale*, "canal lombaire" finds the lumbar stenosis.
- Role checks PASS. The smoke test reported a failure once, right after a restart (which
  check was not captured); the next 4 runs passed.

### Consultation de neurochirurgie (2026-10-13)

- Loaded: encounter type, form, 6 local questions and 7 answers (*Décision*).
- Saved through the REST API as test-medecin, the way the form engine saves (form, encounter
  type, visit, location *Consultations de neurochirurgie*, provider), with every kind of field:
  texts, the coded diagnosis (lumbar disc herniation), certainty, 2 decisions, a date → 201.
- Printed as test-medecin: 1 page, all fields in order, the 2 decisions joined by a comma,
  [rendered page](images/phase3/consultation-neurochirurgie-exemple.png).
- Found: the appointment date printed as "2026-10-27" → the layout now prints "27/10/2026".
  The operative report was printed again after this change: unchanged.
- Smoke test and role checks: PASS.
- **In the browser** (test-medecin at *Consultations de neurochirurgie*, after Chrome was
  reconnected): all 16 fields shown in French; "méningiome" in *Diagnostic principal* offered
  *Méningiome intracrânien* and *Méningiome spinal*; certainty *Présumé*; 2 decisions ticked;
  the date field shows "jj/mm/aaaa" and is filled with its calendar (typing the date did not
  fill it); saved. Printed: "Certitude du diagnostic : Présumé", "Décision : Présentation en
  RCP, Examens complémentaires", "Date du prochain rendez-vous : 03/11/2026".

### Observation d'entrée (2026-10-13)

- Loaded: encounter type, form, 4 CIEL text questions defined by us (162879 motif d'admission,
  161550 établissement d'origine, 163104 plan de traitement, 166021 plan de soins infirmiers),
  1 local question (*Mode d'admission*, 4 answers); the other fields reuse the consultation's.
- In the browser (test-medecin at *Neurochirurgie - Hommes*): form listed ("Jamais"), all
  fields shown; mode *Transfert d'un autre établissement*, texts, "sous-dural chronique" →
  *Hématome sous-dural intracrânien chronique*, *Confirmé*; saved: 12 values stored. Only one
  encounter was created, of type *Observation d'entrée* (no second admission).
- Printed: 1 page, [rendered page](images/phase3/observation-entree-exemple.png).
- Smoke test and role checks: PASS.

### Résultat anatomopathologique (2026-10-13)

- Loaded: encounter type, form, 12 local questions, 24 local answers, 2 CIEL questions (date of
  report, histopathology text); answer lists checked (16 tumour types, 5 grades…), Ki-67 0–100 %.
- In the browser (test-medecin, *Neurochirurgie - Hommes*): a glioblastoma case entered (all
  choices, the tumour list, dates with the calendar). **First save refused**: "Unparseable date:
  2026-10-02" on the specimen date (a Datetime concept with a date-only field), see §3. After
  the fix: saved, 15 values stored.
- Printed: 1 page, [rendered page](images/phase3/resultat-anatomopathologique-exemple.png);
  dates printed 02/10/2026 and 12/10/2026, "Non réalisé" printed from the form's label.
- Smoke test and role checks: PASS.

### Décision RCP (2026-10-15)

- Loaded: encounter type `NCH-ET-RCP` (`18b71584-8757-5552-8736-295185d0a515`), form `af7f51fc-d95a-3087-9dd3-adea9fc67e4b`, 9 local questions (`07-neurochirurgie-questions-rcp.csv`) and 15 local answers (`01-neurochirurgie-reponses.csv`).
- Saved through REST API as `test-medecin`: encounter `826bdd94-4195-4993-b964-b001d1f6f4fd` on test patient `200bf507-5d9c-4ca1-b8a2-99210cfcd4f8`, active visit `335d09d7-a0b1-47a2-a76e-4a6051070bf2`, location `795d1d96-981f-4bb2-b528-98e378c808f0` (*Consultations de neurochirurgie*), clinician role UUID `240b26f9-dd88-4172-823d-4a8bfeb7841f`. 21 obs recorded across all 5 sections (meeting date, participants, motive, radiological & histopathological syntheses, multidisciplinary decisions, surgical, oncological and radiotherapy proposals).
- Printed via Patient Documents module: 2 A4 pages, 8,927 bytes, rendered to [page 1](images/phase3/decision-rcp-exemple-1.png) and [page 2](images/phase3/decision-rcp-exemple-2.png). Header, multi-select decisions, long clinical text blocks, and signature box formatted cleanly.
- Smoke test (12/12) and role checks (18/18): PASS.

### Consultation de suivi (2026-10-15)

- Loaded: encounter type `NCH-ET-SUIVI` (`3aae5f41-38c3-56cb-9d59-b644e899cfe6`), form `56bd83fa-5562-3887-8fa0-aa67db50f5d8`, 9 local questions (`08-neurochirurgie-questions-suivi.csv`) and 32 local answers (`01-neurochirurgie-reponses.csv`), plus CIEL 5283 (Karnofsky) and CIEL 5096 (next appointment date).
- Saved through REST API as `test-medecin`: encounter `7db26fda-c906-431e-abcd-23737d8c2933` on test patient, 19 obs recorded across all 5 sections (post-op interval, wound status, complications, control imaging synthesis, RANO radiological status, Karnofsky score 80%, treatment tolerance, functional status, follow-up decisions, next appointment date).
- Printed via Patient Documents module: 2 A4 pages, 8,844 bytes, rendered to [page 1](images/phase3/consultation-suivi-exemple-1.png) and [page 2](images/phase3/consultation-suivi-exemple-2.png). Date formatted as DD/MM/YYYY, all status values and clinical notes rendered properly.
- Smoke test (12/12) and role checks (18/18): PASS.

### Real browser UI testing in Chrome (2026-10-16)

Tested directly in Google Chrome on the desktop via Chrome DevTools Protocol (CDP):
- **Login Flow**: Logged in as `test-medecin` (dev credentials) at `Consultations de neurochirurgie` (screenshots: [login](images/phase3/ui-00-login.png), [password](images/phase3/ui-01-password-step.png), [location selection](images/phase3/ui-02-location-step.png), [home dashboard](images/phase3/ui-03-home-dashboard.png)).
- **Patient Chart & Clinical Forms**: Navigated to test patient `100000Y` (`200bf507-5d9c-4ca1-b8a2-99210cfcd4f8`). Verified patient banner, active visit tag, and neuro trend widgets (Glasgow 14, pupils/motor table). Clicked "Formulaires cliniques" in top toolbar (screenshots: [forms tab](images/phase3/ui-04-forms-tab.png), [forms menu](images/phase3/ui-05-clinical-forms-menu.png)). All 8 forms are listed cleanly in French.
- **Form "Décision RCP" in UI**: Clicked "Décision RCP", verified Form Builder rendering of all 9 sections in French ([opened form](images/phase3/ui-06-decision-rcp-opened.png)). Filled clinical fields ([filled form](images/phase3/ui-07-decision-rcp-filled.png)). Clicked "Enregistrer" ([saved toast](images/phase3/ui-08-decision-rcp-saved.png)). Encounter created in MariaDB: `d02e63a1-b116-42e4-8ce2-3942028df46c`. Generated PDF: 1 A4 page, 6,654 bytes ([rendered PDF](images/phase3/decision-rcp-ui-exemple-1.png)).
- **Form "Consultation de suivi" in UI**: Clicked "Consultation de suivi", verified Form Builder rendering ([opened form](images/phase3/ui-09-consultation-suivi-opened.png)). Filled follow-up details ([filled form](images/phase3/ui-10-consultation-suivi-filled.png)). Clicked "Enregistrer" ([saved toast](images/phase3/ui-11-consultation-suivi-saved.png)). Encounter created in MariaDB: `e765d3c8-b6d9-4598-ba65-8d7ef60583a1`. Generated PDF: 1 A4 page, 6,204 bytes ([rendered PDF](images/phase3/consultation-suivi-ui-exemple-1.png)).

## 3. Problems found and fixed

| Problem | Cause | Fix |
| --- | --- | --- |
| Concepts refused: "duplicate name" (Emergency, Non applicable, Autre, Troubles visuels) | OpenMRS refuses two concepts with the same name in one language | reuse the existing CIEL concepts (1175, 5622, 118938); names now checked against the database before loading |
| Admission done but bed not assigned (`403` on `POST /beds/1`) | the bed module requires *Assign Beds* **and** *Edit Admission Locations*; the nurse role had only the first | *Edit Admission Locations* added to the nurse role |
| English labels (print menu, forms tab, notes, procedures, ward totals) | missing French translations in O3 | translation overrides in the frontend config |
| "Printed by Super User" in the PDF footer | background rendering as the system user | the layout prints the date only |
| Appointment date printed as "2026-10-27" | the module gives dates as `YYYY-MM-DD` | the layout converts them to `DD/MM/YYYY` |
| Pathology form refused on save: "Unparseable date: 2026-10-02" | a calendar-only date field sends `YYYY-MM-DD`; the concept (CIEL 159951) is Datetime | local Date concept "Date du prélèvement" instead |
| Diagnosis search box showed no results when typing | the field needs `"isSearchable": true`, otherwise it loads one fixed list | added to both diagnosis fields |
| Initializer concept CSV `ArrayIndexOutOfBoundsException: Index 18 out of bounds for length 18` | String concatenation missed trailing comma in 19-column CSV, omitting `_order` | Used Python `csv.writer` with explicit 19-column lists to ensure exact column counts |
| Database error `Column 'encounter_role_id' cannot be null` on REST encounter save | Incorrect clinician encounter role UUID in test payload | Set clinician role UUID `240b26f9-dd88-4172-823d-4a8bfeb7841f` (from `encounterroles.csv`) |
| Incorrect Karnofsky concept UUID in initial plan | CIEL 160349 was planned, but database uses CIEL 5283 (`5283AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`) | Used CIEL 5283 matching `findings-core_demo.csv` |

## 4. Still open

- The relative time in the ward ("Admis : 2 minutes **ago**") is formatted client-side by `dayjs` inside `@openmrs/esm-ward-app` without dynamic locale loading (upstream limitation; documented in `docs/PLAN-PHASE3-COMPLETION.md`).
- The weekly days of the appointment services must be set once in the Appointments screen (*Rendez-vous* → *Services*) (Initializer can't set them).
- A dedicated "Neurochirurgie" menu in the patient chart needs a small frontend module (planned in Phase 4 with the imaging module).
- The forms must be reviewed by a neurosurgeon (see [`neurosurgery-forms.md`](neurosurgery-forms.md)).
