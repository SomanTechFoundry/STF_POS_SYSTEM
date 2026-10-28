# Enterprise POS Backend (Local)

## Stack
- Node.js + Express
- PostgreSQL
- JWT auth
- SMTP email approvals (Nodemailer)

## Setup
1. Create a PostgreSQL database (example: `pos_db`).
2. Run SQL in `sql/schema.sql`.
3. Configure `.env`.
4. Install deps: `npm install`
5. Start server: `npm run dev`

## Required Environment Variables
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `ADMIN_EMAIL` (fixed platform admin identity)
- `APPROVAL_TO_EMAIL` (admin inbox for signup approvals)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER` (optional if SMTP relay is open)
- `SMTP_PASS` (optional if SMTP relay is open)
- `SMTP_FROM_EMAIL` (optional)
- `BREVO_API_KEY` (optional; if set, Brevo API is used instead of SMTP)
- `BREVO_API_URL` (optional; default: `https://api.brevo.com/v3/smtp/email`)
- `FRONTEND_BASE_URL` (default: `http://localhost:3002`)
- `BACKEND_PUBLIC_URL` (default: `http://localhost:5000`)

## Roles
- `admin`: full access + user role/visibility management
- `owner`: operational access to POS modules
- `viewer`: read-oriented app access

## API Base
- `http://localhost:5000/api`

## Auth Flow
- `POST /api/auth/register`: creates/updates a pending signup request and emails approval link to `APPROVAL_TO_EMAIL`
- `GET /api/auth/approve?token=...`: approves signup and enables login
- `POST /api/auth/login`: login after approval

## User Management (admin only)
- `GET /api/users`
- `PATCH /api/users/:userId` with `{ role, isActive }`

## Modules (JWT required)
- `GET/POST /api/products`
- `GET/POST /api/customers`
- `GET/POST /api/sales`
- `GET /api/dashboard/summary`
