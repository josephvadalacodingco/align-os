## Migrate an Existing App to the Template Base (Infra + DB + Auth)

This file is the **law of the land** for turning **any** app repo into “one of these”:

- Azure Container Apps
- Azure Database for PostgreSQL Flexible Server
- Microsoft Entra External ID (platform auth)
- Pipeline‑first GitHub Actions with `azd`

Follow it **literally**. If any step is skipped, the migration will break.

The CI/CD story is **identical for every repo**:

- You must use these exact workflows, unchanged:
  - `.github/workflows/deploy-dev.yml`
  - `.github/workflows/deploy-prod.yml`
- You do **not** add other Azure deploy workflows.
- Per‑repo differences are only:
  - GitHub **variables/secrets**.
  - `appSlug` / `template.config.json`.
  - (Optionally) branch names if you don’t use `main` / `prod`.

---

## 0. Contracts every migrated repo must satisfy

If you want “works like template‑base” for any repo, that repo **must** meet these contracts.

### 0.1 Repo contract (files and layout)

In the root of **every** migrated repo:

- These files/directories must exist (copied from this template, paths unchanged):
  - `azure.yaml`
  - `infra/main.bicep`
  - `infra/infra.bicep`
  - `infra/main.parameters.json`
  - `.github/workflows/deploy-dev.yml`
  - `.github/workflows/deploy-prod.yml`
- Your actual app must live under `app/`:
  - `app/Dockerfile`
  - `app/package.json`
  - `app/package-lock.json` (kept in sync with `package.json` by running `npm install`)
  - Your `app/src/...` or other framework files.

If these files or paths differ, this guide does **not** apply until you fix them.

### 0.1.1 If these files do not exist, AGENT MUST CREATE THEM WITH EXACT CONTENTS BELOW

If you are a **Cursor agent** in a repo that contains this file and any of the required infra/CI files are missing or obviously diverge, you should:

- **Overwrite** them with the exact contents below (do not try to be clever).

#### `azure.yaml`

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/Azure/azure-dev/main/schemas/v1.0/azure.yaml.json

name: template-base

services:
  web:
    project: ./app
    language: ts
    host: containerapp
    docker:
      path: Dockerfile
      context: .
```

#### `infra/main.bicep`

```bicep
targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (e.g. dev, prod)')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('App slug from template.config.json (e.g. alignos)')
param appSlug string = 'alignos'

@description('Git commit SHA, set during deploy (e.g. from github.sha)')
param gitSha string = 'unknown'

@description('Override resource group name')
param resourceGroupName string = ''

@description('Override container apps environment name')
param containerAppsEnvironmentName string = ''

@description('Override container registry name')
param containerRegistryName string = ''

@description('Override container app name')
param containerAppName string = ''

@description('Container image (use current app image when re-provisioning so image is not overwritten)')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('PostgreSQL admin login')
param postgresAdminLogin string = 'pgadmin'
@secure()
@description('PostgreSQL admin password (min 8 chars, mixed case, numbers, symbols)')
param postgresAdminPassword string
@description('DEV only: public IP to allow for local dev (e.g. from azd env). Empty = skip.')
param devPublicIp string = ''
@description('PostgreSQL database name')
param postgresDatabaseName string = 'appdb'
@description('Region for PostgreSQL only (defaults to location). Set when primary location has Postgres quota restrictions (e.g. eastus2).')
param postgresLocation string = ''

var slugForNaming = replace(toLower(appSlug), '_', '-')
var tags = {
  'azd-env-name': environmentName
}

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : 'rg-${slugForNaming}-${environmentName}'
  location: location
  tags: tags
}

module infra './infra.bicep' = {
  name: 'infra-deployment'
  scope: rg
  params: {
    environmentName: environmentName
    location: location
    appSlug: appSlug
    gitSha: gitSha
    containerImage: containerImage
    containerAppsEnvironmentName: containerAppsEnvironmentName
    containerRegistryName: containerRegistryName
    containerAppName: containerAppName
    postgresAdminLogin: postgresAdminLogin
    postgresAdminPassword: postgresAdminPassword
    devPublicIp: devPublicIp
    postgresDatabaseName: postgresDatabaseName
    postgresLocation: postgresLocation
  }
}

