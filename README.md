# STF POS System

Point-of-sale product for Soman Tech Foundry — **Next.js modular monolith**.

## Stack (STF standard)

| Layer | Choice |
|-------|--------|
| App | Next.js 16 App Router + React 19 + TypeScript |
| UI | Tailwind (responsive web + mobile layouts) |
| Database | **PostgreSQL on Neon** |
| ORM / connector | **Prisma** |
| API | Next.js `/api` route handlers |
| Auth | JWT in httpOnly cookie + Bearer support |
| Deploy | One Vercel project |

Legacy Vite + Express code lives under `_legacy/` (not used at runtime).

## Quick local start (Neon)

Full guide: **[docs/LOCAL_NEON_SETUP.md](docs/LOCAL_NEON_SETUP.md)**

```powershell
cd E:\Work\Projects\STF\STF_POS_SYSTEM
copy .env.example .env.local
# Paste Neon DATABASE_URL (pooled) + DIRECT_URL (direct) into .env.local

npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open http://localhost:3002 — login with seeded admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

| Port | App |
|------|-----|
| 3000 | STF-WEBSITE |
| 3001 | STF-AI-AGENT-SERVICES |
| 3002 | **STF POS (this app)** |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server on 3002 |
| `npm run build` / `start` | Production |
| `npx prisma migrate deploy` | Apply migrations to Neon |
| `npm run db:seed` | Print templates + admin user |
| `npm run db:studio` | Browse Neon data |

## Architecture

```
Browser → Next.js (pages + /api) → Prisma Client → Neon Postgres
```
