# Voltwheels EMS — Project Documentation

Last updated: 2026-02-23

This document explains how to execute the project, the overall workflow, per-file/function responsibilities, the architectural and OOP decisions made, and networking/DBMS concepts used while building the Voltwheels EMS application.

---

## Table of contents
- Overview
- Repository layout
- How to run (development & production)
- Major components and workflow (frontend ↔ backend)
- Function-by-function summary (high-signal controllers & components)
- OOP / architecture patterns used
- Networking concepts (APIs, auth, external services)
- Database design & DBMS concepts
- Deployment & production checklist
- Maintenance tasks (data cleanup script, migrations)
- Troubleshooting & common commands

---

## Overview

Voltwheels EMS is a full-stack web application built with:
- Frontend: Next.js (React), Tailwind-style inline CSS in places and custom CSS strings
- Backend: Node.js + Express
- Database: PostgreSQL (accessed via `pg` Pool)
- Charts: `recharts` (client-side)
- Authentication: JWT tokens stored in localStorage, sent as `Authorization: Bearer <token>`
- External services: Nominatim (OpenStreetMap) for location autocomplete (no API key)

The app provides modules for Leads, Visits, Attendance, Tasks, Sales analytics, and Admin tools (including an Admin Task Manager).

---

## Repository layout (important paths)

- `/Voltmate-/` — Next.js frontend
  - `app/` — Next.js pages and client components
    - `sales/` — lead/visit pages and forms
    - `task-manager/` — employee task manager
    - `admin/task-manager/` — admin approval UI
    - `attendance/`, `admin/attendance/` — attendance pages
  - `components/` — reusable UI components (Sidebar, Header, ChartCard, SearchableSelect)
  - `public/` — static assets (logo, favicon)

- `/backend/` — Express API server
  - `src/controllers/` — business logic (leadsController, visitsController, tasksController, etc.)
  - `src/routes/` — route definitions (leads, visits, tasks, auth, attendance)
  - `src/db/` — Postgres pool wrapper (`index.ts`)
  - `scripts/` — maintenance scripts (clear-test-data.ts)
  - `.env` files for environment variables

---

## How to run

Prerequisites:
- Node 18+ (or LTS)
- PostgreSQL accessible via `DATABASE_URL`
- Yarn or npm

Frontend (development)
1. cd `Voltmate-`
2. npm install
3. Copy `.env.example` to `.env.local` if needed (for NEXT_PUBLIC_API_URL)
4. npm run dev

Backend (development)
1. cd `backend`
2. npm install
3. Create `.env` with `DATABASE_URL`, `JWT_SECRET`, etc. (see `.env.example`)
4. npm run dev (or `npx ts-node src/index.ts`)

Running the one-time cleanup (example)
1. cd `backend`
2. Ensure `DATABASE_URL` points to the environment you want to clear
3. npx ts-node scripts/clear-test-data.ts

Production
- Build the Next.js app and deploy to your hosting provider. Backend should be deployed behind TLS with proper env variables, connection pooling, and secure DB access.

---

## Major components and end-to-end workflow

User (browser) ↔ Next.js frontend:
- UI components call internal client APIs (fetch to `/api/v1/...` endpoints).
- Client adds Authorization header: `Bearer <token>` stored in localStorage.
- Frontend uses reusable components (StatCard, ChartCard, SearchableSelect) for consistent UI, and `SearchableSelect` provides searchable dropdowns for long lists.

Next.js frontend ↔ Express backend:
- Frontend requests hit controllers via Express routes (e.g., `/api/v1/leads`, `/api/v1/visits`, `/api/v1/tasks`).
- Controllers perform validations and call `query(...)` (Postgres pool) to read/write data.
- Responses are JSON; status codes used for control flow (201 created, 204 no content, 400 bad request, 403 forbidden).

Backend ↔ Database:
- Controllers may auto-create tables/columns on first use (basic auto-migration pattern).
- SQL uses parameterized queries to avoid SQL injection: `query(sql, params)`.
- Patterns used: `LEFT JOIN` to fetch related user info, `UNIQUE` constraints for single-entry-per-day (tasks), and transactional delete operations in scripts.

---

## Function-by-function (high-signal) explanations

NOTE: This section covers the main controllers and components you will probably modify or inspect before production.

### Backend controllers

- `backend/src/controllers/leadsController.ts`
  - createLead(req, res)
    - Ensures additional columns exist (auto ALTER TABLE IF NOT EXISTS).
    - Validates required fields (cust_name).
    - Generates `cust_code` server-side using timestamp & random suffix.
    - Inserts record including `phone_no_2` and `location`.
    - Returns the inserted row.
  - listLeads(req, res)
    - Builds WHERE clauses dynamically based on q (search), startDate, endDate.
    - Supports searching `location` and `phone_no`.
    - Returns JSON with leads array and pagination info.
  - exportLeadsCSV(req, res)
    - Selects important lead fields, composes CSV, streams it back.

  OOP / design note: controller functions are stateless request handlers; the file groups related functions together. The auto-migration helper (`ensureLeadsCols`) is a simple module-level stateful helper to avoid unnecessary repeated ALTERs.

