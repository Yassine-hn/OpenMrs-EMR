# CLAUDE.md — OpenMrs-EMR

A from-scratch deployment of the **OpenMRS O3 Reference Application** (community
distribution), intended as the base for a new hospital system. See `README.md` for how it
runs.

## Scope (phase 1)

Stock community distribution only, running in Docker. **No custom modules, no Orthanc/OHIF,
no extra services** until the maintainer decides the next step. Each addition later is its
own, separately approved change.

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
| Pin image versions (`OPENMRS_TAG`, MariaDB tag). Never `latest`/`qa`/`nightly`. | Mutable tags change silently on `docker compose pull`. |
| Secrets live only in `.env` (git-ignored). No fallback passwords in `docker-compose.yml`. | The old project leaked working credentials through a public repo. |
| Stay close to upstream `docker-compose.yml` (openmrs/openmrs-distro-referenceapplication). | Keeps upgrades a diff against upstream instead of an investigation. |
| `docker compose down -v` **deletes the database**. Never run it without explicit approval and a fresh backup. | Named volumes hold all data. |
| Back up before any change that touches data: `mariadb-dump` to `backups/` (git-ignored). | `backups/` may contain patient data — it must never be committed. |
