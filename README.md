# OpenMrs-EMR

A complete, production-grade hospital deployment of the **OpenMRS O3 Reference Application** (community distribution 3.7.1) combined with **Orthanc PACS** and **OHIF Viewer v3**, configured specifically for the **Neurosurgery Department of CHU Frantz Fanon, Blida**.

**Status**: **Server 1 Production-Ready (Phases 1–4 Complete & Verified)**:
- **No demo data**: Clean database initialized with CHU Blida metadata, French default, and the official Algerian 69-wilaya address hierarchy.
- **Neurosurgical clinical record (Phase 3)**: 8 specialized clinical forms, 34 CIEL neurosurgical diagnoses with ICD-10 mappings, CHU letterhead PDF encounter printing, Glasgow & Karnofsky trend widgets, consultation queue, and 42 inpatient beds.
- **Integrated medical imaging (Phase 4)**: Orthanc 26.9.1 PACS with PostgreSQL 16 index and DICOMweb, OHIF Viewer 3.13.12, Nginx gateway reverse proxy with OpenMRS session authentication (`auth_request`), and the `esm-neuro-imaging-app` micro-frontend embedded directly into the patient chart with 1-click OHIF viewing, series inspection, and CD/USB DICOM import.
- **Server 1 scope**: Self-contained clinical EMR & PACS stack designed to run on the hospital server (8 GB RAM). (Server 2 AI/GPU services will be added in later phases).

| Document | Content |
| --- | --- |
| [`docs/production-deployment-guide.md`](docs/production-deployment-guide.md) | **Production deployment & operations guide for Server 1** |
| [`docs/neurosurgery-o3-plan.md`](docs/neurosurgery-o3-plan.md) | functional plan, clinical assumptions, roadmap |
| [`docs/configuration.md`](docs/configuration.md) | configuration package in `config/`: Initializer, frontend, PACS, OHIF |
| [`docs/neurosurgery-forms.md`](docs/neurosurgery-forms.md) | the 8 neurosurgery clinical forms and printed layout specifications |
| [`docs/test-report-phase3.md`](docs/test-report-phase3.md) | clinical content & browser UI test report (Phase 3) |
| [`docs/subplans/README.md`](docs/subplans/README.md) | clinical imaging validation with real CHU Blida MRI datasets |
| [`docs/learning-path.md`](docs/learning-path.md) | official OpenMRS learning resources |

| Component | Version / Image (pinned by digest) | Role |
| --- | --- | --- |
| Distribution | O3 Reference Application **3.7.1** | Micro-frontend single-spa clinical application |
| OpenMRS core | **2.8.8** (Java 21, Tomcat 9) | EMR business logic, REST & FHIR R4 APIs |
| Database | MariaDB **10.11.7** | EMR relational clinical database |
| PACS Server | Orthanc **26.9.1** (Core 1.13.0) | DICOM C-STORE, DICOMweb (WADO-RS, QIDO-RS), storage |
| PACS Index | PostgreSQL **16 Alpine** | Orthanc database index |
| Medical Viewer | OHIF Viewer **3.13.12** | Zero-footprint web viewer (MPR, WebGL2, segmentations) |
| Reverse Proxy | Nginx Gateway (O3 3.7.1) | Single entry point, SSL termination, `auth_request` security |
| Frontend Extension | `@openmrs/esm-neuro-imaging-app` | Custom O3 patient chart imaging dashboard & CD import |
| Verified on | Linux, Docker 29.8 / Compose v5.5, 8 cores, 7.6 GB RAM | Total stack footprint: ~1.1 GB at idle |

---

## Architecture

Seven containers on a private Docker network (`openmrs-emr_default`). Only the gateway (HTTP 80 / HTTPS 443) and Orthanc DICOM C-STORE (port 4242) are exposed on the host.

```
browser ──► gateway (Nginx, host port 80 / 443)
              ├── /openmrs/spa/*   ──► frontend  (Nginx serving O3 React micro-frontends)
              ├── /openmrs/*       ──► backend   (Tomcat: OpenMRS core + 30 modules, port 8080)
              │                           └──► db  (MariaDB 10.11, port 3306)
              ├── /ohif/*          ──► ohif      (OHIF Viewer 3.13 static container, port 80)
              │                           [Access verified via gateway auth_request -> backend session]
              └── /dicom-web/*     ──► orthanc   (Orthanc PACS 26.9.1 REST & DICOMweb, port 8042)
                                          [Access verified via gateway auth_request -> backend session]
                                          ├──► orthanc-db  (PostgreSQL 16 index)
                                          └──► volume openmrs-emr_orthanc-storage (raw DICOMs)

radiology modality ──► [port 4242 DICOM C-STORE] ──► orthanc
```

