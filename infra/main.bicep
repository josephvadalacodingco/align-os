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
