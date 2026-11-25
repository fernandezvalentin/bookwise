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
│       │   ├── auth/        Sign-up, sign-in, token rotation, JWT guard
│       │   ├── users/       Users and GET /me
│       │   ├── businesses/  Businesses (tenants), members, tenant guard, public profile
│       │   ├── services/    Catalog of bookable services
│       │   ├── staff/       Staff members, weekly working hours, time off
│       │   ├── common/      Shared helpers (time, slugs, Prisma errors)
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

The API runs at http://localhost:3001, with interactive docs (Swagger) at **http://localhost:3001/docs**. Check it with:

```bash
curl http://localhost:3001/health
```

When you change `prisma/schema.prisma`, create a migration with:

```bash
npm run prisma:migrate -w apps/api -- --name describe_the_change
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

## API

| Method | Path             | Auth   | Description                                   |
| ------ | ---------------- | ------ | --------------------------------------------- |
| GET    | `/health`        | Public | API and database status                       |
| POST   | `/auth/register` | Public | Create an account, returns a token pair       |
| POST   | `/auth/login`    | Public | Sign in, returns a token pair                 |
| POST   | `/auth/refresh`  | Public | Exchange a refresh token for a new token pair |
| POST   | `/auth/logout`   | Public | Revoke the session of a refresh token         |
| GET    | `/me`            | Bearer | The signed-in user                            |

**Businesses** (`/businesses/:businessId/...` requires membership; writes require the `OWNER` role)

| Method              | Path                                                           | Description                                   |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------- |
| POST / GET          | `/businesses`                                                  | Create a business (you become owner) / yours  |
| GET / PATCH         | `/businesses/:businessId`                                      | Read / edit name, slug, time zone             |
| GET / POST          | `/businesses/:businessId/members`                              | List / add an existing user by email          |
| PATCH / DELETE      | `/businesses/:businessId/members/:userId`                      | Change role / remove (always keeps one owner) |
| GET / POST          | `/businesses/:businessId/services`                             | List / create services                        |
| PATCH / DELETE      | `/businesses/:businessId/services/:serviceId`                  | Edit / archive a service                      |
| GET / POST          | `/businesses/:businessId/staff`                                | List / create staff members                   |
| PATCH / DELETE      | `/businesses/:businessId/staff/:staffId`                       | Edit / deactivate a staff member              |
| GET / PUT           | `/businesses/:businessId/staff/:staffId/working-hours`         | Read / replace the weekly schedule            |
| GET / POST / DELETE | `/businesses/:businessId/staff/:staffId/time-off[/:timeOffId]` | Time off (vacations, appointments)            |
| GET                 | `/public/businesses/:slug`                                     | Public profile for the booking page           |

Every endpoint requires `Authorization: Bearer <access token>` unless it is marked public. Request bodies are validated with Zod; invalid input returns `400` with one message per field. The full reference, with request and response schemas, is at `/docs`.

## Design decisions

### Authentication

Built from small pieces (`@nestjs/jwt`, argon2) instead of an all-in-one library, so every step is explicit:

- **Access token:** a JWT signed with HS256 that expires in 15 minutes. It is verified by a global guard without touching the database; routes opt out with `@Public()`.
- **Refresh token:** a random 256-bit string, valid for 30 days. The database stores only its **SHA-256 hash**, so a database leak doesn't expose usable tokens.
- **Rotation with reuse detection:** every refresh revokes the token used and issues a new one in the same _family_ (one family per sign-in). If a revoked token shows up again, it was probably stolen, so the whole family is revoked and that session has to sign in again. Other devices stay signed in.
- **Race-safe rotation:** the token is revoked with a compare-and-set (`UPDATE ... WHERE revoked_at IS NULL`), so when several requests use the same token at the same time, exactly one wins. An e2e test fires simultaneous refreshes to prove it.
- **Passwords:** hashed with **argon2id**. Sign-in returns the same error for an unknown email and a wrong password, and verifies against a dummy hash when the email doesn't exist, so response times don't reveal which emails are registered.
- **Rate limiting:** 10 requests per minute per IP on the auth endpoints (`@nestjs/throttler`).

### Multi-tenancy

Every business is a tenant, and every catalog record belongs to one business.

- **Two layers of isolation:** a guard checks that the user is a member of the business in the URL (and has the required role), and every query is also scoped by `businessId`. Being an owner of business B doesn't give access to a service of business A through B's URLs.
- **404, not 403, for outsiders:** a non-member gets the same response as for a business that doesn't exist, so business ids can't be probed. Members without the right role get `403`.
- **Always one owner:** demoting or removing an owner first counts the remaining owners. That check runs inside a transaction that locks the business row (`SELECT ... FOR UPDATE`): without the lock, two owners removing each other at the same time both saw "2 owners" and left the business with none (reproduced in 29 of 30 attempts before the fix). An e2e test covers it.
- **Archive, don't delete:** services and staff are deactivated instead of deleted, because bookings will reference them.

### Data integrity

- **Database CHECK constraints** back the API validation (durations, prices, weekdays, intervals, slug format), so invalid rows can't be written even by a bug or a manual query.
- **Money in cents** (integers), never floating point.
- **Working hours in local time:** stored as minutes since midnight in the business's time zone (09:30 → 570) and exchanged as `"HH:mm"`. Several intervals per day are allowed (split shifts); overlapping intervals are rejected.

### Dates

Every timestamp is stored as `timestamptz` (UTC). Time zones matter in a booking app: they will drive the availability engine in stage 3.

## Roadmap

- [x] **Stage 0:** monorepo, Docker services, NestJS API with health check, Prisma, CI
- [x] **Stage 1:** users and authentication (JWT access + rotating refresh tokens)
- [x] **Stage 2:** businesses (multi-tenant), services, staff and working hours
- [ ] **Stage 3:** availability engine with time zones
- [ ] **Stage 4:** bookings without double booking (Postgres exclusion constraint)
- [ ] **Stage 5:** email reminders with BullMQ
- [ ] **Stage 6:** web: booking flow
- [ ] **Stage 7:** web: business dashboard
- [ ] **Stage 8:** deployment and public demo
- [ ] **Stage 9:** AI booking assistant
