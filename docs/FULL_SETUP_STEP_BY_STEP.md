## Full Setup – End‑to‑End Steps We Actually Took

This document captures **exactly what we did** to get from nothing → running app with:

- GitHub Actions + `azd` pipeline
- Azure Container Apps
- Azure Database for PostgreSQL Flexible Server
- Microsoft Entra External ID (email/password + Google)
- Diagnostics (`/diagnostics`, `/api/diag`, `/api/env-check`, `/api/db-*`)

Use this when you want the **full story, in order**, including where every value came from.

The pipelines that were proven to work and are assumed in these steps are:

- `.github/workflows/deploy-dev.yml`
  - Trigger: push to `main`, manual dispatch.
  - Flow: checkout → install `azd` → Azure login via OIDC → set `CONTAINER_APP_IMAGE` → `azd auth login` → prepare azd env (`POSTGRES_ADMIN_PASSWORD`, optional `POSTGRES_LOCATION`) → `azd provision` → `azd deploy`.
- `.github/workflows/deploy-prod.yml`
  - Trigger: push to `prod`.
  - Same structure as dev, but uses a GitHub environment `prod` and (optionally) different AZURE_* values.

There is **no separate azure-dev workflow**; everything goes through these two files.

---

### 0. Pre‑reqs

- Azure subscription (Pay‑As‑You‑Go – **we upgraded from free because Postgres was blocked**).
- GitHub account.
- Dev machine:
  - Node.js + npm
  - Azure CLI (`az`)
  - Azure Developer CLI (`azd`)

---

### 1. Portability / naming

1. Open `template.config.json`.
2. Set:
   - `appSlug`: e.g. `alignos`
   - `appDisplayName`: e.g. `Template Base`
3. Commit.

Everything else (RG name, container app, ACR, etc.) derives from this.

---

### 2. Push to GitHub + configure azd pipeline

1. Create a new repo on **GitHub**, push this code.
2. On your local machine:
   - `az login`
   - `azd auth login` (optional if `azd pipeline config` handles it)
3. From repo root:
   ```bash
   azd pipeline config
   ```
   - Choose:
     - **GitHub**
     - **Federated Service Principal (OIDC)**
4. After this, in **GitHub → Settings → Secrets and variables → Actions**:
   - Under **Variables**:
     - `AZURE_CLIENT_ID` – from the service principal.
     - `AZURE_TENANT_ID`
     - `AZURE_SUBSCRIPTION_ID`
     - `AZURE_ENV_NAME` = `dev`
     - `AZURE_LOCATION` = `eastus` (for core resources).
     - `APP_SLUG` = `alignos`.
     - Optional: `POSTGRES_LOCATION` if Postgres is blocked in `AZURE_LOCATION`.
   - Under **Secrets**:
     - `POSTGRES_ADMIN_PASSWORD` – we set a strong password.
     - `AZD_INITIAL_ENVIRONMENT_CONFIG` – if `azd pipeline config` produced one.

**Note:** On the free subscription we repeatedly hit `LocationIsOfferRestricted` for Postgres in `eastus` and `eastus2`. Upgrading to Pay‑As‑You‑Go resolved this, and we then used fallback logic (e.g. defaulting Postgres to `westus3` when `AZURE_LOCATION=eastus`).

---

### 3. Infra provisioning (Step 1 + Step 2)

This is driven by `infra/main.bicep` + `infra/infra.bicep`:

- `main.bicep` – subscription‑scoped:
  - Creates resource group: `rg-<slug>-dev`.
  - Deploys `infra.bicep` into that RG.
  - Exposes outputs (containerAppUrl, postgresServerFqdn, etc.).
- `infra.bicep` – RG‑scoped:
  - Log Analytics workspace.
  - Container Apps Environment.
  - ACR.
  - Managed identity + AcrPull role.
  - Container App.
  - PostgreSQL Flexible Server:
    - Location: `postgresRegion` (derived from `postgresLocation` or fallback).
    - Admin login/password (`postgresAdminLogin` + `postgresAdminPassword`).
    - DB: `postgresDatabaseName`.
    - Firewall rules (AllowAll for dev).
  - Env vars for Container App:
    - `ENVIRONMENT_NAME`
    - `APP_SLUG`
    - `GIT_SHA`
    - `DATABASE_URL` = `postgresql://<login>:<password>@<fqdn>:5432/<db>?sslmode=require`

