# MASTER GOAL
Create a reusable Azure template repo for Next.js + Azure Container Apps + PostgreSQL + Auth (Email/Password + Google) with step-gated implementation and foolproof docs.

# Hard Requirements
- Hosting: Azure Container Apps
- DB: Azure Database for PostgreSQL Flexible Server
- IaC: Bicep
- Orchestration: Azure Developer CLI (azd)
- CI/CD: GitHub Actions with OIDC
  - push to main => deploy DEV
  - push to prod => deploy PROD
- Local dev ALWAYS connects to Azure DEV DB (no local DBs)
- Single variable portability: APP_SLUG (example: vendaval). Everything names from APP_SLUG + env.

# Repo Layout
/
  app/
    Dockerfile
    package.json
    next.config.js
    src/app/page.tsx
    src/app/diagnostics/page.tsx
    src/app/public/page.tsx
    src/app/app/page.tsx
    src/app/api/health/route.ts
    src/app/api/env-check/route.ts
    src/app/api/db-check/route.ts
    src/app/api/db-seed/route.ts
    src/app/api/diag/route.ts
  infra/
    main.bicep
    parameters.dev.json
    parameters.prod.json
  azure.yaml
  .github/workflows/
    deploy-dev.yml
    deploy-prod.yml
  docs/
    CHECKLIST.md
    TROUBLESHOOTING.md
    QUICKSTART_ONE_HOUR.md
  README.md

# STEP 0: Portability / Naming
- Implement APP_SLUG as a single source of truth:
  - Use a config file at repo root: template.config.json containing:
    - appSlug
    - appDisplayName
- README must say: “To start a new app: change template.config.json values and proceed.”

# STEP 1: Deploy-only (no DB, no auth)
## Infrastructure
Provision per environment (dev/prod):
- resource group (derived from APP_SLUG + env)
- log analytics workspace
- container apps environment
- azure container registry (ACR)
- container app with external ingress on port 3000
- env var ENVIRONMENT_NAME set to env
- env var APP_SLUG set to app slug
- env var GIT_SHA set during deploy
Outputs:
- containerAppUrl
- resourceGroupName
- containerAppName

## App
- / shows:
  - “Hello World”
  - “App: <APP_SLUG>”
  - “Environment: <ENVIRONMENT_NAME>”
  - “Build: <GIT_SHA>”
  - Links to /diagnostics and /api/* endpoints
- /api/health returns 200 JSON { ok: true, env: ..., app: ..., sha: ... }

## Tests
- Open deployed URL
- Open /api/health
- Open /diagnostics (should show Health: OK; DB/Auth unknown or skipped)

# STEP 2: Database (add Postgres + wiring)
## Infra
Add per environment:
- PostgreSQL Flexible Server (public access) + database
- Firewall rules:
  - allow Azure services
  - allow devPublicIp for DEV only (parameter; documented in README)
- Inject DATABASE_URL into the container app environment variables.
- DATABASE_URL must be compatible with node-postgres and enforce SSL:
  - include sslmode=require (or equivalent ssl config)
Outputs:
- postgresServerFqdn
- databaseName
- DEV_DATABASE_URL (or components + exact assembly instructions)

## App (DB)
- Use node-postgres (pg).
- /api/db-check:
  - connect using DATABASE_URL
  - run SELECT now()
  - return 200 { dbOk: true, serverTime: ... }
  - on failure return 500 with a “likely causes” list:
    - missing DATABASE_URL
    - firewall blocked
    - SSL/TLS required
- /api/db-seed:
  - create table template_dummy (id int primary key, message text, updated_at timestamptz default now())
  - upsert row id=1 message='Hello from DB'
  - return 200 with inserted row
- Home page:
  - calls /api/db-check and shows db status
  - shows current template_dummy message (query directly or via API)

## Local Dev Contract
- README must instruct to create app/.env.local with DEV DATABASE_URL (from azd outputs).
- Local `npm run dev` must use the DEV Azure DB.
- No local DB containers.

## Tests
- Deployed dev: /api/db-check OK
- Deployed dev: /api/db-seed OK then homepage shows DB message
- Local: /api/db-check OK

# STEP 3: Authentication (email/password + Google)
## Platform auth
- Use Azure Container Apps built-in authentication/authorization.
- Configure a Custom OpenID Connect provider backed by Microsoft Entra External ID:
  - Must support email/password + Google federation via user flow.
- Protect /app route. /public remains open.
- /app shows identity derived from platform injected headers (do not build custom auth sessions).

## App (Auth)
- /public: public content + link to /app
- /app: protected; display user email/name based on injected headers (or show “Not authenticated” if somehow accessible)
- /diagnostics shows Auth header presence as pass/fail.

# Diagnostics / Zero-think debugging
## Endpoints
1) /api/env-check
- Lists:
  - ENVIRONMENT_NAME value
  - APP_SLUG value
  - GIT_SHA value
  - DATABASE_URL present true/false (never echo it)
  - auth header presence true/false (list which headers exist)
2) /api/diag
- Runs:
  - health
  - db-check (if DATABASE_URL present)
  - auth header check
- Returns:
  - appOk, dbOk, authOk, helpfulMessages[]
3) /diagnostics page
- Calls /api/diag and shows green/red statuses and direct links to each API.

# CI/CD
- Use GitHub Actions:
  - deploy-dev.yml triggers on push to main
  - deploy-prod.yml triggers on push to prod
- Authenticate to Azure using OIDC (no publish profile).
- Inject GIT_SHA into the container app env vars (github.sha).

# azd
- azure.yaml must support:
  - azd up => provision + deploy selected env
  - azd env new dev/prod
- Provide azd outputs in a readable way (README references exact command to display outputs).

# Documentation (non-negotiable)
## README.md
- High-level overview + links to docs
- “Start here” section
- “Portability” section (change template.config.json)
- “Step Gates” section (Step 1/2/3 with stop-and-test)

## docs/CHECKLIST.md
- One-page step-by-step checklist (Step 0-3 + prod) with checkboxes.
- Includes exact commands and where to click in Azure/GitHub.

## docs/QUICKSTART_ONE_HOUR.md
- Ultra-minimal “do exactly this” to get:
  - dev deployed with DB working and diagnostics green
  - pipeline configured
  - prod deployed
- No fluff. Commands + links to “where to click” + expected outcomes.

## docs/TROUBLESHOOTING.md
- Decision tree organized by which step failed:
  - Step 1 failures: container start/ingress/logs/revisions
  - Step 2 failures: Postgres firewall, TLS/SSL, DATABASE_URL injection, local IP
  - Step 3 failures: OIDC metadata/issuer mismatch, redirect URI, provider config
- Include “open /diagnostics first” as the first instruction.

# Deliverable
Generate all files fully working. The repo must be runnable locally and deployable via azd.