output containerAppUrl string = infra.outputs.containerAppUri
output resourceGroupName string = rg.name
output containerAppName string = infra.outputs.containerAppName
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_CONTAINER_REGISTRY_NAME string = infra.outputs.acrName
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = infra.outputs.acrLoginServer
output AZURE_CONTAINER_ENVIRONMENT_NAME string = infra.outputs.envName
output postgresServerFqdn string = infra.outputs.postgresServerFqdn
output databaseName string = infra.outputs.databaseName
output postgresAdminLogin string = infra.outputs.postgresAdminLogin
output devDatabaseUrlInstructions string = infra.outputs.devDatabaseUrlInstructions
```

#### `infra/infra.bicep`

```bicep
targetScope = 'resourceGroup'

@minLength(1)
param environmentName string
@minLength(1)
param location string
param appSlug string = 'alignos'
param gitSha string = 'unknown'
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
param containerAppsEnvironmentName string = ''
param containerRegistryName string = ''
param containerAppName string = ''
@description('PostgreSQL admin login (e.g. pgadmin)')
param postgresAdminLogin string = 'pgadmin'
@secure()
@description('PostgreSQL admin password (min 8 chars, mixed case, numbers, symbols)')
param postgresAdminPassword string
@description('DEV only: public IP to allow (e.g. for local dev). Leave empty to skip.')
param devPublicIp string = ''
@description('Database name on the server')
param postgresDatabaseName string = 'appdb'
@description('Region for PostgreSQL only. Defaults to location; when location is eastus we use westus3 for Postgres for common subscription restrictions.')
param postgresLocation string = ''

var slugForNaming = replace(toLower(appSlug), '_', '-')
// East US (and often East US 2) have capacity restrictions for free/student/basic subs (LocationIsOfferRestricted).
// West US 3 typically has capacity when east regions don't. Override with postgresLocation if needed.
var postgresRegion = !empty(postgresLocation) ? postgresLocation : (location == 'eastus' ? 'westus3' : location)
var postgresRegionSuffix = postgresRegion != location ? '-${replace(replace(replace(postgresRegion, 'eastus', 'e'), 'westus', 'w'), 'central', 'c')}' : ''
var resourceToken = toLower(substring(uniqueString(subscription().id, environmentName, location), 0, 6))
var tags = { 'azd-env-name': environmentName }
var slugShort = substring(replace(slugForNaming, '-', ''), 0, min(6, length(replace(slugForNaming, '-', ''))))
var containerAppNameDefault = 'ca-${slugShort}-${environmentName}-${resourceToken}'
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'log-${slugForNaming}-${environmentName}-${resourceToken}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: !empty(containerAppsEnvironmentName) ? containerAppsEnvironmentName : 'cae-${slugForNaming}-${environmentName}-${resourceToken}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: !empty(containerRegistryName) ? containerRegistryName : 'cr${replace(slugForNaming, '-', '')}${environmentName}${resourceToken}'
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: true
  }
}

resource webIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-web-${slugShort}-${environmentName}-${resourceToken}'
  location: location
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, webIdentity.id, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: webIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

var postgresServerName = 'pg-${slugShort}-${environmentName}-${resourceToken}${postgresRegionSuffix}'
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: postgresServerName
  location: postgresRegion
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '15'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  parent: postgres
  name: postgresDatabaseName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource firewallAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource firewallAllowAll 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = {
  parent: postgres
  name: 'AllowAll'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '255.255.255.255' }
}

resource firewallAllowDev 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = if (!empty(devPublicIp)) {
  parent: postgres
  name: 'AllowDevPublicIp'
  properties: { startIpAddress: devPublicIp, endIpAddress: devPublicIp }
}

