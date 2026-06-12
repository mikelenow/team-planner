# 📊 Utilization Planner

A resource utilization planning webapp for managing developer and project manager workloads, project allocations, absences, and Austrian public holidays.

**Target deployment:** planning.mrnow.at

## Features

- 👥 **People Management** — Add/edit/delete people with custom roles, teams, part-time support
- 📁 **Project Management** — Track projects with color coding and optional timelines
- 📊 **Allocation Planning** — Percentage-based allocation of people to multiple projects
- 🏖️ **Absence Tracking** — Custom absence types (Holiday, Sick, Travel, Training, etc.)
- 🇦🇹 **Austrian Holidays** — Auto-generated for Steiermark, dynamically per year
- 📅 **Timeline View** — Gantt-style weekly/bi-weekly/monthly view with color-coded utilization
- ⚠️ **Overallocation Warnings** — Visual alerts when someone is booked >100%
- 📥 **Export** — Download utilization data as XLSX or CSV
- 🔐 **Multi-user Auth** — JWT-based authentication

## Working Hours Model

| Day       | Default Hours |
|-----------|--------------|
| Monday    | 8.0h         |
| Tuesday   | 8.0h         |
| Wednesday | 8.0h         |
| Thursday  | 8.0h         |
| Friday    | 6.5h         |
| **Total** | **38.5h/week** |

Each person can have custom hours (for part-time workers).

## Quick Start

```bash
./start.sh
```

Or manually:

```bash
docker compose up --build
# Wait for containers, then:
docker compose exec backend npx prisma db push
docker compose exec backend npx prisma db seed
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Default login: `admin@mrnow.at` / `admin123`

## Tech Stack

| Layer    | Technology                     |
|----------|--------------------------------|
| Frontend | React 18, Vite, Tailwind CSS   |
| Backend  | Node.js, Express, Prisma       |
| Database | PostgreSQL 16                  |
| Infra    | Docker, Docker Compose         |

## Project Structure

```
utilization-planner/
├── docker-compose.yml
├── start.sh
├── backend/
│   ├── prisma/schema.prisma    # DB schema
│   ├── prisma/seed.js          # Seed data
│   └── src/
│       ├── routes/             # API endpoints
│       └── utils/holidays.js   # Austrian holiday calculator
└── frontend/
    └── src/
        ├── pages/              # Dashboard, Timeline, People, Projects, Teams, Settings
        ├── components/         # Layout, Modal
        ├── context/            # Auth
        └── utils/              # API client, helpers
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register |
| GET/POST/PUT/DELETE | `/api/people` | People CRUD |
| GET/POST/PUT/DELETE | `/api/projects` | Projects CRUD |
| GET/POST/PUT/DELETE | `/api/allocations` | Allocations CRUD |
| GET/POST/PUT/DELETE | `/api/absences` | Absences CRUD |
| GET/POST/PUT/DELETE | `/api/teams` | Teams CRUD |
| GET/POST/PUT/DELETE | `/api/roles` | Roles CRUD |
| GET/POST | `/api/holidays` | Public holidays |
| GET | `/api/utilization` | Utilization calculation |
| GET | `/api/export/utilization` | Export XLSX/CSV |

## Utilization Calculation

```
Utilization % = (Allocated Hours / Available Hours) × 100
```

- **Available Hours** = Person's daily hours minus absences and public holidays
- **Allocated Hours** = Sum of all project allocation percentages × daily hours
- **Overallocation** = When total allocation across projects > 100%

## License

Private / Internal use.
