# InternFlow — Deployment & Operations Guide

> Production deployment, first-admin bootstrap, backup and reset procedures. Never commit production passwords, API keys, database exports, or backup passphrases.

## 1. What the application is

InternFlow is a Docker-based internship management platform for students, supervisors, and administrators.

It includes:

- Account registration, email OTP verification, administrator/supervisor approval, secure login, and password reset.
- Project allocation, including assignment before a student or supervisor has registered.
- Tasks, deadlines, document upload/review, feedback, notifications, and signed internship agreements.
- Role-based access control for student, supervisor, and administrator workspaces.
- AI-assisted review and project-report Q&A, with permission-scoped RAG access.
- Malware scanning for uploads and encrypted Restic backups.

## 2. Stack and services

| Service | Technology | Public exposure in production |
|---|---|---|
| Web application | Next.js / TypeScript | Caddy HTTPS only |
| API | Java 17 / Spring Boot | Caddy HTTPS only |
| Main database | PostgreSQL 16 | Private Docker network only |
| Report RAG store | Qdrant | Private Docker network only |
| File scanning | ClamAV | Private Docker network only |
| Backups | Restic | Private Docker network only |
| HTTPS proxy | Caddy | Ports 80 and 443 only |

Files required for a deployment:

```text
docker-compose.yml
docker-compose.production.yml
Caddyfile
.env.example
backend/
src/
database/
backup/
docs/DEPLOYMENT.md
```

## 3. Server prerequisites

- Linux server/VM with Docker Engine and Docker Compose plugin.
- A public DNS name, for example `internportal.company.tld`.
- DNS A/AAAA record pointing to the server before enabling Caddy.
- Firewall open to the internet only on TCP **80** and **443**.
- SMTP mailbox credentials for OTP, approval, and password-reset emails.
- Company secret manager for passwords, keys, and backup passphrases.
- Enough storage for database, uploads, Qdrant vectors, Docker images, and backups.

Recommended operational controls:

- Server disk encryption, OS security updates, SSH key-only access, and firewall logging.
- External monitoring of `https://internportal.company.tld/actuator/health`.
- Off-site encrypted copy of the Restic repository.
- Written approval before enabling an external AI provider, because authorised report content can be sent to that provider.

### Clone and test locally before deployment

Always test an isolated copy of the application first. Docker volumes are not stored in Git, so a normal clone starts with an empty PostgreSQL database and no uploaded files.

1. Clone the repository on a developer workstation or staging server:

```bash
git clone https://github.com/mmeelt/internflow-platform.git intern-portal
cd intern-portal
```

2. Create a local secrets file. It is deliberately ignored by Git:

```bash
cp .env.example .env
```

On Windows PowerShell use:

```powershell
Copy-Item .env.example .env
```

3. Edit `.env` and set unique local/staging values for at least `DB_PASSWORD`, `JWT_SECRET`, `SMTP_*`, `MAIL_FROM`, and `RESTIC_PASSWORD`. Keep `COOKIE_SECURE=false` and `NEXT_PUBLIC_API_URL=http://localhost:8081` for a local HTTP test. AI can stay disabled initially:

```dotenv
AI_ENABLED=false
BOOTSTRAP_ADMIN_ENABLED=false
```

4. Start the complete stack and wait until the services are healthy:

```bash
docker compose up --build -d
docker compose ps
```

5. Open `http://localhost:3000` and test at least: supervisor registration/approval, student registration/approval, OTP email delivery, login/logout, password reset, project approval/publication/assignment, document upload and review, and role-based access.

6. Optional build checks before accepting a release:

```bash
cd backend && ./mvnw test
cd .. && npm run build
```

Do not use a real production administrator, real production SMTP password, or real internship documents during this test phase.

## 4. Prepare the production environment

1. Clone the approved private repository to a private server directory, for example:

```bash
sudo mkdir -p /opt/intern-portal
sudo chown $USER:$USER /opt/intern-portal
git clone <company-repository-url> /opt/intern-portal
```

Alternatively, transfer an approved release archive through the company’s approved channel.

2. Create the production secrets file:

```bash
cd /opt/intern-portal
cp .env.example .env
chmod 600 .env
```

3. Edit `.env` in the company secret environment. At minimum, set:

