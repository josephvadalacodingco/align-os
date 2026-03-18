using '../main.bicep'

param appName = 'align-os'
param environmentName = 'dev'
param location = 'eastus'
param deployStage = 'core'

param containerAppsEnvironmentName = 'cae-align-os-dev'
param containerAppName = 'ca-align-os-dev'
param identityName = 'id-align-os-dev'
param acrName = 'acralignosdev001'
param logAnalyticsName = 'log-align-os-dev'
param appInsightsName = 'appi-align-os-dev'

param postgresServerName = 'psql-align-os-dev-001'
param postgresDbName = 'appdb'
param postgresAdminUser = 'pgadminlocal'
param postgresAdminPassword = 'Sierra23Luke25!'

param imageName = 'web'
param imageTag = 'latest'

param targetPort = 3000
param minReplicas = 1
param maxReplicas = 2
param containerCpu = '0.5'
param containerMemory = '1Gi'
param externalIngress = true