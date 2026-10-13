# Configuration (`config/`)

Everything that configures this OpenMRS instance is a file in `config/`: metadata, concepts,
global properties, addresses, frontend settings, logos. Nothing is configured by SQL or by
clicking in the admin UI. The O3 images stay the unchanged 3.7.1 releases.

## How it is loaded

| Part | Mounted at (read-only) | Loaded by | When |
| --- | --- | --- | --- |
| `config/backend/` | `/openmrs/distribution/openmrs_config` in `backend` | the backend start script copies it to `/openmrs/data/configuration`, then the **Initializer** module loads it | every start |
| `config/frontend/` | `/usr/share/nginx/html/site` in `frontend` | the O3 app, through `SPA_CONFIG_URLS=/openmrs/spa/site/config-chu-blida.json` | every page load |

This mount **replaces** the configuration baked into the image, which is the upstream
reference-application content plus its demo. The demo patients and demo users
(`clerk`, `nurse`, `doctor`) are only created when the global property
`referencedemodata.createDemoPatientsOnNextStartup` is set, and our configuration does not
set it.

Initializer keeps a checksum of every file it has loaded: on a restart, only changed files
are loaded again.

### Applying a change

| Change | Command (host, repo root) |
| --- | --- |
| a file in `config/backend/` | `docker compose restart backend`, then check the log for Initializer errors |
| a file in `config/frontend/` | reload the page (clear the browser cache if a logo does not change) |

Initializer adds and updates; it does not delete what a removed file once created. To remove
something, mark it retired in its file (`Void/Retire` column = `true`). On this development
machine a full reset is also possible: `docker compose down -v && docker compose up -d`
(**deletes all data**).

## Layout and provenance

