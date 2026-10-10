# UI test report: OpenMRS O3 Reference Application 3.7.1

| | |
| --- | --- |
| Date | 2026-10-01 |
| System | Local stack from this repository: O3 RefApp **3.7.1**, core **2.8.8**, images pinned by digest, **demo data** |
| Method | Real clicks in Chrome (Claude in Chrome) on `http://localhost/openmrs/spa`, with each step checked in the database / REST / FHIR and the logs |
| Users | Demo accounts `clerk`, `nurse`, `doctor`, `technician`, `admin`; one created user `storekeeper` |
| Scope | One patient followed end to end: registration → queue → triage → consultation → lab → pharmacy → billing → ward admission, plus stock, administration and permissions |
| Screenshots | `docs/images/test-3.7.1/` (82 files, numbered in test order) |
| Detailed results | Appendix, one row per check (60 checks) |

## 1. Summary

**The clinical core works end to end.** A patient was registered, queued, triaged (vitals with
abnormal flags), seen by a doctor (allergy, diagnosis, condition, drug and lab orders,
immunization, program, admission request), had the lab result entered, was dispensed the drug,
billed and paid, and was admitted to a ward bed. All of it was saved and confirmed in the database.

| Result | Count |
| --- | --- |
| PASS | 28 |
| PASS with remarks | 19 |
| ISSUE (works, but a problem to fix) | 5 |
| FAIL | 1 |
| Blocked / not configured (setup missing in demo data) | 3 |
| Info | 4 |

**Not ready for a hospital as delivered.** The issues below are mostly **configuration and role
design**, not bugs in the software, but they must be addressed before real patients.

## 2. Findings by priority

### Critical (fix before any real use)

| # | Finding | Evidence |
| --- | --- | --- |
| 1 | **No role separation.** Clerk, nurse and doctor each have the same 301 privileges (incl. placing orders, editing users, managing concepts): every "Application:" role inherits "Privilege Level: High". Roles only change which menus are shown. | X1 |
| 2 | **No drug–allergy warning.** The patient is allergic to penicillins; opening an amoxicillin order shows only a small "Allergies: Penicillins" tag, with no alert or block. (The pharmacy screen does show a clear allergy banner.) | D5a, screenshots 32–33, 50 |
| 3 | **Default admin password** `admin / Admin123` and the demo accounts are publicly known. | – |

### High

| # | Finding | Evidence |
| --- | --- | --- |
| 4 | **Session timeout loses work**: a form left open > 30 min fails to save (401) and the app offers to discard it. Recovery: re-login, then save. Train users; consider a longer timeout. | N2b, screenshot 22 |
| 5 | **A stock-only user cannot use the UI**: login succeeds, but the user is bounced back to the login page (403 on queue / provider data). Stock roles assume a clinical base role, which conflicts with finding 1. | S6, screenshot 82 |
| 6 | **Visit location defaults to "Ubuntu Hospital"** instead of the login location. | C4 |
| 7 | **Lab results have no reference ranges → no abnormal flag**; one result is shown 3 times (once per panel). | L3 |
| 8 | **Billing currency is KES and all prices are 0.** Auto-billing only works once each test or drug is linked to a priced billable service or stock item (proven by test B3–B5). | B1, B4 |
| 9 | **Encounter provider missing** on vitals and order encounters (the creator is still recorded). | D3b |

### Medium (configuration)

| # | Finding |
| --- | --- |
| 10 | **Demo data everywhere**: Cambodian address hierarchy (and not even loaded), 4 wards with **0 beds and no bed types**, HIV / diabetes programs, demo forms, 2 reports only, no stock items, no stock scopes, demo-server banner in the Form builder. Production needs its own configuration. |
| 11 | **French translation incomplete**: many UI strings in English (Actions, Sticky note, Logout, stock / cohort / bed menus, billing labels, toasts), some mistranslations ("Chercher des tables et des services", "Ajouter à l'ordonnance" for a lab test). Metadata names (locations, queues, services) must be translated in our configuration. |
| 12 | **Server in UTC, users in UTC+1** (Algeria): stored times are UTC; decide the server time zone. |
| 13 | **Diagnoses are always "provisional"**; no way seen in the visit note to confirm them, and no disposition (admit / discharge) in the visit note; admission goes through the "Ward Admission" form, stored as encounter type "Transfer Request". |
| 14 | **No statistical reports** out of the box. |

