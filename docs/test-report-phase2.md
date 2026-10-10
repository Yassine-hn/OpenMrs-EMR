# Test report: phase 2 (our configuration on O3 3.7.1)

| | |
| --- | --- |
| Date | 2026-10-10 |
| System | Local stack, O3 RefApp **3.7.1** (same image digests as phase 1), **our configuration** from `config/` (see [`configuration.md`](configuration.md)), fresh database |
| Method | REST/FHIR checks, the smoke test, a role test script, and the real UI in Chrome (Claude in Chrome) |
| Users | `admin` (password from `.env`) and the development test users `test-secretariat`, `test-infirmier`, `test-medecin` |
| Screenshots | `docs/images/phase2/` |

## 1. Summary

**Phase 2 works.** The system starts from our configuration with no demo data. Everything
is in French by default and shows the CHU Blida locations, the 69-wilaya address hierarchy,
our identifiers and our roles. Patient registration, visits, vitals and a visit note with a
French-coded diagnosis work in the UI. Each role is allowed what it should do and refused
the rest.

| Area | Result |
| --- | --- |
| Start without demo data | PASS: 0 patients, no demo users, no demo locations or forms |
| Smoke test (12 checks) | PASS |
| Role checks (18 checks) | PASS |
| Registration in the UI | PASS |
| Visit, vitals, visit note in the UI | PASS |
| PDF printing of an encounter | **Not applicable yet**: works only for Form Builder forms (phase 3), see §4 |

## 2. What was checked

### Start-up and configuration

| Check | Result |
| --- | --- |
| First start on an empty database | ready after **73 min 45 s** (concept import). A normal restart takes **about 50 s** |
| Configuration loading | All 12 concept packages loaded, the allergy set last as designed; address hierarchy: 2,162 entries (1 country, 69 wilayas, 551 daïras, 1,541 communes) |
| Log | only the known harmless messages (DWR XML validation, "Filters cannot be added to context") |
| Time zone | JVM and MariaDB both on Africa/Algiers (UTC+1); times shown in the UI are local |
| Metadata through REST | French names for encounter types, visit types, encounter roles, procedure types, identifier and person attribute types; locations as configured |
| Platform defaults | Two core identifier types, four core person attributes and two stock-module locations retired by configuration; three core attributes translated |

### Smoke test (`scripts/smoke-test.sh`)

All 12 checks pass: containers healthy, UI and legacy UI served, REST login with the `.env`
password, core 2.8.8, 30/30 modules started, FHIR R4, patient count, **French by default**,
**the 5 CHU login locations and nothing from the demo**, **69 wilayas**, **no demo users**.

### Roles (`scripts/dev-test-roles.sh`)

| Action | Secrétariat | Infirmier | Médecin |
| --- | --- | --- | --- |
| Read the patient and visits | allowed | allowed | allowed |
| Create a person | allowed | **refused** | allowed |
| Record an allergy | **refused** | allowed | allowed |
| Record a condition | **refused** | **refused** | allowed |
| Create a user (admin task) | **refused** | **refused** | **refused** |

18/18 as expected. The script cleans up after itself and can be re-run after any change to
the roles.

### User interface (Chrome)

| Step | Result | Screenshot |
| --- | --- | --- |
| Login page | CHU logo text, French | – |
| Login location picker | exactly our 5 units | – |
| Secretary home | menu: *Files d'attente, Rendez-vous, Listes de patients, Admissions*; no laboratory or billing | `01-accueil-secretariat-files-attente.jpg` |
| Registration: address | quick search "Boufarik" → *Algérie > Blida > Boufarik > Boufarik*; country, wilaya, daïra and commune filled | – |
| Registration: NIN | 5 digits refused with *"Exactement 18 chiffres"*; 18 digits accepted | `02-enregistrement-nin-invalide.jpg` |
| Patient saved | banner: *N° de dossier 100000Y*, NIN; FHIR returns name, both identifiers, the full address and the phone | `03-dossier-patient-apres-enregistrement.jpg` |
| Patient chart menu | *Résumé, Signes vitaux et biométrie, Visites, Allergies, Conditions médicales, Procedures, Pièces jointes, Rendez-vous*; immunizations, programs, medications, tests, orders and billing hidden | `03-…` |
| Start a visit (doctor) | location defaults to **CHU Frantz Fanon de Blida** (fixes finding 6 of the 3.7.1 report); types *Consultation externe*, *Hospitalisation* | – |
| Vitals (doctor) | French labels, BMI calculated (25.2), high blood pressure flagged (165/95 ↑), time 17:59 local | `04-…`, `05-…` |
| Visit note (doctor) | diagnosis searched in French ("tumeur" → *Tumeur du cerveau*, *Tumeur cérébrale, astrocytome*…); saved | – |
| Allergy form | all 4 allergy concept sets load (drugs, foods, environment, reactions) | – |
| Registration form after the last change | *NIN* shown by default, *Nom de la mère*, *Profession*, *Personne à prévenir* | `06-formulaire-enregistrement-champs-chu.jpg` |

## 3. Problems found and fixed during the test

| Problem | Cause | Fix |
| --- | --- | --- |
| Address hierarchy not loaded (1st start) | the address module only reads `addresshierarchy/addressConfiguration.xml` at the folder root | files moved to the root |
| OCL mapping errors (1st start) | concept packages load in path order; the allergy set loaded before the packages it refers to | `ocl/upstream/1-concepts/` then `2-allergies/`, plus the BasicDrugs concept package |
| Application did not start (2nd start) | address codes longer than the 11-character database column | short daïra codes (`09D02`); the generator refuses long codes |
| "Erreur du service de facturation" in the visit form, pink tag in the banner | billing extensions in the visit form, visit summary and patient banner | removed by frontend configuration |
| "Une partie du formulaire n'a pas été chargée" in the visit form | the chart's default visit attributes (punctuality, insurance) come from dropped demo data | `visitAttributeTypes: []` |
| "Visite hors ligne" offered as a visit type | upstream offline visit type | retired |
| Core identifier types and stock locations in pickers | created by the platform, not by our configuration | retired by configuration |

## 4. Known limitations (not blocking)

- **PDF printing applies to Form Builder forms only.** The printing module skips encounters
  that have no form (source: `EncounterXmlBuilder`), so the stock visit note and vitals cannot
  be printed this way. The neurosurgery documents will be forms (phase 3), and their printing
  is the first test of phase 3. The configured layout file doesn't exist yet, so the bundled
  layout is used (warning in the log).
- **The order basket stays in the chart's right-hand toolbar.** In 3.7.1 that toolbar is built
  from "workspace windows", not an extension slot, so it can't be removed by slot
  configuration. It will be used for imaging requests later.
- **Simple roles, known trade-off:** the secretary can add encounters and observations (needed
  for the patient photo), so the backend would also accept vitals from a secretary.
- **Translations:** a few stock labels are still in English (*Procedures*, vitals field labels
  inside the form, "Sticky note"). They can be fixed later with translation overrides.
- **Browser automation:** screenshots time out when a side panel slides in. This is a test-tool
  issue: the page keeps responding, and the steps were completed through element references.

## 5. Test data created

| Item | Details |
| --- | --- |
| Patient | **Karim Testpatient**, N° de dossier `100000Y`, NIN `109850315000000017` (test value), Boufarik (Blida) |
| Visit | Consultation externe, with vitals and a visit note (diagnosis *Tumeur du cerveau*) |
| Users | `test-secretariat`, `test-infirmier`, `test-medecin` (development only; remove before production) |
| Role-test records | created and removed again by the script |