### Persistent Data Volumes

| Service | Volume Name | Content |
| --- | --- | --- |
| `backend` | `openmrs-emr_openmrs-data` | `openmrs-runtime.properties` (encryption keys), Lucene search indexes, uploaded attachments (`storage/complex_obs/`) |
| `db` | `openmrs-emr_db-data` | MariaDB relational database (patients, encounters, observations, users, metadata) |
| `orthanc-db` | `openmrs-emr_orthanc-db-data` | PostgreSQL relational database (DICOM patient/study/series index) |
| `orthanc` | `openmrs-emr_orthanc-storage` | Raw DICOM Part 10 image files organized on disk |

All container images are **pinned by multi-architecture digest** in `docker-compose.yml` (`tag@sha256:...`) to ensure reproducible deployments on Intel/AMD and ARM hospital hardware.

---

## Prerequisites

- **Host OS**: Linux (Ubuntu 22.04 LTS or 24.04 LTS recommended, Debian 12).
- **Docker**: Docker Engine 26+ with Docker Compose plugin v2.20+.
- **RAM**: Server 1 needs at least **8 GB RAM** (the complete stack consumes ~1.1 GB at idle and peaks under 4 GB during heavy ingestion).
- **Disk**: Minimum **100 GB** for system, plus dedicated storage for PACS (allow ~500 GB to 1 TB for 1–2 years of neurosurgical MRI/CT studies).
- **Network Ports**:
  - `80` (HTTP) and `443` (HTTPS) free on the host.
  - `4242` free for DICOM C-STORE (receiving images from hospital scanners/radiology).

---

## Getting Started

All commands run on the **host**, from the repository root:

```bash
# 1. Environment and Secrets (.env is git-ignored)
cp .env.example .env
sed -i "s/OMRS_DB_PASSWORD=CHANGE_ME/OMRS_DB_PASSWORD=$(openssl rand -hex 16)/; \
        s/MYSQL_ROOT_PASSWORD=CHANGE_ME/MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)/; \
        s/ORTHANC_DB_PASSWORD=CHANGE_ME/ORTHANC_DB_PASSWORD=$(openssl rand -hex 16)/" .env
# The admin password requires upper case, lower case and a digit (OpenMRS security rule)
sed -i "s/OMRS_ADMIN_PASSWORD=CHANGE_ME/OMRS_ADMIN_PASSWORD=Adm$(openssl rand -hex 12)X9/" .env
chmod 600 .env

# 2. Pull Pinned Images (~3.5 GB)
docker compose pull

# 3. Start the Stack
docker compose up -d
```

### First-Start Initialization (~50 to 75 minutes)

On the very first boot on an empty database:
1. MariaDB schema is generated by Liquibase.
2. The **Initializer** module imports our clean configuration (`config/backend/`): ~2,500 concepts (CIEL packages for vitals, diagnoses, allergies, procedures, neurosurgery), metadata, and the 2,162 Algerian address hierarchy entries.
3. During this time, the web interface shows `/openmrs/initialsetup` ("Installation is currently in progress"). **This is normal.** Do not interrupt or restart containers.
4. **Readiness test**:
   ```bash
   curl -s http://localhost/openmrs/ws/rest/v1/session
   # Ready when returns: {"authenticated":false,"locale":"fr","allowedLocales":["fr","en","ar"]}
   ```
Subsequent restarts skip initialization and take **under 50 seconds**.

### Web Access

| Application | URL | Credentials |
| --- | --- | --- |
| **OpenMRS O3 UI** | `http://<SERVER_IP>/openmrs/spa` | `admin` / password from `OMRS_ADMIN_PASSWORD` in `.env` |
| **OHIF Viewer** | `http://<SERVER_IP>/ohif/` | Requires active OpenMRS session (single sign-on) |
| **Legacy Admin UI** | `http://<SERVER_IP>/openmrs` | System administration, scheduler, modules |

---

## Daily Operations

| Task | Command (host, repository root) |
| --- | --- |
| Check status | `docker compose ps` |
| Start stack | `docker compose up -d` |
| Stop stack (keep data) | `docker compose stop` (or `docker compose down`) |
| View backend logs | `docker compose logs -f --tail 200 backend` |
| View PACS logs | `docker compose logs -f --tail 200 orthanc` |
| View Gateway logs | `docker compose logs -f --tail 200 gateway` |
| EMR SQL shell | `docker compose exec db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" openmrs'` |
| PACS SQL shell | `docker compose exec orthanc-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` |

