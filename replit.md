# Stayflow — PG / Hostel Management

A comprehensive admin tool for managing Paying Guest (PG) properties and hostels: rooms, beds, tenants, monthly rent, and complaints.

## Stack

- pnpm monorepo
- Frontend: React + Vite + Tailwind v4 + shadcn/ui + wouter + TanStack Query + Recharts
- Backend: Express + Drizzle ORM + PostgreSQL
- API contract: OpenAPI → generated TanStack Query hooks (`@workspace/api-client-react`) and Zod validators (`@workspace/api-zod`)

## Artifacts

- `pg-manager` — admin UI (web, served at `/`)
- `api-server` — Express API at `/api`
- `mockup-sandbox` — design preview server (template default)

## Domain modules

1. **Dashboard** — KPIs, occupancy trend (area chart), revenue breakdown (stacked bar), recent activity feed
2. **Properties** — list cards with capacity stats; create dialog
3. **Rooms & Beds** — visual bed grid per room; click bed to assign / release a tenant
4. **Tenants** — profile cards with KYC, contact, current bed; create dialog
5. **Payments** — invoice table with status filters, "Mark paid" select, "Generate monthly" action
6. **Complaints** — kanban-style columns (open / in_progress / resolved) with priority and inline status update

## Database schema (`lib/db/src/schema/`)

`properties`, `rooms`, `beds`, `tenants`, `payments`, `complaints` — all foreign keys cascade appropriately. Beds carry the optional `tenantId` and `isOccupied` flag.

## Key files

- `lib/api-spec/openapi.yaml` — single source of truth for the API
- `artifacts/api-server/src/routes/*.ts` — Express handlers, all aggregates computed in SQL
- `artifacts/pg-manager/src/pages/*.tsx` — page components
- `artifacts/pg-manager/src/components/Layout.tsx` — sidebar shell
- `scripts/src/seed.ts` — demo seed (run with `pnpm --filter @workspace/scripts seed`)

## Conventions

- Currency rendered in INR (`Intl.NumberFormat en-IN`)
- No emojis anywhere in the UI
- Date columns are stored as `date` (string `YYYY-MM-DD`); date inputs converted server-side via `dateToStr` helper
- Theme: warm slate background + emerald primary + orange accent
