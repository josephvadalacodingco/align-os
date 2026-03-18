param location string
param containerAppName string
param containerAppsEnvironmentId string
param identityResourceId string
param identityPrincipalId string
param acrName string
param acrLoginServer string
param imageName string
param imageTag string
param targetPort int
param minReplicas int
param maxReplicas int
param containerCpu string
param containerMemory string
param externalIngress bool
param appInsightsConnectionString string = ''
param postgresHost string = ''
param postgresDbName string = ''
param postgresUser string = ''
@secure()
param postgresPassword string = ''
param deployStage string = 'core'
param tags object = {}

var image = '${acrLoginServer}/${imageName}:${imageTag}'

var baseEnv = [
  {
    name: 'NODE_ENV'
    value: 'production'
  }
  {
    name: 'DEPLOY_STAGE'
    value: deployStage
  }
]

var aiEnv = empty(appInsightsConnectionString) ? [] : [
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: appInsightsConnectionString
  }
]

var dbEnv = empty(postgresHost) ? [] : [
  {
    name: 'POSTGRES_HOST'
    value: postgresHost
  }
  {
    name: 'POSTGRES_DB'
    value: postgresDbName
  }
  {
    name: 'POSTGRES_USER'
    value: postgresUser
  }
  {
    name: 'POSTGRES_PASSWORD'
    value: postgresPassword
  }
  {
    name: 'DATABASE_URL'
    value: 'postgresql://${postgresUser}:${postgresPassword}@${postgresHost}:5432/${postgresDbName}?sslmode=require'
  }
]

resource app 'Microsoft.App/containerApps@2025-07-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityResourceId}': {}
    }
  }
  tags: tags
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      ingress: {
        external: externalIngress
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: identityResourceId
        }
      ]
      activeRevisionsMode: 'Single'
    }
    template: {
      containers: [
        {
          name: 'web'
          image: image
          resources: {
            cpu: json(containerCpu)
            memory: containerMemory
          }
          env: concat(baseEnv, aiEnv, dbEnv)
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2026-01-01-preview' existing = {
  name: acrName
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identityPrincipalId, 'acrpull')
  scope: acr
  properties: {
    principalId: identityPrincipalId
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalType: 'ServicePrincipal'
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn