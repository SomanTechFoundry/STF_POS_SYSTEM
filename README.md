# STF_POS_SYSTEM
POS application

## Deployment (Railway + Render)

### Backend on Railway
1. Create a Railway service from the `Backend` folder.
2. Railway will use `Backend/railway.json` automatically.
3. Set environment variables (use `Backend/.env.example` as template):
   - `NODE_ENV=production`
   - `PORT=5000` (Railway may override port automatically)
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN=8h`
   - `CORS_ORIGIN=https://<your-render-domain>`
   - `FRONTEND_BASE_URL=https://<your-render-domain>`
   - `BACKEND_PUBLIC_URL=https://<your-railway-domain>`
   - `ADMIN_EMAIL=somandeepak14@gmail.com`
   - SMTP + approval email variables if using signup approval mail flow.
4. Deploy and verify: `https://<your-railway-domain>/health`

### Frontend on Render
1. Create a Static Site on Render from this repo using `render.yaml` at root.
2. Render uses:
   - `rootDir: Frontend`
   - `buildCommand: npm install && npm run build`
   - `publish directory: dist`
   - SPA rewrite configured in `render.yaml`.
3. Set environment variable:
   - `VITE_API_BASE_URL=https://<your-railway-domain>/api`
4. Redeploy frontend.

### Important
- After frontend domain is ready, update backend `CORS_ORIGIN` with the exact Render URL.
- If you use a custom domain, add that domain to `CORS_ORIGIN` too (comma-separated list supported).
