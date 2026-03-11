#!/usr/bin/env bash
# Provision infra without Docker (azd checks for Docker even on provision).
# Use this when Docker doesn't work locally. Deploy via GitHub Actions.
# Usage: ./scripts/provision-without-docker.sh [dev|prod] [--update]
#   --update: use when container app already exists (e.g. re-provision after Bicep changes)
set -e
cd "$(dirname "$0")/.."
ENV="${1:-dev}"
UPDATE=""
[[ "${2:-}" == "--update" ]] && UPDATE=1
PARAMS="infra/parameters.${ENV}.json"
[[ -n "$UPDATE" ]] && PARAMS="infra/parameters.${ENV}-update.json"
[[ ! -f "$PARAMS" ]] && { echo "Missing $PARAMS"; exit 1; }
echo "Provisioning env: $ENV (params: $PARAMS)"
az deployment sub create \
  --location eastus \
  --template-file infra/main.bicep \
  --parameters "@$PARAMS" \
  --name "azd-$ENV-$(date +%s)"
