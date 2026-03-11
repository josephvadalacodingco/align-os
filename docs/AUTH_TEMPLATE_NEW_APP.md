## Azure Template Base – New App Quick Setup

This is the **fast path** to get a brand‑new app using this template fully working (Steps 0–3: deploy, DB, auth) with **minimum yaks to shave**.

Use this when: you’re starting from this repo and want to spin up a new project.

This guide assumes you keep the two pipelines that already work in this repo:

- `.github/workflows/deploy-dev.yml`
- `.github/workflows/deploy-prod.yml`

You do **not** need any other workflow (we removed the old `azure-dev` / AVM flows).

---

### 1. Fork/clone and set portability

- **Clone or fork** this repo.
- Open `template.config.json` and set:
  - `appSlug`: short, lowercase/underscore, e.g. `my_cool_app`
  - `appDisplayName`: human‑readable name, e.g. `My Cool App`
- Commit.

Everything in infra and app names from `appSlug` + env (dev/prod).

---

### 2. GitHub + azd pipeline (DEV)

1. Push repo to **GitHub**.
2. On your dev machine:
   - Install **Azure CLI** and **azd**.
   - Run:
     ```bash
     azd pipeline config
     ```
     - Choose **GitHub** + **Federated Service Principal (OIDC)**.
3. In GitHub repo **Settings → Secrets and variables → Actions → Variables**, set:
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`
   - `AZURE_ENV_NAME` = `dev`
   - `AZURE_LOCATION` = region for core resources, e.g. `eastus`
   - `APP_SLUG` = same as `appSlug`
   - (Optional) `POSTGRES_LOCATION` if your subscription can’t create Postgres in `AZURE_LOCATION`. For many subs:
     - If `AZURE_LOCATION=eastus`, a good `POSTGRES_LOCATION` is often `westus3` or `centralus`.
4. In GitHub **Settings → Secrets and variables → Actions → Secrets**, set:
   - `POSTGRES_ADMIN_PASSWORD` – strong password, 8+ chars, mixed case, numbers, symbol.
   - `AZD_INITIAL_ENVIRONMENT_CONFIG` – from `azd pipeline config` (if requested).

Push to `main`. The **deploy‑dev** workflow will run: `azd provision` + `azd deploy`.

#### What the working `deploy-dev.yml` actually does

For each push to `main` (or manual run), it:

1. **Checks out** the repo.
2. **Installs `azd`**.
3. Logs in to Azure using **OIDC** with the `AZURE_CLIENT_ID`/`TENANT_ID`/`SUBSCRIPTION_ID` repo variables.
4. Runs a small script to set **`CONTAINER_APP_IMAGE`**:
   - If a Container App tagged `azd-service-name=web` already exists in the dev RG, it reuses that image (so re‑provision doesn’t overwrite the app image).
   - Otherwise it falls back to a public hello‑world image.
5. Logs in to `azd` using the same federated identity.
6. Runs a “Prepare azd environment” step:
   - `azd env select "$AZURE_ENV_NAME"` or creates it.
   - `azd env set POSTGRES_ADMIN_PASSWORD "$POSTGRES_ADMIN_PASSWORD"`.
   - If `POSTGRES_LOCATION` is non‑empty, `azd env set POSTGRES_LOCATION "$POSTGRES_LOCATION"`.
7. Runs:
   - `azd provision --no-prompt` → calls `infra/main.bicep` with `infra/main.parameters.json`.
   - `azd deploy --no-prompt` → builds Docker image with `npm ci` inside the container, pushes to ACR, updates the Container App.

The **prod** pipeline in `deploy-prod.yml` is the same pattern, but:

- Triggers on `prod` branch.
- Uses a GitHub **environment** named `prod` and separate AZURE_* / APP_SLUG values if you want a different slug or location.

---

### 3. Infra defaults to “just‑works” for free/basic plans

Infra does this per environment:

- **Resource group**: `rg-<slug>-<env>`
- **Container Apps Environment**, **ACR**, **Container App** on port 3000.
- **Postgres Flexible Server**:
  - Public access + firewall rules (AllowAll for dev; consider VNet for prod).
  - Region:
    - If `POSTGRES_LOCATION` is set → use that.
    - Else if `AZURE_LOCATION == eastus` → default to a safer region (e.g. `westus3`).
    - Else → use `AZURE_LOCATION`.
  - `DATABASE_URL` injected into the container app with `sslmode=require`.

If you hit `LocationIsOfferRestricted` for Postgres:

- Set `POSTGRES_LOCATION` to another region (for US subs: try `westus3`, `centralus`, `southcentralus` in that order).
- Re‑run the pipeline.

---

### 4. Step 1 / Step 2 validation (pipeline only)

Once the GitHub deploy finishes:

1. Get the **dev URL** from the workflow logs or via:
   ```bash
   azd env get-values
   ```
2. Open:
   - `/` → see **Hello World**.
   - `/diagnostics` → Health: OK; DB/Auth eventually OK after Step 2.
   - `/api/health` → `{ ok: true }`.
3. After Postgres is live:
   - `/api/db-check` → `{ dbOk: true, serverTime: ... }`.
   - `POST /api/db-seed` once → upserts `template_dummy` row.
   - Home page shows `DB: OK (...)` and **From DB: Hello from DB**.

At this point **Steps 1–2** are done.

---

### 5. Microsoft Entra External ID (CIAM) tenant (auth)

Use a **separate external tenant** for customers.

1. Go to `https://entra.microsoft.com`.
2. Left nav: **Identity → Overview → Manage tenants**.
3. Click **+ Create**.
4. Choose **External** tenant type, **Continue**.
5. Fill:
   - Name: `MyApp Customers` (anything)
   - Domain: e.g. `myappcustomers`
   - Region: your choice.