var postgresFqdn = postgres.properties.fullyQualifiedDomainName
var databaseUrl = 'postgresql://${postgresAdminLogin}:${postgresAdminPassword}@${postgresFqdn}:5432/${postgresDatabaseName}?sslmode=require'

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: !empty(containerAppName) ? containerAppName : containerAppNameDefault
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${webIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        traffic: [
          { latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: webIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'main'
          image: containerImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'ENVIRONMENT_NAME', value: environmentName }
            { name: 'APP_SLUG', value: appSlug }
            { name: 'GIT_SHA', value: gitSha }
            { name: 'DATABASE_URL', value: databaseUrl }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
      }
    }
  }
}

output containerAppUri string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerAppName string = containerApp.name
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output envName string = containerAppsEnv.name
output postgresServerFqdn string = postgres.properties.fullyQualifiedDomainName
output databaseName string = postgresDatabaseName
output postgresAdminLogin string = postgresAdminLogin
output devDatabaseUrlInstructions string = 'In app/.env.local set DATABASE_URL=postgresql://<postgresAdminLogin>:<your-password>@<postgresServerFqdn>:5432/<databaseName>?sslmode=require (get postgresAdminLogin, postgresServerFqdn, databaseName from azd env get-values)'
```

#### `infra/main.parameters.json`

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": {
      "value": "${AZURE_ENV_NAME}"
    },
    "location": {
      "value": "${AZURE_LOCATION}"
    },
    "appSlug": {
      "value": "${APP_SLUG=alignos}"
    },
    "gitSha": {
      "value": "${GIT_SHA=unknown}"
    },
    "containerImage": {
      "value": "${CONTAINER_APP_IMAGE=mcr.microsoft.com/azuredocs/containerapps-helloworld:latest}"
    },
    "postgresAdminLogin": {
      "value": "${POSTGRES_ADMIN_LOGIN=pgadmin}"
    },
    "postgresAdminPassword": {
      "value": "${POSTGRES_ADMIN_PASSWORD}"
    },
    "devPublicIp": {
      "value": "${DEV_PUBLIC_IP=}"
    },
    "postgresDatabaseName": {
      "value": "${POSTGRES_DATABASE_NAME=appdb}"
    },
    "postgresLocation": {
      "value": "${POSTGRES_LOCATION=}"
    }
  }
}
```

#### `.github/workflows/deploy-dev.yml`

```yaml
# Deploy to DEV on push to main
# Configure: azd pipeline config (or set vars: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID, AZURE_ENV_NAME, AZURE_LOCATION, APP_SLUG)
# Step 2: Set secret POSTGRES_ADMIN_PASSWORD. If Postgres fails in your region (LocationIsOfferRestricted), set var POSTGRES_LOCATION (e.g. eastus2).
# OIDC: Set id-token: write and use federated credentials

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      AZURE_CLIENT_ID: ${{ vars.AZURE_CLIENT_ID }}
      AZURE_TENANT_ID: ${{ vars.AZURE_TENANT_ID }}
      AZURE_SUBSCRIPTION_ID: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      AZURE_ENV_NAME: ${{ vars.AZURE_ENV_NAME }}
      AZURE_LOCATION: ${{ vars.AZURE_LOCATION }}
      APP_SLUG: ${{ vars.APP_SLUG }}
      GIT_SHA: ${{ github.sha }}
      POSTGRES_LOCATION: ${{ vars.POSTGRES_LOCATION }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install azd
        uses: Azure/setup-azd@v2

      - name: Log in with Azure (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: Set CONTAINER_APP_IMAGE (preserve existing image when re-provisioning)
        run: |
          RG="rg-$(echo ${APP_SLUG//_/-} | tr '[:upper:]' '[:lower:]')-${AZURE_ENV_NAME}"
          IMAGE=$(az containerapp list --resource-group "$RG" --query "[?tags.\"azd-service-name\"=='web'].properties.template.containers[0].image" -o tsv 2>/dev/null | head -1 || true)
          if [ -n "$IMAGE" ]; then
            echo "CONTAINER_APP_IMAGE=$IMAGE" >> $GITHUB_ENV
            echo "Using existing container image so provision does not overwrite it"
          else
            echo "CONTAINER_APP_IMAGE=mcr.microsoft.com/azuredocs/containerapps-helloworld:latest" >> $GITHUB_ENV
            echo "No existing app, using placeholder image"
          fi

      - name: Log in with azd (OIDC)
        run: |
          azd auth login \
            --client-id "$AZURE_CLIENT_ID" \
            --federated-credential-provider "github" \
            --tenant-id "$AZURE_TENANT_ID"

      - name: Prepare azd environment (ensure env exists and set Postgres password for Bicep)
        run: |
          azd env select "$AZURE_ENV_NAME" 2>/dev/null || azd env new "$AZURE_ENV_NAME" --no-prompt
          azd env set POSTGRES_ADMIN_PASSWORD "$POSTGRES_ADMIN_PASSWORD"
          [ -n "$POSTGRES_LOCATION" ] && azd env set POSTGRES_LOCATION "$POSTGRES_LOCATION" || true
        env:
          POSTGRES_ADMIN_PASSWORD: ${{ secrets.POSTGRES_ADMIN_PASSWORD }}

      - name: Provision Infrastructure
        run: azd provision --no-prompt
        env:
          AZD_INITIAL_ENVIRONMENT_CONFIG: ${{ secrets.AZD_INITIAL_ENVIRONMENT_CONFIG }}

      - name: Deploy Application
        run: azd deploy --no-prompt
```

#### `.github/workflows/deploy-prod.yml`

```yaml
# Deploy to PROD on push to prod branch
# Configure: Set vars for prod env (AZURE_ENV_NAME=prod, etc.)
# OIDC: Use federated credential with subject repo:owner/repo:ref:refs/heads/prod

on:
  push:
    branches: [prod]

permissions:
  id-token: write
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    environment: prod
    env:
      AZURE_CLIENT_ID: ${{ vars.AZURE_CLIENT_ID }}
      AZURE_TENANT_ID: ${{ vars.AZURE_TENANT_ID }}
      AZURE_SUBSCRIPTION_ID: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      AZURE_ENV_NAME: ${{ vars.AZURE_ENV_NAME }}
      AZURE_LOCATION: ${{ vars.AZURE_LOCATION }}
      APP_SLUG: ${{ vars.APP_SLUG }}
      GIT_SHA: ${{ github.sha }}
      POSTGRES_LOCATION: ${{ vars.POSTGRES_LOCATION }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install azd
        uses: Azure/setup-azd@v2

      - name: Log in with Azure (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      - name: Set CONTAINER_APP_IMAGE (preserve existing image when re-provisioning)
        run: |
          RG="rg-$(echo ${APP_SLUG//_/-} | tr '[:upper:]' '[:lower:]')-${AZURE_ENV_NAME}"
          IMAGE=$(az containerapp list --resource-group "$RG" --query "[?tags.\"azd-service-name\"=='web'].properties.template.containers[0].image" -o tsv 2>/dev/null | head -1 || true)
          if [ -n "$IMAGE" ]; then
            echo "CONTAINER_APP_IMAGE=$IMAGE" >> $GITHUB_ENV
            echo "Using existing container image so provision does not overwrite it"
          else
            echo "CONTAINER_APP_IMAGE=mcr.microsoft.com/azuredocs/containerapps-helloworld:latest" >> $GITHUB_ENV
            echo "No existing app, using placeholder image"
          fi

      - name: Log in with azd (OIDC)
        run: |
          azd auth login \
            --client-id "$AZURE_CLIENT_ID" \
            --federated-credential-provider "github" \
            --tenant-id "$AZURE_TENANT_ID"

      - name: Prepare azd environment (ensure env exists and set Postgres password for Bicep)
        run: |
          azd env select "$AZURE_ENV_NAME" 2>/dev/null || azd env new "$AZURE_ENV_NAME" --no-prompt
          azd env set POSTGRES_ADMIN_PASSWORD "$POSTGRES_ADMIN_PASSWORD"
          [ -n "$POSTGRES_LOCATION" ] && azd env set POSTGRES_LOCATION "$POSTGRES_LOCATION" || true
        env:
          POSTGRES_ADMIN_PASSWORD: ${{ secrets.POSTGRES_ADMIN_PASSWORD }}

      - name: Provision Infrastructure
        run: azd provision --no-prompt
        env:
          AZD_INITIAL_ENVIRONMENT_CONFIG: ${{ secrets.AZD_INITIAL_ENVIRONMENT_CONFIG }}

      - name: Deploy Application
        run: azd deploy --no-prompt
```

