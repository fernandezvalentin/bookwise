# Bookwise

**Multi-tenant appointment booking platform.** Businesses (barbershops, clinics, sports courts) publish their services and staff schedules; customers book available time slots online.

> 🚧 Work in progress. The project is built in stages; see the [roadmap](#roadmap).

## Tech stack

| Layer    | Technology                                                |
| -------- | --------------------------------------------------------- |
| API      | **NestJS 12** (TypeScript, ESM)                           |
| Database | **PostgreSQL 17** with **Prisma 7**                       |
| Queues   | **Redis** + **BullMQ** (reminders)                        |
| Web      | **Next.js 16** + Tailwind CSS 4                           |
| Testing  | **Vitest** + Supertest, e2e tests against a real Postgres |
| Tooling  | Docker Compose, oxlint, Prettier, GitHub Actions          |

## Project structure

```
bookwise/
├── apps/
│   └── api/                 NestJS REST API
│       ├── prisma/          Schema and migrations
│       ├── src/
│       │   ├── config/      Environment validation (Zod)
│       │   ├── health/      GET /health (liveness + database check)
│       │   └── prisma/      Prisma client as a Nest provider
│       └── test/            e2e tests
├── docker/                  Docker init scripts
├── docker-compose.yml       Postgres, Redis and Mailpit for local development
└── .github/workflows/       CI
```

## Getting started

Requirements: **Node.js 24+** and **Docker**.

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Start Postgres, Redis and Mailpit
npm run db:up

# 3. Create the API environment file
cp apps/api/.env.example apps/api/.env

# 4. Run the API in watch mode
npm run dev
```

The API runs at http://localhost:3001. Check it with:

```bash
curl http://localhost:3001/health
```

### Local services

| Service  | Address               | Notes                                                              |
| -------- | --------------------- | ------------------------------------------------------------------ |
| API      | http://localhost:3001 |                                                                    |
| Postgres | `localhost:5434`      | user/password `bookwise`, databases `bookwise` and `bookwise_test` |
| Redis    | `localhost:6379`      |                                                                    |
| Mailpit  | http://localhost:8025 | Inbox for every email sent locally                                 |

## Scripts

Run from the repository root:

| Command                     | What it does                                   |
| --------------------------- | ---------------------------------------------- |
| `npm run dev`               | API in watch mode                              |
| `npm run build`             | Production build                               |
| `npm run lint`              | oxlint (type-aware)                            |
| `npm run typecheck`         | TypeScript, no emit                            |
| `npm test`                  | Unit tests                                     |
| `npm run test:e2e`          | e2e tests against the `bookwise_test` database |
| `npm run format`            | Prettier                                       |
| `npm run db:up` / `db:down` | Start / stop the Docker services               |

## Roadmap

- [x] **Stage 0:** monorepo, Docker services, NestJS API with health check, Prisma, CI
- [ ] **Stage 1:** users and authentication (JWT access + rotating refresh tokens)
- [ ] **Stage 2:** businesses (multi-tenant), services, staff and working hours
- [ ] **Stage 3:** availability engine with time zones
- [ ] **Stage 4:** bookings without double booking (Postgres exclusion constraint)
- [ ] **Stage 5:** email reminders with BullMQ
- [ ] **Stage 6:** web: booking flow
- [ ] **Stage 7:** web: business dashboard
- [ ] **Stage 8:** deployment and public demo
- [ ] **Stage 9:** AI booking assistant
