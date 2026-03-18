using '../main.bicep'

param appName = 'align-os'
param environmentName = 'prod'
param location = 'eastus'
param deployStage = 'full'

param containerAppsEnvironmentName = 'cae-align-os-prod'
param containerAppName = 'ca-align-os-prod'
param identityName = 'id-align-os-prod'
param acrName = 'acralignosprod001'
param logAnalyticsName = 'log-align-os-prod'
param appInsightsName = 'appi-align-os-prod'

param postgresServerName = 'psql-align-os-prod-001'
param postgresDbName = 'appdb'
param postgresAdminUser = 'pgadminlocal'
param postgresAdminPassword = 'REPLACE_AT_DEPLOY_TIME'

param imageName = 'web'
param imageTag = 'latest'

param targetPort = 3000
param minReplicas = 1
param maxReplicas = 4
param containerCpu = '1'
param containerMemory = '2Gi'
param externalIngress = true