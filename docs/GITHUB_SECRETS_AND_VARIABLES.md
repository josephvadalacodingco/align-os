# GitHub Actions: Variables and Secrets – Where to Get Each Value

Use this when the pipeline needs **Variables** and **Secrets** and you're starting from zero.  
**Exact steps and locations** for every value.

---

## Where to add them in GitHub

1. Open your repo on **GitHub** (e.g. `https://github.com/YOUR_ORG/align-os`).
2. Click **Settings** (repo settings, not your profile).
3. In the left sidebar, under **Secrets and variables** → **Actions**, click it.
4. You’ll see two tabs: **Variables** and **Secrets**. Use them as below.

---

## Variables (repo or environment)

Add these under **Variables** (green “New repository variable” or “New environment variable” if you use Environments).

| Variable | Where to get the value |
|----------|-------------------------|
| **AZURE_CLIENT_ID** | **Azure Portal** → **Microsoft Entra ID** (search “Entra” or “Azure Active Directory”) → **App registrations** → **All applications**. Find the app that `azd pipeline config` created (name often matches your repo, e.g. `align-os`, or “Azure Developer CLI”). Click it → **Overview** → copy **Application (client) ID** (a GUID like `12345678-abcd-...`). |
| **AZURE_TENANT_ID** | **Azure Portal** → **Microsoft Entra ID** → **Overview** (left menu, first item). Copy **Tenant ID** (a GUID). Same for every app in this tenant. |
| **AZURE_SUBSCRIPTION_ID** | **Azure Portal** → search **Subscriptions** → click your subscription (e.g. “Azure subscription 1”) → copy **Subscription ID** (a GUID). Or in a terminal (after `az login`): `az account show --query id -o tsv` |
| **AZURE_ENV_NAME** | **You choose.** The environment name you gave when you ran `azd pipeline config` (e.g. `dev` or `alignos-dev`). Type that exact value. |
| **AZURE_LOCATION** | **You choose.** Azure region for resources (e.g. `eastus`, `eastus2`, `westus2`). List: **Azure Portal** → **Resource groups** → **Create** → **Region** dropdown. Or: `az account list-locations -o table` and use the **Name** column (e.g. `eastus`). |
| **APP_SLUG** | **From your repo.** Open `template.config.json` in the repo → use the **`appSlug`** value (e.g. `align_os`). Must match so infra naming is consistent. |
| **POSTGRES_LOCATION** | **Optional.** Only if PostgreSQL fails in your main region (e.g. “LocationIsOfferRestricted”). Set to a different region (e.g. `eastus2` or `westus3`). Otherwise leave this variable unset. |

---

## Secrets (repo or environment)

Add these under **Secrets** (red “New repository secret” or “New environment secret”).

| Secret | Where to get the value |
|--------|-------------------------|
| **POSTGRES_ADMIN_PASSWORD** | **You create it.** Invent a strong password for the PostgreSQL admin user (min 8 chars, mixed case, numbers, symbols). Used by Bicep when creating the database server. Store it only in GitHub Secrets and in your password manager; don’t commit it. **Required for Step 2** (database provisioning). |
| **AZD_INITIAL_ENVIRONMENT_CONFIG** | **Only if `azd pipeline config` told you to.** When you ran `azd pipeline config`, it may have printed a JSON block and said to add it as a secret. If it did, copy that **entire** JSON into a secret named `AZD_INITIAL_ENVIRONMENT_CONFIG`. If it didn’t print anything like that, **don’t add this secret**; the pipeline can work without it. |

---

## Quick reference: minimal set for deploy-dev

**Variables (all required except POSTGRES_LOCATION):**

- `AZURE_CLIENT_ID` ← Entra → App registrations → your azd app → Overview → Application (client) ID  
- `AZURE_TENANT_ID` ← Entra → Overview → Tenant ID  
- `AZURE_SUBSCRIPTION_ID` ← Subscriptions → your sub → Subscription ID (or `az account show --query id -o tsv`)  
- `AZURE_ENV_NAME` ← same name you used in `azd pipeline config` (e.g. `dev`)  
- `AZURE_LOCATION` ← e.g. `eastus`  
- `APP_SLUG` ← from `template.config.json` → `appSlug` (e.g. `align_os`)  
- `POSTGRES_LOCATION` ← optional; only if Postgres is restricted in your region  

**Secrets:**

- `POSTGRES_ADMIN_PASSWORD` ← you make it up (strong password; required for DB)  
- `AZD_INITIAL_ENVIRONMENT_CONFIG` ← only if `azd pipeline config` gave you a JSON blob to store  

---

## If you can’t find the App Registration (for AZURE_CLIENT_ID)

After `azd pipeline config` with **Federated** credentials, the app is usually created in the **same tenant** as your Azure login.

1. **Azure Portal** → **Microsoft Entra ID** → **App registrations** → **All applications**.
2. Sort by **Created** (newest first) and look for an app created when you ran the command (name often matches repo or “Azure Developer CLI”).
3. Or in **App registrations** → **Owned applications** (if you were the one who ran `azd pipeline config`), you’ll see it there.
4. Copy its **Application (client) ID** into the **AZURE_CLIENT_ID** variable.

---

## After you’ve set everything

- **Variables** are visible (masked in logs); **Secrets** are not visible after saving.
- Re-run the **Deploy to DEV** workflow (push to `main` or **Actions** → **Deploy to DEV** → **Run workflow**).
- If the run fails, check the error: missing variable names are usually obvious in the logs.