### Low (usability bugs)

- Date picker header shows "Oct, 12:00 AM 2026".
- A stock scope saved for oneself → raw "500" error (the rule is fine, the message is not).
- Bed-type display name limited to 10 characters; the form only says "Invalid Submission".
- Some lists don't refresh after saving (stock items, stock scopes); some dropdowns ignore typing (stock dispensing unit).
- The vaccine list contains an entry called "None".
- Chrome's password manager autofilled a saved login into the OCL subscription form (nothing saved). Recommend not saving passwords in browsers on hospital PCs.

## 3. What works well

- **Registration**: auto-generated ID, photo, search by name or ID, patient lists.
- **Queues**: add / call / serve / move with priority and comments; appointment check-in starts the visit.
- **Appointments**: per service and provider, day calendar with load counts, **recurring appointments** option.
- **Vitals**: live abnormal highlighting, automatic BMI, history and charts.
- **Clinical chart**: allergies, conditions, coded diagnoses (CIEL), visit notes, immunizations with dose series, programs, visit timeline with all encounters.
- **Orders**: one basket for drugs and labs, quantity auto-calculation, validation (e.g. refills required).
- **Lab workflow**: pick → in progress → result → visible in chart.
- **Pharmacy**: prescription list, clear allergy banner, dispense with editable quantity, FHIR MedicationDispense.
- **Billing**: manual bill, finalize, cash payment with reference, PAID status; **automatic bill from an order once a priced service is linked**.
- **Wards**: admission request from the doctor → ward nurse admits to a bed.
- **Form builder** with JSON + live preview; **FHIR R4** API.

## 4. Configuration to-do list for the hospital (input for the next step)

1. **Roles and privileges** designed per job (reception, nurse, doctor, lab, pharmacy, cashier, store, admin), each with a working landing page; test each one.
2. **Change all default passwords**; remove demo accounts and demo data (needs a clean, non-demo setup).
3. **Locations**: the hospital's real services, wards, login locations; correct default visit location.
4. **Algerian address hierarchy** (wilaya / daïra / commune).
5. **Beds**: bed types, beds per ward.
6. **Concepts**: reference ranges for lab tests; the department's diagnoses and procedures (OCL / CIEL).
7. **Forms**: neurosurgery forms (pre-op, operation note, post-op…) in the Form builder.
8. **Billing**: currency DZD, price list, link services to tests / procedures; cash points; payment modes.
9. **Stock**: items, units, sources, store locations, user scopes.
10. **French translations** of metadata, plus missing UI strings (configurable overrides).
11. **Server time zone** and the session timeout.
12. **Reports** the hospital needs.
13. **Drug–allergy safety**: decide how to compensate (configuration, a frontend extension, or procedure).

## 5. Test data created during this test

All in the local demo database. A fresh setup would not contain them.

| Item | Details |
| --- | --- |
| Patient | **Amina Testuser, 10001PE**: OPD visit, queue entries, vitals, allergy (penicillins), condition and diagnosis (hypertension), orders ORD-323/324 + a 2nd creatinine order, lab result 135 µmol/L, dispense, immunization (Hep B), program enrollment, ward admission (Ward 1, bed W1-01), bills 0001-8 (0, posted) and 0002-6 (800, **paid**) |
| Demo patient | Richard Jones (10000GX): appointment checked in, visit started |
| Appointment | #180 for 10001PE, 08/10/2026 10:00 |
| Patient list | "UI test - follow-up" |
| Billing | Billable service "Serum creatinine test" (Cash 800) |
| Stock | Item "Amlodipine 5mg tablet" (AML5, box of 30); user role scope for storekeeper |
| Beds | Bed type STANDARD; bed W1-01 in Ward 1 (occupied by 10001PE) |
| User | `storekeeper` (Sami Storekeeper): Inventory Manager, Stock Management Base Role, Provider; provider 7-5. Password known only to the user |
| Preferences | `clerk` language switched for one session only; `admin` default language = French (set by the user on 26/09) |

