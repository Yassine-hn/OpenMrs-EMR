# Neurosurgery forms and documents

Clinical content of the system: the forms used by the department and the documents they print.
**Every form here is a first version written from standard neurosurgical practice. It must be
reviewed by a neurosurgeon of the department before real use.** Comments and corrections can
be made directly in this document.

How it is built (concepts, files, print layout): see [`configuration.md`](configuration.md).
Where an international code exists (CIEL), the field uses it: Glasgow total, procedure
performed, side, type of anaesthesia, diagnoses. The other fields use local codes of the CHU.

| Form | Status | Prints as |
| --- | --- | --- |
| [Consultation de neurochirurgie](#consultation-de-neurochirurgie) | v1, to be validated | consultation report (PDF, CHU letterhead) |
| [Observation d'entrée](#observation-dentrée) | v1, to be validated | admission note (PDF, CHU letterhead) |
| [Compte rendu opératoire](#compte-rendu-opératoire) | v1, to be validated | operative report (PDF, CHU letterhead) |
| [Résultat anatomopathologique](#résultat-anatomopathologique) | v1, to be validated | pathology result (PDF, CHU letterhead) |
| [Évaluation neurologique](#évaluation-neurologique) | v1, to be validated | neurological examination (PDF); trends on the patient summary |
| [Demande d'admission](#demande-dadmission) | v1 | starts an admission, handled by the nurses in *Admissions* |

## How a document is printed

1. Fill the form in the patient's chart (*Formulaires cliniques* panel).
2. *Visites* → *Toutes les consultations* → the row's menu → **Imprimer cette consultation**.
3. A PDF opens: CHU letterhead with the patient's name, N° de dossier and NIN on every page, the
   form's title, only the fields that were filled, a signature box, and "Page X / Y".

Example: [page 1](images/phase3/compte-rendu-operatoire-exemple-1.png),
[page 2](images/phase3/compte-rendu-operatoire-exemple-2.png) (test patient).

Requires the privilege *App: Print encounter forms*, which all CHU roles have.

## Consultation de neurochirurgie

Encounter type *Consultation de neurochirurgie*. Filled by the neurosurgeon at the outpatient
consultation (location *Consultations de neurochirurgie*). The printed report is the letter
for the referring doctor and the patient's file:
[example](images/phase3/consultation-neurochirurgie-exemple.png) (test patient).

| Section | Field | Type | Choices |
| --- | --- | --- | --- |
| **Motif et histoire** | Adressé par | text | |
| | Motif de consultation | text | |
| | Histoire de la maladie | long text | |
| | Antécédents médicaux et chirurgicaux | long text | |
| | Traitement en cours | text | |
| **Examen clinique** | Examen clinique et neurologique | long text | |
| **Imagerie et examens** | Résultats d'imagerie (scanner, IRM…) | long text | |
| **Diagnostic** | Diagnostic principal | **search in the diagnosis list** | see [Diagnoses](#diagnoses) |
| | Certitude du diagnostic | choice | Confirmé, Présumé |
| | Autres diagnostics / précisions | text | level, side, size… |
| **Conduite à tenir** | Décision | several choices | Traitement médical, Indication opératoire posée, Surveillance clinique et radiologique, Examens complémentaires, Présentation en RCP, Hospitalisation, Orientation vers une autre spécialité |
| | Intervention proposée | text | |
| | Examens demandés | text | |
| | Traitement prescrit | text | |
| | Date du prochain rendez-vous | date | |
| | Commentaires | text | |

The structured neurological examination (Glasgow, pupils, strength) is not repeated here: it
is the *Évaluation neurologique* form, which feeds the trends on the patient summary.

Questions for the reviewer:
- Is the order of the sections the one used in the department's letters?
- Should the consultation also record a Glasgow score and a Karnofsky index directly?
- Is "Décision" complete (e.g. physiotherapy, infiltration, pain clinic)?
- The next appointment date is only written on the report; booking it is done in
  *Rendez-vous*. Is that acceptable?

## Observation d'entrée

Encounter type *Observation d'entrée*. The doctor's admission note, written when the patient
arrives in a ward (after the admission itself, which the nurse records in *Admissions*).
[Example](images/phase3/observation-entree-exemple.png) (test patient).

| Section | Field | Type | Choices |
| --- | --- | --- | --- |
| **Admission** | Mode d'admission | choice | Par les urgences, Admission programmée, Transfert d'un autre service, Transfert d'un autre établissement |
| | Établissement ou service d'origine | text | |
| | Motif d'hospitalisation | text | |
| **Histoire** | Histoire de la maladie | long text | |
| | Antécédents médicaux et chirurgicaux | long text | |
| | Traitement en cours | text | |
| **Examen à l'entrée** | Examen clinique et neurologique | long text | |
| **Imagerie et examens** | Résultats d'imagerie (scanner, IRM…) | long text | |
| **Diagnostic d'entrée** | Diagnostic principal | **search in the diagnosis list** | see [Diagnoses](#diagnoses) |
| | Certitude du diagnostic | choice | Confirmé, Présumé |
| | Autres diagnostics / précisions | text | |
| **Projet thérapeutique** | Projet thérapeutique | long text | |
| | Intervention prévue | text | |
| | Examens demandés | text | |
| | Consignes de surveillance et de soins | long text | for the nurses |

The Glasgow score, pupils and strength on arrival are recorded with *Évaluation neurologique*
(trends on the patient summary).

Questions for the reviewer:
- Is a separate admission note needed when the patient was seen in consultation just before
  (the history is then written twice)?
- Should the mode of admission include "Transfert depuis la réanimation"?
- Should the nursing instructions be a structured list (frequency of neurological checks,
  position, drains) rather than free text?

## Compte rendu opératoire

Encounter type *Compte rendu opératoire*. One per operation. Filled by the surgeon, usually at
the *Bloc opératoire* location.

| Section | Field | Type | Choices |
| --- | --- | --- | --- |
| **Intervention** | Intervention réalisée | text | |
| | Caractère de l'intervention | choice | Programmée, Urgente |
| | Côté | choice | Droit, Gauche, Bilatéral, Médian, Non applicable |
| | Indication opératoire | text | |
| | Diagnostic pré-opératoire | **search in the diagnosis list** | see [Diagnoses](#diagnoses) |
| | Diagnostic pré-opératoire - précisions | text | side, size, details |
| | Diagnostic post-opératoire | **search in the diagnosis list** | |
| | Diagnostic post-opératoire - précisions | text | |
| **Équipe et anesthésie** | Opérateur(s) | text | |
| | Aide(s) opératoire(s) | text | |
| | Anesthésiste | text | |
| | Type d'anesthésie | choice | Anesthésie générale, locale, locorégionale, Sédation intraveineuse |
| **Technique opératoire** | Installation du patient | choice | Décubitus dorsal, ventral, latéral, Position assise, Autre |
| | Voie d'abord | text | |
| | Neuronavigation | Oui / Non | |
| | Microscope opératoire | Oui / Non | |
| | Description de l'intervention | long text | |
| | Constatations per-opératoires | long text | |
| | Qualité de l'exérèse | choice | Exérèse complète, subtotale, partielle, Biopsie seule, Non applicable |
| | Prélèvement pour anatomopathologie | Oui / Non | |
| | Matériel implanté | text | |
| **Fin d'intervention** | Pertes sanguines estimées (mL) | number (0–10,000) | |
| | Transfusion | Oui / Non | |
| | Incidents et complications per-opératoires | long text | |
| | Drainage | text | |
| | Fermeture | text | |
| | Consignes post-opératoires | long text | |

Questions for the reviewer:
- The diagnoses are now coded (see [Diagnoses](#diagnoses)). Should the **procedure** be coded
  too (list of neurosurgical procedures)? It makes statistics by type of operation possible,
  but needs an agreed list.
- Should the team be selected from the list of staff instead of typed?
- Missing fields: duration of the operation, ASA score, antibiotic prophylaxis, blood loss
  categories, specific implants (shunt valve type and setting, spinal hardware)?

## Diagnoses

Diagnoses are searched by name, in French or English: type a few letters ("hémat",
"méningiome", "hernie discale") and choose. The list holds the general diagnoses of the CIEL
dictionary (about 2,200, including head injury, epidural and intracerebral haemorrhage,
subarachnoid haemorrhage, spinal fractures, cerebral abscess, epilepsy, spondylolisthesis) and
34 neurosurgical diagnoses added for the department. Each has an ICD-10 code. The same list is
used by the diagnosis search of the visit note.

| Group | Diagnoses added (French name; *search also by*) |
| --- | --- |
| Trauma and haematomas | Hématome sous-dural intracrânien chronique; Hématome sous-dural intracrânien traumatique; Fracture du crâne |
| Hydrocephalus and CSF | Hydrocéphalie; Hydrocéphalie obstructive; Dysfonctionnement d'une dérivation ventriculaire cérébrale (*valve*); Écoulement du liquide céphalorachidien (*fuite de liquide cérébrospinal*) |
| Tumours | Glioblastome multiforme cérébral; Gliome cérébral; Méningiome intracrânien; Méningiome spinal; Adénome hypophysaire; Neurinome acoustique (*schwannome vestibulaire*); Tumeur maligne secondaire de l'encéphale (*métastase cérébrale*); Médulloblastome; Craniopharyngiome; Néoplasme de la moelle épinière (*tumeur médullaire*) |
| Vascular | Anévrisme intracrânien (*anévrisme cérébral*); Anévrisme cérébral rompu; Malformation artérioveineuse des vaisseaux cérébraux |
| Spine | Prolapsus du disque intervertébral lombaire (*hernie discale lombaire*); Hernie discale cervicale; Sténose spinale de la région lombaire (*canal lombaire étroit*); Spondylose cervicale avec myélopathie (*myélopathie cervicarthrosique*); Compression médullaire; Syndrome de la queue de cheval |
| Malformations | Malformation d'Arnold-Chiari, type I; Spina bifida; Syringomyélie; Syndrome de craniosynostose (*craniosténose*) |
| Infections | Abcès intracrânien sous-dural (*empyème sous-dural*); Discite infectieuse (*spondylodiscite*); Tuberculose vertébrale (*mal de Pott*) |
| Other | Névralgie du trijumeau |

Questions for the reviewer:
- Which frequent diagnoses of the department are missing? (Cavernoma is not in the CIEL
  dictionary; it can be added as a local diagnosis.)
- Are the French names acceptable, or should more usual terms be added?

## Résultat anatomopathologique

Encounter type *Résultat anatomopathologique*. The neurosurgeon records the pathology result of
a tumour (written by the pathology laboratory) in the patient's file, in a structured way so
that tumour types, grades and markers can be counted later. Classification: **WHO 2021, 5th
edition (CNS5)**. [Example](images/phase3/resultat-anatomopathologique-exemple.png) (test patient).

| Section | Field | Type | Choices / range |
| --- | --- | --- | --- |
| **Prélèvement** | Date du prélèvement | date | |
| | Type de prélèvement | choice | Pièce d'exérèse chirurgicale, Biopsie stéréotaxique, Biopsie chirurgicale à ciel ouvert, Autre |
| | Laboratoire et n° d'examen | text | |
| | Date du compte rendu | date | |
| **Diagnostic** | Diagnostic intégré (OMS SNC5) | list | Glioblastome, IDH-sauvage; Astrocytome, IDH-muté; Oligodendrogliome, IDH-muté et 1p/19q-codélété; Gliome diffus de la ligne médiane, H3 K27-altéré; Astrocytome pilocytique; Épendymome; Schwannome; Médulloblastome; Méningiome intracrânien; Méningiome spinal; Adénome hypophysaire (PitNET); Craniopharyngiome; Lymphome primitif du SNC; Hémangioblastome; Métastase; Autre |
| | Grade OMS du SNC | choice | Grade 1, 2, 3, 4, Non applicable |
| | Compte rendu histologique | long text | the laboratory's text |
| **Biologie moléculaire et immunohistochimie** | IDH | choice | Muté, Non muté (type sauvage), Non réalisé |
| | Codélétion 1p/19q | choice | Codélétion présente, Absence de codélétion, Non réalisé |
| | Méthylation du promoteur MGMT | choice | Méthylé, Non méthylé, Non réalisé |
| | H3 K27M | choice | Muté, Non muté (type sauvage), Non réalisé |
| | ATRX | choice | Expression conservée, Perte d'expression, Non réalisé |
| | Index Ki-67 (%) | number (0–100) | |
| | Autres marqueurs | text | |
| **Conclusion** | Conclusion | long text | |

Questions for the reviewer (and the pathologists):
- Is the list of tumour types right for the department's activity? WHO CNS5 has many more
  (e.g. ependymoma subtypes by location and molecular group, meningioma subtypes); which
  should be separate choices?
- Should the result be entered by the pathology laboratory itself (needs an account and a role
  for them), or transcribed by the neurosurgeons as designed now?
- Other markers to structure (p53, EGFR, CDKN2A/B, BRAF, TERT)?

## Évaluation neurologique

Encounter type *Évaluation neurologique*. Used at the consultation, on admission, and for
post-operative neurological checks; doctors and nurses can fill it. Each evaluation adds a
point to the trends shown on the patient summary (see below).

| Section | Field | Type | Choices / range |
| --- | --- | --- | --- |
| **Score de Glasgow** | Ouverture des yeux (Y) | choice | 4 Spontanée, 3 À la demande verbale, 2 À la douleur, 1 Aucune |
| | Réponse verbale (V) | choice | 5 Orientée, 4 Confuse, 3 Mots inappropriés, 2 Sons incompréhensibles, 1 Aucune |
| | Réponse motrice (M) | choice | 6 Obéit aux ordres, 5 Localise la douleur, 4 Évitement, 3 Flexion anormale (décortication), 2 Extension (décérébration), 1 Aucune |
| | Score de Glasgow total | **calculated** (Y + V + M, 3–15) | filled in automatically once Y, V and M are chosen |
| **Pupilles** | Pupille droite / gauche - diamètre | number (1–9 mm) | |
| | Pupille droite / gauche - réactivité | choice | Réactive, Paresseuse, Aréactive |
| **Motricité (MRC 0 à 5)** | Membre supérieur droit / gauche, membre inférieur droit / gauche | number (0–5) | |
| **Autres éléments** | Déficit sensitif (préciser) | text | |
| | Atteinte des nerfs crâniens (préciser) | text | |
| | Langage | choice | Normal, Aphasie, Dysarthrie |
| | Signes neurologiques présents | several choices | Céphalées, Vomissements, Crises convulsives, Syndrome méningé, Syndrome cérébelleux, Syndrome pyramidal, Troubles visuels, Troubles sphinctériens |
| **Échelles fonctionnelles** | Indice de Karnofsky (KPS) | number (0–100 %) | |
| | Échelle de Rankin modifiée (mRS) | choice | 0 Aucun symptôme … 6 Décès |
| **Commentaires** | Examen neurologique - commentaires | long text | |

**On the patient summary** (*Résumé patient*), two widgets read these evaluations:
- *Glasgow et Karnofsky*: graph and table of the GCS total and the KPS over time;
- *Pupilles et motricité*: table (and graph) of pupil sizes and limb strength.

Questions for the reviewer:
- Is a GCS that is "not testable" needed (intubated or sedated patient: V = NT)?
- Should the motor score use the side/limb grid as is, or a single "best motor response"?
- Which subspecialty scales should be added (ASIA for spine; WFNS / Fisher for subarachnoid
  haemorrhage)?

## Demande d'admission

Encounter type *Demande de transfert*. The doctor fills it (in the patient's chart, *Formulaires
cliniques*) to ask for an admission:

| Field | Choices |
| --- | --- |
| Décision | Admission en hospitalisation |
| Unité d'admission | Neurochirurgie - Hommes, - Femmes, - Soins intensifs (wards tagged *Admission Location*) |

The request then appears in the ward's *Admissions* page ("1 demande d'admission" → *Gérer*),
where a nurse admits the patient and chooses the bed. The form uses the CIEL concepts the ward
app expects (inpatient disposition), so its structure must not be changed.
