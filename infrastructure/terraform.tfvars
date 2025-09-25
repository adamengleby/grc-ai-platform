# Azure Configuration
subscription_id = "2e6b5431-6d83-4072-8ccc-86af69cf22b0"
tenant_id       = "f9991ad2-cab9-4e69-b235-a10d7e39b96c"

# Resource Configuration
resource_group_name = "rg-grc-ai-platform-prod"
location           = "Australia East"
environment        = "prod"

# Security Configuration
oauth_secret = "grc-oauth-secret-32-chars-minimum-production-secure"
auth0_domain = "dev-grc-platform.us.auth0.com"

# Performance Configuration
cosmos_db_throughput = 400
app_service_sku     = "B1"

# CORS Configuration
allowed_origins = [
  "https://grcplatform.com",
  "https://*.grcplatform.com",
  "https://acme.grcplatform.com",
  "https://fintech.grcplatform.com"
]

# Tenant Configuration
default_tenants = [
  {
    id              = "tenant-acme-001"
    name            = "ACME Corporation"
    slug            = "acme"
    domain          = "acme.grcplatform.com"
    auth0_client_id = "acme-client-id-placeholder"
  },
  {
    id              = "tenant-fintech-001"
    name            = "FinTech Corp"
    slug            = "fintech"
    domain          = "fintech.grcplatform.com"
    auth0_client_id = "fintech-client-id-placeholder"
  },
  {
    id              = "tenant-admin-001"
    name            = "Platform Administration"
    slug            = "platform-admin"
    domain          = "admin.grcplatform.com"
    auth0_client_id = "admin-client-id-placeholder"
  }
]

# Container Configuration
mcp_server_image = "grc-mcp-server:latest"
container_cpu    = 1
container_memory = 2

# Monitoring Configuration
log_retention_days = 30
enable_monitoring = true