## 6. Notes on the test method

- Chrome had to stay **visible and the active tab**; hidden or background tabs ignore input and screenshots time out. After a logout + login in the same tab, mouse input sometimes froze; a fresh tab, or switching users through the session API + reload, avoided it. The login **location picker** sometimes ignored clicks and was selected through its label element. These are automation issues, not OpenMRS bugs.
- Where a screen gave an unclear error, the cause was read from the backend log, the REST response or the source code in `../openmrs-source/` (billing strategy, stock scope rule, bed type validation, frontend redirect logic).
- Two tester mistakes were caught and corrected before saving (a wrong allergy reaction, wrong stock-scope boxes); they are noted in the appendix.
- **Not tested**: printing (opens browser dialogs), attachments upload, discharge / transfer from ward, ending a visit, refunds and discounts, stock receipt (blocked, see S6), appointments calendar view, implementer tools, offline mode.

---

## Appendix: detailed results

Screenshot numbers refer to files in `docs/images/test-3.7.1/` (prefix `NN-`).

| ID | Role | Use case | Result | Notes | Screenshot |
|---|---|---|---|---|---|
| C1 | clerk | Login (username → password → location) | PASS | 2-step login; location list (Outpatient Clinic). Radio clicks need the tab visible | 01-clerk-home-appointments.jpg |
| C2 | clerk | Home page | PASS | Lands on Appointments (today: 1, Richard Jones, Rehabilitation). Left menu: Service queues, Appointments, Patient lists, Wards, Laboratory, Billing. Top bar: search, add patient, user menu, app switcher | 01 |
| C3 | clerk | Register new patient (name, sex, DOB, city, phone) | PASS | Top-bar "add patient" icon. Sections: Basic Info, Contact Details, Relationships. Photo optional. OpenMRS ID auto-generated → 10001PE (Amina Testuser, F, 14-Mar-1985). Address = free-text fields + "Search address" (hierarchy empty, as known). Lands in patient chart with toast "New Patient Created" | 02, 03 |
| C4 | clerk | Start a visit (Actions → Add visit) | PASS with remarks | Panel "Start a visit": New/Ongoing/In the past; upcoming-appointments notice; Visit location; 5 visit types (Facility, Home, OPD, Offline, Group Session); Billing details: Paying/Non paying → Payment method (Cash, Bank transfer, Paypal), Punctuality, Insurance policy no. Banner shows "Active Visit". DB: OPD Visit, attributes Patient Type + Payment Method. **Remark 1: visit location defaulted to "Ubuntu Hospital", not the login location "Outpatient Clinic"** (config issue for us). **Remark 2: no bill created on visit start (0 bills via /billing/bill?patientUuid=) — billing needs billable services/orders; retest in billing section** | 04, 05, 06 |
| C5 | clerk | Add patient to service queue | PASS | Service queues → "Add patient to queue" → search by ID → Queue location (Outpatient Clinic) → Service (Outpatient Triage / Outpatient Consultation) → Priority (Not Urgent/Urgent/Emergency). Row: Urgent, Waiting, Outpatient Triage, action "Call". Counter "Waiting: 1, Urgent 1". Remark: "Checked in patients" stays 0 (counts appointment check-ins, not queue entries). Note: the Service dropdown is a native select; needed keyboard Escape to close in automation | 07, 08 |
| C6 | clerk | Book an appointment | PASS with remarks | Appointments → Create new appointment → search patient → Location, Service (General Medicine / Outpatient Department / Rehabilitation), Type (Scheduled), **Recurring appointment toggle**, Date, Time + AM/PM, Duration, mini-calendar with bookings per day, Provider (6 providers), Date issued, Note. Saved #180: 08/10/2026 10:00–10:30 (DB 09:00 UTC; server UTC vs browser UTC+1). **Remark: date-picker header shows "Oct, 12:00 AM 2026" (cosmetic bug)**. Panel banner also shows queue status (Outpatient Triage, Urgent, "Move") | 09, 10 |
| C7 | clerk | Check in today's appointment | PASS | Appointments → "Check In" → opens Start a visit with "Upcoming appointments – select appointment to fulfill" + "Last visit information" notice → Facility Visit, Non paying → Start visit. Toasts "Visit started", "Appointment Checked In". Row → Checked in, visit start 12:21, button "Check out"; counters Checked in 1 / Not arrived 0 | 11, 12 |
| C8 | clerk | Search patient by name (top bar) | PASS | Live results while typing, case-insensitive, shows Active Visit tag | 13 |
| C9 | clerk | Create patient list + add patient | PASS | Patient lists → New list (name, cohort type System List/My List, description) → toast "Created". Patient chart → Actions → Add to list → tick list → Save. "My lists" shows 1 patient. Tabs: Starred / System / My / All lists, filter by location | 14 |
| G1 | any | User menu + switch language to French | PASS with remarks | User menu: name, Language "Change", Password "Change", Logout. Languages offered: English, British English, Español, Français, עברית, Khmer, العربية… Option "Update your default locale" (untick = session only). French chart: mostly translated. **Untranslated UI strings: "Actions", "Sticky note", "Procedures"(→Procédures), "OpenMRS ID"; awkward "Aucun(e) constantes". Metadata names stay English (queue "Outpatient Triage", location "Outpatient Clinic") → must be translated in our configuration** | 15, 16 |
| G2 | any | Browser console during clerk session | PASS (1 harmless) | Only error: "Unknown config key '@openmrs/esm-laboratory-app.labTableColumns' … Ignoring." (demo config vs app version mismatch) | – |
| N0 | nurse | Login | PASS | Nurse home = Service queues (clerk home = Appointments). Same left menu | 17 |
| N1 | nurse | Call patient from queue → Serve | PASS | "Call" → dialog "Serve patient" (name, gender, age, ID) with Requeue / Serve → Serve opens the patient chart | 18 |
| N2 | nurse | Record vitals & biometrics | PASS | Fields: Temp, BP sys/dia, HR, RR, SpO2, Notes, Weight, Height, BMI (auto: 68 kg/165 cm → 25), MUAC. **Abnormal values flagged live** (BP 150/95 red + ↑). Saved 9 obs; FHIR interpretation H for BP sys/dia and BMI, N for others. Chart: header strip + Vitals/Biometrics tables (table/graph toggle, "Vitals history") | 19, 20, 21, 23 |
| N2b | nurse | **Session timeout while a form is open** | **ISSUE (important)** | Form left open > 30 min → Save → `POST /encounter` **401**, app jumps to /login with dialog "Close workspace(s)… unsaved changes" (Cancel / Discard changes). **Nothing saved.** Recovery that works: Cancel → log in again (session renewed) → Save → saved, then location picker re-appears. **Users must be taught this; consider a longer session timeout** (Tomcat session-timeout=30) | 22 |
| T1 | (tester) | Automation note | INFO | Chrome must stay visible & be the active tab; hidden/background tabs ignore input and screenshots time out. A fresh tab fixed one stuck-input episode |  |
| N3 | nurse | Move patient to another queue | PASS | Banner "Move" → dialog: Service location (Outpatient Consultation / Outpatient Triage (Current)), Priority, Comment, Time of transition "Now" → Move. Toast "Queue entry transitioned"; banner → Outpatient Consultation | 24 |
| N4a | nurse | Wards app at Outpatient Clinic | INFO | Ward view uses the LOGIN location; Outpatient Clinic: "No beds configured for this location", 0 admission requests. **Demo data has 0 beds in all 4 wards (Inpatient Ward, Ward 1–3)** → beds must be created (Bed management, admin) before bed assignment can be tested | 25 |
| D0 | doctor | Login; queue shows patient "coming from Outpatient Triage" in Outpatient Consultation | PASS | Doctor home = Service queues. (Automation: location picker needed scripted label click; new tab needed after login switch) | – |
| D1 | doctor | Call → Serve → chart | PASS | Toast "Patient attending service"; doctor sees nurse's vitals with BP flagged | 26 |
| D2 | doctor | Record allergy | PASS | Allergies → Record allergy intolerances → Allergen (searchable list, e.g. Penicillins), Reactions (checkbox list: Anaemia…Unknown), Severity (Mild/Moderate/Severe), Comments → Save. Table: Penicillins / Moderate / Hives / comment. (Tester error: one scripted click ticked the wrong reaction, corrected before save) | 27, 28 |
| D3 | doctor | Visit note with diagnosis | PASS with remark | Right toolbar pen icon → Visit Note: Primary diagnosis (coded search, e.g. Hypertension / Hypertensive disorder / …), Secondary diagnosis, Note, Image. Saved encounter "Visit Note" @ Outpatient Clinic by Jake Doctor; diagnosis rank 1, **certainty PROVISIONAL (no way seen to mark it confirmed)**; note stored as obs. **No disposition (admit/discharge) in this note** | 29, 30 |
| D3b | doctor | Encounter provider recorded? | ISSUE (data quality, to confirm) | Visit timeline shows "Vitals – No provider" AND "Order – No provider" (order basket signed by doctor in a normal session); Visit Note / Immunizations / Transfer Request show "Jake Doctor". Creator is always stored; orders carry the orderer. So vitals & order encounters created from the O3 UI lack an encounter provider — likely app behaviour, not the tester session renewal. Re-check with a fresh nurse login | 42 |
| D4 | doctor | Record condition | PASS | Conditions → Record conditions → search (Hypertension), Onset date, Clinical status Active/Inactive → "Condition saved". Note: visit-note diagnosis ≠ condition (separate records, by design) | 31 |
| D5a | doctor | **Drug–allergy check** (penicillin allergy, order amoxicillin) | **ISSUE (patient safety)** | Drug search & order form only show a passive tag "Allergies: Penicillins"; **no warning/block when opening an amoxicillin order**. Order discarded (not signed) | 32, 33 |
| D5 | doctor | Order basket: drug + lab, sign | PASS | Drug search → Order form: dose, dose unit, route, frequency, patient instructions, PRN, start date, duration+unit, **quantity auto-calculated**, refills (**required, validated**), indication, "Add to my pinned orders". Lab: search test → Order form: reference number, priority (Routine…), instructions. Basket shows both → "Sign and close" → "Orders placed". ORD-324 Amlodipine 5mg 1 tab oral once daily 30 days; ORD-323 Serum creatinine | 34, 35, 36 |
| D5b | doctor | Auto-billing of orders | NOT CONFIGURED | 0 bills after signing. Source (billing module OrderBillingStrategy): **test order → bill only if a Billable Service is linked to the test concept (+price); drug order → only if the drug has a Stock Item (+price); a cash point must exist**. Demo data lacks these → silently skipped. To set up in billing test | – |
| D6 | doctor | Clinical forms list + Ward Admission form (= admission request) | PASS | Forms panel (doc icon): Covid 19, Laboratory Test Results, Mental Health Assessment, SOAP Note Template, Structured SOAP note, **Surgical Operation**, Test Form 1, **Ward Admission**; "Last completed" column. Ward Admission: disposition "Admit to hospital" + location (Inpatient Ward, Ward 1–3) → "Form submitted". EMR API confirms admission request: 10001PE, ADMIT, Ward 1 | 37, 38 |
| D7 | doctor | Record immunization | PASS with remark | Immunizations → Record: date, vaccine (BCG, Polio oral, DTP, Hep B, Hib…; **odd entry "None" in list – demo config**), dose number (appears after vaccine chosen), manufacturer, lot, expiry, note, next dose date. Validation "Vaccine is required". Saved → history "Hepatitis B, Dose 1, 01-Oct-2026" | 39, 40 |
| D8 | doctor | Enroll in a program | PASS with remark | Programs → Record program enrollments → program, date enrolled, date completed, enrollment location → "Program enrollment saved". **Demo programs: HIV Care, PMTCT, HIV PEP/PrEP, Outpatient Diabetes Education – none relevant; must configure our own** | 41 |
| D9 | doctor | Visits view / timeline | PASS with remark | Visits tab: visit row (OPD Visit, diagnoses Hypertension); expand → Timeline (Immunizations, Transfer Request, Order, Visit Note, Vitals with provider & time), Notes, Tests, Medications, Completed forms, Encounters, Bills. Tabs: Visits / All encounters / Completed forms. **Ward Admission form is stored as encounter type "Transfer Request" (confusing name)** | 42 |
| L0 | technician | Login (role check) | INFO | Demo "technician" has only role **Organizational: Nurse** — no laboratory-specific role exists in demo data. (Switched user via session API + reload to avoid the post-logout input freeze; location picker used normally) | – |
| L1 | technician | Laboratory app: see & pick the doctor's order | PASS | Laboratory: counters Tests ordered / Worklist in progress / Results completed; tabs Tests ordered, In progress, Completed, Declined; date range; "Add test order". Row Amina, 1 Routine → details (test, status "Order not picked", ORD-323, ordered by Jake Doctor, instructions) → "Pick lab request" → confirm dialog → "Picked an order"; moves to In progress | 43, 44, 45 |
| L2 | technician | Enter result | PASS | In progress → "Add lab results" → panel "Enter test results" (Serum creatinine umol/L, ≥0) → 135 → Save → "Lab results for ORD-323 have been successfully updated"; Completed = 1 | 46, 47 |
| L3 | doctor/any | Result visible in chart | PASS with remarks | Chart → Results: 135.0 umol/L. **No reference range ("-- umol/L") → no abnormal flag (concept ranges not configured). Same result shown 3× (Basic metabolic, Serum chemistry, Renal function panels) – "Results (3)". Result date shows order time (01:16 PM), not result entry time.** Views: Individual tests / Over time; test tree (Hematology, Bloodwork, HIV viral load) | 48 |
| P0 | admin (as pharmacist) | Pharmacy app access | INFO | No demo pharmacist account; tested as admin, whose default language is French (set during the user's own test) → pharmacy/billing/stock tested in French. Pharmacy app is reached from the app switcher / URL /openmrs/spa/dispensing, not from the clinic left menu | 49 |
| P1 | pharmacist | Find prescription | PASS | Pharmacie: tabs Rechercher / Ordonnances actives / Toutes les ordonnances; search by ID → row (date, patient, prescriber Jake Doctor, Amlodipine 5mg, Actif). Expand: **prominent yellow allergy banner "1 allergie Pénicillines"**; sections Prescription details / Conditions & diagnoses / History & comments; actions Terminer / Interruption / Délivrer; "Imprimer les ordonnances" | 50 |
| P2 | pharmacist | Dispense | PASS with remarks | Délivrer → panel prefilled from prescription (quantity 30, unit, dose, route; formulation editable) → "Délivrer une prescription" → tag "Délivré", "Dernière distribution: Super User". FHIR MedicationDispense completed, qty 30. **Mixed language: toast "Medication successfully dispensed." and "for 30 d" untranslated. Dispensing does not create a bill or touch stock (amlodipine has no stock item)** | 51, 52 |
| B0 | cashier (admin) | Billing app home | PASS with remarks | "En cours de facturation" (odd FR label for Billing) → bill list, sort "Pending confirmation", filter. **Untranslated: "Pending confirmation", "Bill date", "Invoice number", "Filter bills by…", "There are no bills to display", "Create bill"**. No create button on billing home; bills are created from patient chart → Billing history → "Create bill". Demo billing setup: 3 cash points (OPD, IPD, Community Outreach), 4 billable services (Antenatal care, Orthopedic Service, Nutrition counseling, OPD consultation), payment modes Cash/Bank transfer/Paypal | 53, 54 |
| B1 | cashier | Create bill manually | PASS with remarks | Chart → Billing history → Create bill → "Add bill items" (search: Antenatal care / Orthopedic / Nutrition / OPD consultation) → qty → save → invoice 0001-8, banner tag "UNPAID". **Currency KES (Kenya) and all demo prices 0.00 → must configure DZD + prices. FR label "Chercher des tables et des services" is a mistranslation** | 55, 56, 57 |
| B2 | cashier | Finalize → pay a 0-price bill | BLOCKED by config | Bill page: Request discount, Add items, Delete bill, Finalize bill, Print invoice (print not clicked: opens browser dialog). Payment allowed only after "Finalize" (confirm dialog; then no more edits) → status POSTED; payment button disabled because amount due = 0 | 57 |
| B3 | billing admin | Create a billable service with price | PASS | /openmrs/spa/billable-services: Services list (prices "--"), Billing settings (cash points, payment modes), Discount requests, Refund requests. "Ajouter un nouveau service": name, short name, linked concept (Créatinine), service type (Laboratory orders…), payment mode + price (Cash 800) → "Service facturable créé" | 58, 59, 60 |
| B4 | doctor/admin → billing | **Auto-bill from order** (after B3) | PASS | New creatinine order signed → bill 0002-6 created automatically (PENDING, OPD Cash Point, "Serum creatinine test" 800). Confirms source analysis: auto-billing needs a billable service linked to the test concept. (Remark: quick "Add to basket" leaves the lab order "Incomplet" until opened & saved; panel title "test order" and "Ajouter à l'ordonnance" untranslated/mis-worded) | – |
| B5 | cashier | Finalize + pay (Cash) | PASS | Finalize → payment form (method Cash/Bank transfer/Paypal, amount, reference) → "Traitement du paiement" → status PAID, line status PAID, payments table (date, amount, method), amount due 0; then "Request refund", "Print receipt" available | 61, 62 |
| S1 | stock admin | Stock dashboard | PASS (empty) | /stock-management: expiring stock, out of stock, expired/damaged, inventory alerts, receipts, issues – all 0. **Left menu untranslated (Overview, Items, Operations, Sources, User role scopes, Reports, Settings)** | 63 |
| S2 | stock admin | Create stock item linked to a drug | PASS with remarks | Items (demo: **0 items**) → "Ajouter Article de Stock": type Pharmaceuticals → drug (Amlodipine 5mg), common name, abbreviation, expires? (+ expiry notice days, required, msg "Expiry notice required" untranslated), supplier, category, dispensing unit (**unit list does not filter while typing**) → saved; tabs Packaging units (Box of 30 saved), Transactions, Batch info, Quantities, Rules, References. List needed a reload to show the new item | 64 |
| S3 | stock admin | Stock operations (receipt) | BLOCKED by setup | Operations page has **no "new operation" button** until the user has a **user role scope**; empty-state text wrongly says "No user role scope to display". Operation types: Adjustment, Disposal, Opening Stock, Receipt, Requisition, Return, Stock Issue, Stock Take, Transfer Out | 65 |
| S4 | stock admin | Create user role scope | ISSUE (UX) + rule | Form: user, role (only the user's **stock-relevant roles** are offered), enabled, permanent, dates, operations, locations (Main Pharmacy, Main Store). **Admin → scope for itself → HTTP 500, raw error toast**; log: `stockmanagement.userrolescopes.userUuid.selfupdate` = users cannot grant themselves a scope (sound rule, bad error message). Jane Nurse → role list empty (no inventory role). **Chain needed: user with Inventory role → scope created by another admin → items → operations. Demo data sets none of this up** | 66, 67 |
| A0 | admin | O3 System Administration page | PASS with remark | Tiles: Legacy admin, Open Concept Lab, Bed management, Reports, Cohort Builder, Service queue management, Stock, Billable services, Form builder. **No O3 user/role management – users are managed in the legacy admin UI** (old look, mostly English even with French selected) | 68, 69 |
| A1 | admin + user | Create user (legacy Add User → Create a new person) | PASS | Form: given/middle/family name, gender, "Create a Provider account", username, password + confirm (policy: ≥8 chars, upper+lower, digit, non-digit), force password change, roles checklist (Application:*, Inventory *, Organizational:*, Privilege Level, Provider, System Developer…). Filled: Sami Storekeeper, M, provider account, username storekeeper, roles Inventory Manager + Provider. **Password left for the user to type** (tester not permitted to handle the generated password) | 70 |
| A1b | admin | Verify new user | PASS | User "storekeeper" (system ID 7-5, Sami Storekeeper) with roles Inventory Manager + Provider, provider account 7-5 created; password typed by the user | – |
| S5 | admin | Stock scope for another user | PASS with remarks | Scope for Sami Storekeeper: role Inventory Manager (now offered), enabled, permanent, Receipt + Stock Issue, Main Pharmacy + Main Store → "Vous avez enregistré avec succès la portée du rôle". Remarks: ticking "Permanent" hides the date fields and shifts the layout (tester mis-clicked once, corrected); list does not refresh after save | 71 |
| A2 | admin | Bed management: bed type + bed | PASS with remarks | Bed management (Summary / Bed allocation / Bed types / Bed tags): 4 wards, 0 beds. Add bed requires a **bed type, none exist** (field greyed, "Veuillez sélectionner un type de lit valide"). Bed type creation: **display name max 10 chars; UI only says "Invalid Submission"** (API: error.exceededMaxLengthOfField) → "Standard" OK. Bed W1-01 in Ward 1 created. Bed-type dropdown: selection by click unreliable, keyboard works | 72, 73, 74 |
| N4 | admin (as ward nurse) | Admit patient from admission request | PASS with remark | Change location (top bar) → Ward 1 → ward view: bed W1-01 empty, "1 demande d'admission" → Gérer → request (Amina, 13:18, Jake Doctor, Outpatient Clinic) with Admit elsewhere / Cancel / Admit → choose "Sans lit" or "W1-01 · Vide" → Admettre → "Patient admis … lit W1-01"; card shows "1 Labs" pending; counters Patients 1, free beds 0. Untranslated "a few seconds ago" | 75, 76, 77 |
| A3 | admin | Form builder | PASS with remark | 10 forms (Covid 19, 2 unpublished "Form Engine Cookbook", Laboratory Test Results v3, Mental Health, SOAP Note Template, Structured SOAP 1.1, Surgical Operation, Test Form 1, Ward Admission 1.0.0); actions edit / download / delete; "Créer un nouveau formulaire". Editor: JSON schema + live preview, tabs Preview / Interactive editor / Translation editor / Audit, Save, Unpublish. **Banner "This is a demo server and can't be relied upon to save your schemas…" comes from demo config – remove for production.** Surgical Operation form is minimal (free text pre-/post-op diagnosis, procedure) | 78, 79 |
| A4 | admin | Open Concept Lab page | PASS with ⚠ | /openmrs/spa/ocl (my first guess /openconceptlab was a blank page): Subscription / Import / Previous imports. **⚠ Chrome's password manager autofilled the just-saved storekeeper login into "Subscription URL" and "Token"** — not saved (server shows empty url/token). Advice: do not let browsers save passwords on hospital PCs | – |
| A5 | admin | Reports | PASS with remark | Run / schedule / web preview. **Only 2 reports: "Patient Identifier Sticker", "Generic Encounter PDF Report"** — no statistics/activity reports out of the box | 80 |
| A6 | admin | Cohort builder | PASS (UI only) | Criteria: Concepts, Demographics, Person attributes, Encounters, Location, Enrollments, Drug order, Composition, Saved cohorts/queries. **Untranslated (English)** | 81 |
| X1 | (all roles) | **Permissions / role separation** | **ISSUE (security, critical for go-live)** | DB check: Organizational Clerk, Nurse and Doctor each resolve to the **same 301 privileges incl. Add Orders, Edit Users, Manage Concepts**. Cause: every "Application: *" role inherits **"Privilege Level: High"** (301 privileges). Differences between roles are only in which apps/menus are shown, not in what the API allows (e.g. clerk sees Laboratory & Billing too). Inventory Manager: 15 privileges. Demo "technician" has only the Nurse role. **→ Hospital roles & privileges must be redesigned before real use** | – |
| S6 | storekeeper | Log in as stock-only user and receive stock | **FAIL (blocked)** | Login succeeds server-side (session = storekeeper, Outpatient Clinic, 15 privileges) but the UI lands on the clinic home → `GET /queue-entry` **403** → raw error toast "Error loading queue entries … 403" → user is sent back to the login page; opening /stock-management directly also returns to login. Provider lookup also 403. Stock "App:" view privileges live in a separate role "Stock Management Base Role" — added via API (roles now Inventory Manager + Stock Management Base Role + Provider); fresh login by the user **still fails**. Not investigated further (time-box). **A stock-only user cannot use the O3 UI out of the box; stock roles are meant to be combined with a clinical role, which (X1) currently grants almost everything → role design needed.** Stock receipt therefore not tested | 82 |
