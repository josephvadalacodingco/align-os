targetScope = 'resourceGroup'

@description('Short app name, e.g. app1')
param appName string

@allowed([
  'dev'
  'prod'
])
param environmentName string

@description('Azure region')
param location string = resourceGroup().location

@allowed([
  'core'
  'db'
  'full'
])
@description('core = ACR + identity + CAE + app, db = core + postgres, full = db + monitoring')
param deployStage string = 'core'

@description('Container Apps environment name')
param containerAppsEnvironmentName string

@description('Container App name')
param containerAppName string

@description('User-assigned managed identity name')
param identityName string

@description('Azure Container Registry name')
param acrName string

@description('Log Analytics workspace name')
param logAnalyticsName string

@description('Application Insights name')
param appInsightsName string

@description('PostgreSQL server name')
param postgresServerName string

@description('PostgreSQL database name')
param postgresDbName string = 'appdb'

@description('PostgreSQL admin username')
param postgresAdminUser string = 'pgadminlocal'

@secure()
@description('PostgreSQL admin password')
param postgresAdminPassword string

@description('Container image name')
param imageName string = 'web'

@description('Container image tag')
param imageTag string = 'latest'

@description('Container port')
param targetPort int = 3000

@description('Minimum replicas')
param minReplicas int = 1

@description('Maximum replicas')
param maxReplicas int = 2

@description('CPU cores as string so 0.5 works too')
param containerCpu string = '0.5'

@description('Memory, e.g. 1Gi or 2Gi')
param containerMemory string = '1Gi'

@description('Expose app publicly')
param externalIngress bool = true

var tags = {
  app: appName
  environment: environmentName
  managedBy: 'bicep'
}

var deployDb = contains([
  'db'
  'full'
], deployStage)

var deployMonitor = contains([
  'full'
], deployStage)

module acr './modules/acr.bicep' = {
  name: 'acr'
  params: {
    location: location
    acrName: acrName
    tags: tags
  }
}

module identity './modules/identity.bicep' = {
  name: 'identity'
  params: {
    location: location
    identityName: identityName
    tags: tags
  }
}

module monitor './modules/monitor.bicep' = if (deployMonitor) {
  name: 'monitor'
  params: {
    location: location
    logAnalyticsName: logAnalyticsName
    appInsightsName: appInsightsName
    tags: tags
  }
}

module cae './modules/container-app-env.bicep' = {
  name: 'cae'
  params: {
    location: location
    containerAppsEnvironmentName: containerAppsEnvironmentName
    logAnalyticsWorkspaceId: deployMonitor ? monitor.outputs.logAnalyticsWorkspaceId : ''
    tags: tags
  }
}

module postgres './modules/postgres.bicep' = if (deployDb) {
  name: 'postgres'
  params: {
    location: location
    postgresServerName: postgresServerName
    postgresDbName: postgresDbName
    postgresAdminUser: postgresAdminUser
    postgresAdminPassword: postgresAdminPassword
    tags: tags
  }
}

module app './modules/container-app.bicep' = {
  name: 'app'
  params: {
    location: location
    containerAppName: containerAppName
    containerAppsEnvironmentId: cae.outputs.containerAppsEnvironmentId
    identityResourceId: identity.outputs.id
    identityPrincipalId: identity.outputs.principalId
    acrName: acrName
    acrLoginServer: acr.outputs.loginServer
    imageName: imageName
    imageTag: imageTag
    targetPort: targetPort
    minReplicas: minReplicas
    maxReplicas: maxReplicas
    containerCpu: containerCpu
    containerMemory: containerMemory
    externalIngress: externalIngress
    appInsightsConnectionString: deployMonitor ? monitor.outputs.appInsightsConnectionString : ''
    postgresHost: deployDb ? postgres.outputs.fqdn : ''
    postgresDbName: deployDb ? postgresDbName : ''
    deployStage: deployStage
    tags: tags
  }
}

output containerAppName string = containerAppName
output containerAppFqdn string = app.outputs.fqdn
output acrName string = acrName
output acrLoginServer string = acr.outputs.loginServer
output postgresHost string = deployDb ? postgres.outputs.fqdn : ''