Each Initializer domain folder has up to three subfolders, so the origin of every file is
obvious (exception: `addresshierarchy/`, see [Two loader details](#two-loader-details-that-matter)):

| Subfolder | Content |
| --- | --- |
| `upstream/` | copied **unchanged** from the O3 3.7.1 reference content (image `openmrs/openmrs-reference-application-3-backend:3.7.1`) |
| `adapted/` | upstream rows, **filtered** and/or **translated into French**; the UUIDs are kept so the stock O3 screens still find them |
| `chu-blida/` | **our own** files |

```
config/
├── backend/                      → Initializer domains
│   ├── addresshierarchy/               69 wilayas > daïras > communes (files at the folder root)
│   ├── concepts/                       upstream/adapted: vital signs, diagnosis framework, notes
│   │   ├── chu-blida/                  our local neurosurgery concepts (source CHU-Blida)
│   │   └── ciel/                       CIEL concepts we define: form questions, 34 diagnoses
│   ├── ocl/upstream/1-concepts/        CIEL concept packages used by the stock screens
│   ├── ocl/upstream/2-allergies/       the allergy set, loaded after them
│   ├── locations/chu-blida/            CHU and neurosurgery units
│   ├── ampathforms/chu-blida/          neurosurgery forms (Form Builder JSON)
│   ├── printing/                       CHU print layout (not an Initializer domain)
│   ├── liquibase/                      initial bed layout (SQL changesets)
│   └── …                               one folder per domain
├── frontend/
│   ├── config-chu-blida.json           O3 frontend configuration
│   └── logo-chu-blida-*.svg            temporary text logos
└── NOTICE.md                           third-party data notices
```

## What the configuration contains

### Base kept from upstream (unchanged)

| Domain | Files | Why |
| --- | --- | --- |
| `ocl` | CIEL packages: DiagnosesStarterKit (2,186 diagnoses, French names), CIELAllergySet, SOAP_Note, procedures, CDU (units), DeathCause v11, DemoQueueConcepts, IPD-DEMO, VitalSignCodes (BMI), CIELImmunizationContent, PD (patient photo), BasicDrugs (165 drug **concepts**, no formulary) | concepts the stock screens use by default: diagnoses, allergies, visit note, procedures, queues, admissions, registration (cause of death). BasicDrugs is needed by the allergy set (drug allergens) |
| `concepts` | `findings-core_demo.csv` (vital signs with French names, Karnofsky), `questions_core-demo.csv`, `misc-core_data.csv`, `disable_false-core_demo.csv` | vitals, notes |
| `conceptreferencerange` | vitals and BMI reference ranges | abnormal values highlighted in vitals |
| `cohorttypes`, `conceptclasses`, `conceptsources`, `fhirconceptsources`, `locationtags`, `privileges` | base reference content | required by the platform |
| `metadatasets`, `metadatatermmappings`, `metadatasharing`, `dispositions` | EMR API mappings and dispositions (admit / transfer / discharge) | visit note, admissions, ward app |
| `globalproperties` | base settings, drug-order units, FHIR encounter role | platform defaults |
| `jsonkeyvalues` | patient ID sticker settings | sticker printing |

The concepts needed by the stock screens were identified by listing every concept UUID used
as a default in the frontend apps' `config-schema.ts` files and finding which upstream file
defines it.

### Adapted from upstream

| Domain | Change |
| --- | --- |
| `concepts/adapted/convsets-vital-signs.csv` | only the "Vital signs" set (the lab orderability set is dropped) |
| `concepts/adapted/diagnosis-emrapi-concepts.csv` | only the 10 diagnosis framework concepts (certainty, order, visit diagnoses…); the demo diagnoses are dropped |
| `encountertypes` | French names; "Adult Visit" and "Mental Health Assessment" dropped |
| `encounterroles` | French names |
| `visittypes` | "Consultation externe" (default visit type); "Visite hors ligne" **retired** (offline mode not used) |
| `patientidentifiertypes` | **"N° de dossier"** (auto-generated, with check character, e.g. `100000Y`); the demo types are dropped; the two core types created at install ("Old Identification Number", "OpenMRS Identification Number") are **retired** |
| `idgen`, `autogenerationoptions` | generator of the N° de dossier, referenced by UUID |
| `personattributetypes` | "Téléphone", "Patient non identifié"; core types created at install translated ("Lieu de naissance", "Nom de la mère", "Nationalité") or **retired** (Civil Status, Health Center, Health District, Race). The core "email" type is left as is: its UUID is generated at install, so it can't be targeted |
| `locations/adapted/module-locations-retired.csv` | "Main Pharmacy" and "Main Store", created by the stock module, **retired** |
| `proceduretypes` | French names; dental, obstetric, vaccination and laboratory types dropped; "Externe" kept for procedures done elsewhere |
| `jsonkeyvalues/adapted/encounterPrinting.json` | PDF printing of forms: header with "N° de dossier", footer "CHU Frantz Fanon de Blida - Service de neurochirurgie". Printing only applies to encounters entered with a **Form Builder form** (the printing module skips others, such as the stock visit note). The layout file it names doesn't exist yet, so the bundled layout is used (log warning) until the CHU layout is made in phase 3 |

### Ours (`chu-blida/`)

| Domain | Content |
| --- | --- |
| `locations` | **CHU Frantz Fanon de Blida** (visit location) > **Service de neurochirurgie** > *Consultations de neurochirurgie* (login, queue, appointments), *Neurochirurgie - Hommes / Femmes / Soins intensifs* (login, admission, transfer), *Bloc opératoire* (login, queue) |
| `visittypes` | "Hospitalisation" |
| `patientidentifiertypes` | **NIN** (national identification number, optional, unique, 18 digits) |
| `personattributetypes` | "Profession", "Personne à prévenir" |
| `globalproperties` | French by default (`default_locale=fr`, allowed: fr, en, ar), queue concept sets, cause of death, attachment file types (jpeg, jpg, png, pdf) |
| `addresshierarchy` (folder root) | Algérie > Wilaya > Daïra > Commune, then a free-text address line: **69 wilayas, 551 daïras, 1,541 communes** (Law 26-06, JO n°25 of 5 April 2026) |

### Neurosurgery content (phase 3)

The clinical content (concepts, forms, print layout) is described for clinicians in
[`neurosurgery-forms.md`](neurosurgery-forms.md). Mechanics:

| Domain / folder | Content |
| --- | --- |
| `conceptsources/chu-blida/` | concept source **"CHU-Blida"**: local codes (`NCH-A-…` answers, `NCH-Q-…` questions) for concepts that CIEL does not have. Each local concept has a "same as" mapping `CHU-Blida:<code>` |
| `concepts/chu-blida/01-…-reponses.csv` | local answer concepts (`_order:1000`, loaded before the questions) |
| `concepts/chu-blida/02-…-questions-….csv` | local question concepts, one file per form (`_order:1100`) |
| `concepts/ciel/ciel-neurochirurgie.csv` | **CIEL concepts** used by the forms that are not in the `ocl` packages, defined with their CIEL UUID, names and `CIEL:<id>` mapping (`_order:1200`, after the local files, see below) |
| `concepts/ciel/ciel-diagnostics-neurochirurgie.csv` | **34 neurosurgical diagnoses** from CIEL that the `ocl` diagnosis package lacks (subdural haematomas, hydrocephalus, brain and spinal tumours, aneurysms, disc herniations, Chiari…), with their ICD-10 codes and a French synonym where the clinical term differs (see below) |
| `concepts/chu-blida/04-…-questions-consultation.csv` | local questions of the consultation form (`_order:1100`). Checked in OCL: CIEL has no text equivalent for *Adressé par*, *Traitement en cours*, *Intervention proposée*, *Examens demandés*, *Traitement prescrit* (its "Tests ordered" 1271 is coded); *Décision* could later use CIEL 166937 "Care management plan", which has no answers in CIEL |
| `concepts/chu-blida/05-…-questions-observation-entree.csv` | the admission note's only local question, *Mode d'admission* (4 local answers: CIEL 162477 "Admission status" only has approved/denied) |
| `encountertypes/chu-blida/` | one encounter type per document (e.g. "Compte rendu opératoire"). From the consultation on, the code behind each UUID is recorded: *Consultation de neurochirurgie* = `NCH-ET-CONSULT`, *Observation d'entrée* = `NCH-ET-OBSENTREE`. The admission note has its own type: the stock "Admission" type is the one the ward app uses for the admission itself |
| `ampathforms/chu-blida/` | the Form Builder forms (O3 JSON). Initializer derives the form's UUID itself (from name and version); the `uuid` field in the file is ignored |
| `printing/chu-blida-encounter.xsl` | the **CHU print layout** for "Imprimer cette consultation". Not an Initializer domain: copied with the rest to `/openmrs/data/configuration/printing/`, and referenced by `encounterPrinting.json` (`stylesheetPath`) |

Rules for local content:
- **CIEL first:** before creating a local concept, check that it doesn't already exist. OpenMRS
  refuses two concepts with the same name in one language (that's how "Non applicable" =
  CIEL 1175 and "Autre" = CIEL 5622 were found and reused).
- **Stable UUIDs:** a local concept's UUID is
  `uuid5(NAMESPACE_URL, "https://chu-blida.dz/openmrs/neurochirurgie/" + code)`, so it can
  always be recomputed from its code.
- Yes/No questions use CIEL 1065 (Oui) / 1066 (Non).

**CIEL mapping** (2026-10-11). Each local concept was looked up in CIEL on OCL
(app.openconceptlab.org, read-only, nothing created in the account). When CIEL has the same
concept, the form now uses the CIEL concept:

| Field | Was (local) | Now (CIEL) | Note |
| --- | --- | --- | --- |
| Score de Glasgow total | NCH-Q-GCST | **160347** Glasgow coma scale (Finding, numeric 0–15) | the trend widget reads it |
| Intervention réalisée | NCH-Q-INTERV | **166635** Procedure performed (text) | |
| Côté | NCH-Q-COTE | **160594** Laterality | answers 5141 Droit, 5139 Gauche, 160406 Bilatéral + local *Médian* + 1175 Non applicable |
| Type d'anesthésie | NCH-Q-TYPANE | **164254** Anesthesia type | answers 161909 Anesthésie générale, 161914 Anesthésie locale, 164244 Sédation intraveineuse + local *Anesthésie locorégionale* |

Kept local, because CIEL has no exact equivalent: the Glasgow components (eyes, verbal, motor),
pupils, MRC grades per limb, mRS, body position, extent of resection, indication, and
**blood loss** (CIEL 161928 is in **litres**; the surgeons write mL).

**Coded diagnoses.** The operative report records the pre- and post-operative diagnoses as
**CIEL 163034 / 163035** (coded), chosen by searching all diagnoses; the former free-text fields
remain as "… - précisions".
- Searchable diagnoses: the 2,186 of the CIEL starter package (`ocl`) plus our 34
  neurosurgical ones. The same diagnoses are found by the visit note's diagnosis search.
- Each of the 34 keeps CIEL's ICD-10 relation as is (`Mappings|SAME-AS|ICD-10-WHO`,
  `Mappings|NARROWER-THAN|ICD-10-WHO`, `Mappings|BROADER-THAN|ICD-10-WHO` columns), for
  statistics by ICD-10 chapter later.
- 14 have a **French synonym** (`Synonym:fr`) because CIEL's French name is not the term used
  in practice: "Hernie discale lombaire", "Canal lombaire étroit", "Mal de Pott",
  "Schwannome vestibulaire", "Craniosténose", "Empyème sous-dural"… A search finds the synonym;
  the official name is displayed and printed.
- Not in CIEL, so not added: cavernoma (CIEL only has a generic "cavernous hemangioma").
- Form field: `"rendering": "ui-select-extended"`, `"isSearchable": true`,
  `"datasource": {"name": "problem_datasource", "config": {"class": ["<Diagnosis class uuid>"]}}`.
  `isSearchable` is required: without it the field loads one fixed list and typing doesn't search.
  The class must be a **list**: the engine then filters the results itself. With a single value
  it is sent to the server, but the server ignores the class when there is a search term.

How the switch is done, and why in this order:
- The replaced local concepts are **retired** (`Void/Retire` = `TRUE` in their CSV), not deleted:
  old test data still points to them.
- OpenMRS ignores retired concepts when it checks for duplicate names, so the CIEL concepts can
  carry the same French names ("Droit", "Type d'anesthésie"…). This works only if the local
  files load first, hence `_order:1200` for the CIEL file.
- Our CIEL answer lists are shorter than CIEL's (anaesthesia type) or have local answers added
  (laterality). If a CIEL package that contains these concepts is loaded one day, it will replace
  our answer lists; the forms keep working because they list their answers themselves.

**Print layout** (`chu-blida-encounter.xsl`, XSL 1.0 for Apache FOP, strict validation):
letterhead on every page (Republic, Ministry, CHU, service | patient, N° de dossier, NIN,
date, location); the form's title; one coloured band per section; **only answered questions**
(the module writes "No data recorded" for the others), short answers as "Label : valeur" on
one line and long texts as blocks with their line breaks; a signature box; footer "Imprimé le
…", the custom footer text, "Document médical confidentiel", "Page X / Y". Notes:
- the logo can only be a PNG (`encounterPrinting.json` → `logopath`), so the letterhead is
  text until the official logo is available;
- the module writes "Printed by <name>", but the PDF is rendered by a background task running
  as the system user, so the layout prints only the date;
- printing applies to **Form Builder forms only**, and prints **observation fields only**: a form
  field of type `diagnosis` (which records a visit diagnosis instead of an observation) would
  not appear on the PDF. So the consultation records its diagnosis as a coded observation
  (CIEL 1284, with certainty CIEL 159394), like the operative report;
- a date answer comes from the module as `YYYY-MM-DD`; the layout prints it as `DD/MM/YYYY`;
- texts written as `markdown` in a form are printed too, so a form must not contain on-screen
  hints.

### Clinic, queue and beds (phase 3)

| Domain / folder | Content |
| --- | --- |
| `appointmentspecialities/chu-blida/` | speciality "Neurochirurgie" |
| `appointmentservicedefinitions/chu-blida/` | *Consultation de neurochirurgie* (20 min, max 25 per session), *Consultation post-opératoire* (15 min, max 15), *Consultation de neuro-oncologie* (20 min, max 10); 08:30–13:00; location *Consultations de neurochirurgie*. **The weekly days of a service can't be set by Initializer**; set them once in *Rendez-vous* → *Services* |
| `queues/chu-blida/` | queue *Consultation de neurochirurgie* at the consultation location (service *Consultation*) |
| `concepts/adapted/queue-concepts-fr.csv` | French names for the queue concepts of the kept DemoQueueConcepts package, same UUIDs, English name kept (the queue app uses them by UUID): *Patient en attente, Pris en charge, Prise en charge terminée*; *Non urgent, Urgent, Urgence*; *Consultation, Tri* |
| `liquibase/liquibase.xml` | **initial bed layout**: types *Lit standard* and *Lit de soins intensifs*; 18 beds H-01…H-18 (Hommes), 18 F-01…F-18 (Femmes), 6 SI-01…SI-06 (Soins intensifs), 3 per row. Bed numbers can be changed later in the Bed Management app |

Why the beds are in a Liquibase file: Initializer has no domain for beds. Its `liquibase`
domain runs **before** the locations domain, and each file is skipped once loaded. So every
bed changeset first inserts its ward location **if it is missing** (same UUID as
`locations.csv`, which then completes it), and every insert is "insert if missing". It is
therefore safe on a fresh install and on re-runs.

### Roles (`roles/chu-blida/roles.csv`)

Built from scratch. None of them inherits "Privilege Level: High", which in the stock
distribution gave every clinical role the same 301 privileges (test report, finding 1).

| Role | Inherits | Adds |
| --- | --- | --- |
| **CHU - Consultation du dossier** | – | reading the record (patients, visits, encounters, observations, allergies, conditions, diagnoses, procedures, appointments, queues, beds, attachments, patient lists), printing forms and ID stickers |
| **CHU - Secrétariat** | Consultation du dossier | registering and editing patients and identifiers, relationships, starting visits, patient photo, attachments, appointments, queue entries, patient lists |
| **CHU - Infirmier** | Consultation du dossier | encounters and observations (vitals, forms), allergies, notes, attachments, queue entries, bed assignment and admissions/transfers/discharges in the ward app (*Assign Beds* **and** *Edit Admission Locations*: the bed module requires both), patient lists |
| **CHU - Médecin** | Infirmier | patient and identifier edits, diagnoses, conditions, problems, procedures, orders, programs, deleting observations and notes, appointments |

Administrators use the built-in **System Developer** role (all privileges). The roles file is
generated with every privilege name checked against the running database; a name that
doesn't exist makes Initializer skip it silently, so check again when adding one.

On the development machine, `scripts/dev-create-test-users.sh` creates one test user per
role (`test-secretariat`, `test-infirmier`, `test-medecin`), and
`scripts/dev-test-roles.sh <patient uuid>` checks through the REST API what each role may and
may not do (18 checks: reading, creating a person, allergies, conditions, creating a user).
The test users' password comes from the environment and is never stored. Never run these
scripts on the hospital server.

Known trade-off of these simple roles: the secretary can add encounters and observations
(needed for the patient photo), so the backend would also accept vitals from a secretary.
And since the bed module ties bed assignment to *Edit Admission Locations*, nurses (and doctors)
can also edit a ward's bed layout.

### Dropped from upstream

Demo patients and users, Cambodian address hierarchy, demo locations, all demo forms,
appointment services/types/specialities, queues, programs (HIV, diabetes), billing (services,
cash points, payment modes), drugs and the drug formulary, lab tests and lab reference ranges,
stock, mental health, COVID and group-session content, relationship types, demo roles, order
frequencies. The appointment services, queues, forms and drugs the department needs are
added in their own steps.

### Frontend (`config/frontend/config-chu-blida.json`)

- Logos: `logo-chu-blida-nav.svg` (top bar) and `logo-chu-blida-login.svg` (login page).
  These are temporary text logos; replace the SVG files with the official CHU logo when
  available.
- Hidden because not used by the department (assumption A8 in the plan): pharmacy dispensing
  and fast data entry in the app menu; laboratory and billing on the home page; immunizations,
  programs, medications, test results, orders and billing in the patient chart. Stock and
  billing menu entries are also restricted by privileges.
- Billing extensions removed from the visit form (`extra-visit-attribute-slot`), the visit
  summary (`visit-summary-panels`) and the patient banner (`patient-banner-tags-slot`). Without
  this, the visit form shows *"Erreur du service de facturation"*.
- `visitAttributeTypes: []`: the chart's default visit attributes (punctuality, insurance
  number) came from dropped demo data and made the visit form show *"Une partie du formulaire
  n'a pas été chargée"*.
