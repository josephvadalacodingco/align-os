# AlignOS

A reusable Azure template for Next.js + Azure Container Apps + PostgreSQL + Auth (Email/Password + Google) with step-gated implementation.

## Start here

1. **Initialize a new app**: After copying this repo (or using it as a GitHub template), run:
   ```bash
   node scripts/init-app-from-template.js
   ```
   This will ask for the app slug and display name and update `template.config.json`, `azure.yaml`, and the README.
2. **Portability**: All naming is driven off `template.config.json`; each new repo gets its own values.
3. **Pipeline**: Push to `main` → provision + deploy runs in GitHub Actions (no local Docker).
4. **Local** (optional): `azd up` if you have Docker and want to deploy from your machine.

## Portability

All naming derives from `template.config.json`:

- **appSlug**: Used for resource names and env vars (e.g. `alignos`).
- **appDisplayName**: Human-readable name for the app.

To start a new app: change `template.config.json` values and proceed.

## Step gates

Implementation is gated by steps. Stop and test after each step.

| Step | Scope | Test |
|------|-------|------|
| **Step 0** | Portability / naming | Config file present |
| **Step 1** | Deploy-only (no DB, no auth) | Open deployed URL, `/api/health`, `/diagnostics` |
| **Step 2** | Database (Postgres) | `/api/db-check`, `/api/db-seed`, homepage shows DB message |
| **Step 3** | Authentication | `/app` protected, `/public` open |

## Documentation

- [docs/CHECKLIST.md](docs/CHECKLIST.md) – Step-by-step checklist with commands
- [docs/QUICKSTART_ONE_HOUR.md](docs/QUICKSTART_ONE_HOUR.md) – Minimal “do exactly this” guide
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) – Decision tree by step

## Quick commands

```bash
# Pipeline (no local Docker): configure once, then push
azd pipeline config   # choose GitHub, Federated SP + OIDC
# Set repo vars: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, AZURE_ENV_NAME, AZURE_LOCATION, APP_SLUG
# Step 2: Set repo secret POSTGRES_ADMIN_PASSWORD (used by Bicep for PostgreSQL)
# Push to main → deploy-dev runs

# Local (optional, requires Docker)
azd env new dev && azd up
azd env get-values
```

## Local dev (Step 2 – database)

Local `npm run dev` uses the **DEV Azure DB**; there are no local DB containers.

1. After provisioning DEV at least once, run:
   ```bash
   azd env get-values
   ```
2. Create `app/.env.local` with `DATABASE_URL`:
   ```bash
   DATABASE_URL=postgresql://<postgresAdminLogin>:<your-password>@<postgresServerFqdn>:5432/<databaseName>?sslmode=require
   ```
   Use the values from `azd env get-values` (e.g. `postgresServerFqdn`, `databaseName`, `postgresAdminLogin`). Use the same admin password you set as the `POSTGRES_ADMIN_PASSWORD` secret (or the one you passed when provisioning).

3. From repo root: `cd app && npm run dev`. The app will connect to the DEV Postgres instance.
