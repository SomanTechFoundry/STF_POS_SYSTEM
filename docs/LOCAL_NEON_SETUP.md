# Local setup — Neon PostgreSQL + Prisma (STF POS)

This app uses **Neon Postgres** with **Prisma** only (same pattern as STF-AI-AGENT-SERVICES).  
The old Express/`pg` stack in `_legacy/` is not used.

---

## A. Create a Neon database (one-time)

1. Go to [https://console.neon.tech](https://console.neon.tech) and sign in.
2. **Create project** (e.g. `stf-pos-system`).
3. Open **Dashboard → Connect** (or Connection details).
4. Copy **two** URLs:
   - **Pooled** connection string → use as `DATABASE_URL`  
     Host usually contains `-pooler` (good for the running app).
   - **Direct** connection string → use as `DIRECT_URL`  
     Host without `-pooler` (required for migrations).
5. Both should include `?sslmode=require` (Neon adds this by default).

You can create a **new Neon project** just for POS, or a new **branch/database** inside an existing Neon project. Do not reuse the legacy Railway Postgres unless you intentionally want that data.

---

## B. Configure the app

**Env file note**

| Tool | Reads |
|------|--------|
| Next.js (`npm run dev`) | `.env.local` **and** `.env` (`.env.local` wins) |
| Prisma CLI by itself (`npx prisma …`) | **only** `.env` |
| Our npm db scripts (`npm run db:migrate:prod`, `db:seed`, …) | `.env.local` then `.env` |

So for day-to-day work you can keep secrets in **`.env.local`**.  
If you run bare `npx prisma migrate deploy`, put the same `DATABASE_URL` / `DIRECT_URL` in **`.env`**, or use `npm run db:migrate:prod` instead.

In `E:\Work\Projects\STF\STF_POS_SYSTEM`:

```powershell
cd E:\Work\Projects\STF\STF_POS_SYSTEM
copy .env.example .env.local
```

Edit `.env.local` and set at least:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3002
DATABASE_URL="postgresql://...@ep-xxx-pooler....neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://...@ep-xxx....neon.tech/neondb?sslmode=require"
JWT_SECRET=some-long-random-secret
ADMIN_EMAIL=admin@example.com
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=Admin123!
```

Leave Brevo/SMTP empty for local — signup approval links will print in the terminal.

---

## C. Install, migrate, seed

```powershell
cd E:\Work\Projects\STF\STF_POS_SYSTEM
npm install
npx prisma generate
npm run db:migrate:prod
npm run db:seed
```

What this does:

| Command | Result |
|---------|--------|
| `prisma generate` | Builds Prisma Client (ORM) |
| `prisma migrate deploy` | Creates all POS tables on Neon |
| `db:seed` | Print templates + admin user + inventory locations |

Default seed login (unless you changed env):

- Email: `admin@example.com` (or `SEED_ADMIN_EMAIL`)
- Password: `Admin123!` (or `SEED_ADMIN_PASSWORD`)

Optional: open data browser with `npm run db:studio`.

---

## D. Run and test the app

```powershell
npm run dev
```

Open **http://localhost:3002**

### Suggested smoke test

1. **Login** with the seeded admin.
2. **Products** → create a product with at least one variant (SKU, sale price, stock).
3. **POS** → add to cart → checkout (retail).
4. **Inventory** → confirm stock dropped at Main Store.
5. **Reports** → see the sale.
6. **Customers** → add a customer; try wholesale sale with customer selected.
7. From the website catalog (port 3000), **Our Work → STF POS → Try demo** should open `http://localhost:3002` when website `.env.local` has:
   `NEXT_PUBLIC_WORK_DEMO_POS_URL=http://localhost:3002`

### Optional: website + agent together

| Port | App | Command |
|------|-----|---------|
| 3000 | STF-WEBSITE | `npm run dev` |
| 3001 | AI Agent Services | `npx next dev -p 3001` |
| 3002 | POS (this app) | `npm run dev` |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `P1001` / can't reach DB | Wrong host/password; confirm Neon project is active; use `sslmode=require` |
| Migrate fails on pooler | Put the **non-pooler** URL in `DIRECT_URL` |
| Login fails after seed | Re-run `npm run db:seed`; check `SEED_ADMIN_EMAIL` / password |
| Signup stuck “pending” | Use seeded admin, or open the approve URL printed in the server log |
| Prisma Client out of date | `npx prisma generate` |

---

## Architecture reminder

```
Browser → Next.js (UI + /api) → Prisma Client → Neon Postgres
```

No separate Express server. No `pg` Pool in the new app.
