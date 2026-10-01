# OpenMrs-EMR

A from-scratch deployment of the **OpenMRS O3 Reference Application** — the current
community distribution of OpenMRS — running in Docker. It is the base for a new hospital
system.

**Current phase: stock community system only.** No custom modules, no PACS/imaging, no
extra services. Those are added later, one decision at a time.

| | |
| --- | --- |
| Distribution | O3 Reference Application **3.7.1** (released 2026-07-13) |
| OpenMRS core | **2.8.8** (Java 21, Tomcat 9) |
| Database | MariaDB **10.11.7** |
| Modules | 30 bundled backend modules — see [Bundled modules](#bundled-modules) |
| Verified on | 2026-09-26, Linux, Docker 29.8 / Compose v5.5, 8 cores, 7.6 GB RAM |

## Table of contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Daily operations](#daily-operations)
- [Testing](#testing)
- [Backup and restore](#backup-and-restore)
- [Upgrading](#upgrading)
- [Known issues and log noise](#known-issues-and-log-noise)
- [Bundled modules](#bundled-modules)
- [Project layout](#project-layout)

## Architecture

Four containers on one Docker network. Only the gateway is published on the host.

```
browser ──► gateway (nginx, host port 80)
              ├── /openmrs/spa/*  ──► frontend  (nginx serving the O3 React app)
              └── /openmrs/*      ──► backend   (Tomcat: OpenMRS core + modules, port 8080)
                                          └──► db  (MariaDB, port 3306)
```

| Service | Image (pinned by digest) | Holds data? |
| --- | --- | --- |
| `gateway` | `openmrs/openmrs-reference-application-3-gateway:3.7.1@sha256:49070abb…` | no |
| `frontend` | `openmrs/openmrs-reference-application-3-frontend:3.7.1@sha256:f6b1f844…` | no |
| `backend` | `openmrs/openmrs-reference-application-3-backend:3.7.1@sha256:929cfe5d…` | **yes** — volume `openmrs-emr_openmrs-data` |
| `db` | `mariadb:10.11.7@sha256:27292753…` | **yes** — volume `openmrs-emr_db-data` |

**Images are pinned by digest**, and the full digests are in `docker-compose.yml`. A tag
such as `3.7.1` is a label the publisher can move to a different image. A digest
(`sha256:…`) is a fingerprint of the image content, so it always means the same bytes.
When both are given (`tag@sha256:…`), Docker uses only the digest; the tag is there for
people reading the file. Each digest is a multi-architecture index, so the same pin works
on amd64 and arm64 servers. They were checked against Docker Hub on 2026-09-27.

The frontend is the O3 **micro-frontend** app: a set of React modules loaded into one page.
The backend is classic OpenMRS (Java modules, REST and FHIR APIs). The old admin UI is still
available at `/openmrs` for system administration.

`docker-compose.yml` is upstream's file with a short, documented list of changes at its top
(images pinned by digest, secrets from `.env`, fixed project name). Keep it close to upstream so
upgrades stay a simple diff.

## Prerequisites

- Docker with the Compose plugin.
- **RAM:** the stack uses about 1.2 GB at idle; the backend alone uses about 1 GB. Allow
  4 GB free, more during the first start.
- **Disk:** about 3 GB for the images, plus about 0.8 GB of data after the first start with
  demo data.
- Port 80 free on the host, or set another `HTTP_PORT` in `.env`.
- Internet access for the first `docker compose pull`.

## Getting started

All commands run on the **host**, from the repository root.

```bash
# 1. Secrets. .env is git-ignored. Replace every CHANGE_ME with a strong password, e.g.:
cp .env.example .env
sed -i "s/OMRS_DB_PASSWORD=CHANGE_ME/OMRS_DB_PASSWORD=$(openssl rand -hex 16)/; \
        s/MYSQL_ROOT_PASSWORD=CHANGE_ME/MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)/" .env
chmod 600 .env

# 2. Images (about 3 GB)
docker compose pull

# 3. Start
docker compose up -d
```

### The first start takes about an hour — this is normal

On the very first start the backend builds the database and then the **Initializer** module
imports the reference configuration: roughly 4,100 concepts and 23,000 concept links from
the OCL/CIEL packages, then drugs, forms, and 50 demo patients. On the reference machine
this took **52 minutes**, mostly on one CPU core.

- **Do not trust "healthy" in `docker compose ps` during this time.** The backend's
  healthcheck only checks that Tomcat answers, so it reports `healthy` after about 30 seconds,
  long before OpenMRS is usable.
- **Ready means the REST API answers with JSON:**

  ```bash
  curl -s http://localhost/openmrs/ws/rest/v1/session
  # ready: {"authenticated":false,"locale":"en",...}
  ```

- To watch for problems: `docker compose logs -f backend | grep -E "ERROR|FATAL"`.
  See [Known issues](#known-issues-and-log-noise) for errors that are expected.
- **Do not restart or stop the stack during the first start.**

Later starts skip the import (the Initializer keeps checksums of what it loaded) and are
ready in about **1 minute**.

### Log in

| URL | What |
| --- | --- |
| http://localhost/openmrs/spa | O3 user interface (use this) |
| http://localhost/openmrs | legacy admin UI (modules, global properties, scheduler) |

Default account: **`admin` / `Admin123`**. This is public knowledge — **change it before
the system holds any real data**, and before exposing it beyond this machine. After changing
it, pass the new credentials to the smoke test (see [Testing](#testing)).

## Daily operations

| Task | Command (host, repository root) |
| --- | --- |
| Status | `docker compose ps` |
| Start | `docker compose up -d` |
| Stop, keep data | `docker compose stop` (or `docker compose down`) |
| Backend logs | `docker compose logs -f --tail 200 backend` |
| Shell in the backend | `docker compose exec backend bash` |
| SQL shell | `docker compose exec db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" openmrs'` |

> **`docker compose down -v` deletes the database and all OpenMRS data.** `down` without
> `-v` is safe: containers are recreated, volumes are kept. This was tested: after a full
> `down` / `up`, all patients and observations were still there.

## Testing

`scripts/smoke-test.sh` is **read-only** and takes a few seconds. Run it after every start
and every change:

```bash
./scripts/smoke-test.sh
# after changing the admin password:
OMRS_USER=admin OMRS_PASS='...' ./scripts/smoke-test.sh
```

It checks: all containers running and healthy, the O3 UI and legacy UI respond, REST login,
the core version, that every module started, the FHIR R4 endpoint, and the patient count.
Right after a start the containers check can fail for up to 30 seconds while Docker's
healthcheck catches up; run it again.

### What was verified on 2026-09-26

- Smoke test: all 8 checks pass, before and after a full `down` / `up`.
- Through the REST API: register a patient (ID generated by idgen), start a visit, record
  vitals (weight, height, temperature), book an appointment, find the patient by
  identifier, and read the patient and observations back through FHIR.
- Persistence: the test patient and its 3 observations were still there after recreating
  all containers.
- **Not yet verified:** clicking through the O3 user interface in a browser.

## Backup and restore

A complete backup needs **both** volumes:

- the **database** (`db-data`), which holds all clinical data, and
- the **OpenMRS data directory** (`openmrs-data`). It contains `openmrs-runtime.properties`
  with the **encryption key** for encrypted fields, **uploaded files** (patient photos and
  attachments, under `storage/complex_obs/`; core 2.8 no longer uses the top-level
  `complex_obs/`, which stays empty), and search indexes. **A database restored without its matching encryption key cannot decrypt
  those fields.**

`backups/` is git-ignored because dumps contain patient data. **Never commit it.**

```bash
mkdir -p backups
TS=$(date +%Y%m%d-%H%M%S)

# Database: consistent online dump
docker compose exec -T db sh -c 'mariadb-dump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines openmrs' \
  | gzip > "backups/openmrs-db-$TS.sql.gz"

# OpenMRS data directory. Uses the already-pinned MariaDB image only for its `tar` (the
# backend image has none). Skips .openmrs-lib-cache, which OpenMRS rebuilds on every start.
docker run --rm -v openmrs-emr_openmrs-data:/data:ro mariadb:10.11.7 \
  tar czf - -C /data --exclude=./.openmrs-lib-cache . > "backups/openmrs-data-$TS.tar.gz"
```

Tested on 2026-09-26 with demo data: the database dump was 3.7 MB (239 tables) and the data
archive 116 MB, including `openmrs-runtime.properties`. Copy backups **off this machine**.
A backup that exists only on the same disk is not a backup.

Restore into an empty stack: start `db` only, load the dump, restore the data directory
into the volume, then start everything. **The restore procedure has not been tested yet.**
Test it before relying on it.

## Upgrading

1. Read the release notes of the new O3 version.
2. Compare upstream's `docker-compose.yml` at the new tag with ours, and carry over any
   changes. The list of our intentional differences is at the top of our file.
3. Back up both volumes (see above).
4. Look up the new digests. Each image has to be looked up separately; replace `3.8.0` with
   the target release:

   ```bash
   for r in backend frontend gateway; do
     printf "%s: " $r
     curl -s "https://hub.docker.com/v2/repositories/openmrs/openmrs-reference-application-3-$r/tags/3.8.0" \
       | python3 -c 'import json,sys; print(json.load(sys.stdin)["digest"])'
   done
   # MariaDB, only if upstream changed its version:
   curl -s https://hub.docker.com/v2/repositories/library/mariadb/tags/<version> \
     | python3 -c 'import json,sys; print(json.load(sys.stdin)["digest"])'
   ```

5. In `docker-compose.yml`, replace **both** the tag and the digest of each image
   (`…:3.8.0@sha256:<new digest>`). If you change only the tag, the old digest still wins
   and nothing is upgraded.
6. `docker compose pull && docker compose up -d`, then check that what runs is what you pinned:
   `docker compose images` and
   `docker image inspect <image> -f '{{index .RepoDigests 0}}'`.
7. Wait for the REST API, not the healthcheck. Database migrations can make this start slow.
8. Run `./scripts/smoke-test.sh`, and update the version and image tables in this README.

Never use the moving tags (`latest`, `qa`, `nightly`, `3.7.x`): they change without notice.

## Known issues and log noise

Seen in the backend log on 3.7.1. None of these stop the system from working.

| Log message | Meaning | Action |
| --- | --- | --- |
| `Temporary Store limit is 51200 mb, whilst the temporary data directory ... only has N mb` | The event module's embedded ActiveMQ has a default temp-store limit larger than the free disk, so it limits itself to what is available. | None now. Keep enough free disk. |
| `Address hierarchy configuration file appears invalid, skipping ...` | The demo address configuration (Cambodia) is in a subfolder the loader does not read, so **no address hierarchy is loaded** (0 entries). | Later: provide our own Algerian hierarchy (wilaya / daïra / commune). |
| `Attribute "moduleId" must be declared for element type "allow"` / `"signatures"` | XML validation noise from the legacy UI module's DWR configuration. | None. |
| `Name 'PK_HL7_IN_ERROR' ignored for PRIMARY key` | MariaDB ignores custom primary-key names during schema creation. | None. |
| `Email notification for tele-consultation not configured` (WARN) | Printed for each demo appointment; email is not set up. | None. |

## Bundled modules

As reported by the running system (`/openmrs/ws/rest/v1/module`); all 30 started.

| Module id | Name | Version |
| --- | --- | --- |
| `addresshierarchy` | Address Hierarchy | 2.21.0 |
| `appointments` | Bahmni Appointment Scheduling | 2.1.0 |
| `attachments` | Attachments | 4.0.0 |
| `authentication` | Authentication | 2.3.0 |
| `bedmanagement` | Bed Management Module | 7.2.0 |
| `billing` | OpenMRS Billing Module | 2.3.0 |
| `calculation` | Calculation | 2.0.0 |
| `cohort` | Cohort Module | 3.7.3 |
| `emrapi` | EMR API Module | 3.4.0 |
| `event` | Event Module | 4.0.0 |
| `fhir2` | FHIR2 | 4.2.0 |
| `htmlwidgets` | HTML Widgets | 2.0.1 |
| `idgen` | ID Generation | 5.0.4 |
| `initializer` | Initializer | 2.12.0 |
| `legacyui` | Legacy UI Module | 2.1.0 |
| `metadatamapping` | Metadata Mapping | 2.0.0 |
| `o3forms` | O3 Forms | 2.3.0 |
| `openconceptlab` | Open Concept Lab Module | 3.1.0 |
| `ordertemplates` | Order Templates | 2.2.0 |
| `patientdocuments` | Patient Documents | 1.1.0 |
| `patientflags` | Patient Flags Module | 3.0.10 |
| `queue` | Queue | 3.0.0 |
| `referencedemodata` | Reference Demo Data Module | 2.6.1 |
| `reporting` | Reporting | 2.1.0 |
| `reportingrest` | Reporting REST | 2.0.0 |
| `serialization.xstream` | Serialization Xstream | 0.3.0 |
| `stockmanagement` | Stock Management | 3.0.0 |
| `tasks` | Tasks | 2.1.0 |
| `teleconsultation` | Teleconsultation | 2.0.0 |
| `webservices.rest` | Rest Web Services OMOD | 3.5.0 |

**Demo data:** the 3.7.1 images always include the demo configuration and generate 50 fake
patients on the first start. No `3.7.1-no-demo` image exists. A clean production setup
(no demo patients, our own concepts and metadata) is a separate, later step.

## Project layout

```
OpenMrs-EMR/
├── docker-compose.yml     # the stack (upstream + documented changes, images pinned by digest)
├── .env.example           # template for .env (secrets, port)
├── .env                   # real secrets - git-ignored, never commit
├── scripts/
│   ├── smoke-test.sh      # read-only health check
│   └── fetch-sources.sh   # clones the OpenMRS source code (exact running versions) to ../openmrs-source
├── docs/
│   └── learning-path.md   # ordered official videos/courses, with time estimates
├── backups/               # local backups - git-ignored (contains patient data)
├── CLAUDE.md              # working rules for this repository
└── README.md
```

### Source code (outside this repository)

We don't build OpenMRS; we run the community images. To **read** the code of exactly what
runs, clone it next to this repository:

```bash
./scripts/fetch-sources.sh          # about 1 minute, about 280 MB, into ../openmrs-source/
```

You get 46 shallow clones (the release tag only, no history): `distro/`, `core/`,
`content/` (the reference configuration: concepts, forms, locations), `backend-modules/`
(30) and `frontend/` (12 repositories that produce the 45 O3 apps).
`../openmrs-source/VERSIONS.md` lists each repository with its tag and commit. These are
study copies, so don't edit them. **When upgrading**, update the list in the script, delete
`../openmrs-source/` and run the script again.

Upstream reference: https://github.com/openmrs/openmrs-distro-referenceapplication (tag `3.7.1`).
