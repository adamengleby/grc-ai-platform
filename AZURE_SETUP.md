# Azure OpenAI Integration Setup

This guide covers setting up Azure OpenAI Service for the GRC platform.

## 🏢 **Why Azure OpenAI for Enterprise GRC?**

- **Enterprise Compliance**: Meets SOC 2, HIPAA, and other compliance requirements
- **Data Residency**: Your data stays in your Azure region
- **Private Networking**: VNet integration and private endpoints
- **Enterprise Support**: 99.9% SLA with Microsoft support
- **Cost Control**: Predictable pricing and usage controls
- **Integration**: Seamless with Azure services (Key Vault, Monitor, etc.)

## 🚀 **Setup Steps**

### 1. Create Azure OpenAI Resource

```bash
# Using Azure CLI
az cognitiveservices account create \
  --name "grc-openai-service" \
  --resource-group "grc-platform-rg" \
  --location "East US" \
  --kind "OpenAI" \
  --sku "S0"
```

### 2. Deploy Models

```bash
# Deploy GPT-4 for GRC analysis
az cognitiveservices account deployment create \
  --resource-group "grc-platform-rg" \
  --name "grc-openai-service" \
  --deployment-name "grc-gpt4" \
  --model-name "gpt-4" \
  --model-version "0613" \
  --model-format "OpenAI" \
  --scale-settings-scale-type "Standard"
```

### 3. Configure Environment Variables

```bash
# Required Azure OpenAI configuration
export AZURE_OPENAI_API_KEY="your_api_key_here"
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_DEPLOYMENT="grc-gpt4"
export AZURE_OPENAI_API_VERSION="2024-02-15-preview"
```

### 4. Using Azure Key Vault (Recommended)

```bash
# Store secrets in Key Vault
az keyvault secret set \
  --vault-name "grc-keyvault" \
  --name "azure-openai-api-key" \
  --value "your_api_key_here"

# Update application to use Key Vault
export AZURE_KEY_VAULT_URL="https://grc-keyvault.vault.azure.net/"
```

## 🔧 **Configuration Options**

### Basic Configuration
```javascript
const { createGRCConfig } = require('./lib/llmConfig');

const config = createGRCConfig('azure', {
  azureEndpoint: 'https://your-resource.openai.azure.com/',
  azureDeployment: 'grc-gpt4',
  maxTokens: 6000,
  temperature: 0.2
});
```

### Advanced Configuration
```javascript
const config = {
  provider: 'azure',
  azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureDeployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  azureApiVersion: '2024-02-15-preview',
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  model: 'gpt-4',
  maxTokens: 6000,
  temperature: 0.2,
  timeout: 45000
};
```

## 🏗️ **Azure Infrastructure Setup**

### Resource Group Structure
```
grc-platform-rg/
├── grc-openai-service (Cognitive Services)
├── grc-keyvault (Key Vault)
├── grc-app-service (App Service)
├── grc-database (PostgreSQL)
├── grc-storage (Storage Account)
└── grc-monitoring (Application Insights)
```

### Network Security
```bash
# Create VNet with private endpoints
az network vnet create \
  --resource-group grc-platform-rg \
  --name grc-vnet \
  --address-prefix 10.0.0.0/16

# Create private endpoint for OpenAI
az network private-endpoint create \
  --resource-group grc-platform-rg \
  --name grc-openai-pe \
  --vnet-name grc-vnet \
  --subnet default \
  --private-connection-resource-id "/subscriptions/.../cognitiveServices/grc-openai-service"
```

## 📊 **Monitoring & Cost Management**

### Application Insights Integration
```javascript
const { ApplicationInsights } = require('@azure/monitor-opentelemetry');

// Track LLM usage and performance
ApplicationInsights.setup()
  .setAutoCollectConsole(true)
  .setAutoCollectExceptions(true)
  .start();
```

### Cost Controls
```bash
# Set spending limits
az cognitiveservices account update \
  --name "grc-openai-service" \
  --resource-group "grc-platform-rg" \
  --properties '{
    "restrictOutboundNetworkAccess": true,
    "allowedFqdnList": ["your-domain.com"]
  }'
```

## 🔐 **Security Best Practices**

### 1. Managed Identity (Recommended)
```javascript
const { DefaultAzureCredential } = require('@azure/identity');

const credential = new DefaultAzureCredential();
// Use managed identity instead of API keys
```

### 2. API Key Rotation
```bash
# Rotate keys regularly
az cognitiveservices account keys regenerate \
  --name "grc-openai-service" \
  --resource-group "grc-platform-rg" \
  --key-name "Key1"
```

### 3. Network Restrictions
```bash
# Restrict access to specific IPs/VNets
az cognitiveservices account network-rule add \
  --name "grc-openai-service" \
  --resource-group "grc-platform-rg" \
  --ip-address "your.public.ip.address"
```

## 🧪 **Testing Your Setup**

### 1. Test Connection
```javascript
const { LLMClient } = require('./lib/llmClient');
const { createGRCConfig } = require('./lib/llmConfig');

async function testAzureConnection() {
  const config = createGRCConfig('azure');
  const client = new LLMClient(config);
  
  try {
    const response = await client.generateInsights({
      tenantData: {
        tenant: { name: 'Test Corp', industry: 'Financial Services' },
        riskData: { risks: [] },
        controlData: { controls: [] },
        complianceData: { overall_score: 0.85 },
        incidentData: { incidents: [] }
      },
      focusArea: 'overall',
      insightType: 'summary'
    });
    
    console.log('Azure OpenAI connected successfully!');
    console.log('Response length:', response.length);
  } catch (error) {
    console.error('Connection failed:', error.message);
  }
}

testAzureConnection();
```

### 2. Performance Testing
```bash
# Test multiple concurrent requests
npm run test:azure-performance
```

## 📈 **Production Deployment**

### 1. ARM Template
```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": [
    {
      "type": "Microsoft.CognitiveServices/accounts",
      "apiVersion": "2023-05-01",
      "name": "grc-openai-service",
      "location": "[parameters('location')]",
      "sku": {
        "name": "S0"
      },
      "kind": "OpenAI",
      "properties": {
        "customSubDomainName": "grc-openai-service",
        "restrictOutboundNetworkAccess": true
      }
    }
  ]
}
```

### 2. Container Deployment
```dockerfile
# Dockerfile for Azure Container Instances
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --production
EXPOSE 3000
CMD ["node", "grc-mcp-server-v2.js"]
```

## 🔄 **Auto-Scaling & Load Balancing**

```bash
# Configure auto-scaling for App Service
az appservice plan create \
  --name grc-app-plan \
  --resource-group grc-platform-rg \
  --sku P1V3 \
  --is-linux

# Enable auto-scaling
az monitor autoscale create \
  --resource-group grc-platform-rg \
  --resource /subscriptions/.../serverFarms/grc-app-plan \
  --min-count 2 \
  --max-count 10 \
  --count 3
```

## 📞 **Support & Troubleshooting**

### Common Issues
1. **429 Rate Limit**: Increase quota or implement backoff
2. **403 Forbidden**: Check API key and endpoint
3. **Timeout**: Increase timeout for complex queries

### Monitoring Queries (KQL)
```kql
// Track LLM usage
traces
| where message contains "LLM Client"
| summarize count() by bin(timestamp, 1h)

// Monitor error rates
exceptions
| where outerMessage contains "Azure OpenAI"
| summarize count() by problemId
```

---

**Next Steps**: Once Azure OpenAI is configured, the GRC platform will automatically use it for generating real AI insights instead of mock responses.