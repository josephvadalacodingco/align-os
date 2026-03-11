# Quickstart: One Hour to Deployed App

Everything runs in the pipeline. No local Docker.

## 1. Prerequisites

- Azure subscription
- [azd](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd) and [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- `az login` completed
- Repo pushed to GitHub

## 2. Configure pipeline

```bash
azd pipeline config
# Choose Federated Service Principal (SP + OIDC)
```

Set repo variables: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, AZURE_ENV_NAME, AZURE_LOCATION, APP_SLUG.

## 3. Deploy

Push to `main`. The deploy-dev workflow runs: provision + build (in runner) + deploy. No local Docker.

## 4. Verify

Check the workflow run for the deployment URL, or Azure Portal → Resource group → Container App.

Open: `<url>` → Hello World; `<url>/api/health`; `<url>/diagnostics`.

## 5. Prod

Create Environment "prod" in GitHub, set AZURE_ENV_NAME=prod (and other vars). Add federated credential for `ref:refs/heads/prod`. Push to `prod` branch.

## 6. Portability

Edit `template.config.json` (`appSlug`, `appDisplayName`) and re-provision (push or `azd provision`).
