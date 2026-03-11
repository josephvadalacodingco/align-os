# Checklist: Step 0–3 + Prod

## Step 0: Portability

- [ ] `template.config.json` exists with `appSlug` and `appDisplayName`
- [ ] To start a new app: change values in `template.config.json` and proceed

## Step 1: Deploy-only (no DB, no auth)

### Prerequisites

- [ ] Azure subscription
- [ ] [azd](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd) and [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- [ ] `az login` completed
- [ ] Repo pushed to GitHub

### Pipeline (primary path)

- [ ] `azd pipeline config` → Federated Service Principal (SP + OIDC)
- [ ] Set repo variables: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, AZURE_ENV_NAME, AZURE_LOCATION, APP_SLUG
- [ ] Push to `main` → deploy-dev runs (provision + build + deploy; no local Docker)
- [ ] For prod: create Environment "prod", set AZURE_ENV_NAME=prod, add federated credential for refs/heads/prod

### Verify

- [ ] Open deployed URL → Hello World and links
- [ ] Open `/api/health` → `{ ok: true }`
- [ ] Open `/diagnostics` → Health: OK; DB/Auth skipped

### Local (optional)

- [ ] Requires Docker. `azd env new dev` then `azd up`.

## Step 2: Database

- [ ] Set repo **secret** `POSTGRES_ADMIN_PASSWORD` (used by Bicep for PostgreSQL; min 8 chars, mixed case, numbers, symbols)
- [ ] Re-run pipeline (or push to main) → provision creates Postgres + injects DATABASE_URL into container app
- [ ] Open deployed URL → DB: OK and “From DB: Hello from DB” (seed once via POST `/api/db-seed` or homepage will show “No row yet” until seeded)
- [ ] Open `/api/db-check` → `{ dbOk: true, serverTime: ... }`
- [ ] Open `/api/db-seed` (GET or POST) → seed returns row with message
- [ ] Open `/diagnostics` → DB: OK

### Local dev (Step 2)

- [ ] After DEV is provisioned: `azd env get-values` to get postgresServerFqdn, databaseName, postgresAdminLogin
- [ ] Create `app/.env.local` with `DATABASE_URL=postgresql://<login>:<password>@<fqdn>:5432/<db>?sslmode=require`
- [ ] `cd app && npm run dev` → app connects to DEV Azure Postgres (no local DB)

## Step 3: Authentication

- [ ] See MASTER-GOAL.MD Step 3
- [ ] `/app` protected
- [ ] `/public` open

## Prod

- [ ] Create `prod` branch
- [ ] Configure GitHub vars for prod (AZURE_ENV_NAME=prod, etc.)
- [ ] Add federated credential for `ref:refs/heads/prod` if using OIDC
- [ ] Push to `prod` → deploy-prod runs
