# Port Terminal ERP – Setup Guide

## Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Docker & Docker Compose (for containerised deployment)

---

## Option A – Local Development

### 1. Database
```bash
psql -U postgres -c "CREATE DATABASE port_terminal_erp;"
```

### 2. Backend
```bash
cd backend
cp .env.example .env        # fill in DB_PASSWORD, JWT_SECRET, etc.
npm install
npm run migrate             # creates schema + seeds roles
npm run seed                # creates admin user
npm run dev                 # starts on :5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                 # starts on :3000
```

**Default admin login:**
- Username: `admin`
- Password: `Admin@123!`  ← change immediately after first login

---

## Option B – Docker Compose (Production)

```bash
cp .env.example .env        # fill in all values
docker compose up --build -d
```

App available at http://localhost

---

## API Endpoints Summary

| Method | Path                              | Role Required          | Description                  |
|--------|-----------------------------------|------------------------|------------------------------|
| POST   | /api/auth/login                   | Public                 | Login                        |
| POST   | /api/auth/logout                  | Any                    | Logout                       |
| GET    | /api/auth/me                      | Any                    | Current user profile         |
| GET    | /api/users                        | admin/supervisor       | List users                   |
| POST   | /api/users                        | admin                  | Create user                  |
| PUT    | /api/users/:id                    | admin                  | Update user                  |
| POST   | /api/users/:id/reset-password     | admin                  | Reset password                |
| POST   | /api/containers/allocate          | booth_officer          | Create allocation + chit     |
| POST   | /api/containers/confirm-entry     | marshal                | Confirm gate entry           |
| POST   | /api/containers/confirm-exit      | marshal                | Confirm gate exit            |
| GET    | /api/containers                   | All roles              | List transactions             |
| GET    | /api/containers/:id               | All roles              | Single transaction + chit    |
| PUT    | /api/containers/:id/override      | supervisor/admin       | Override transaction          |
| GET    | /api/containers/verify/:token     | Public (QR scan)       | Verify QR code               |
| GET    | /api/dashboard/summary            | supervisor+            | Real-time dashboard data     |
| GET    | /api/dashboard/overstayed         | supervisor+            | Overstayed containers        |
| GET    | /api/reports/daily                | supervisor+            | Daily ops report             |
| GET    | /api/reports/dwell-time           | supervisor+            | Dwell time report            |
| GET    | /api/reports/agent-performance    | supervisor+            | Agent performance report     |
| GET    | /api/reports/audit                | admin                  | Audit trail                  |
| GET    | /api/reports/exceptions           | supervisor+            | Exception report             |
| GET    | /api/reports/config               | admin                  | System config                |
| PUT    | /api/reports/config               | admin                  | Update system config         |

Add `?format=csv` or `?format=xlsx` to report endpoints for file download.

---

## Role Permissions Matrix

| Feature                    | Admin | Supervisor | Booth Officer | Marshal |
|----------------------------|:-----:|:----------:|:-------------:|:-------:|
| Create allocation          | ✓     |            | ✓             |         |
| Generate chit              | ✓     |            | ✓             |         |
| Confirm entry              | ✓     |            |               | ✓       |
| Confirm exit               | ✓     |            |               | ✓       |
| View transactions          | ✓     | ✓          | ✓             | ✓       |
| Override transactions      | ✓     | ✓          |               |         |
| Dashboard (full)           | ✓     | ✓          |               |         |
| Reports & exports          | ✓     | ✓          |               |         |
| Audit trail                | ✓     |            |               |         |
| Manage users               | ✓     |            |               |         |
| System config              | ✓     |            |               |         |

---

## Database Schema Overview

```
roles              → id, name, description
permissions        → id, name, description
role_permissions   → role_id ↔ permission_id
users              → id (UUID), username, email, password_hash, role_id, is_active …
user_sessions      → id, user_id, token_hash, last_active, expires_at
holding_areas      → id, name, code
bays               → id, holding_area_id, bay_code, capacity
container_transactions → id (UUID), transaction_id, container_number, agent_*, status,
                         qr_code_token, time_in, time_out, dwell_minutes …
audit_logs         → id (immutable), user_id, action, entity, details, ip_address …
system_config      → key, value (admin-configurable thresholds)
```

---

## Security Notes
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens stored server-side (session table) – can be revoked
- Auto-logout after configurable inactivity period (default 30 min)
- Account lockout after 5 failed login attempts (15-min lockout)
- Rate limiting: 20 login attempts per 15 min, 200 API calls per min
- All actions write to immutable audit_logs (no DELETE in app layer)
- Container numbers validated against ISO 6346 (4 letters + 7 digits)
- QR tokens are signed JWTs – tamper-proof
