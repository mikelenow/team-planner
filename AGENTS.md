# AGENTS.md

## Project: Team Planner

Resource utilization planning webapp for developers, project managers, and other roles.

---

## ⚠️ Critical Rules

### 1. Tech Stack is LOCKED — Do NOT Change

The tech stack for this project has been decided and **must not be changed**:

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 18, Vite, Tailwind CSS        |
| UI Libs    | Headless UI, Heroicons              |
| Backend    | Node.js, Express                    |
| Database   | PostgreSQL 16                       |
| ORM        | Prisma                              |
| Auth       | JWT (jsonwebtoken + bcryptjs)       |
| Export     | xlsx (SheetJS)                      |
| Infra      | Docker, Docker Compose              |
| Date utils | date-fns                            |

Do **not** introduce alternative frameworks, ORMs, databases, or UI libraries without explicit user approval. No switching to TypeScript, Next.js, Drizzle, MongoDB, Material UI, etc.

### 2. Maintain CHANGELOG.md

Every change to this project **must** be logged in `CHANGELOG.md` at the project root.

- Follow [Keep a Changelog](https://keepachangelog.com/) format
- Use categories: Added, Changed, Fixed, Removed
- Group by date (newest first)
- Be specific about what changed and why
- **Read CHANGELOG.md at the start of every session** to understand recent changes

---

## Project Architecture

```
team-planner/
├── docker-compose.yml          # Full stack orchestration
├── .env                        # Environment variables (not committed)
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (source of truth)
│   │   └── seed.js             # Seed data (roles, holidays, etc.)
│   └── src/
│       ├── index.js            # Express entry point
│       ├── middleware/auth.js  # JWT auth middleware
│       ├── routes/             # API route handlers
│       ├── services/           # Business logic (future)
│       └── utils/holidays.js   # Austrian holiday calculator
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── components/         # Reusable UI components
│       ├── pages/              # Page-level components
│       ├── hooks/              # Custom React hooks
│       ├── utils/              # Helper functions
│       └── context/            # React context (auth, etc.)
└── CHANGELOG.md
```

## Key Design Decisions

- **Working hours**: Mon–Thu = 8h, Fri = 6.5h (38.5h/week default, customizable per person for part-time). Can be overridden per week via `WeeklySchedule` for people whose working days/hours vary week to week — resolved by `backend/src/utils/workingHours.js`
- **Utilization**: `(allocated hours / available hours) × 100`
- **Holidays**: Austrian (Steiermark), dynamically calculated per year
- **Allocations**: Percentage-based, per person per project, with date ranges
- **Absence types**: Customizable (Holiday, Sick, Travel, etc.)
- **Overallocation**: Warn when person is >100% booked
- **Export**: CSV and XLSX supported

## Running Locally

```bash
docker compose up --build
# Backend: http://localhost:3001
# Frontend: http://localhost:5173
# Default login: admin@mrnow.at / admin123
```

## Database Migrations

```bash
docker compose exec backend npx prisma migrate dev --name <description>
docker compose exec backend npx prisma db seed
```

## Deployment Target

- Local Docker first
- Production: planning.mrnow.at (Docker-based deployment)
