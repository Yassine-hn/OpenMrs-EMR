# Test report: phase 3 (neurosurgery content), in progress

| | |
| --- | --- |
| Date | 2026-10-10 |
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

## 3. Problems found and fixed

| Problem | Cause | Fix |
| --- | --- | --- |
| Concepts refused: "duplicate name" (Emergency, Non applicable, Autre, Troubles visuels) | OpenMRS refuses two concepts with the same name in one language | reuse the existing CIEL concepts (1175, 5622, 118938); names now checked against the database before loading |
| Admission done but bed not assigned (`403` on `POST /beds/1`) | the bed module requires *Assign Beds* **and** *Edit Admission Locations*; the nurse role had only the first | *Edit Admission Locations* added to the nurse role |
| English labels (print menu, forms tab, notes, procedures, ward totals) | missing French translations in O3 | translation overrides in the frontend config |
| "Printed by Super User" in the PDF footer | background rendering as the system user | the layout prints the date only |

## 4. Still open

- The relative time in the ward ("Admis : 2 minutes **ago**") is in English.
- The weekly days of the appointment services must be set once in the Appointments screen
  (Initializer can't set them).
- A dedicated "Neurochirurgie" menu in the patient chart needs a small frontend module (planned
  with the imaging module).
- The forms must be reviewed by a neurosurgeon (see [`neurosurgery-forms.md`](neurosurgery-forms.md)).
