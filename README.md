# VoltWheels EMS — Cleaned Backend & Frontend Structure

This repository reorganizes the backend and frontend into clear, maintainable folders.

Backend
- Location: `backend/`
- Run locally:
  - copy `.env.example` to `backend/.env` and set `DATABASE_URL` and `JWT_SECRET`
  - cd backend && npm install
  - npm run migrate
  - npm run seed
  - npm run dev

Frontend
- Location: (existing frontend folders) — add `NEXT_PUBLIC_API_URL` in your frontend `.env.local` to point to the backend API.

Migration & Seeding
- Migrations are in `backend/migrations/` and can be applied with `node backend/scripts/migrate.js`
- Seed admin user via `node backend/scripts/seed-admin.js`

