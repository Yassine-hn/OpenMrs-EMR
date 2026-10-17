# CLAUDE.md — OpenMrs-EMR

A from-scratch deployment of the **OpenMRS O3 Reference Application** (community
distribution), intended as the base for a new hospital system. See `README.md` for how it
runs.

## Scope

Target: the **Neurosurgery department, CHU Frantz Fanon, Blida**. Fresh deployment, no
data migration. The plan is `docs/neurosurgery-o3-plan.md`.

- **Phase 1 (done):** stock O3 3.7.1 in Docker, images pinned by digest.
- **Phase 2 (done 2026-10-10):** our own configuration replaces the demo configuration
  (`config/`, see `docs/configuration.md`). Same 3.7.1 images. No custom code.
- **Phase 3 (done 2026-10-16):** neurosurgery content by configuration: 8 forms + CHU print layout,
  concepts (CIEL where it has them, otherwise the local `CHU-Blida` source), clinic services and queue, beds,
  real browser UI verification and test suite (see `docs/neurosurgery-forms.md`, `docs/test-report-phase3.md`).
- **Phase 4 (current):** Imaging: Orthanc 26.9.1 (PostgreSQL index, DICOM storage) + OHIF 3.13.12,
  gateway access control (OpenMRS session check via `auth_request`), and frontend module
  `esm-neuro-imaging-app` (imaging tab in patient chart, CD/USB import with identity rewrite).
- **Later phases:** Hospital pilot, surgical pathway, statistics, and AI on Server 2.

Build principles: stock O3 first, then configuration, then a **new** module only when
needed. Nothing is copied from the old system.

The older system in `../openmrs-orthanc-integration/` (O2, core 2.4.3) is **read-only
inspiration**. Never modify it, never copy its containers, volumes or ports into this
project, and never "upgrade" it.

## Working protocol

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
| `docker compose down -v` **deletes the database**. Never run it without explicit approval and a fresh backup. | Named volumes hold all data. |
| Back up before any change that touches data: `mariadb-dump` to `backups/` (git-ignored). **Waived for this development machine** (maintainer, 2026-10-10: test data only). Mandatory again on the hospital server. | `backups/` may contain patient data — it must never be committed. |
| Change the system through files in `config/` (Initializer, frontend config), never by SQL or by clicking in the admin UI. | The configuration is reviewed, versioned and reproducible on the hospital server. |
| Mount directories, never single files. | A single-file bind mount keeps serving the old content after an editor replaces the file (inode trap). |
| Record every action in `WORK-LOG.md` (private, git-ignored): commands, file changes, results, tests. Keep shared docs in `docs/` organized and current. | The maintainer wants a complete personal record; shared docs are read by others. |
