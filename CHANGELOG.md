# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## 2026-06-12

### Added

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