The pipeline runs:

```yaml
- name: Provision Infrastructure
  run: azd provision --no-prompt
```

Using `infra/main.parameters.json` which maps CI vars and env vars into Bicep parameters:

- `environmentName` ← `${AZURE_ENV_NAME}`
- `location` ← `${AZURE_LOCATION}`
- `appSlug` ← `${APP_SLUG=alignos}`
- `gitSha` ← `${GIT_SHA=unknown}`
- `containerImage` ← `${CONTAINER_APP_IMAGE=...}`
- `postgresAdminLogin` ← `${POSTGRES_ADMIN_LOGIN=pgadmin}`
- `postgresAdminPassword` ← `${POSTGRES_ADMIN_PASSWORD}`
- `devPublicIp` ← `${DEV_PUBLIC_IP=}`
- `postgresDatabaseName` ← `${POSTGRES_DATABASE_NAME=appdb}`
- `postgresLocation` ← `${POSTGRES_LOCATION=}`

**Where values came from:**

- `AZURE_*` / `APP_SLUG` – GitHub repo variables.
- `POSTGRES_ADMIN_PASSWORD` – GitHub secret.
- `CONTAINER_APP_IMAGE` – set in the workflow by querying any existing Container App to preserve image on re‑provision.

---

### 4. DB & app wiring

In `app/package.json` we added:

- `pg`
- `@types/pg`

We updated `package-lock.json` by running:

```bash
cd app
npm install
```

and committed the lockfile so `npm ci` in Docker works.

APIs:

- `/api/db-check`:
  - Uses `pg` and `process.env.DATABASE_URL`.
  - `SELECT now()`; returns:
    - `200 { dbOk: true, serverTime }` on success.
    - `500 { dbOk: false, error, likelyCauses[] }` on failure.
- `/api/db-seed`:
  - GET: shows current `template_dummy` row.
  - POST: creates table if needed, upserts `id=1` with message `'Hello from DB'`.

Home page:

- Calls `/api/db-check` and `/api/db-seed` client‑side and shows:
  - `DB: OK (...)` or red “Not connected”.
  - “From DB: Hello from DB” after seeding.

Diagnostics:

- `/api/health` – `{ ok: true, env, app, sha }` (env/slug/sha optional).
- `/api/env-check` – lists:
  - `ENVIRONMENT_NAME`, `APP_SLUG`, `GIT_SHA`, `DATABASE_URL_PRESENT`, `AUTH_HEADER_PRESENCE`.
- `/api/diag`:
  - Calls `/api/health`, `/api/db-check` (if `DATABASE_URL` present), and checks auth headers.
  - Returns `{ appOk, dbOk, authOk, helpfulMessages[] }`.
- `/diagnostics` – client page that displays those statuses and links to each API.

---

### 5. First full pipeline run (dev)

We pushed to `main`, which triggered:

- `deploy-dev.yml`:
  - Login with OIDC.
  - `azd provision` (infra).
  - `azd deploy` (builds Docker image, pushes to ACR, updates Container App revision).

We verified:

- `/` – Hello World.
- `/diagnostics` – Health OK; DB/Auth initially skipped, then OK after Postgres + auth.
- `/api/db-check` – OK.
- `/api/db-seed` – POST once, then GET shows row.

---

### 6. Microsoft Entra External ID: external tenant

We needed platform auth (no custom auth in app). Steps:

1. Go to `https://entra.microsoft.com`.
2. Left nav: **Identity → Overview → Manage tenants**.
3. **+ Create** → choose **External** tenant type → **Continue**.
4. Basics:
   - Name: e.g. `Template Base Customers`.
   - Domain: e.g. `templatebasejosephvadala`.
   - Country/Region: as needed.
5. Finish wizard.
6. Switch tenant (top‑right) to the new external tenant.

---

