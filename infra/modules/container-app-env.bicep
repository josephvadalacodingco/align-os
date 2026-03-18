param location string
param containerAppsEnvironmentName string
@description('Optional. Leave empty to skip Log Analytics wiring during core stage.')
param logAnalyticsWorkspaceId string = ''
param tags object = {}

var hasWorkspace = !empty(logAnalyticsWorkspaceId)

var environmentProperties = hasWorkspace
  ? {
      appLogsConfiguration: {
        destination: 'log-analytics'
        logAnalyticsConfiguration: {
          customerId: reference(logAnalyticsWorkspaceId, '2023-09-01', 'full').properties.customerId
          sharedKey: listKeys(logAnalyticsWorkspaceId, '2023-09-01').primarySharedKey
        }
      }
    }
  : {}

resource cae 'Microsoft.App/managedEnvironments@2025-07-01' = {
  name: containerAppsEnvironmentName
  location: location
  tags: tags
  properties: environmentProperties
}

output containerAppsEnvironmentId string = cae.id