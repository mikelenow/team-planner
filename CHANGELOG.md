# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## 2026-06-14

### Added

- **Production deployment pipeline** for teamplanner.mrnow.at
  - GitHub Actions workflow: auto-deploys on push to main
  - SSH via Cloudflare tunnel to production server
  - Production Docker Compose: postgres + backend + frontend (nginx static) + nginx reverse proxy
  - Optimized Dockerfiles (multi-stage frontend build, no devDeps in backend)
  - deploy.sh: pull → build → migrate → seed → health check → auto-rollback on failure
  - deployment/README.md with setup instructions

### Changed

- Bumped all Dockerfiles from Node 20 to **Node 22** (matches local dev environment)
- Updated npm packages: bcryptjs 2→3, dotenv 16→17, multer 1→2
- Default role when adding a person is now **Developer**
- Default team when adding a person is now **Development**
- Seed: renamed "Engineering" team to "Development"

### Fixed

- Empty email on people no longer causes unique constraint error (converts to null)
- Safe `start.sh` — uses `prisma db push` without force-reset, won't wipe data
- Added x86_64 Prisma binary target for production server (`linux-musl-openssl-3.0.x`)
- Health checks use `127.0.0.1` instead of `localhost` (Alpine IPv6 issue)
- Added `package-lock.json` files (required for `npm ci` in production)
- npm version mismatch: prod Dockerfiles now run `npm install -g npm@latest`
- Deploy script seeds database after migration (ensures admin user exists)

---

## 2026-06-12

### Added

- **Timeline inline editing**: Click any cell in the timeline to add/edit/delete allocations and absences
  - Set project + percentage + date range per allocation
  - Add multiple projects per person per day
  - Quick absence entry (full/half day) from same modal
  - Live total percentage counter with overallocation warning
  - Visual hover indicator on clickable cells
- **Capacity overview dashboard**: Complete resource spending & remaining overview
  - Side-by-side **Week** and **Month** capacity cards
  - Team utilization gauge (%) with color-coded thresholds
  - Hours breakdown: Total Capacity | Allocated | Absences | Remaining
  - Overallocation warning when team exceeds 100%
  - Per-project hours breakdown with mini bar charts
  - Per-person utilization with allocated/available hours display
- **Week-level allocation editing**: "Week" column with ✏️ button per person
  - Set project allocation percentages for entire week at once
  - Quick presets (25/50/75/100%) for rapid entry
  - Backend auto-upserts (creates or extends existing allocations)
- **User management & role system**:
  - Three roles: ADMIN (full access), MANAGER (edit), VIEWER (read-only)
  - Users page (admin only) with create/edit/deactivate/delete
  - Role-based access control on all write endpoints
  - Viewers see timeline but cannot click to edit
  - First registered user becomes ADMIN automatically
  - Protection against removing last admin or self-deletion
- **Project logos**: Upload PNG/JPG/SVG/WebP logos (max 2MB) to projects, displayed in project cards and detail views
- Logo preview in create/edit modal with remove button
- Static file serving for uploaded logos (`/uploads/logos/`)
- Persistent uploads volume in Docker

### Fixed

- Prisma binary target for Apple Silicon (linux-musl-arm64-openssl-3.0.x)
- Removed obsolete `version` attribute from docker-compose.yml
- Added OpenSSL to backend Alpine container

### Added (initial scaffolding)

- **Project scaffolding**: Full Docker Compose setup with PostgreSQL 16, Node.js backend, React frontend
- **Database schema** (Prisma): Users, Teams, Roles, People, Projects, Allocations, Absences, AbsenceTypes, PublicHolidays
- **Backend API routes**: Auth (login/register), People CRUD, Projects CRUD, Teams CRUD, Roles CRUD, Allocations CRUD, Absences CRUD, Holidays management, Utilization calculation, Export (CSV/XLSX)
- **Austrian holidays** (Steiermark): Dynamic calculation for any year with Easter-based movable holidays
- **Utilization engine**: Per-person daily/period calculation with overallocation detection
- **Auth system**: JWT-based with admin/user roles
- **Seed data**: Default roles (DEV, PM, DES, QA, OPS), absence types (Holiday, Sick, Travel, Training, Personal, Unpaid, Parental), teams, admin user, holidays for 2026–2027
- **Export endpoint**: XLSX and CSV export of utilization data
- **Working hours model**: Mon–Thu 8h, Fri 6.5h (38.5h/week), with per-person part-time support
- **Frontend pages**: Login, Dashboard (stats + weekly utilization bars), People (CRUD + filters), Person Detail (allocations + absences), Projects (CRUD + archive), Project Detail (allocated people), Timeline (Gantt-style week/2-week/month view with color-coded cells), Teams (CRUD), Settings (roles, absence types, holiday generator)
- **Frontend components**: Layout (sidebar nav), Modal (Headless UI dialog), AuthContext (JWT state)
- **Frontend utilities**: API client (axios + interceptors), helpers (date formatting, utilization colors)
- **Tailwind config**: Custom primary color palette, component classes (btn-primary, input, card, etc.)
- **Vite config**: Proxy to backend, host binding for Docker
- **Dockerfiles**: Backend (Node 20 Alpine + Prisma generate), Frontend (Node 20 Alpine + Vite dev)
- **start.sh**: One-command startup script (docker compose + migrate + seed)
- **README.md**: Full project documentation with API reference
- **AGENTS.md**: Project rules and architecture documentation
- **CHANGELOG.md**: This file