Any Cursor agent in a repo that contains this file and lacks these exact files/contents should:

- **Create or overwrite** them with the snippets above.
- Then proceed with the rest of this document (GitHub variables/secrets, `azd pipeline config`, etc.).

### 0.2 GitHub contract (per‑repo config)

For each migrated repo, in **that repo’s** GitHub settings:

**Variables**  
Settings → Secrets and variables → Actions → **Variables**:

- `AZURE_CLIENT_ID` – from the federated SP created by `azd pipeline config`.
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_ENV_NAME` – usually `dev`.
- `AZURE_LOCATION` – primary region for non‑DB resources (e.g. `eastus`).
- `APP_SLUG` – unique slug for this app (also used in `template.config.json`).
- Optional: `POSTGRES_LOCATION` – only if your subscription can’t create Postgres in `AZURE_LOCATION`.

**Secrets**  
Settings → Secrets and variables → Actions → **Secrets**:

- `POSTGRES_ADMIN_PASSWORD` – strong password (8+ chars, mixed case, numbers, symbol).
- `AZD_INITIAL_ENVIRONMENT_CONFIG` – only if `azd pipeline config` for this repo produced one.

You must set these for **every repo** you migrate.

### 0.3 Local contract (one command per repo)

On your machine, once per repo:

```bash
cd <that-repo>
azd pipeline config
```

- Choose **GitHub** + **Federated Service Principal (OIDC)**.
- This pairs **that GitHub repo** with Azure and is why we can reuse the same workflows.

If you skip this in a repo, its `deploy-dev.yml` will not be correctly wired to Azure.

### 0.4 App contract (how the app behaves)

Inside `app/` in each repo:

- `npm run build` must build the app.
- `npm run start` must start the app listening on `PORT` or `3000` and `0.0.0.0`.
- Dockerfile assumes:
  - `npm ci`
  - `npm run build`
  - `npm run start`

If you change how your app builds/starts, you must either:
- Update your scripts to match the Dockerfile, or
- Update the Dockerfile to call the right scripts.

### 0.5 Auth contract (External ID tenant reuse)

We use **one Microsoft Entra External ID (CIAM) tenant** for all apps.

Per app you either:

- Reuse the **same app registration** and add another redirect URI, or
- Create a **new app registration** in that external tenant with its own client ID/secret.

Every Container App then:

- Uses the same **Metadata URL** (OpenID configuration URL) from the user flow.
- Uses that app’s **Client ID** / **Client Secret**.
- Uses a redirect URI of the form:  
  `https://<that-app-host>/.auth/login/externalid/callback`.

---

### 1. Bring your app code into the template repo

1. Start from this repo as a **new repo** for the migrated app (clone or use as template).
2. In `app/`:
   - Replace the placeholder Next.js app with your app’s source:
     - Either copy your existing Next.js app into `app/`, or
     - If it’s another Node app, adapt to:
       - Listen on `PORT` (fall back to 3000).
       - Bind to `0.0.0.0`.
   - Keep:
     - `Dockerfile`
     - `next.config.js` (or adjust as needed)
     - `package.json` / `package-lock.json` (merge your deps + template deps).