- `backend/src/controllers/visitsController.ts`
  - createVisit(req, res)
    - Validates `lead_id` exists, fetches `cust_code` for denormalized storage.
    - Stores visits with optional `phone_no` and `phone_no_2`.
  - listVisits(req, res)
    - Returns visits joined with lead and salesperson names (LEFT JOIN).
  - exportVisitsCSV(req, res)
    - Similar CSV export logic as leads.

- `backend/src/controllers/tasksController.ts`
  - ensureTables()
    - On-first-use auto-creates `tasks` and `task_edits` tables and migrates columns.
  - getTodayTask(req, res)
    - Returns logged-in user's task for the current date (or 204 if none).
  - createTask(req, res)
    - Upsert behavior: If today's task exists, updates it and logs an edit to `task_edits`.
    - When an employee edits a task, resets `approval_status` to `Pending`.
  - updateTask(req, res)
    - Patch for description/status; only owner or admin may edit; edit history recorded.
  - approveTask(req, res)
    - Admin-only endpoint to set `approval_status` to Approved/Rejected/Pending; records the approver and timestamp.
  - listTasks(req, res)
    - Admins see all tasks with employee info; non-admins see own tasks only.
  - getTaskHistory(req, res)
    - Returns history rows from `task_edits`.

  Design note: tasksController implements audit logging for edits, a single-entry-per-user-per-day constraint, and an approval workflow for admin review.

### Frontend components

- `Voltmate-/components/SearchableSelect.tsx`
  - Reusable client component providing a button-styled trigger and a managed dropdown with:
    - Search input, keyboard navigation (ArrowUp/Down, Enter to select, Escape to close).
    - Accepts `options` (strings or {value,label}), `fieldClass` to inherit CSS.
    - Keeps behavior consistent across forms (create-visit, create-lead, filters).

- `Voltmate-/app/sales/create-visit-report/page.tsx`
  - Client page with modal for "Add Visit".
  - Uses `SearchableSelect` for Customer, Salesperson, Vehicle, Status, Next Action.
  - Validates phone numbers (Phone 1 required, Phone 2 optional) with a regex /^[6-9]\d{9}$/ for Indian mobile numbers.
  - Submits to `/api/v1/visits` (POST).

- `Voltmate-/app/sales/create-lead-report/page.tsx`
  - Client page for "Add Lead".
  - Adds `location` via Nominatim autocomplete (OpenStreetMap). The UI filters results to West Bengal using `address.state === 'West Bengal'`.
  - Adds `phone_no_2` optional field. Validations as above.
  - Submits to `/api/v1/leads`.

- `Voltmate-/app/task-manager/page.tsx`
  - Employee-facing task manager:
    - Enter one task per day; save/update resets approval to Pending.
    - Shows today's task and a history table.
    - Inline status dropdown updates server via patch.
    - Shows approval badge and reviewer if set.

- `Voltmate-/app/admin/task-manager/page.tsx`
  - Admin approval UI with full table, filters, Approve/Reject/Reset/History actions.
  - Calls `PATCH /api/v1/tasks/:id/approval` to update approval status.

---

## OOP & Architectural patterns used

Although this codebase is primarily functional (Express route handlers and React function components), several object-oriented and architectural best practices were applied:

- Separation of concerns:
  - Controllers (business logic) vs routes (HTTP wiring) vs db layer (query pool).
- Encapsulation:
  - Each controller file encapsulates related functions (e.g., leadsController manages only leads).
- Single-responsibility:
  - Components and controllers are narrowly focused (SearchableSelect only handles dropdown/search UI).
- Reusability:
  - Shared components (ChartCard, StatCard, SearchableSelect) are used across pages to keep UI consistent.
- Audit & immutability:
  - Edits are recorded in `task_edits` to keep an immutable history of changes — an approach aligned with event-sourcing ideas.
- Defensive programming:
  - Parameterized SQL queries, validation of inputs, role checks (admin vs non-admin).

Design tradeoffs:
- Auto-migrations (ALTER TABLE IF NOT EXISTS) are convenient for development but not suitable as a long-term production migration strategy. For production, use a proper migration tool (e.g., Flyway, Liquibase, or node-pg-migrate).

---

## Networking concepts used

- RESTful API design:
  - Resources follow `/api/v1/<resource>` patterns (leads, visits, tasks).
  - HTTP verbs: GET (read), POST (create), PATCH (partial update), DELETE (delete).
- Authentication:
  - JWT tokens are stored client-side and sent in the `Authorization` header.
  - Server has an `authMiddleware` that validates tokens and attaches `req.user` (sub, role).
