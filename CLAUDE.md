# CLAUDE.md — OpenMrs-EMR

A from-scratch, production-grade deployment of the **OpenMRS O3 Reference Application** (community distribution 3.7.1) with integrated **Orthanc PACS** and **OHIF Viewer v3**, built for the **Neurosurgery Department, CHU Frantz Fanon, Blida**.

## Scope & Status

The project architecture comprises two servers:
- **Server 1 (In the hospital, 8 GB RAM)**: Core EMR + Orthanc PACS + OHIF Viewer v3 + Neurosurgery Clinical Content. **COMPLETED & PRODUCTION-READY (Phases 1–4 Verified).** Ready for hospital deployment independently of Server 2.
- **Server 2 (GPU Server)**: AI imaging tools (OHIF-AI / segmentation), medical dictation, and clinical assistant using local LLMs. **NEXT PHASE (To be added later).**

### Completed Phases on Server 1:
- **Phase 1 (done 2026-09-26):** Stock O3 3.7.1 in Docker, images pinned by multi-arch digest.
- **Phase 2 (done 2026-10-10):** Clean configuration replacing demo data (`config/`): French default, CHU locations, 69-wilaya Algerian address hierarchy, NIN identifier, custom non-inherited roles.
- **Phase 3 (done 2026-10-16):** Neurosurgery content: 8 clinical forms, 34 CIEL diagnoses with ICD-10, CHU letterhead PDF encounter printing, Glasgow/Karnofsky trend widgets, consultation queue, and 42 inpatient beds.
- **Phase 4 (done 2026-10-21):** Imaging: Orthanc 26.9.1 PACS (PostgreSQL 16 index) + OHIF Viewer 3.13.12, Nginx gateway access control (`auth_request`), single-spa micro-frontend `esm-neuro-imaging-app` (patient chart tab, series inspection, CD/USB import), 6,665 clinical DICOM slices ingested, and radiology reports integrated.
- **Production Readiness & Sign-off (Current):** Automated 4-volume disaster recovery backup & restore verified, production deployment guide authored, test suites passing (12/12 smoke, 10/10 imaging, 10/10 clinical dataset, 18/18 roles).

### Working Branch Rule:
- **Work exclusively on `develop`.** Do not merge to `main` until the maintainer explicitly requests the final production release.
- **Private Documentation Rule:** Any plan for a phase or subtask must live in `docs/` and be named `PLAN-*.md` (strictly git-ignored as private documentation).

Build principles: stock O3 first, then configuration, then new modules written from scratch in this repository. Nothing is imported or copied from the legacy O2 system (`../openmrs-orthanc-integration/`), which remains read-only inspiration.

## Working Protocol

- **Plan first, wait for approval, then act.** One change at a time; verify each one.
- **Read-only investigation before any write.**
- **Never claim something works without demonstrating it** (command + actual output).
- Say **where** a command runs: host, or which container (`docker compose exec <service>`).
- Classify commands that change state: FILE CHANGE / DESTRUCTIVE / DATA-IMPACTING.
- No git writes (`commit`, `push`, `reset`, `checkout`, ...) without explicit approval.

## Rules

| Rule | Why |
| --- | --- |
| Pin every image by digest in `docker-compose.yml` (`tag@sha256:…`). When upgrading, change tag **and** digest. Never `latest`/`qa`/`nightly`. | Tags are mutable and change silently on `docker compose pull`; a digest cannot. |
| Secrets live only in `.env` (git-ignored). No fallback passwords in `docker-compose.yml`. | The old project leaked working credentials through a public repo. |
| Stay close to upstream `docker-compose.yml` (openmrs/openmrs-distro-referenceapplication). | Keeps upgrades a diff against upstream instead of an investigation. |
| `docker compose down -v` **deletes all databases and raw imaging**. Never run it without explicit approval and a fresh backup. | Named volumes hold all clinical and imaging data. |
| Back up before any change that touches data: use `scripts/backup-all.sh` to archive all 4 volumes into `backups/` (git-ignored). | `backups/` contains patient data — it must never be committed. |
| Change the system through files in `config/` (Initializer, frontend config, PACS, OHIF), never by manual SQL or clicking in the admin UI. | The configuration is reviewed, versioned, and reproducible on the hospital server. |
| Mount directories, never single files. | A single-file bind mount keeps serving the old content after an editor replaces the file (inode trap). |
| Record every action in `WORK-LOG.md` (private, git-ignored): commands, file changes, results, tests. Keep shared docs in `docs/` organized and current. | Complete private audit trail; shared docs are read by others. |