3. Update `package.json`:
   - Make sure scripts:
     - `"build"` builds the app.
     - `"start"` starts the built app.
4. Run locally:
   ```bash
   cd app
   npm install
   npm run build
   npm run start
   ```
   Confirm the app runs on `http://localhost:3000`.

---

### 2. Wire in diagnostics and DB (optional but recommended)

Pick how “template‑ized” you want your existing app to be:

#### Minimal

- Keep your app as‑is, only adopting:
  - Dockerfile
  - Infra (Bicep)
  - GitHub Actions + `azd`
- You **don’t have to use** the template’s `/diagnostics`, `/api/diag`, etc.

#### Full

- Copy the template’s:
  - `/diagnostics` page
  - `/api/health`
  - `/api/env-check`
  - `/api/diag`
  - `/api/db-check`, `/api/db-seed`
  - `/public` and `/app` routes
- Adjust your existing app pages to **link** to `/diagnostics` and optionally embed DB/auth info.

For a consistent experience across apps, the **full** option is recommended.

---

### 3. Configure portability for this app

1. Update `template.config.json`:
   - `appSlug`: unique slug for this app, e.g. `billing_service`.
   - `appDisplayName`: e.g. `Billing Service`.
2. Commit.

Everything will be named off this slug: resource group, container app, ACR, etc.

---

### 4. Adopt the pipeline (GitHub + azd)

1. Push this repo to **GitHub** (new repo per app).
2. On a dev machine:
   - Install `azd` and Azure CLI.
   - Run:
     ```bash
     azd pipeline config
     ```
     - Select **GitHub** + **Federated Service Principal (OIDC)**.
3. In GitHub repo **Settings → Secrets and variables → Actions**:
   - **Variables**:
     - `AZURE_CLIENT_ID`
     - `AZURE_TENANT_ID`
     - `AZURE_SUBSCRIPTION_ID`
     - `AZURE_ENV_NAME` = `dev`
     - `AZURE_LOCATION` (e.g. `eastus`)
     - `APP_SLUG` = your `appSlug`
     - Optional `POSTGRES_LOCATION` if needed.
   - **Secrets**:
     - `POSTGRES_ADMIN_PASSWORD` – strong password.
     - `AZD_INITIAL_ENVIRONMENT_CONFIG` – if `azd pipeline config` gave you one.

Push to **main** and let the **deploy‑dev** workflow run.

For reference, the working `deploy-dev.yml` does this on each run:

1. **Trigger** – on push to `main` (and `workflow_dispatch`).
2. **Job env** – pulls your repo variables into env (`AZURE_*`, `APP_SLUG`, `GIT_SHA`).
3. **Checkout** the repo.
4. **Install `azd`** via `Azure/setup-azd@v2`.
5. **Azure login (OIDC)** via `azure/login@v2` using `AZURE_CLIENT_ID` / `TENANT_ID` / `SUBSCRIPTION_ID`.
6. **Set `CONTAINER_APP_IMAGE`**:
   - Script looks up any existing Container App in `rg-<slug>-<env>` tagged `azd-service-name=web`.
   - If found, sets `CONTAINER_APP_IMAGE` to its current image so re‑provision doesn’t overwrite it.
   - If not found, uses a public hello‑world image.
7. **`azd auth login`** using the same federated credential.
8. **Prepare azd env**:
   - `azd env select "$AZURE_ENV_NAME"` or `azd env new "$AZURE_ENV_NAME" --no-prompt`.
   - `azd env set POSTGRES_ADMIN_PASSWORD "$POSTGRES_ADMIN_PASSWORD"`.
   - If `POSTGRES_LOCATION` is non‑empty: `azd env set POSTGRES_LOCATION "$POSTGRES_LOCATION"`.
9. **Provision**:
   - `azd provision --no-prompt` → runs `infra/main.bicep` with `infra/main.parameters.json`.
10. **Deploy**:
    - `azd deploy --no-prompt` → builds Docker image (`npm ci` → `npm run build` → `npm run start` in container), pushes to ACR, updates the Container App.

