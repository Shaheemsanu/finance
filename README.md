# Ledgerline

Multi-site financial management for freelancers and small businesses. The React application lives in `web/` and uses a site-scoped repository boundary with Supabase Auth, PostgreSQL RLS, and a local demo repository when credentials are not configured.

## Run locally

```sh
cd web
npm install
cp .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
npm run dev
```

Open the Vite URL printed in the terminal. `.env.local` is ignored by Git; use only a Supabase publishable/anon key in browser configuration. Never put a service-role key in `VITE_*` variables.

## Supabase setup

Apply the SQL files in `web/supabase/migrations/` in order using the Supabase SQL editor or an authenticated Supabase CLI session. The first migration creates the tenant membership model, site-scoped finance tables, RLS policies, and invoice-payment routine. The second adds the atomic `record_financial_transaction` RPC used by income and expense entry. The application will explain this requirement if the write RPC is not deployed.

Configure Supabase email/password authentication and redirect URLs for the deployed application. Site reads use the authenticated user’s business/site memberships and RLS; the browser key is not an authorization mechanism.

## Checks

```sh
cd web
npm run build
npm test
npm run lint
```

The test suite covers exact decimal arithmetic and site isolation in All Sites aggregations. PostgreSQL migrations should also be checked against a disposable Supabase-compatible database before production deployment.