6. Complete the wizard and wait for creation.
7. Switch into this tenant:
   - Top‑right tenant picker → **Switch tenant** → select the new external tenant.

---

### 6. Customer user flow (email/password + Google)

In the **external** tenant at `https://entra.microsoft.com`:

1. Left nav: **Identity → External Identities → User flows**.
2. Click **+ New user flow**.
3. Choose **Sign up and sign in**.
4. Configure:
   - Name: `B2C_1_signup_signin` (or similar).
   - Auth methods:
     - Email with password.
     - Google provider (configure client ID/secret if you want Google now; you can add it later).
5. Create the flow.
6. Open the created flow → **Overview → Run user flow** (or equivalent).
7. In the panel that opens, copy the **OpenID Connect metadata URL**.
   - It looks like:  
     `https://<your-tenant>.ciamlogin.com/<tenant-id>/v2.0/.well-known/openid-configuration?appid=<appId>`
   - This exact URL is your **Metadata URL** for Container Apps auth.

---

### 7. App registration in the external tenant

1. Still in the external tenant: **Identity → Applications → App registrations → New registration**.
2. Name: `template-base-app` (or per project).
3. Redirect URI: you can leave blank for now; we will add it after configuring the Container App.
4. Register.
5. Copy **Application (client) ID** – call this **CLIENT_ID**.
6. Under **Certificates & secrets → + New client secret**:
   - Description: `container-app`
   - Expires: as desired.
   - Copy the **Value** – call this **CLIENT_SECRET**.

---

### 8. Wire auth into the Container App (built‑in auth)

In the **Azure Portal** (`https://portal.azure.com`), back in your main subscription tenant:

1. Open `rg-<slug>-dev` → your **Container App**.
2. Left nav: **Authentication** → **+ Add identity provider**.
3. Choose **Custom OpenID Connect**.
4. Fill:
   - Provider name: `externalid` (must match the path we use in the redirect URI).
   - Metadata URL: paste the **OpenID configuration URL** from the user flow.
   - Client ID: **CLIENT_ID** from the app registration.
   - Client secret: **CLIENT_SECRET**.
5. Save.

Build the redirect URI yourself:

- Get the app host from **Container App → Overview → Application URL**, e.g.  
  `https://ca-templa-dev-34fc2t.something.azurecontainerapps.io`
- Redirect URI:
  ```text
  https://ca-templa-dev-34fc2t.something.azurecontainerapps.io/.auth/login/externalid/callback
  ```

Add this redirect URI to the app registration in the external tenant:

1. Back in `https://entra.microsoft.com`, external tenant.
2. App registrations → open your app → **Authentication**.
3. Under **Web** platform:
   - Add the redirect URI above.
   - Save.

---

### 9. Turn on auth and protect `/app`

In the Container App **Authentication** blade:

1. Turn **Authentication** **On**.
2. Ensure `externalid` provider is **On**.
3. For a simple setup:
   - Deny unauthenticated requests globally.
   - Optionally, add per‑path rules (if available) so:
     - `/public` and `/` are anonymous.
     - `/app` requires auth.

App behavior (from this template):

- `/public` – always open, with link to `/app`.
- `/app` – uses `x-ms-client-principal` headers to show:
  - Signed in as: email or name.
  - Identity provider.
- `/diagnostics` – calls `/api/diag`:
  - `appOk`, `dbOk`, `authOk`.
  - Helpful messages if DB or auth missing.

---

### 10. Final sanity checks (green path)

In a private/incognito window:

1. Hit `/public` → see public page + link to `/app`.
2. Click `/app`:
   - Should redirect to External ID sign‑up / sign‑in.
   - After login, you see `/app` with “Signed in as: <your email>”.
3. Hit `/diagnostics`:
   - Health: OK
   - DB: OK
   - Auth: OK
   - Messages array is empty (or informational only).

At this point you have a **fully working pipeline → infra → DB → auth** stack for a new app.

