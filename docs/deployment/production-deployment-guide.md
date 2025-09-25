# Production Deployment Guide

This guide walks through deploying the GRC AI Platform to Azure production environment.

## Prerequisites

### Required Tools
- **Azure CLI** (v2.40+): [Install Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- **Terraform** (v1.6+): [Install Terraform](https://developer.hashicorp.com/terraform/downloads)
- **Docker**: [Install Docker](https://docs.docker.com/get-docker/)
- **Node.js** (v18+): [Install Node.js](https://nodejs.org/)
- **Azure Functions Core Tools**: `npm install -g azure-functions-core-tools@4`

### Azure Requirements
- Azure subscription with appropriate permissions
- Resource Group creation permissions
- Azure AD application registration permissions (for OAuth)

## Quick Start

### 1. Clone and Configure

```bash
git clone <repository-url>
cd grc-ai-platform

# Copy and edit Terraform variables
cp infrastructure/terraform.tfvars.example infrastructure/terraform.tfvars
```

### 2. Configure Terraform Variables

Edit `infrastructure/terraform.tfvars`:

```hcl
# Azure Configuration
subscription_id = "your-azure-subscription-id"
tenant_id       = "your-azure-tenant-id"

# Security Configuration
oauth_secret = "your-super-secure-oauth-secret-32-characters-min"
auth0_domain = "your-auth0-domain.us.auth0.com"

# Resource Configuration
resource_group_name = "rg-grc-ai-platform-prod"
location           = "East US"
environment        = "prod"

# Tenant Configuration
default_tenants = [
  {
    id              = "tenant-acme-001"
    name            = "ACME Corporation"
    slug            = "acme"
    domain          = "acme.grcplatform.com"
    auth0_client_id = "your-acme-auth0-client-id"
  }
  # Add more tenants as needed
]
```

### 3. Deploy Infrastructure

```bash
# Login to Azure
az login

# Set subscription (if needed)
az account set --subscription "your-subscription-id"

# Deploy infrastructure
cd infrastructure
terraform init
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"
```

### 4. Deploy Applications

Option A: **Automated Script** (Recommended)
```bash
# Set environment variables
export AZURE_SUBSCRIPTION_ID="your-subscription-id"

# Run deployment script
./scripts/deploy-production.sh
```

Option B: **Manual Deployment**
```bash
# Deploy backend
cd packages/backend
npm ci --production
npm run build
func azure functionapp publish func-grc-backend-prod --node

# Deploy MCP server
cd ../mcp-server
az acr login --name acrgrcplatformprod
docker build -t acrgrcplatformprod.azurecr.io/grc-mcp-server:latest .
docker push acrgrcplatformprod.azurecr.io/grc-mcp-server:latest

# Deploy to Container Instances
az container create \
  --resource-group rg-grc-ai-platform-prod \
  --name aci-grc-mcp-server-prod \
  --image acrgrcplatformprod.azurecr.io/grc-mcp-server:latest \
  --dns-name-label grc-mcp-server-prod \
  --ports 3006

# Deploy frontend
cd ../frontend
npm ci
VITE_API_BASE_URL=https://func-grc-backend-prod.azurewebsites.net/api/v1 npm run build
# Upload dist/ folder to Azure Static Web Apps
```

## Architecture Overview

### Azure Services Used

```
Azure Production Architecture:

Internet (HTTPS)
    ↓
Azure Static Web Apps (Frontend)
    ↓
Azure Functions (Backend API)
    ↓
Azure Container Instances (MCP Server)
    ↓
Azure Cosmos DB (Multi-tenant Data)
    ↓
Azure Key Vault (Secrets)
```

### Service Configuration

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Azure Functions** | Backend API | Node.js 18, B1 plan, OAuth integration |
| **Static Web Apps** | Frontend hosting | React SPA, custom domain support |
| **Container Instances** | MCP server | Docker container, 1 CPU, 2GB RAM |
| **Cosmos DB** | Multi-tenant database | Partition by tenantId, 400 RU/s |
| **Key Vault** | Secrets management | OAuth secrets, API keys, certificates |
| **Container Registry** | Docker images | MCP server container storage |
| **Application Insights** | Monitoring | Performance and error tracking |

## OAuth Configuration

### Auth0 Setup

1. **Create Auth0 Application**
   - Type: Single Page Application
   - Allowed Callback URLs: `https://func-grc-backend-prod.azurewebsites.net/auth/*/callback`
   - Allowed Logout URLs: `https://stapp-grc-frontend-prod.azurestaticapps.net/login`

2. **Configure Tenants**
   ```json
   {
     "acme": {
       "clientId": "acme-client-id",
       "callbackUrl": "https://func-grc-backend-prod.azurewebsites.net/auth/acme/callback"
     }
   }
   ```

3. **Add Secrets to Key Vault**
   ```bash
   az keyvault secret set --vault-name kv-grc-platform-prod --name "oauth-secret" --value "your-oauth-secret"
   az keyvault secret set --vault-name kv-grc-platform-prod --name "auth0-client-secret" --value "your-auth0-client-secret"
   ```

## Environment Variables

### Backend Function App
```bash
# Database
COSMOS_DB_ENDPOINT=https://cosmos-grc-platform-prod.documents.azure.com:443/
COSMOS_DB_KEY=<from-terraform-output>
COSMOS_DB_DATABASE=grc-platform

# OAuth
OAUTH_SECRET=<from-key-vault>
AUTH0_ISSUER_BASE_URL=https://your-auth0-domain.us.auth0.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_CLIENT_SECRET=<from-key-vault>

# MCP Server
MCP_SERVER_URL=https://grc-mcp-server-prod.eastus.azurecontainer.io:3006

# AI Services
OPENAI_API_KEY=<from-key-vault>
```

### Frontend Static Web App
```bash
VITE_API_BASE_URL=https://func-grc-backend-prod.azurewebsites.net/api/v1
VITE_MCP_SERVER_URL=https://grc-mcp-server-prod.eastus.azurecontainer.io:3006
VITE_AUTH0_DOMAIN=your-auth0-domain.us.auth0.com
```

## Security Configuration

### Network Security
- **HTTPS Only**: All communications encrypted with TLS 1.3
- **CORS**: Restricted to production domains
- **API Keys**: Stored in Key Vault with rotation
- **Container Security**: Non-root user, health checks

### Multi-Tenant Isolation
- **Data Partitioning**: Cosmos DB partitioned by `tenantId`
- **Secret Isolation**: Per-tenant Key Vault secrets
- **OAuth Isolation**: Tenant-specific OAuth configurations
- **Access Control**: Azure RBAC for service-to-service auth

## Monitoring and Logging

### Application Insights
- **Performance Monitoring**: Response times, dependency calls
- **Error Tracking**: Exception tracking and alerting
- **Usage Analytics**: User behavior and feature usage
- **Custom Metrics**: Business KPIs and AI performance

### Health Checks
```bash
# Backend health
curl https://func-grc-backend-prod.azurewebsites.net/api/v1/health

# MCP server health
curl https://grc-mcp-server-prod.eastus.azurecontainer.io:3006/health

# OAuth health
curl https://func-grc-backend-prod.azurewebsites.net/api/v1/oauth/health
```

### Alerting
- **API Errors**: > 5% error rate for 5 minutes
- **Latency**: > 2 seconds average for 3 minutes
- **Auth Failures**: > 10 failures per minute
- **Container Health**: Container restart or failure

## Cost Optimization

### Current Tier Costs (Estimated)
- **Azure Functions**: ~$20/month (B1 plan)
- **Static Web Apps**: Free tier
- **Container Instances**: ~$30/month (1 CPU, 2GB)
- **Cosmos DB**: ~$24/month (400 RU/s)
- **Key Vault**: ~$3/month
- **Container Registry**: ~$5/month
- **Application Insights**: ~$10/month

**Total**: ~$92/month for production environment

### Scaling Options
- **Functions**: Consumption plan for variable loads
- **Cosmos DB**: Autoscale for traffic spikes
- **Container Instances**: Multiple instances for HA
- **Static Web Apps**: Standard tier for custom domains

## Troubleshooting

### Common Issues

1. **Function App Not Starting**
   ```bash
   # Check logs
   az functionapp log tail --name func-grc-backend-prod --resource-group rg-grc-ai-platform-prod

   # Check app settings
   az functionapp config appsettings list --name func-grc-backend-prod --resource-group rg-grc-ai-platform-prod
   ```

2. **MCP Server Connection Failed**
   ```bash
   # Check container status
   az container show --name aci-grc-mcp-server-prod --resource-group rg-grc-ai-platform-prod --query instanceView.state

   # Check container logs
   az container logs --name aci-grc-mcp-server-prod --resource-group rg-grc-ai-platform-prod
   ```

3. **OAuth Authentication Issues**
   ```bash
   # Verify Auth0 configuration
   curl https://func-grc-backend-prod.azurewebsites.net/api/v1/oauth/tenants

   # Check Key Vault secrets
   az keyvault secret list --vault-name kv-grc-platform-prod
   ```

4. **Database Connection Issues**
   ```bash
   # Test Cosmos DB connectivity
   az cosmosdb show --name cosmos-grc-platform-prod --resource-group rg-grc-ai-platform-prod

   # Check firewall rules
   az cosmosdb network-rule list --name cosmos-grc-platform-prod --resource-group rg-grc-ai-platform-prod
   ```

## Backup and Disaster Recovery

### Automated Backups
- **Cosmos DB**: Automatic backups every 4 hours, 30-day retention
- **Key Vault**: Soft delete enabled, 7-day retention
- **Container Registry**: Geo-replication available
- **Application Code**: Git repository as source of truth

### Recovery Procedures
1. **Infrastructure**: Re-run Terraform to recreate resources
2. **Data**: Restore from Cosmos DB backup
3. **Secrets**: Restore from Key Vault backup
4. **Applications**: Redeploy from Git repository

## Post-Deployment Checklist

- [ ] All health checks passing
- [ ] OAuth authentication working for all tenants
- [ ] MCP server tools accessible
- [ ] Frontend loads and connects to backend
- [ ] Application Insights collecting telemetry
- [ ] Backup verification completed
- [ ] DNS records updated (if using custom domains)
- [ ] SSL certificates configured
- [ ] Monitoring alerts configured
- [ ] Security scan completed

## Support and Maintenance

### Regular Maintenance
- **Weekly**: Review Application Insights for errors
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Review and optimize costs
- **Annually**: Security audit and compliance review

### Emergency Contacts
- Azure Support: [Azure Portal Support](https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade)
- Application Issues: Check Application Insights and container logs
- Security Issues: Review Azure Security Center recommendations