The `deploy-prod.yml` workflow mirrors this for the `prod` branch / environment, with:

- Trigger: push to `prod`.
- A GitHub **environment** named `prod`.
- Same sequence of steps.

---

## 5. Worked example (template → VendVault) – copy/paste checklist

This is a **concrete example** of migrating an existing app repo called **VendVault** to this template.  
Substitute your own repo name/paths, but follow the same pattern.

### 5.1 Copy infra + config from template into VendVault

**From this template repo → VendVault repo root** (overwriting if they exist), copy:

- `azure.yaml`
- `infra/main.bicep`
- `infra/infra.bicep`
- `infra/main.parameters.json`
- `template.config.json`

**Result in VendVault repo:**

- VendVault now has **identical** `azure.yaml` and `infra/**` as this repo.
- VendVault has its own `template.config.json` where you set:
  - `appSlug`: `"vendvault"` (or your slug)
  - `appDisplayName`: `"VendVault"` (or similar)

### 5.2 Copy the workflows

In the **template** repo under `.github/workflows`:

- Copy:
  - `.github/workflows/deploy-dev.yml`
  - `.github/workflows/deploy-prod.yml`

In the **VendVault** repo under `.github/workflows`:

- Delete any old azd workflows, e.g.:
  - `deploy-dev-azd.yml`
  - `deploy-prod-azd.yml`
- Paste in the template’s:
  - `deploy-dev.yml`
  - `deploy-prod.yml`

**Important:** Do **not** rename or edit these workflow files beyond trigger branches / prod environment name. They must stay the same.

Now VendVault and this template share the same:

- `azure.yaml`
- `infra/**`
- `.github/workflows/deploy-*.yml`

Only **app code** and `template.config.json` differ.

### 5.3 Put VendVault’s app where the template expects it (`app/`)

The template expects your app under `app/`:

- `app/Dockerfile`
- `app/package.json`
- `app/package-lock.json`
- `app/src/...`

In VendVault:

1. Ensure an `app/` folder exists (you can start from the template’s `app/` and then replace the placeholder app).
2. Copy your existing VendVault frontend into `app/`, e.g.:
   - From: `apps/vendvault/frontend/*`
   - To: `app/`
3. In `app/package.json`, ensure scripts match what the Dockerfile expects:

```json
"scripts": {
  "build": "next build",
  "start": "next start"
}
```

(If the template uses slightly different script names, keep the template’s pattern and merge your dependencies into it.)

4. Verify locally on your machine:

```bash
cd "c:\Software Projects\Modern Vending Warehouse App\VendVault\app"
npm install
npm run build
npm run start
```

Confirm VendVault runs at `http://localhost:3000`.

### 5.4 Wire azd pipeline for **this** repo (VendVault)

On your machine:

```bash
cd "c:\Software Projects\Modern Vending Warehouse App\VendVault"
azd pipeline config
```

- Choose **GitHub** + **Federated Service Principal (OIDC)**.
- When asked which app registration to use, pick the SP you want for VendVault (e.g. `VendVault-GitHub-Actions`).

This wires VendVault’s `deploy-dev.yml` / `deploy-prod.yml` to Azure exactly like the template’s, but for this repo.

### 5.5 Set GitHub variables/secrets for VendVault

In **VendVault’s** GitHub repo:

Go to **Settings → Secrets and variables → Actions → Variables** and set:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_ENV_NAME` = `dev`
- `AZURE_LOCATION` = region for core resources (same as template, e.g. `eastus`)
- `APP_SLUG` = slug from VendVault’s `template.config.json` (e.g. `vendvault`)
- Optional: `POSTGRES_LOCATION` = alt region for Postgres if `AZURE_LOCATION` is restricted.

Then under **Settings → Secrets and variables → Actions → Secrets**, set:

- `POSTGRES_ADMIN_PASSWORD` – same strong password you want for VendVault DB.
- `AZD_INITIAL_ENVIRONMENT_CONFIG` – **only** if `azd pipeline config` for VendVault printed one and told you to set it.

### 5.6 (Optional) Local azd env for VendVault

If you want to run `azd` locally for VendVault:

```bash
cd "c:\Software Projects\Modern Vending Warehouse App\VendVault"
azd env new dev --location <same AZURE_LOCATION>   # or azd env select dev if it already exists
azd env config set infra.parameters.appSlug vendvault
azd env config set infra.parameters.environmentName dev
azd env set POSTGRES_ADMIN_PASSWORD "<same as GitHub secret>"
# Optional:
# azd env set POSTGRES_LOCATION "<region>"
```

Then, to sanity‑check before relying solely on the pipeline:

```bash
azd provision --no-prompt
azd deploy --no-prompt
```

If this works, VendVault is now in **exactly the same setup** as this template:

- Same infra (Bicep).
- Same pipelines (`deploy-dev.yml` / `deploy-prod.yml`).
- Same `azd` config pattern.
- App code under `app/` is your VendVault UI.


---

### 5. Lift‑and‑shift DB (optional)

If your existing app already uses Postgres and you want to **point it at the new Azure Flexible Server**:

1. After `azd provision` succeeds, run:
   ```bash
   azd env get-values
   ```
2. Note:
   - `postgresServerFqdn`
   - `databaseName`
   - `postgresAdminLogin`
3. Build your `DATABASE_URL`:
   ```text
   postgresql://<postgresAdminLogin>:<POSTGRES_ADMIN_PASSWORD>@<postgresServerFqdn>:5432/<databaseName>?sslmode=require
   ```
4. For **deployed app**:
   - The infra already injects `DATABASE_URL` into the Container App.
   - Adjust your app’s DB code to use `process.env.DATABASE_URL`.
5. For **local dev**:
   - Create `app/.env.local`:
     ```bash
     DATABASE_URL=postgresql://<login>:<password>@<fqdn>:5432/<db>?sslmode=require
     ```
   - `cd app && npm run dev` – you’ll hit the **DEV Azure DB**, no local DB container.

If you have existing data, migrate it into this Postgres instance using your usual tools (pg_dump/pg_restore, scripts, etc.).

---

### 6. Adopt platform auth for an existing app

If your existing app already has some auth, you can:

- Keep your current auth and **skip** Container Apps auth, or
- Shift to **platform auth** (recommended) and treat your app as “header‑based identity”:
  - Trust `X-MS-CLIENT-PRINCIPAL`, `X-MS-CLIENT-PRINCIPAL-NAME`, `X-MS-CLIENT-PRINCIPAL-ID`.

To adopt platform auth:

1. Follow the **External ID tenant + user flow + app registration** steps from `AUTH_TEMPLATE_NEW_APP.md`.
2. Add **Custom OpenID Connect** provider to the Container App (metadata URL, CLIENT_ID, CLIENT_SECRET).
3. Add redirect URI to the External ID app.
4. Turn auth **On** for the Container App and:
   - Require auth for your “protected” routes (e.g. `/app`, `/dashboard`, etc.).
   - Allow anonymous for public routes (e.g. `/`, `/public`).
5. In your app, change places where you read identity to instead read from the headers:
   - Decode `x-ms-client-principal` (base64 → JSON).
   - Use `claims` to get `email`, `name`, `userId`.

You can copy the example from `app/src/app/app/page.tsx` as a reference implementation.

---

### 7. Use diagnostics to verify migration

After the first deploy:

- `/diagnostics`:
  - Health: OK → container up.
  - DB: OK → DATABASE_URL working.
  - Auth: OK → platform auth headers present.
- `/api/env-check`:
  - Shows `ENVIRONMENT_NAME`, `APP_SLUG`, `DATABASE_URL_PRESENT`, and which auth headers are present.
- `/api/diag`:
  - Rollup of app, DB, auth with helpful messages.

Add links to these endpoints in your existing app’s nav or admin area so you always have a zero‑think troubleshooting path.