> [!WARNING]
> **`docker compose down -v` deletes all databases and raw imaging data.** Never run `down -v` in production. Standard `docker compose stop` or `docker compose down` (without `-v`) safely preserves all persistent volumes.

---

## Testing & Quality Assurance

Automated regression test suites verify EMR, RBAC, and PACS functionality:

```bash
# 1. EMR Core & Configuration Smoke Test (12 checks)
./scripts/smoke-test.sh

# 2. PACS Gateway Security & Access Control Test (10 checks)
./scripts/dev-test-imaging.sh

# 3. Clinical Imaging Dataset & DICOMweb Test (10 checks)
./scripts/verify-imaging-dataset.sh

# 4. Role-Based Access Control (18 checks on test patient)
TEST_USER_PASSWORD='...' ./scripts/dev-test-roles.sh <patient-uuid>
```

---

## Backup and Disaster Recovery

A complete Server 1 backup archives all four data stores:

```bash
# Automated consistent online backup of all 4 volumes:
./scripts/backup-all.sh
```

This creates four timestamped archives in `backups/` (git-ignored):
1. `openmrs-db-<TS>.sql.gz`: MariaDB transactional SQL dump.
2. `orthanc-db-<TS>.sql.gz`: PostgreSQL Orthanc index SQL dump.
3. `openmrs-data-<TS>.tar.gz`: OpenMRS data directory (encryption keys, attachments).
4. `orthanc-storage-<TS>.tar.gz`: Raw DICOM Part 10 imaging storage.

### Restoring from Backup

To restore Server 1 following server failure or data corruption:

```bash
# Restore from a specific backup timestamp:
./scripts/restore-all.sh <TIMESTAMP> --yes
```

The restore script stops application traffic, restores both relational databases, unpacks the data volumes, restarts the containers, and verifies readiness via the smoke test.

---

## Upgrading

1. Review upstream release notes for OpenMRS O3, Orthanc, and OHIF.
2. Back up all volumes with `./scripts/backup-all.sh`.
3. In `docker-compose.yml`, update both the version tag and multi-architecture digest (`tag@sha256:...`). Changing only the tag has no effect because Docker resolves the immutable digest.
4. Run `docker compose pull && docker compose up -d`.
5. Verify via `./scripts/smoke-test.sh` and `./scripts/verify-imaging-dataset.sh`.

---

## Project Layout

```
OpenMrs-EMR/
├── docker-compose.yml           # 7-container stack (O3 + MariaDB + Orthanc + PostgreSQL + OHIF)
├── .env.example                 # Secrets template (DB credentials, admin password, AET)
├── .env                         # Real passwords (git-ignored)
├── config/                      # OUR CONFIGURATION (no demo data)
│   ├── backend/                 # Initializer domains (concepts, forms, locations, address hierarchy)
│   ├── frontend/                # O3 frontend config, logos, and micro-frontends
│   │   └── esm-neuro-imaging/   # Patient chart imaging tab & CD import single-spa module
│   ├── orthanc/                 # Orthanc PACS JSON configuration
│   ├── ohif/                    # OHIF Viewer app-config.js (DICOMweb data source)
│   └── NOTICE.md                # Third-party attribution & licensing notices
├── gateway/
│   └── templates/               # Nginx reverse proxy templates with auth_request security
├── scripts/
│   ├── backup-all.sh            # Consistent online backup of all 4 data volumes
│   ├── restore-all.sh           # Automated disaster recovery restore script
│   ├── smoke-test.sh            # EMR health & configuration test (12 checks)
│   ├── dev-test-imaging.sh      # Imaging security & auth test (10 checks)
│   ├── verify-imaging-dataset.sh# Clinical DICOMweb dataset verification (10 checks)
│   ├── dev-test-roles.sh        # Role boundary & privilege verification (18 checks)
│   ├── dev-create-test-users.sh # Test user provisioning
│   └── build-address-hierarchy.py # Generates 69-wilaya Algerian address CSV
├── docs/                        # Complete project documentation
│   ├── production-deployment-guide.md # Deployment & operations guide for Server 1
│   ├── neurosurgery-o3-plan.md  # Functional plan & roadmap
│   ├── configuration.md         # Configuration inventory & domain layout
│   ├── neurosurgery-forms.md    # 8 clinical forms & CHU print layouts
│   ├── test-report-phase3.md    # Phase 3 clinical verification report
│   └── subplans/                # Phase 4 clinical dataset execution & validation
├── backups/                     # Local backups (git-ignored, contains clinical data)
├── CLAUDE.md                    # Repository working rules & principles
└── README.md
```

Upstream reference: [OpenMRS Reference Application 3.7.1](https://github.com/openmrs/openmrs-distro-referenceapplication).
