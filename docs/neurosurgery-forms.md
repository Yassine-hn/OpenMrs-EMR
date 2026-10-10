# Neurosurgery forms and documents

Clinical content of the system: the forms used by the department and the documents they print.
**Every form here is a first version written from standard neurosurgical practice. It must be
reviewed by a neurosurgeon of the department before real use.** Comments and corrections can
be made directly in this document.

How it is built (concepts, files, print layout): see [`configuration.md`](configuration.md).

| Form | Status | Prints as |
| --- | --- | --- |
| [Compte rendu opératoire](#compte-rendu-opératoire) | v1, to be validated | operative report (PDF, CHU letterhead) |
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

## Compte rendu opératoire

Encounter type *Compte rendu opératoire*. One per operation. Filled by the surgeon, usually at
the *Bloc opératoire* location.

| Section | Field | Type | Choices |
| --- | --- | --- | --- |
| **Intervention** | Intervention réalisée | text | |
| | Caractère de l'intervention | choice | Programmée, Urgente |
| | Côté | choice | Droit, Gauche, Bilatéral, Médian, Non applicable |
| | Indication opératoire | text | |
| | Diagnostic pré-opératoire | text | |
| | Diagnostic post-opératoire | text | |
| **Équipe et anesthésie** | Opérateur(s) | text | |
| | Aide(s) opératoire(s) | text | |
| | Anesthésiste | text | |
| | Type d'anesthésie | choice | Anesthésie générale, locale, locorégionale, Sédation |
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
- Should the procedure and the diagnoses be **coded** (list of neurosurgical procedures,
  ICD-10 diagnoses) instead of free text? Coding makes statistics possible (operations by type),
  but needs an agreed list.
- Should the team be selected from the list of staff instead of typed?
- Missing fields: duration of the operation, ASA score, antibiotic prophylaxis, blood loss
  categories, specific implants (shunt valve type and setting, spinal hardware)?

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
