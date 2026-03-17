@description('Name of the Static Web App')
param appName string = 'pong-webapp'

@description('Azure region for the resource')
param location string = 'eastus2'

@description('GitHub repository URL (e.g. https://github.com/org/repo)')
param repositoryUrl string

@description('GitHub branch to deploy from')
param branch string = 'main'

@description('GitHub personal access token or repository token')
@secure()
param repositoryToken string

resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: appName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: branch
    repositoryToken: repositoryToken
    buildProperties: {
      appLocation: '/'
      outputLocation: ''
      apiLocation: ''
    }
  }
}

output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output staticWebAppName string = staticWebApp.name