- **Registration form** (`@openmrs/esm-patient-registration-app`): NIN shown by default
  (`defaultPatientIdentifierTypes`); "Nom de la mère" and "Profession" in *Informations de
  base*; "Personne à prévenir" in *Coordonnées* (address hierarchy and phone are built in).
- The order basket stays in the chart's right-hand toolbar: in 3.7.1 that toolbar is built
  from "workspace windows", not an extension slot, so slot configuration can't remove it. It
  will be used for imaging requests.
- Same settings as upstream for the patient chart (`restrictByVisitLocationTag`,
  `showUpcomingAppointments`) and the brand colour.

- **Neuro trends on the patient summary:** two instances of the generic widget
  `obs-by-encounter-widget` added to `patient-chart-summary-dashboard-slot` (`add`,
  `configure`, `order`): `#neuroGlasgow` (GCS total and Karnofsky, graph by default) and
  `#neuroPupillesMotricite` (pupils and MRC strength, table by default), both filtered on the
  encounter type *Évaluation neurologique*. A dedicated "Neurochirurgie" menu entry can't be
  made by configuration in 3.7.1 (each dashboard link's title and path are fixed in its app's
  code); it will come with our own frontend module.
- **Calculated form fields** (e.g. the GCS total) use O3's expression evaluator: field ids as
  variables, arithmetic, ternary `a ? b : c`, `=== !== && || ??`.
