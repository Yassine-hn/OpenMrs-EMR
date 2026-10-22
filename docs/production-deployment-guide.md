# Production Deployment & Operations Guide — Server 1

This guide covers the production deployment, network configuration, security hardening, and operational maintenance of **Server 1** for the **Neurosurgery Department, CHU Frantz Fanon, Blida**.

Server 1 is a completely self-contained clinical EMR and PACS server running on local hospital hardware. It does not require active internet connectivity after initial image installation and functions independently of Server 2 (AI/GPU services).

---

## 1. System Specifications & Hardware Requirements

| Parameter | Minimum Requirement | Recommended Specification |
| --- | --- | --- |
| **Server** | Dedicated physical machine or hypervisor VM (Server 1) | Same |
| **CPU** | 4 cores (x86_64 or ARM64) | 8 cores |
| **RAM** | 8 GB RAM | 8 GB to 16 GB RAM |
| **System Disk** | 80 GB SSD/NVMe (OS + Docker containers) | 120 GB SSD/NVMe |
| **Storage Disk** | 500 GB (DICOM studies & database) | 1 TB to 2 TB dedicated volume for `/var/lib/docker/volumes` |
| **OS** | Linux (Ubuntu Server 22.04 LTS / 24.04 LTS or Debian 12) | Ubuntu Server 24.04 LTS (Kernel 6.8+) |
| **Docker** | Docker Engine 26.0+ with Docker Compose v2.20+ | Latest Docker CE with Compose plugin |

---

## 2. Network Topology & Port Allocation

Server 1 sits on the internal hospital Local Area Network (LAN). No external internet exposure is required or recommended.

```
Department Workstations ──► [Port 80/443 (HTTP/HTTPS)] ──► Gateway (Nginx)
CT / MRI Modalities     ──► [Port 4242 (DICOM C-STORE)] ──► Orthanc PACS
```

### Exposed Host Ports:

| Port | Protocol | Service | Access Policy |
| --- | --- | --- | --- |
| **80** | TCP | Nginx Gateway (HTTP) | Open to hospital LAN (redirects to HTTPS in production) |
| **443** | TCP | Nginx Gateway (HTTPS) | Open to hospital LAN (clinical UI, OHIF, APIs) |
| **4242** | TCP | Orthanc PACS (DICOM C-STORE) | Restricted to trusted modality / scanner IP addresses |

All other inter-service communications (MariaDB port 3306, Tomcat port 8080, PostgreSQL port 5432, Orthanc REST port 8042, OHIF port 80) remain strictly internal to the private Docker bridge network (`openmrs-emr_default`).

---

## 3. Pre-Deployment Server Preparation

### 3.1 Install Docker Engine and Compose

On fresh Ubuntu Server:

```bash
# 1. Install prerequisites
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 2. Add Docker official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 3. Add repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Docker CE and Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# 6. Allow non-root deployer user (optional, log out and back in)
sudo usermod -aG docker $USER
```

### 3.2 Time Synchronization & Time Zone

The hospital system requires strict timestamp alignment for legal and clinical auditing:

```bash
# Set server time zone to Africa/Algiers (UTC+1, no daylight saving)
sudo timedatectl set-timezone Africa/Algiers

# Enable NTP time synchronization
sudo timedatectl set-ntp true
timedatectl status
```

---

## 4. Production Installation Step-by-Step

### 4.1 Clone Repository

```bash
cd /opt
sudo git clone -b develop https://github.com/Yassine-hn/OpenMrs-EMR.git
cd /opt/OpenMrs-EMR
sudo chown -R $USER:$USER /opt/OpenMrs-EMR
```

### 4.2 Generate Production Secrets

Create the production `.env` file with cryptographically secure random passwords:

```bash
cp .env.example .env

# Generate 32-character hexadecimal passwords for databases
sed -i "s/OMRS_DB_PASSWORD=CHANGE_ME/OMRS_DB_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/MYSQL_ROOT_PASSWORD=CHANGE_ME/MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)/" .env
sed -i "s/ORTHANC_DB_PASSWORD=CHANGE_ME/ORTHANC_DB_PASSWORD=$(openssl rand -hex 16)/" .env

# Generate complex OpenMRS Admin password (must have upper, lower, and digits)
sed -i "s/OMRS_ADMIN_PASSWORD=CHANGE_ME/OMRS_ADMIN_PASSWORD=Adm$(openssl rand -hex 12)X9/" .env

# Set Orthanc Application Entity Title (AET)
sed -i "s/ORTHANC_AET=ORTHANC/ORTHANC_AET=NEURO_BLIDA/" .env

# Lock down file permissions (read-only by deployer)
chmod 600 .env
```

> [!IMPORTANT]
> Record the generated `OMRS_ADMIN_PASSWORD` securely in the hospital IT vault. This password is required for initial administrative login.

### 4.3 Configure TLS / SSL Certificates

For HTTPS deployment, create or obtain SSL certificates:

```bash
mkdir -p gateway/ssl

# If hospital CA certificate is available:
# Copy certificate to gateway/ssl/server.crt
# Copy private key to gateway/ssl/server.key

# Alternatively, generate a 10-year internal self-signed certificate:
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout gateway/ssl/server.key \
  -out gateway/ssl/server.crt \
  -subj "/C=DZ/ST=Blida/L=Blida/O=CHU Frantz Fanon/OU=Service de Neurochirurgie/CN=emr.neuro-blida.dz"
chmod 600 gateway/ssl/server.key
```

### 4.4 Pull Images and Boot Stack

```bash
# Pull all pinned images by immutable digest (~3.5 GB)
docker compose pull

# Start containers in detached mode
docker compose up -d
```

---

## 5. First-Boot Sequencing & Verification

On the initial boot, OpenMRS populates the empty database and imports all clinical concepts and address entries:

```bash
# Monitor boot progress
docker compose logs -f backend
```

- **Duration**: Takes approximately **50 to 75 minutes** on an 8-core CPU.
- **Normal behavior**: Web requests return HTTP 302 redirecting to `/openmrs/initialsetup`. Do not restart or stop containers.
- **Completion indicator**: The REST API session endpoint answers with JSON:

```bash
until curl -s http://localhost/openmrs/ws/rest/v1/session | grep -q '"authenticated"'; do
  echo "Waiting for initialization... ($(date +%H:%M:%S))"
  sleep 30
done
echo "OpenMRS EMR is READY!"
```

### Run Verification Suite:

```bash
./scripts/smoke-test.sh
./scripts/dev-test-imaging.sh
```

Both test suites must report **ALL CHECKS PASSED**.

---

## 6. Post-Installation Clinical Configuration

### 6.1 Set Consultation Service Schedules

Initializer creates the services, but weekly operating hours must be defined once through the web UI:
1. Log in to `http://<SERVER_IP>/openmrs/spa` as `admin`.
2. Go to **Rendez-vous** (Appointments) $\rightarrow$ **Services**.
3. For each service (*Consultation de neurochirurgie*, *Consultation post-opératoire*, *Neuro-oncologie*):
   - Set weekly operating days (e.g. Dimanche, Mardi, Jeudi).
   - Set operating hours (e.g. 08:30 – 12:30).
   - Set max load per slot (e.g. 15 patients).

### 6.2 Provision Staff Accounts

Create user accounts for clinical staff through the legacy administration UI at `http://<SERVER_IP>/openmrs/admin/users/users.list`:

| Role Name | Intended Users | Permissions |
| --- | --- | --- |
| `Secrétariat` | Reception, medical secretaries | Patient registration, search, appointment scheduling, queue check-in |
| `Infirmier` | Ward & clinic nurses | Vitals, bed management, admission, observation recording |
| `Médecin` | Residents, neurosurgeons | Clinical notes, 8 neurosurgery forms, diagnosis coding, operative reports, OHIF imaging view |
| `Administrateur Système` | Hospital IT staff | Full administrative access |

---

## 7. Automated Daily Backups & Disaster Recovery

### 7.1 Automated Backup Cron

Configure an automated nightly backup that archives all four volumes:

```bash
# Open crontab for root or deployer
crontab -e

# Run daily backup at 02:00 AM every night and retain in /opt/OpenMrs-EMR/backups
0 2 * * * /opt/OpenMrs-EMR/scripts/backup-all.sh >> /var/log/openmrs-backup.log 2>&1
```

### 7.2 Off-Site Backup Replication

Backups must not remain solely on the local drive:

```bash
# Example rsync to hospital NAS / backup server
rsync -avz --delete /opt/OpenMrs-EMR/backups/ backupuser@192.168.1.50:/backup/openmrs-neuro-blida/
```

### 7.3 Disaster Recovery Procedure

In case of hardware failure or catastrophic corruption:

1. Deploy fresh OS and Docker engine on replacement hardware.
2. Clone repository to `/opt/OpenMrs-EMR` and restore `.env`.
3. Copy the backup archives (`openmrs-db-*.sql.gz`, `orthanc-db-*.sql.gz`, `openmrs-data-*.tar.gz`, `orthanc-storage-*.tar.gz`) into `/opt/OpenMrs-EMR/backups/`.
4. Execute the automated restore script:

```bash
cd /opt/OpenMrs-EMR
./scripts/restore-all.sh <BACKUP_TIMESTAMP> --yes
```

The script restores both databases, unpacks imaging files and encryption keys, starts all containers, and runs the smoke test.

---

## 8. Monitoring & Maintenance

### Daily Health Check:

```bash
# Check running containers
docker compose ps

# Check memory utilization (budget: < 5.5 GB total)
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"
```

### Log Rotation:

Docker's default JSON log driver should be configured with rotation in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```

Restart Docker daemon after modifying: `sudo systemctl restart docker`.
