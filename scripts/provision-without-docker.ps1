# Provision infra without Docker (azd checks for Docker even on provision).
# Use this when Docker doesn't work locally. Deploy via GitHub Actions.
# Usage: ./scripts/provision-without-docker.ps1 [-Env dev|prod] [-Update]
#   -Update: use when container app already exists (e.g. re-provision after Bicep changes)
param([string]$Env = "dev", [switch]$Update)
Set-Location $PSScriptRoot\..
$params = if ($Update) { "infra/parameters.$Env-update.json" } else { "infra/parameters.$Env.json" }
if (-not (Test-Path $params)) { Write-Error "Missing $params"; exit 1 }
Write-Host "Provisioning env: $Env (params: $params)"
az deployment sub create `
  --location eastus `
  --template-file infra/main.bicep `
  --parameters "@$params" `
  --name "azd-$Env-$(Get-Date -Format 'yyyyMMddHHmmss')"