- **French translation overrides** (`"Translation overrides": {"fr": {key: text}}` under the
  app that owns the text): `printEncounter` "Imprimer cette consultation" and
  `completedForms` "Formulaires complétés" (patient chart), `stickyNote` "Note rapide"
  (notes), `procedures` and `Procedures` "Actes et procédures" (procedures app; the left-menu
  entry translates the dashboard title literally, hence the capitalised key). To find a key,
  search the app's `translations/fr.json` in `../openmrs-source/frontend` for the English text.

**How to find a slot or extension name:** the image's `routes.registry.json`
(`docker compose exec frontend cat /usr/share/nginx/html/routes.registry.json`) lists every
extension with its slot. The configuration goes under the app that **renders** the slot,
which you can find with `grep -rln "'<slot name>'" ../openmrs-source/frontend`.

## Rebuilding the address hierarchy

`config/backend/addresshierarchy/addresshierarchy.csv` is generated, not edited by
hand:

```bash
# in an empty temporary folder
curl -O https://registry.npmjs.org/geoalgeria/-/geoalgeria-2.3.0.tgz
tar -xzf geoalgeria-2.3.0.tgz
# from the repo root
python3 -I scripts/build-address-hierarchy.py <tmp>/package/data/csv \
  config/backend/addresshierarchy/addresshierarchy.csv
```