```dotenv
APP_DOMAIN=internportal.company.tld
DB_USERNAME=internflow_app
DB_PASSWORD=<long-random-database-password>
DB_NAME=internportal
JWT_SECRET=<base64-secret-of-64-random-bytes>

COOKIE_SECURE=true
CORS_ORIGINS=https://internportal.company.tld
NEXT_PUBLIC_API_URL=https://internportal.company.tld

SMTP_HOST=<company-smtp-host>
SMTP_PORT=<smtp-port>
SMTP_USERNAME=<company-smtp-user>
SMTP_PASSWORD=<smtp-password-or-app-password>
MAIL_FROM=<approved-sender-address>

RESTIC_REPOSITORY=/backups/restic
RESTIC_PASSWORD=<long-random-backup-passphrase>

# Leave disabled unless AI has been approved and configured.
AI_ENABLED=false
AI_PRIMARY_PROVIDER=gemini
GEMINI_API_KEY=
GROQ_API_KEY=
OPENAI_API_KEY=

# Must remain false except for the one startup that creates the first admin.
BOOTSTRAP_ADMIN_ENABLED=false
BOOTSTRAP_ADMIN_EMAIL=
BOOTSTRAP_ADMIN_PASSWORD=
BOOTSTRAP_ADMIN_NAME=
```

Generate a JWT secret on Linux:

```bash
openssl rand -base64 64
```

Generate a backup passphrase:

```bash
openssl rand -base64 48
```

Do not use development values in production. Do not expose `.env` through Git, tickets, email, or screenshots.

## 5. First production deployment

Use the same Compose project name for every command below. This makes the Docker volume names predictable.

```bash
export COMPOSE_PROJECT_NAME=internportal
docker compose -f docker-compose.yml -f docker-compose.production.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
```

Expected result:

- Caddy is the only service with public ports 80 and 443.
- PostgreSQL, backend, Qdrant, ClamAV, and backups are private.
- Caddy automatically obtains and renews the TLS certificate when DNS and ports are correct.

Check the service and public health endpoint:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
curl --fail https://internportal.company.tld/actuator/health
```

If the certificate is not issued, first check DNS, public firewall rules, and Caddy logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml logs --tail=100 caddy
```

## 6. Create the first administrator

There is intentionally no public administrator sign-up page. Create the first administrator only after the database is empty.

1. Temporarily set these entries in the protected `.env` file:

```dotenv
BOOTSTRAP_ADMIN_ENABLED=true
BOOTSTRAP_ADMIN_EMAIL=administrator@company.tld
BOOTSTRAP_ADMIN_NAME=System Administrator
BOOTSTRAP_ADMIN_PASSWORD=<unique-password-with-12+-characters-and-letters-and-digits>
```

2. Recreate **only** the backend once:

```bash
export COMPOSE_PROJECT_NAME=internportal
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --force-recreate backend
docker compose -f docker-compose.yml -f docker-compose.production.yml logs --tail=100 backend
```

3. Sign in once at `https://internportal.company.tld` with that account.
4. Immediately edit `.env` again:

```dotenv
BOOTSTRAP_ADMIN_ENABLED=false
BOOTSTRAP_ADMIN_EMAIL=
BOOTSTRAP_ADMIN_NAME=
BOOTSTRAP_ADMIN_PASSWORD=
```

5. Recreate the backend again:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --force-recreate backend
```

Never leave bootstrap enabled. After this, the administrator can approve supervisors and manage accounts through the application.

### PowerShell equivalent

On a Windows server, use `$env:COMPOSE_PROJECT_NAME = 'internportal'` before the same `docker compose` commands. Prefer editing the protected `.env` file for bootstrap values rather than placing the first administrator password in PowerShell command history.

## 7. Account and project workflow

### Registered people

When an admin assigns a project to existing student and supervisor accounts:

- The assigned student sees it only after the project is approved.
- The student receives the project-assignment notification/email after approval.
- The project becomes public in the shared library only when the admin separately clicks **Publish**.

### People who have not registered yet

When the admin enters a new student or supervisor name and email while creating a project:

- The platform saves a **pending assignment record**, not a fake or disabled user account.
- No assignment email is sent at this stage.
- The person later registers normally with the exact same email and verifies their OTP.
- After the required account approval, the project is automatically linked once both assigned accounts exist.
- A project reserved for an unregistered student is hidden from other students during registration.

## 8. Backups and restore rehearsal

The backup container creates encrypted Restic backups of both PostgreSQL and uploaded files. It refuses to back up if `RESTIC_PASSWORD` is empty.

Check backup snapshots:

```bash
export COMPOSE_PROJECT_NAME=internportal
docker compose exec backup restic snapshots
```

Run one backup manually:

```bash
docker compose exec backup /usr/local/bin/backup.sh
```

The default retention policy is 7 daily, 4 weekly, and 12 monthly snapshots. Copy the Restic repository to company-approved encrypted off-site storage.

Before production acceptance, perform a restore rehearsal into a separate staging environment. Do **not** restore over the live database without a documented, approved recovery plan.

## 9. Intentional fresh-data reset

> Warning: These commands permanently remove application data. Take and verify a backup first. They are for a planned reset, not normal operation.

### 9.1 Reset only PostgreSQL

This removes accounts, projects, tasks, and database records, but retains uploaded files and RAG vectors. It is generally not recommended for a real fresh start.

```bash
export COMPOSE_PROJECT_NAME=internportal
docker compose -f docker-compose.yml -f docker-compose.production.yml down

