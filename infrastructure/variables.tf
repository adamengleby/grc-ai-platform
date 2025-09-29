# Core Infrastructure Variables
variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "tenant_id" {
  description = "Azure tenant ID"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "rg-grc-ai-platform-prod"
}

variable "location" {
  description = "Azure region for deployment"
  type        = string
  default     = "Australia East"
}

variable "environment" {
  description = "Environment name (prod, staging, dev)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "grc-ai-platform"
}

# Application Configuration
variable "oauth_secret" {
  description = "OAuth secret for session management"
  type        = string
  sensitive   = true
}

variable "auth0_domain" {
  description = "Auth0 domain for OAuth configuration"
  type        = string
  default     = "dev-grc-platform.us.auth0.com"
}

# Cosmos DB Configuration
variable "cosmos_db_throughput" {
  description = "Cosmos DB throughput (RU/s)"
  type        = number
  default     = 400
}

variable "cosmos_db_consistency_level" {
  description = "Cosmos DB consistency level"
  type        = string
  default     = "BoundedStaleness"
}

# App Service Configuration
variable "app_service_sku" {
  description = "App Service plan SKU"
  type        = string
  default     = "B1"
}

variable "function_app_node_version" {
  description = "Node.js version for Function App"
  type        = string
  default     = "18"
}

# Security Configuration
variable "allowed_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default     = ["https://grcplatform.com", "https://*.grcplatform.com"]
}

variable "key_vault_soft_delete_retention_days" {
  description = "Key Vault soft delete retention period in days"
  type        = number
  default     = 7
}

# Multi-tenant Configuration
variable "default_tenants" {
  description = "Default tenants to create"
  type = list(object({
    id          = string
    name        = string
    slug        = string
    domain      = string
    auth0_client_id = string
  }))
  default = [
    {
      id              = "tenant-acme-001"
      name            = "ACME Corporation"
      slug            = "acme"
      domain          = "acme.grcplatform.com"
      auth0_client_id = "acme-client-id"
    },
    {
      id              = "tenant-fintech-001"
      name            = "FinTech Corp"
      slug            = "fintech"
      domain          = "fintech.grcplatform.com"
      auth0_client_id = "fintech-client-id"
    },
    {
      id              = "tenant-admin-001"
      name            = "Platform Administration"
      slug            = "platform-admin"
      domain          = "admin.grcplatform.com"
      auth0_client_id = "admin-client-id"
    }
  ]
}

# Container Configuration
variable "mcp_server_image" {
  description = "MCP server container image"
  type        = string
  default     = "grc-mcp-server:latest"
}

variable "container_cpu" {
  description = "Container CPU allocation"
  type        = number
  default     = 1
}

variable "container_memory" {
  description = "Container memory allocation in GB"
  type        = number
  default     = 2
}

# Monitoring Configuration
variable "log_retention_days" {
  description = "Log retention period in days"
  type        = number
  default     = 30
}

variable "enable_monitoring" {
  description = "Enable Application Insights monitoring"
  type        = bool
  default     = true
}

# Tags
variable "common_tags" {
  description = "Common tags to be applied to all resources"
  type        = map(string)
  default = {
    Project     = "grc-ai-platform"
    Owner       = "platform-team"
    Environment = "production"
    Terraform   = "true"
  }
}