Version used: **geoalgeria 2.3.0** (2026-10-03), npm integrity
`sha512-6I0/yIf7mfZWw/ll9+wLC83t1ysNDJ6YOmBQ0xH7E6VTihGR11IDbmoDwh0+CNEcKbDvU+73rC7Yj/RCU2HtBA==`.
Only names and administrative codes are used (MIT); see `config/NOTICE.md`.

Each CSV line is `Algérie%DZ,<wilaya>%NN,<daïra>%NNDxx,<commune>%NNNN`. The code after `%`
is stored in `address_hierarchy_entry.user_generated_id`, which holds **at most 11
characters**. A longer code makes the load fail during startup, and that failure stops the
whole application. Daïra codes are therefore short (`09D02` = 2nd daïra of wilaya 09 in
alphabetical order), and the script refuses to write any code longer than 11 characters.

## Two loader details that matter

- **The address hierarchy files must be at the root of `addresshierarchy/`.** The
  addresshierarchy module only reads `addresshierarchy/addressConfiguration.xml` (source:
  `AddressConfigurationLoader`). A file in a subfolder is ignored with the log error
  *"Address hierarchy configuration file appears invalid"*, which is why the upstream demo
  never loaded its Cambodian hierarchy.
- **OCL packages load in path order, and a package is marked as loaded even if some of its
  mappings failed** (source: `BaseFileLoader`; files without an explicit order are sorted by
  path). A mapping fails when its target concept is not imported yet, and it is not retried
  on the next start. The allergy set refers to concepts in SOAP_Note, DiagnosesStarterKit and
  BasicDrugs, so it sits in `2-allergies/`, after `1-concepts/`. Checked offline: with this
  order only 2 *same-as* mappings stay unresolved (in DiagnosesStarterKit and DeathCause), and
  they were already unresolved in the upstream demo. When adding a package, check its mappings
  the same way and put it in a folder that loads after the packages it refers to.

## Rules

- Never edit a file in an `upstream/` folder. Copy it to `adapted/` and change the copy.
- Keep the UUIDs of upstream metadata when adapting it: the stock O3 screens refer to them.
- New UUIDs are generated once (`python3 -c 'import uuid; print(uuid.uuid4())'`) and never
  changed afterwards.
- CSV files are UTF-8, comma-separated, one header row.
- Mount directories, never single files.