- CORS & origin:
  - Backend uses environment variable ALLOWED_ORIGIN; in production, set this to frontend origin.
- External API integration:
  - Location autocomplete uses Nominatim (OpenStreetMap) via client-side fetch: `https://nominatim.openstreetmap.org/search?q=...&format=json&addressdetails=1`.
  - No API key is required, but usage must respect Nominatim usage policies (rate limits and fair use).
- Client-side network patterns:
  - `fetch` with proper headers, robust error handling, and optimistic UI where applicable (e.g., refresh after write).

Security notes:
- Always use HTTPS in production.
- Do not leak tokens in logs.
- Consider short-lived tokens with refresh tokens.

---

## Database design & DBMS concepts

Core tables (high-level):
- users — employee accounts (existing)
- leads — leads with cust_code, contact phones, business, location
- visits — visit/activity records, denormalized lead_cust_code
- attendance — attendance records joined with users
- tasks — daily task entries (unique per user per day) with approval metadata
- task_edits — audit log for edits to tasks

Key DBMS concepts used:
- Referential integrity:
  - `FOREIGN KEY` constraints (e.g., tasks.user_id → users.id)
- Uniqueness:
  - `UNIQUE (user_id, task_date)` enforces one task per employee per day
- Indices:
  - Rely on primary keys and foreign keys; add indexes on frequently searched columns (e.g., leads.cust_code, visits.visit_date) if needed.
- Transactions:
  - Cleanup script wraps deletes in a transaction (BEGIN / COMMIT / ROLLBACK) to ensure atomicity.
- Parameterized queries:
  - All DB queries use parameter binding to prevent SQL injection.
- Denormalization:
  - `visits` stores `lead_cust_code` to avoid joins in reporting queries and to keep historical snapshots.
- Auto-migrations:
  - Controllers execute `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` on first use — convenient for dev, but migrate to a proper tool for production.

Schema example (tasks):
```\n+CREATE TABLE tasks (\n+  id SERIAL PRIMARY KEY,\n+  user_id INTEGER NOT NULL REFERENCES users(id),\n+  task_date DATE NOT NULL,\n+  description TEXT NOT NULL,\n+  status VARCHAR(50) NOT NULL DEFAULT 'Just Assigned',\n+  approval_status VARCHAR(20) NOT NULL DEFAULT 'Pending',\n+  approved_by INTEGER REFERENCES users(id),\n+  approved_at TIMESTAMPTZ,\n+  created_at TIMESTAMPTZ DEFAULT now(),\n+  updated_at TIMESTAMPTZ DEFAULT now(),\n+  UNIQUE (user_id, task_date)\n+);\n+```\n+
---

## Deployment & production checklist

Before going live:
1. Replace any dev secrets: set `JWT_SECRET` to a strong value.
2. Ensure `DATABASE_URL` points to a production DB with backups and monitoring.
3. Swap auto-migrations to a managed migration process; test migrations in staging.
4. Use TLS (HTTPS) everywhere, and set `ALLOWED_ORIGIN` correctly.
5. Rate-limit or cache external API calls (e.g., Nominatim) if needed.
6. Remove or run any test-data cleanup scripts (we provided `scripts/clear-test-data.ts`).
7. Confirm logging, prometheus/metrics, and error reporting (Sentry) in place.
8. Set NODE_ENV=production and enable process manager (PM2 / systemd).

Commands:
- Build frontend: `npm run build` (in `Voltmate-`), start with `npm start`
- Backend start (production): `NODE_ENV=production node dist/index.js` or use your containerized image

---

## Maintenance tasks

- Clearing test data: `backend/scripts/clear-test-data.ts` (run with `npx ts-node`)
- Adding new vehicle variants: edit the `VEHICLES` array in `create-visit-report/page.tsx` (or move to a config table)
- Adding new statuses or categories: update constants in the respective pages and controllers
- Database migrations: export SQL changes to migration files and apply via a migration tool in CI/CD

---

## Troubleshooting & common commands

- Start frontend: (in `Voltmate-`) `npm install && npm run dev`
- Start backend: (in `backend`) `npm install && npm run dev`
- Lint check: run your project's lint command (if configured)
- Run cleanup script (one-time): `cd backend && npx ts-node scripts/clear-test-data.ts`
- Inspect DB: connect using `psql` or PgAdmin with `DATABASE_URL`

If you see permission/403 errors, ensure the token is present and the user's role (admin) is set correctly in the `users` table.

---

If you'd like, I can:
- Produce a shorter executive summary for non-technical stakeholders
- Convert this document into a README.md at the repo root
- Generate an ER diagram for the core tables
- Add step-by-step deployment commands for a specific cloud provider (AWS/GCP/Heroku)

Tell me which of the above you'd prefer next.