# Inspect the exact target before removing it.
docker volume inspect internportal_postgres_data
docker volume rm internportal_postgres_data
```

### 9.2 Complete clean application reset

Use this when the company wants an entirely new empty platform. It removes the database, uploads, and RAG vectors but intentionally keeps backup history and TLS certificates.

```bash
export COMPOSE_PROJECT_NAME=internportal
docker compose -f docker-compose.yml -f docker-compose.production.yml down

# Inspect every volume first. Stop if any name is unexpected.
docker volume inspect internportal_postgres_data
docker volume inspect internportal_backend_uploads
docker volume inspect internportal_qdrant_storage

# Permanently remove only the inspected application-data volumes.
docker volume rm internportal_postgres_data
docker volume rm internportal_backend_uploads
docker volume rm internportal_qdrant_storage
```

Then start a fresh system and follow Section 6 to create the first administrator:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up --build -d
```

Do not remove `internportal_backup_data`, `internportal_caddy_data`, or `internportal_caddy_config` unless retention policy and the company security owner explicitly approve it.

### Required sequence after the planned reset

After a complete reset, use this order exactly:

1. Start the empty application with `BOOTSTRAP_ADMIN_ENABLED=false`.
2. Follow Section 6 to enable bootstrap for one backend start and create the real company administrator.
3. Disable bootstrap immediately and recreate the backend.
4. Have the administrator sign in, test company SMTP, approve the first supervisors, and then supervise student registration.

The reset must never be run after real data has been entered unless a verified backup and written company approval exist.

## 10. Update procedure

1. Back up and confirm `restic snapshots` works.
2. Pull/copy the reviewed new code release.
3. Review changes to `.env.example`, Compose files, and Flyway migrations.
4. Build and restart:

```bash
export COMPOSE_PROJECT_NAME=internportal
docker compose -f docker-compose.yml -f docker-compose.production.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
```

5. Check the health endpoint and application login.
6. Do not delete volumes during a normal upgrade. Flyway applies database migrations automatically and transactionally.

## 11. Production acceptance checklist

- [ ] Domain resolves to the server and HTTPS is valid.
- [ ] HTTP redirects to HTTPS and `COOKIE_SECURE=true`.
- [ ] `CORS_ORIGINS` contains only the company HTTPS domain.
- [ ] `.env` has restrictive permissions and is not tracked by Git.
- [ ] Database, backend, frontend, ClamAV, Qdrant, and backup services are healthy.
- [ ] First administrator exists and bootstrap is disabled.
- [ ] Supervisor registration/approval, student registration, OTP, login, and password reset work through company SMTP.
- [ ] Admin project approval, library publication, and student selection rules work.
- [ ] Pending email-based project assignment works for a new student and supervisor.
- [ ] Upload validation and ClamAV rejection behavior are tested safely.
- [ ] Role-based document/project access and AI report access have been tested.
- [ ] Restic backup and a staging restore rehearsal have been documented.
- [ ] AI is disabled or approved and configured with company-owned credentials.

## 12. Support and security rules

- Rotate database, SMTP, JWT, AI, and backup credentials after personnel changes or suspected exposure.
- Do not expose ports 5432, 8081, 6333, or 3310 to the internet.
- Keep Docker images and the server operating system updated.
- Use company monitoring/alerting for the health endpoint, backup failures, disk capacity, and certificate renewal.
- Keep AI provider keys server-side only. Never put them in the frontend or browser.