### 7. User flow (sign up + sign in)

In the external tenant:

1. **Identity → External Identities → User flows**.
2. **+ New user flow**.
3. Choose **Sign up and sign in**.
4. Enable:
   - Email with password.
   - (Optionally) Google IDP.
5. Create, named something like `B2C_1_signup_signin`.
6. Open the user flow → **Overview → Run user flow**:
   - Click the **OpenID Connect metadata** link.
   - Copy full URL, e.g.:  
     `https://templatebasejosephvadala.ciamlogin.com/a6be0f9a-.../v2.0/.well-known/openid-configuration?appid=cf088137-e411-4392-a43a-5c5c7415e478`

This is the **Metadata URL** for Container Apps.

---

### 8. App registration (for Container App)

In the same external tenant:

1. **Identity → Applications → App registrations → New registration**.
2. Name: `template-base-app`.
3. Click **Register**.
4. On Overview:
   - **Application (client) ID** = `cf088137-e411-4392-a43a-5c5c7415e478` (in our case).
5. **Certificates & secrets → + New client secret**:
   - Description: `container-app`.
   - Copy the **Value** → e.g. `KF68Q~...`.

We now have:

- Metadata URL (OpenID configuration).
- Client ID.
- Client Secret.

---

### 9. Configure Container App authentication (Custom OpenID Connect)

In Azure Portal, main subscription:

1. Open `rg-template-base-dev` → Container App (e.g. `ca-templa-dev-34fc2t`).
2. Left nav: **Authentication**.
3. **+ Add identity provider** → **Custom OpenID Connect**.
4. Fill:
   - OpenID provider name: `externalid`.
   - Metadata URL: the OpenID configuration URL from the user flow.
   - Client ID: `cf088137-e411-4392-a43a-5c5c7415e478`.
   - Client secret: `KF68Q~...`.
5. Save.

We then **constructed** the redirect URI:

- App host from **Container App → Overview → Application URL**:  
  `https://ca-templa-dev-34fc2t.wonderfulhill-aef17695.eastus.azurecontainerapps.io`
- Redirect URI:

```text
https://ca-templa-dev-34fc2t.wonderfulhill-aef17695.eastus.azurecontainerapps.io/.auth/login/externalid/callback
```

Back in the external tenant app registration:

1. App registrations → open app.
2. **Authentication → Add a platform → Web** (or edit existing Web config).
3. Add the redirect URI above.
4. Save.

---

### 10. Turn on auth + app changes

In Container App **Authentication**:

1. Toggle **Authentication** = **On**.
2. Ensure `externalid` provider is enabled.
3. Optionally tighten per‑path rules so `/app` requires auth, `/public` is anonymous.

In the app (`app/src/app/app/page.tsx`), we implemented:

- `getClientPrincipal()`:
  - Reads `x-ms-client-principal` header.
  - Base64 decodes to JSON.
  - Returns `{ identityProvider, userId, userDetails, claims[] }`.
- We pull:
  - `name` claim (if present).
  - Email claim.
  - Fallback to `userDetails`.
- Display:
  - `Signed in as: <email or name or Unknown user>`.
  - `Email: <email>` if present.
  - `Identity provider: <provider>` if present.

Final tweak:

- We now compute `displayName = email ?? name ?? 'Unknown user'` and use that in the UI, so you see your email if name is not set.

---

### 11. Final tests

Using an incognito window:

1. `/public` – loads without login, shows link to `/app`.
2. `/app` – redirects to External ID sign‑up/sign‑in; after sign‑in:
   - Shows `Signed in as: <your email>`.
3. `/diagnostics` – shows:
   - Health: OK.
   - DB: OK.
   - Auth: OK.
   - Helpful messages empty.

At this point:

- **Step 0** – Portability via `template.config.json`.
- **Step 1** – Infra + deploy‑only works via pipeline.
- **Step 2** – Postgres + DB wiring working.
- **Step 3** – Platform auth (External ID + Container Apps built‑in auth) working.
- **Diagnostics** – `/diagnostics`, `/api/diag`, `/api/env-check` provide zero‑think debugging.

