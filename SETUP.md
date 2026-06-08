# ScanPort – Setup & Run Instructions

ScanPort is a combined **Scanner Certification Manager** and **Incident & Downtime Management System** for port scanner operations.

## Prerequisites
- Node.js 18+ and npm
- SQLite (bundled via Prisma — no separate install needed)

---

## Quick Start (Local Development)

### 1. Backend Setup
```bash
cd scanport/backend
cp .env.example .env
# Edit .env — set JWT_SECRET (required), adjust other settings
npm install
npx prisma generate
npx prisma db push          # Creates SQLite DB + applies schema
node prisma/seed.js         # Loads sample scanners + 10 sample incidents
npm run dev                 # Starts on http://localhost:4000
```

### 2. Frontend Setup
```bash
cd scanport/frontend
npm install
npm run dev                 # Starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Docker Compose (All-in-one)

```bash
cd scanport
docker-compose up --build -d

# Seed sample data (after containers are healthy)
docker-compose exec backend node prisma/seed.js
```

Open **http://localhost:5173**

---

## Login Credentials (after seeding)

| Role        | Email                        | Password     |
|-------------|------------------------------|--------------|
| Admin       | admin@scanport.com           | Admin@1234   |
| Admin       | ops@scanport.com             | Admin@1234   |
| Supervisor  | supervisor@scanport.com      | Super@1234   |
| Maintenance | maint@scanport.com           | Maint@1234   |
| Operator    | operator@scanport.com        | Viewer@1234  |

---

## System Modules

### 1. Incident Management System (NEW)
- **Log Incident** (`/incidents/new`) — Quick form optimised for < 30 second logging
- **Incident List** (`/incidents`) — Filterable list with SLA indicators, status tabs
- **Ticket Detail** (`/incidents/:id`) — Full detail, activity timeline, status transitions
- **Auto-generated ticket IDs** — Format: `LOCATION-YEAR-XXXX` (e.g. `IS1-2026-0001`)
- **SLA engine** — Automatic breach detection every 15 minutes, auto-escalation
- **PDF & Excel reports** with date/location/severity filters

### 2. Scanner Certification Manager
- Track NRA inspection dates, expiry dates, notice dates
- Automated 120-day expiry alerts
- NRA renewal letter generation (PDF)
- Full notification audit trail

---

## Incident Locations (seeded)

| Code | Name                  | Type                |
|------|-----------------------|---------------------|
| IS1  | Import Scanner 1      | Import Scanner      |
| IS2  | Import Scanner 2      | Import Scanner      |
| ES1  | Export Scanner 1      | Export Scanner      |
| ES2  | Export Scanner 2      | Export Scanner      |
| IEB1 | IE Bay 1              | Intrusive Exam Bay  |
| IEB2 | IE Bay 2              | Intrusive Exam Bay  |
| IEB3 | IE Bay 3              | Intrusive Exam Bay  |
| HAN  | Holding Area North    | Holding Area        |
| HAS  | Holding Area South    | Holding Area        |

---

## SLA Thresholds

| Severity | First Response | Resolution |
|----------|---------------|------------|
| CRITICAL | 1 hour        | 4 hours    |
| MAJOR    | 2 hours       | 8 hours    |
| MINOR    | 4 hours       | 24 hours   |

SLA auto-escalation triggers at 150% of resolution threshold if ticket is still OPEN.

---

## Ticket Workflow

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
OPEN/IN_PROGRESS → ESCALATED → IN_PROGRESS → RESOLVED → CLOSED
```

---

## Environment Variables (.env)

| Variable       | Description                              | Required |
|----------------|------------------------------------------|----------|
| DATABASE_URL   | SQLite file path (e.g. file:./data.db)  | Yes      |
| JWT_SECRET     | Secret key for JWT signing               | Yes      |
| JWT_EXPIRES_IN | Token expiry (default: 7d)              | No       |
| PORT           | Backend port (default: 4000)            | No       |
| FRONTEND_URL   | CORS origin for frontend                | No       |
| SMTP_HOST      | SMTP server hostname                     | No       |
| SMTP_PORT      | SMTP port (587 for TLS)                 | No       |
| SMTP_USER      | SMTP username / email                   | No       |
| SMTP_PASS      | SMTP password / app password            | No       |
| EMAIL_FROM     | Sender name and address                 | No       |
| ALERT_EMAIL    | Recipient(s) for automated alert emails | No       |

---

## Incident API Endpoints

| Method | Endpoint                         | Description                          |
|--------|----------------------------------|--------------------------------------|
| GET    | /api/incidents                   | List tickets (filters: status, severity, location, search, date) |
| POST   | /api/incidents                   | Create new ticket                    |
| GET    | /api/incidents/:id               | Get ticket + activities + attachments |
| PATCH  | /api/incidents/:id               | Update status / assignment / fields  |
| POST   | /api/incidents/:id/comments      | Add comment to activity feed         |
| POST   | /api/incidents/:id/attachments   | Upload photo/video/document          |
| GET    | /api/incidents/stats             | Dashboard KPIs (30-day window)       |
| GET    | /api/incidents/locations         | List all locations                   |
| GET    | /api/incidents/meta              | Issue types, equipment types, etc.   |
| GET    | /api/incidents/reports/pdf       | Download PDF report (filtered)       |
| GET    | /api/incidents/reports/excel     | Download Excel report (filtered)     |

---

## Background Jobs

| Job          | Schedule         | Description                                    |
|--------------|------------------|------------------------------------------------|
| Daily Check  | 07:00 daily      | Updates cert statuses, sends email alerts      |
| Backup Job   | Configurable     | Database backup                                |
| SLA Check    | Every 15 minutes | Marks SLA-breached tickets, auto-escalates     |

---

## Audit & Compliance

- Every ticket creation, update, escalation, and closure is logged to the Audit Log
- Ticket activities (status changes, comments, assignments) are immutable — append only
- Tickets cannot be deleted; only archived via CLOSED status
- Full audit trail viewable by Admin at `/audit`
