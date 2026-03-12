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
@description('Region for PostgreSQL only. Defaults to location; when location is eastus we use eastus2 for Postgres (common subscription restriction).')
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
