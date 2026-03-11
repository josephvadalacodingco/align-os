# Troubleshooting

**First step:** Open `/diagnostics` and check the status of Health, DB, and Auth.

## Step 1 failures

### Docker build fails: "/app/public" not found

- Ensure `app/public/` exists (even if empty). Add `.gitkeep` if needed.
- Next.js standalone Dockerfile requires the public folder.

### Docker build fails: context or path errors

- `azure.yaml` docker path and context are relative to `project` (./app).
- Use `path: Dockerfile` and `context: .` (not ./app/Dockerfile).

### UNAUTHORIZED: authentication required (ACR image pull)

- Container app cannot pull images from ACR. Ensure the container app has a managed identity with AcrPull role on the registry.
- The infra uses a user-assigned managed identity for the container app; AcrPull is assigned via the AVM module. If you customized the Bicep, verify identityType, identityName, userAssignedIdentityResourceId, and identityPrincipalId are passed to the container-app-upsert module.

### Docker Desktop won't start (local)

**You don't need local Docker.** Push to `main` → the pipeline runs everything in the GitHub runner (which has Docker).

If you want local deploy: fix Docker (WSL 2, reset to factory defaults, reinstall). See [Docker docs](https://docs.docker.com/desktop/troubleshoot-and-support/troubleshoot/topics/).

### ACR Tasks not allowed (TasksOperationsNotAllowed)

- Free/trial Azure subscriptions often block ACR Tasks (remote build).
- Use local Docker build instead: remove `remoteBuild: true` from azure.yaml.
- For CI: GitHub runners have Docker; build happens there.

### Container won't start

- Check Azure Portal → Container Apps → your app → Revisions
- View Log stream for startup errors
- Ensure `PORT=3000` and app listens on `0.0.0.0`

### Ingress / URL not working

- Verify external ingress is enabled and target port is 3000
- Check Container Apps environment is healthy
- Run `azd env get-values` and confirm `containerAppUrl`

### Provision or deploy fails

- Run `azd provision --debug` or `azd deploy --debug`
- Ensure Bicep parameters (e.g. `parameters.dev.json`) are valid
- Check Azure subscription and resource quotas

### Logs

- Azure Portal → Container Apps → Log stream
- Or: `az containerapp logs show -n <app> -g <rg> --follow`

### Pipeline (GitHub Actions) fails

- **Auth:** Run `azd pipeline config` and choose Federated Service Principal (SP + OIDC).
- **Vars:** Set repo variables: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, AZURE_ENV_NAME, AZURE_LOCATION, APP_SLUG.
- **Step 2:** Set repo **secret** POSTGRES_ADMIN_PASSWORD (required for Bicep to create PostgreSQL). If missing, “Prepare azd environment” or provision may fail.
- **Prod:** Create GitHub Environment "prod", set AZURE_ENV_NAME=prod (and other vars). Add federated credential for `ref:refs/heads/prod`.

## Step 2 failures

- **LocationIsOfferRestricted** ("Subscriptions are restricted from provisioning in location 'eastus'/'eastus2'"): This is **capacity/offer restriction**, not a template bug. **East US and East US 2** often block PostgreSQL for **free, student, and basic** subscriptions. The template defaults Postgres to **West US 3** when your main location is East US (West US 3 usually has capacity). If that still fails, set repo **variable** `POSTGRES_LOCATION` to another region (e.g. `centralus`, `southcentralus`, `westus2`). See [Azure capacity errors](https://learn.microsoft.com/en-us/azure/postgresql/troubleshoot/how-to-resolve-capacity-errors) and [quota increase](https://aka.ms/postgres-request-quota-increase).
- **Provision fails (Postgres):** Ensure repo secret `POSTGRES_ADMIN_PASSWORD` is set (min 8 chars, mixed case, numbers, symbols). Run “Prepare azd environment” step; if env doesn’t exist, `azd env new` runs first.
- **DATABASE_URL not set in container:** Infra injects it from Bicep; re-provision and check container app revision env vars in Azure Portal.
- **/api/db-check returns 500:** Check “likelyCauses” in the JSON. Common: firewall (infra adds AllowAll for Container Apps; for prod consider VNet), wrong URL, or SSL required — use `?sslmode=require` in DATABASE_URL.
- **Local /api/db-check fails:** Create `app/.env.local` with `DATABASE_URL` from `azd env get-values` (postgresServerFqdn, databaseName, postgresAdminLogin + your password). Add your public IP to Postgres firewall (param `devPublicIp`) or use the AllowAll rule in DEV.

## Step 3 failures

*(To be expanded when Step 3 is implemented.)*

- OIDC metadata/issuer mismatch
- Redirect URI configuration
- Provider config
