# Voltwheels EMS — Complete Project Documentation

Last updated: 2026-03-27

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Layout](#2-repository-layout)
3. [Technology Stack](#3-technology-stack)
4. [Environment Variables](#4-environment-variables)
5. [How to Run](#5-how-to-run)
6. [Layer 1 — Database (PostgreSQL)](#6-layer-1--database-postgresql)
7. [Layer 2 — Backend API (Express + TypeScript)](#7-layer-2--backend-api-express--typescript)
8. [Layer 3 — Frontend (Next.js + React)](#8-layer-3--frontend-nextjs--react)
9. [Data Flow — End to End](#9-data-flow--end-to-end)
10. [Authentication & Authorization](#10-authentication--authorization)
11. [Status & Enum System](#11-status--enum-system)
12. [Rate Limiting & Security](#12-rate-limiting--security)
13. [CSV Export System](#13-csv-export-system)
14. [Architecture & Design Patterns](#14-architecture--design-patterns)
15. [Deployment](#15-deployment)
16. [Maintenance & Scripts](#16-maintenance--scripts)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Project Overview

**Voltwheels EMS** is a full-stack **Enterprise Management System** built for the Voltwheels electric vehicle dealership. It manages:

- **Lead Reports** — capture and track incoming sales leads
- **Visit Reports** — log salesperson interactions with leads through the pipeline
- **Task Manager** — daily task submission by employees with admin approval workflow
- **Attendance** — clock-in/clock-out with admin approval
- **Sales Performance Dashboard** — charts and KPIs across leads and visits
- **Service Manager** — vehicle inventory and service tracking
- **Opportunities** — Salesforce-synced and non-Salesforce pipeline records
- **Admin Panel** — user management, role assignment, task approval, attendance review

**Live URLs (production):**
- Frontend: `https://voltwheelsind.com` (deployed on Vercel)
- Backend API: `https://voltmate.onrender.com` (deployed on Render)

---

## 2. Repository Layout

```
voltwheels-ems/
│
├── Voltmate-/                  ← Primary Next.js frontend (App Router)
│   ├── app/                    ← All pages (file-based routing)
│   ├── components/             ← UI components, sections, shadcn primitives
│   ├── hooks/                  ← Custom React hooks
│   ├── lib/                    ← Utility functions (cn helper)
│   ├── src/                    ← API client layer + AuthTabs
│   ├── public/                 ← Static assets (logo, favicon)
│   ├── next.config.mjs         ← Next.js config (cache headers, TS error bypass)
│   ├── tailwind.config.ts      ← Tailwind CSS config
│   └── package.json
│
├── backend/                    ← Primary Express + TypeScript API
│   ├── src/
│   │   ├── app.ts              ← Express app setup (middleware, routes)
│   │   ├── index.ts            ← Server entry point (listen on PORT)
│   │   ├── db/index.ts         ← Postgres pool (pg.Pool via DATABASE_URL)
│   │   ├── controllers/        ← Business logic handlers
│   │   ├── routes/             ← Route definitions (thin wiring layer)
│   │   ├── middlewares/        ← auth, rate limiting
│   │   └── utils/              ← validate.ts, activityLog.ts
│   ├── migrations/             ← SQL migration files (users, leads, visits, etc.)
│   ├── scripts/                ← One-off maintenance scripts
│   ├── tsconfig.json
│   └── package.json
│
├── backend-node/               ← Alternate slim backend used by Docker
│   ├── src/                    ← index.ts, handlers/, db.ts
│   └── Dockerfile
│
├── app/                        ← Root-level partial/legacy Next.js slice (page.tsx + auth/)
├── components/                 ← Root-level UI primitives (mirrors Voltmate-)
├── hooks/, lib/                ← Root-level hooks/utils (mirrors Voltmate-)
│
├── docker-compose.yml          ← Postgres + backend-node + Voltmate- frontend
├── next.config.mjs             ← Root Next.js config
├── tsconfig.json               ← Root TypeScript config
├── PROJECT_DOCUMENTATION.md   ← This file
└── README.md
```

> **Canonical stack:** `Voltmate-/` (frontend) + `backend/` (API). The `docker-compose.yml` builds from `backend-node/` (slimmer image), but `backend/` is the full-featured API used in production on Render.

---

## 3. Technology Stack

### Frontend (`Voltmate-/`)

| Concern | Tool |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| UI library | React 19.2.3 |
| Styling | Tailwind CSS + inline CSS-in-JS strings |
| UI primitives | shadcn/ui (Radix UI based) |
| Charts | recharts |
| Forms | react-hook-form + zod |
| Dates | date-fns |
| Icons | lucide-react |
| HTTP client | Native `fetch` with Bearer token headers |
| Toasts | sonner |
| Language | TypeScript 5.7.3 |

### Backend (`backend/`)

| Concern | Tool |
|---|---|
| Framework | Express.js |
| Language | TypeScript (compiled via ts-node-dev in dev) |
| Database driver | `pg` (node-postgres, Pool) |
| Auth | `jsonwebtoken` (HS256 JWTs) |
| Password hashing | `bcrypt` / `bcryptjs` |
| Rate limiting | `express-rate-limit` |
| Security headers | `helmet` |
| CORS | `cors` |
| Email | `@sendgrid/mail` |
| Language | TypeScript |

### Database

| Concern | Tool |
|---|---|
| Engine | PostgreSQL |
| Access | `pg.Pool` (connection string via `DATABASE_URL`) |
| Migrations | Manual SQL files in `backend/migrations/` + auto-DDL in controllers |

---

## 4. Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Full Postgres connection string |
| `JWT_SECRET` | ✅ | Secret for signing/verifying JWTs |
| `PORT` | ✅ | HTTP port (default: 8081) |
| `NODE_ENV` | recommended | `development` or `production` |
| `ALLOWED_ORIGIN` | production | Primary frontend origin for CORS |
| `ALLOWED_ORIGINS` | production | Comma-separated additional origins |
| `SENDGRID_API_KEY` | optional | For email functionality |
| `SENDGRID_FROM` | optional | Sender email address |

### Frontend (`Voltmate-/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend base URL (e.g. `https://voltmate.onrender.com`) |
| `NEXT_PUBLIC_YOUTUBE_API_KEY` | optional | For vehicle videos page |

> **CORS logic:** The backend auto-adds `voltwheelsind.com` and `voltwheelsin.com` (+ `www.` variants) to the allowed origins whenever the `ALLOWED_ORIGIN` env contains either domain. In development, any origin (or no origin) is allowed.

---

## 5. How to Run

### Development

```bash
# Terminal 1 — Backend
cd backend
npm install
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, PORT=8081
npm run dev               # ts-node-dev, watches src/

# Terminal 2 — Frontend
cd Voltmate-
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8081
npm run dev               # Next.js dev server on http://localhost:3000
```

### Production Build

```bash
# Backend
cd backend && npm run build && node dist/index.js

# Frontend
cd Voltmate- && npm run build && npm start
```

### Docker (backend-node + frontend)

```bash
docker-compose up --build
# Postgres on 5432, backend-node on its PORT, frontend on 3000
```

---

## 6. Layer 1 — Database (PostgreSQL)

### Connection

`backend/src/db/index.ts` creates a single `pg.Pool` from `DATABASE_URL`. All controllers import `query` from this file — a thin wrapper around `pool.query(sql, params)`.

### Tables

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | TEXT | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | bcrypt |
| role | TEXT | `'employee'` or `'admin'` |
| is_approved | BOOLEAN | admin must approve new accounts |
| created_at | TIMESTAMPTZ | |

#### `leads`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| cust_code | TEXT UNIQUE | auto-generated: `C-` + timestamp suffix |
| cust_name | TEXT | required |
| phone_no | TEXT | Indian mobile (regex validated) |
| phone_no_2 | TEXT | optional second number |
| business | TEXT | |
| lead_type | TEXT | `'Digital Lead'` or `'Non Digital Lead'` |
| location | TEXT | from Nominatim autocomplete |
| connect_date | DATE | |
| created_by | INT FK → users.id | |
| updated_by | INT FK → users.id | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `visits`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| lead_id | INT FK → leads.id | |
| lead_cust_code | TEXT | denormalized from leads |
| lead_type | TEXT | denormalized from leads |
| connect_date | DATE | denormalized from leads |
| salesperson_id | INT FK → users.id | |
| vehicle | TEXT | |
| status | TEXT | from VISIT_STATUSES enum |
| visit_date | DATE | |
| next_action | TEXT | mirrors status enum |
| next_action_date | DATE | |
| note | TEXT | |
| phone_no | TEXT | |
| phone_no_2 | TEXT | |
| created_by | INT FK → users.id | |
| updated_by | INT FK → users.id | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `tasks`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| user_id | INT FK → users.id | |
| task_date | DATE | |
| description | TEXT | |
| status | TEXT | `'Just Assigned'` / `'Under Process'` / `'Completed'` |
| approval_status | TEXT | `'Pending'` / `'Approved'` / `'Rejected'` |
| approved_by | INT FK → users.id | |
| approved_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| UNIQUE | (user_id, task_date) | one task per employee per day |

#### `task_edits` (audit log)
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| task_id | INT FK → tasks.id | |
| edited_by | INT FK → users.id | |
| old_description | TEXT | |
| new_description | TEXT | |
| edited_at | TIMESTAMPTZ | |

#### `attendance`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| user_id | INT FK → users.id | |
| clock_in | TIMESTAMPTZ | |
| clock_out | TIMESTAMPTZ | nullable |
| approved | BOOLEAN | |
| approved_by | INT FK → users.id | |
| date | DATE | |

#### `opportunities`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| sl_no | TEXT | |
| opportunity_name | TEXT | |
| phone_no | TEXT | |
| stage | TEXT | |
| next_connect | TEXT | |
| last_connect | TEXT | |
| month_of_reconnect | TEXT | |
| stage_remark | TEXT | |
| connected_person | TEXT | |
| probability | TEXT | |
| business_payload | TEXT | |
| use_range | TEXT | |
| customer_own_vehicle | TEXT | |
| customer_location | TEXT | |
| vehicle_suggested_action | TEXT | |
| distributor_manufacturer | TEXT | |
| source | TEXT | `'salesforce'` or NULL |
| salesforce_id | TEXT | |
| amount | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `vehicles`
Runtime-created by `vehicleController.ts`:
| Column | Type |
|---|---|
| id | SERIAL PK |
| reg_no | TEXT UNIQUE |
| make | TEXT |
| model | TEXT |
| year | INT |
| current_km | INT |
| created_at | TIMESTAMPTZ |

#### `vehicle_services`
Runtime-created by `vehicleServiceController.ts`:
| Column | Type |
|---|---|
| id | SERIAL PK |
| vehicle_id | INT FK → vehicles.id |
| service_type | TEXT |
| service_date | DATE |
| next_due_date | DATE |
| notes | TEXT |
| created_at | TIMESTAMPTZ |

#### `activity_log`
Runtime-created by `utils/activityLog.ts`:
| Column | Type |
|---|---|
| id | SERIAL PK |
| entity_type | TEXT | e.g. `'visit'`, `'lead'` |
| entity_id | INT | |
| entity_code | TEXT | human-readable identifier |
| action | TEXT | `'create'`, `'update'`, `'delete'` |
| performed_by | INT FK → users.id | |
| performed_at | TIMESTAMPTZ | |
| details | TEXT | free-form description |

### Auto-DDL Pattern

Many controllers run `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` or `CREATE TABLE IF NOT EXISTS` on first request. This avoids migration files for incremental column additions during development. For production, prefer proper migration tooling.

---

## 7. Layer 2 — Backend API (Express + TypeScript)

### App Bootstrap (`src/app.ts`)

Middleware stack applied in order:

1. `helmet` — security headers (COOP/COEP, XSS, etc.)
2. CORS — origin whitelist from env vars, `credentials: true`
3. `express.json({ limit: '10kb' })` — JSON body parsing
4. **Public routes** — `GET /api/v1/health`, all `/api/v1/auth/*`
5. `authMiddleware` — JWT verification; attaches `req.user = { sub, role }` on all subsequent routes
6. `apiLimiter` — global request cap per IP
7. `writeLimiter` — cap on POST/PUT/PATCH/DELETE
8. `deleteLimiter` — extra cap on DELETE
9. All domain routers mounted
10. 404 handler
11. Global error handler (never leaks stack traces to clients)

### Middleware

#### `middlewares/auth.ts` — `authMiddleware`
- Reads `Authorization: Bearer <token>` header
- Verifies with `jsonwebtoken.verify(token, JWT_SECRET)`
- Rejects with 401 if missing, invalid, or expired
- Sets `req.user = { sub: userId, role: userRole }` for downstream handlers

#### `middlewares/rateLimits.ts`
| Limiter | Scope | Window | Max requests |
|---|---|---|---|
| `apiLimiter` | All authenticated routes | 15 min | 300 |
| `writeLimiter` | POST / PUT / PATCH / DELETE | 15 min | 60 |
| `deleteLimiter` | DELETE only | 15 min | 20 |
| `exportLimiter` | CSV export endpoints | 15 min | 10 |

### Routes & Controllers

#### Auth — `/api/v1/auth`

| Method | Path | Function | Auth | Notes |
|---|---|---|---|---|
| POST | `/register` | `register` | public | Creates user, sends verification email via SendGrid |
| POST | `/verify` | `verify` | public | Verifies email token |
| POST | `/login` | `login` | public | Returns JWT on success |
| GET | `/me` | `me` | ✅ | Returns current user profile |
| GET | `/employees` | `listEmployees` | ✅ | Lists all users (for dropdowns) |
| POST | `/admin/users/:id/approve` | `adminApprove` | ✅ admin | Approves/rejects new user |
| PATCH | `/admin/users/:id/role` | `adminChangeRole` | ✅ admin | Changes user role |

Also aliased: `GET /api/v1/employees` → `listEmployees`

---

#### Leads — `/api/v1/leads`

| Method | Path | Function | Notes |
|---|---|---|---|
| GET | `/export/csv` | `exportLeadsCSV` | exportLimiter |
| POST | `/` | `createLead` | writeLimiter; auto-generates `cust_code` |
| GET | `/` | `listLeads` | supports `?q=`, `?startDate=`, `?endDate=`, pagination |
| PUT | `/:id` | `updateLead` | |
| DELETE | `/:id` | `deleteLead` | deleteLimiter |

**`createLead`**: validates `cust_name` (required), `phone_no` (optional), `phone_no_2`, `lead_type` (enum), `connect_date`, `location`. Generates `cust_code` as `C-<6-char-base36-timestamp>`. Runs `ensureLeadsCols()` (ALTER TABLE safety).

**`listLeads`**: builds dynamic WHERE — supports full-text search across `cust_name`, `cust_code`, `phone_no`, `location`, `business`. Date range filtering on `connect_date`.

---

#### Visits — `/api/v1/visits`

| Method | Path | Function | Notes |
|---|---|---|---|
| GET | `/report/export/csv` | `exportVisibleVisitsCSV` | exportLimiter; status allow-list filtered |
| GET | `/report` | `listVisibleVisits` | status allow-list filtered (no Lost/Booking/etc.) |
| GET | `/overdue` | `listOverdueVisits` | next_action_date < today, active statuses only |
| GET | `/export/csv` | `exportVisitsCSV` | exportLimiter; ALL statuses (admin use) |
| POST | `/` | `createVisit` | requires valid `lead_id` |
| GET | `/` | `listVisits` | ALL statuses, paginated |
| PUT | `/:id` | `updateVisit` | |
| DELETE | `/:id` | `deleteVisit` | deleteLimiter |

**Visible status filter** (used in `listVisibleVisits` and `exportVisibleVisitsCSV`):
```sql
WHERE v.status IS NULL OR v.status IN (
  'New Lead', 'Attempted Contact', 'Connected', 'Requirement Identified',
  'Qualified Lead', 'Demo Scheduled', 'Demo Completed', 'Quotation Shared',
  'Demo Follow Up', 'Follow-Up 2', 'Negotiation', 'Booking Date Confirmed'
)
```
Statuses like `Lost – Price Issue`, `Loan Processing`, `Booking Amount Received`, `Order Confirmed`, `Delivery Scheduled`, `Delivered (Closed – Won)` are **never** returned by the report endpoint.

**`createVisit`**: fetches `cust_code` and `lead_type` from leads table to denormalize into visits. Runs `ensureVisitsCols()`.

---

#### Tasks — `/api/v1/tasks`

| Method | Path | Function | Notes |
|---|---|---|---|
| GET | `/today` | `getTodayTask` | returns 204 if none exists today |
| GET | `/` | `listTasks` | admins see all; employees see own |
| POST | `/` | `createTask` | upsert: updates today's task if one already exists |
| PATCH | `/:id` | `updateTask` | owner or admin only; resets approval to Pending |
| PATCH | `/:id/approval` | `approveTask` | admin only; sets Approved/Rejected/Pending |
| GET | `/:id/history` | `getTaskHistory` | returns `task_edits` rows |

---

#### Attendance — `/api/v1/attendance`

| Method | Path | Function | Notes |
|---|---|---|---|
| POST | `/clockin` | `clockIn` | records clock-in timestamp |
| POST | `/clockout` | `clockOut` | records clock-out |
| GET | `/current` | `currentAttendance` | today's record for current user |
| GET | `/stats` | `attendanceStats` | aggregated stats |
| GET | `/` | `listAttendance` | paginated list |
| GET | `/:id` | `getAttendance` | single record |
| POST | `/admin/:id/approve` | `adminApproveAttendance` | admin only |

---

#### Opportunities — `/api/v1/opportunities`

| Method | Path | Function | Notes |
|---|---|---|---|
| GET | `/` | `listOpportunities` | supports `?q=`, `?source=salesforce\|non-salesforce`, pagination |
| GET | `/:id` | `getOpportunity` | single record |
| PATCH | `/:id` | `updateOpportunity` | admin only; validates against `ALLOWED_FIELDS` |

**`ALLOWED_FIELDS`** for opportunity updates: `sl_no`, `opportunity_name`, `phone_no`, `stage`, `next_connect`, `last_connect`, `month_of_reconnect`, `stage_remark`, `connected_person`, `probability`, `business_payload`, `use_range`, `customer_own_vehicle`, `customer_location`, `vehicle_suggested_action`, `distributor_manufacturer`, `source`.

---

#### Vehicles — `/api/v1/vehicles`

| Method | Path | Function | Notes |
|---|---|---|---|
| GET | `/dashboard` | `serviceDashboard` | aggregated service status |
| GET | `/export/csv` | `exportVehiclesCSV` | exportLimiter |
| GET | `/` | `listVehicles` | |
| POST | `/import` | `importVehicles` | bulk import |
| POST | `/` | `createVehicle` | |
| GET | `/:id/services` | `listServicesForVehicle` | |
| PUT | `/:id/services/:svcId` | `upsertService` | creates or updates a service record |
| PATCH | `/:id/current-km` | `patchCurrentKm` | update odometer only |
| PUT | `/:id` | `updateVehicle` | |
| DELETE | `/:id` | `deleteVehicle` | deleteLimiter |

---

#### Other endpoints

| Method | Path | Controller | Notes |
|---|---|---|---|
| GET | `/api/v1/sales/by-employee` | `salesByEmployee` | aggregated visit counts |
| GET | `/api/v1/activity-log` | `listActivityLog` | `?entity_type=&entity_id=` |
| GET | `/api/v1/activity/activity` | `getActivity` | |
| GET | `/api/v1/health` | inline | public health check, returns `{ status: 'ok' }` |

---

### Utils

#### `utils/validate.ts`
Central validation/sanitization module. Key exports:

| Export | Purpose |
|---|---|
| `reqId(val)` | Parses required integer ID; returns `{ value, error }` |
| `optId(val)` | Parses optional integer ID |
| `reqStr(val, max)` | Required string, max length, strips HTML |
| `optStr(val, max)` | Optional string, max length, strips HTML |
| `reqEmail(val)` | Required email with format validation |
| `optPhone(val)` | Optional phone — Indian mobile regex `/^[6-9]\d{9}$/` |
| `optDate(val)` | Optional ISO date string |
| `optEnum(val, list)` | Optional value constrained to an enum array |
| `sanitizeSearch(val)` | Strips SQL-dangerous characters from search queries |
| `parsePagination(limit, offset, max?)` | Returns safe `{ limit, offset }` with defaults |
| `collectErrors(fields)` | Merges field error map into a single error string |
| `VISIT_STATUSES` | Full enum of all valid visit statuses |
| `LEAD_TYPES` | `['Digital Lead', 'Non Digital Lead']` |
| `TASK_STATUSES` | `['Just Assigned', 'Under Process', 'Completed']` |
| `APPROVAL_STATUSES` | `['Pending', 'Approved', 'Rejected']` |

#### `utils/activityLog.ts`
| Export | Purpose |
|---|---|
| `ensureActivityLog()` | Creates `activity_log` table if not exists (run once) |
| `logActivity(entity_type, entity_id, entity_code, action, performed_by, details)` | Inserts a row into `activity_log` |

Called by `visitsController` on every create/update/delete to maintain a full audit trail per visit.

---

## 8. Layer 3 — Frontend (Next.js + React)

### API Base URL Resolution

Every page resolves `API_BASE` the same way:
```typescript
const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')
).replace(/\/api\/v1\/?$/, '');
// Usage: fetch(`${API_BASE}/api/v1/visits/report`)
```

### Token Management
```typescript
// All pages use:
const token = localStorage.getItem('auth_token') || '';
headers['Authorization'] = `Bearer ${token}`;
```

### Pages

#### `/` — Dashboard (`app/page.tsx`)
Main shell — renders the `SalesPerformance` section component inside the layout (Header + Sidebar).

---

#### `/login` — Login (`app/login/page.tsx`)
Public page. POST to `/api/v1/auth/login`, stores returned JWT in `localStorage` as `auth_token`.

---

#### `/auth` — Auth/Register (`app/auth/page.tsx`)
Public page for email verification or alternate auth flow.

---

#### `/sales/create-lead-report` — Create Lead
**Key features:**
- Form fields: Customer Name, Phone 1 (required, Indian regex), Phone 2 (optional), Business, Lead Type, Connect Date, Location
- **Location autocomplete**: fetches from `https://nominatim.openstreetmap.org/search` filtered to `address.state === 'West Bengal'`
- POST to `/api/v1/leads`
- Inline list of recent leads with edit/delete functionality
- PUT `/:id` for edits, DELETE `/:id` for removal

---

#### `/sales/lead-report` — View Lead Report
**Key features:**
- Fetches all leads from `GET /api/v1/leads?limit=500`
- Client-side search (name, code, phone, location), date range filter
- Sortable columns
- **CSV export**: client-side generation from the filtered `leads` array — never calls backend for export
- Preview modal showing all lead fields + activity history

---

#### `/sales/create-visit-report` — Create Visit Report
**Key features:**
- Full status/next-action selector with `SearchableSelect` (complete `STATUSES` list including post-booking stages)
- Customer lookup via `GET /api/v1/leads` (searchable)
- Salesperson dropdown from `GET /api/v1/employees`
- Phone fields auto-populated from selected lead, editable
- POST to `/api/v1/visits`, PUT `/:id` for edits, DELETE `/:id`
- **`STATUSES` array** (complete, includes restricted stages for input):
  `New Lead`, `Demo Scheduled`, `Demo Completed`, `Quotation Shared`, `Demo Follow Up`, `Follow-Up 2`, `Negotiation`, **`Booking Date Confirmed`**, `Loan Processing`, `Booking Amount Received`, `Order Confirmed`, `Delivery Scheduled`, `Delivered (Closed – Won)`, `Lost – Price Issue`, `Lost – Competitor`, `Lost – No Response`, `Lost – Not Interested`

---

#### `/sales/visit-report` — View Visit Report
**Key features:**
- Fetches from `GET /api/v1/visits/report` — **pre-filtered by backend** (only visible pipeline stages)
- Client-side filters: search (name/code/salesperson/vehicle), status dropdown (visible stages only), date from/to
- Sortable columns: visit date, status, customer name, salesperson
- Stats bar: Total, Connected, Demos, Won
- **CSV export**: calls `GET /api/v1/visits/report/export/csv`, then client-side post-filters the returned CSV rows to strip any status not in the `STATUSES` allow-list before triggering download — double-filtering for safety
- Preview modal with full details + audit pills + activity history timeline
- **`STATUSES` array** (visible only — restricted stages excluded):
  `New Lead`, `Attempted Contact`, `Connected`, `Requirement Identified`, `Qualified Lead`, `Demo Scheduled`, `Demo Completed`, `Quotation Shared`, `Demo Follow Up`, `Follow-Up 2`, `Negotiation`, `Booking Date Confirmed`

---

#### `/task-manager` — Employee Task Manager
**Key features:**
- One task per day (today's task auto-loaded from `GET /api/v1/tasks/today`)
- Creates/updates via POST `/api/v1/tasks` (upsert on server)
- Status dropdown: `Just Assigned`, `Under Process`, `Completed` via PATCH
- Approval badge display (Pending/Approved/Rejected) + approver name
- Edit history from `GET /api/v1/tasks/:id/history`

---

#### `/admin/task-manager` — Admin Task Approval
**Key features:**
- Fetches all employee tasks from `GET /api/v1/tasks`
- Filter by employee, date, approval status
- Approve / Reject / Reset actions via `PATCH /api/v1/tasks/:id/approval`
- History modal per task

---

#### `/attendance` — Employee Attendance
**Key features:**
- Clock in/out via POST `/api/v1/attendance/clockin` and `/clockout`
- Shows today's record from `GET /api/v1/attendance/current`

---

#### `/admin/attendance` — Admin Attendance
**Key features:**
- Full attendance list `GET /api/v1/attendance`
- Admin approval via POST `/api/v1/attendance/admin/:id/approve`

---

#### `/service-manager` — Service Dashboard
**Key features:**
- Vehicle overview from `GET /api/v1/vehicles/dashboard`
- Links to vehicle list

#### `/service-manager/vehicles` — Vehicle List
**Key features:**
- Full CRUD for vehicles
- Service record upsert per vehicle
- CSV export and bulk import
- Odometer update via PATCH

---

#### `/vehicle-videos` — Vehicle Videos
YouTube video gallery (uses `NEXT_PUBLIC_YOUTUBE_API_KEY`).

---

### Components

#### Layout
| Component | File | Purpose |
|---|---|---|
| `Sidebar` | `components/Sidebar.tsx` | Navigation sidebar with role-aware links |
| `Header` | `components/Header.tsx` | Top bar with user info and logout |
| `AuthGuard` | `app/AuthGuard.tsx` | Wraps pages; redirects to `/login` if no token |
| `theme-provider` | `components/theme-provider.tsx` | next-themes dark/light mode provider |

#### Reusable UI
| Component | File | Purpose |
|---|---|---|
| `SearchableSelect` | `components/SearchableSelect.tsx` | Searchable dropdown — keyboard navigable, accepts string or `{value, label}` options; used in all forms |
| `StatCard` | `components/StatCard.tsx` | KPI card with label + value |
| `ChartCard` | `components/ChartCard.tsx` | Wrapper card for recharts charts |
| `RecentActivityCard` | `components/RecentActivityCard.tsx` | Recent activity list widget |

#### Sections (used in Dashboard)
| Component | File | Purpose |
|---|---|---|
| `SalesPerformance` | `components/sections/SalesPerformance.tsx` | Full dashboard: KPI cards, bar/pie charts, recent leads table, recent visits table |
| `DashboardOverview` | `components/sections/DashboardOverview.tsx` | Overview stats |
| `Analytics` | `components/sections/Analytics.tsx` | Analytics charts |
| `EmployeeManagement` | `components/sections/EmployeeManagement.tsx` | Employee list |
| `PayrollSection` | `components/sections/PayrollSection.tsx` | Payroll view |

#### API Client (`src/api/`)
| File | Exports | Purpose |
|---|---|---|
| `client.ts` | `API_BASE`, `getToken`, `get`, `post`, `patch` | Shared fetch helpers with auth headers |
| `users.ts` | `login(email, password)`, `getProfile()` | Auth API calls |

#### UI Primitives (`components/ui/`)
Full shadcn/ui set: accordion, alert, avatar, badge, button, calendar, card, carousel, chart, checkbox, collapsible, command, dialog, drawer, dropdown-menu, form, input, label, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip.

---

## 9. Data Flow — End to End

### Example: Creating a Visit Report

```
1. User fills form on /sales/create-visit-report
   └─ SearchableSelect loads customers from GET /api/v1/leads
   └─ SearchableSelect loads salespersons from GET /api/v1/employees

2. User submits form
   └─ Frontend: POST /api/v1/visits
      Headers: { Authorization: Bearer <token>, Content-Type: application/json }
      Body: { lead_id, salesperson_id, vehicle, status, visit_date,
              next_action, next_action_date, note, phone_no, phone_no_2 }

3. Express: authMiddleware verifies JWT → sets req.user
   Express: writeLimiter checks POST budget

4. visitsController.createVisit:
   └─ Validates all fields via utils/validate.ts
   └─ Queries leads table for cust_code, lead_type, connect_date
   └─ Inserts into visits table (denormalizing lead info)
   └─ Calls logActivity('visit', id, cust_code, 'create', userId, ...)
   └─ Returns 201 + new visit row

5. Frontend receives 201, refreshes visit list
```

### Example: Exporting Visit Report CSV

```
1. User clicks "↓ Export CSV" on /sales/visit-report

2. Frontend: exportCSV()
   └─ GET /api/v1/visits/report/export/csv (with Bearer token)

3. Backend: exportVisibleVisitsCSV
   └─ SQL with status IN (...allowed list...) WHERE clause
   └─ Returns CSV text (header + data rows)

4. Frontend receives CSV text
   └─ Parses header to find 'status' column index
   └─ Filters rows: keeps only rows where status ∈ STATUSES allow-list
   └─ Creates Blob, triggers download
   (Double-filter: backend SQL filter + client-side row filter)
```

---

## 10. Authentication & Authorization

### Registration Flow
1. User POSTs to `/api/v1/auth/register` with name, email, password
2. Password is hashed with `bcrypt` (salt rounds: 10)
3. Account is created with `is_approved = false`
4. Verification email sent via SendGrid
5. Admin must call `/api/v1/auth/admin/users/:id/approve` to activate

### Login Flow
1. User POSTs email + password to `/api/v1/auth/login`
2. bcrypt compare against stored hash
3. If approved and password matches: `jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: '7d' })`
4. Token returned; frontend stores in `localStorage` as `auth_token`

### Per-Request Auth
- `authMiddleware` reads `Authorization: Bearer <token>`, calls `jwt.verify`
- On success: `req.user = { sub: number, role: 'admin' | 'employee' }`
- Controllers check `req.user.role === 'admin'` for protected operations

### Role Capabilities
| Action | Employee | Admin |
|---|---|---|
| Create/read leads | ✅ | ✅ |
| Delete leads | ✅ | ✅ |
| Create/read visits | ✅ | ✅ |
| Delete visits | ✅ | ✅ |
| Create/update own tasks | ✅ | ✅ |
| Approve tasks | ❌ | ✅ |
| Approve attendance | ❌ | ✅ |
| Update opportunities | ❌ | ✅ |
| Change user roles | ❌ | ✅ |
| Approve new users | ❌ | ✅ |

---

## 11. Status & Enum System

The visit pipeline has two lists — one for **input** (creating/editing), one for **display** (report view):

### Full `VISIT_STATUSES` (backend `validate.ts`) — used for DB validation on write
```
New Lead, Demo Scheduled, Demo Completed, Quotation Shared,
Demo Follow Up, Follow-Up 2, Negotiation, Booking Date Confirmed,
Loan Processing, Booking Amount Received, Order Confirmed,
Delivery Scheduled, Delivered (Closed – Won),
Lost – Price Issue, Lost – Competitor, Lost – No Response, Lost – Not Interested
```

### Visible `STATUSES` (frontend `visit-report/page.tsx`) — report view & CSV
```
New Lead, Attempted Contact, Connected, Requirement Identified,
Qualified Lead, Demo Scheduled, Demo Completed, Quotation Shared,
Demo Follow Up, Follow-Up 2, Negotiation, Booking Date Confirmed
```

### Restricted statuses (never shown in Visit Report or CSV)
```
Lost – Price Issue, Lost – Competitor, Lost – No Response, Lost – Not Interested,
Loan Processing, Booking Amount Received, Order Confirmed,
Delivery Scheduled, Delivered (Closed – Won)
```

> **To add a new visible status:** add it to `VISIT_STATUSES` in `backend/src/utils/validate.ts`, to the `IN (...)` lists in both `listVisibleVisits` and `exportVisibleVisitsCSV` in `visitsController.ts`, to the `STATUSES` array in `visit-report/page.tsx`, and to the `STATUSES` array in `create-visit-report/page.tsx`. Also add a badge style in `SalesPerformance.tsx` if needed.

---

## 12. Rate Limiting & Security

### Rate Limiters (per IP)
```
apiLimiter:    300 req / 15 min  →  all authenticated routes
writeLimiter:   60 req / 15 min  →  POST, PUT, PATCH, DELETE
deleteLimiter:  20 req / 15 min  →  DELETE only
exportLimiter:  10 req / 15 min  →  CSV export endpoints
```

### Security Headers (helmet)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security` (HSTS)
- `X-XSS-Protection`
- `crossOriginEmbedderPolicy: false` (for Render/Vercel embedding)

### Additional Protections
- All DB queries use parameterized `$1, $2...` placeholders (no SQL injection)
- JSON body limited to `10kb`
- `sanitizeSearch()` strips dangerous characters from search params
- `optStr()` strips HTML tags from all text input
- CORS whitelist — only known origins in production
- In production, requests with no `Origin` header are rejected

---

## 13. CSV Export System

### Leads CSV (`GET /api/v1/leads/export/csv`)
- Backend generates CSV from full leads table
- No status filtering needed (leads don't have pipeline status)

### Visits CSV (`GET /api/v1/visits/export/csv`)
- Backend export with **no status filter** — returns ALL statuses
- Intended for admin/internal use only

### Visit Report CSV (`GET /api/v1/visits/report/export/csv`)
- Backend SQL filters to visible status IN list
- **Frontend additionally re-filters** returned CSV rows client-side:
  1. Parses CSV header to find `status` column index dynamically
  2. Drops any row where `status` is not in the `STATUSES` allow-list (case-insensitive)
  3. Triggers download with clean data
- This double-filter ensures correctness even if backend deployment lags

### Vehicles CSV (`GET /api/v1/vehicles/export/csv`)
- Full vehicle list, no filtering

---

## 14. Architecture & Design Patterns

### Separation of Concerns
```
Routes (HTTP wiring)
  └─ Controllers (business logic + DB)
       └─ db/index.ts (connection pool)
            └─ PostgreSQL
```

### Stateless Controllers
Each controller function is a pure Express request handler. No shared mutable state between requests. Auto-migration helpers use a module-level boolean flag (`visitsColsReady`, etc.) to avoid repeated ALTER TABLE calls within a process lifetime.

### Denormalization for Performance
`visits` stores `lead_cust_code`, `lead_type`, `connect_date` copied from `leads` at insert time. This avoids repeated joins in reporting queries and preserves historical data even if the lead changes.

### Audit Trail
Every visit mutation (create/update/delete) calls `logActivity()`, which writes to `activity_log`. The visit preview modal fetches this log via `GET /api/v1/activity-log?entity_type=visit&entity_id=<id>` and renders a timeline.

### Upsert Pattern (Tasks)
`createTask` checks for an existing record (`SELECT ... WHERE user_id=$1 AND task_date=CURRENT_DATE`). If found, it UPDATEs and records a diff in `task_edits`. This enforces the one-task-per-day business rule at the application layer (backed by a DB UNIQUE constraint).

### Client-side Filtering on Top of Server Data
The Visit Report page fetches server-filtered data, then applies further client-side filters (search text, status dropdown, date range). The CSV export replicates this by applying the same allow-list filter on the server's response.

### Auto-DDL Pattern
Controllers call `ensureVisitsCols()` / `ensureLeadsCols()` / `ensureTables()` on first request. These run `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS`. Idempotent and safe, but not a substitute for production migration tooling.

---

## 15. Deployment

### Production Architecture
```
Browser
  └─ HTTPS → Vercel (Voltmate- Next.js app)
                └─ fetch API_BASE → Render (backend Express app)
                                        └─ TCP → PostgreSQL (Neon / Supabase / Render Postgres)
```

### Environment Setup Checklist
- [ ] `JWT_SECRET` — strong random secret (min 32 chars)
- [ ] `DATABASE_URL` — production Postgres connection string
- [ ] `ALLOWED_ORIGIN` — set to `https://voltwheelsind.com`
- [ ] `ALLOWED_ORIGINS` — any additional frontend origins
- [ ] `SENDGRID_API_KEY` + `SENDGRID_FROM` — for email verification
- [ ] `NEXT_PUBLIC_API_URL` — set to `https://voltmate.onrender.com`
- [ ] `NODE_ENV=production`

### Build Commands
```bash
# Frontend (Vercel — set as build command)
cd Voltmate- && npm run build

# Backend (Render — set as start command)
cd backend && npm run build && node dist/index.js
```

### CORS in Production
The backend auto-includes `voltwheelsind.com` and `voltwheelsin.com` (+ `www.` variants) whenever either domain appears in `ALLOWED_ORIGIN` or `ALLOWED_ORIGINS`. No extra config needed for these domains.

---

## 16. Maintenance & Scripts

### Add New Visit Status
1. `backend/src/utils/validate.ts` — add to `VISIT_STATUSES`
2. `backend/src/controllers/visitsController.ts` — add to `IN (...)` in `listVisibleVisits` and `exportVisibleVisitsCSV` (if it should be visible)
3. `Voltmate-/app/sales/visit-report/page.tsx` — add to `STATUSES`
4. `Voltmate-/app/sales/create-visit-report/page.tsx` — add to `STATUSES`
5. `Voltmate-/components/sections/SalesPerformance.tsx` — add badge style to `STATUS_BADGE`

### Clear Test Data
```bash
cd backend
npx ts-node scripts/clear-test-data.ts
# Wraps deletes in a transaction; safe to re-run
```

### Add New DB Column
Use the auto-DDL pattern or write a proper migration:
```sql
-- backend/migrations/XXXX_add_column.sql
ALTER TABLE visits ADD COLUMN IF NOT EXISTS new_field TEXT;
```

### Database Backup
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

---

## 17. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 Unauthorized` on all requests | Token missing or expired | Re-login; check `localStorage.auth_token` |
| `403 Forbidden` on admin action | User role is `employee` | Set role to `admin` in `users` table |
| CORS error in browser | Origin not in whitelist | Add origin to `ALLOWED_ORIGINS` env var |
| CSV contains restricted statuses | Backend deployment lagging | Client-side re-filter is the safety net; redeploy backend |
| `500 Internal Server Error` | DB query error | Check Render/backend logs; verify `DATABASE_URL` |
| Visit report shows 0 rows | All visits have filtered statuses | Check status values in DB against allowed IN list |
| `CORS: missing Origin header` | Direct curl in production | Only browser requests from allowed origins work |
| Rate limit `429 Too Many Requests` | Exceeded per-IP budget | Wait 15 minutes or increase limits in `rateLimits.ts` |
| Auto-migration fails silently | DB user lacks ALTER permission | Grant `ALTER TABLE` permission to DB user |

### Common Commands
```bash
# Start frontend dev
cd Voltmate- && npm run dev

# Start backend dev
cd backend && npm run dev

# Inspect DB
psql $DATABASE_URL

# Check backend logs (Render)
# Go to: Render dashboard → voltmate → Logs

# Force-redeploy backend (Render)
# Go to: Render dashboard → voltmate → Manual Deploy
```
