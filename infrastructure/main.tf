terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# Variables are defined in variables.tf

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    Environment = var.environment
    Project     = "grc-ai-platform"
    Terraform   = "true"
  }
}

# Storage Account for static website and function apps
resource "azurerm_storage_account" "main" {
  name                     = "stgrcaiplatform${var.environment}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  enable_https_traffic_only = true

  static_website {
    index_document = "index.html"
  }

  tags = {
    Environment = var.environment
    Project     = "grc-ai-platform"
  }
}

# Application Insights
resource "azurerm_application_insights" "main" {
  name                = "ai-grc-platform-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "web"

  tags = {
    Environment = var.environment
    Project     = "grc-ai-platform"
  }
}

# Key Vault
resource "azurerm_key_vault" "main" {
  name                        = "kv-grc-platform-${var.environment}"
  location                    = azurerm_resource_group.main.location
  resource_group_name         = azurerm_resource_group.main.name
  enabled_for_disk_encryption = true
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days  = 7
  purge_protection_enabled    = false
  sku_name                    = "standard"

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get",
      "List",
      "Set",
      "Delete",
      "Backup",
      "Restore"
    ]
  }

  tags = {
    Environment = var.environment
    Project     = "grc-ai-platform"
  }
}

# Get current client config
data "azurerm_client_config" "current" {}

# Cosmos DB Account
resource "azurerm_cosmosdb_account" "main" {
  name                = "cosmos-grc-platform-${var.environment}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  enable_automatic_failover = true

  consistency_policy {
    consistency_level       = "BoundedStaleness"
    max_interval_in_seconds = 300
    max_staleness_prefix    = 100000
  }

  geo_location {
    location          = azurerm_resource_group.main.location
    failover_priority = 0
  }

  tags = {
    Environment = var.environment
    Project     = "grc-ai-platform"
  }
}

# Cosmos DB Database
resource "azurerm_cosmosdb_sql_database" "main" {
  name                = "grc-platform"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  throughput          = 400
}

# Cosmos DB Containers
resource "azurerm_cosmosdb_sql_container" "tenants" {
  name                  = "tenants"
  resource_group_name   = azurerm_resource_group.main.name
  account_name          = azurerm_cosmosdb_account.main.name
  database_name         = azurerm_cosmosdb_sql_database.main.name
  partition_key_path    = "/tenantId"
  partition_key_version = 1
  throughput            = 400

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/*"
    }
  }
}

resource "azurerm_cosmosdb_sql_container" "users" {
  name                  = "users"
  resource_group_name   = azurerm_resource_group.main.name
  account_name          = azurerm_cosmosdb_account.main.name
  database_name         = azurerm_cosmosdb_sql_database.main.name
  partition_key_path    = "/tenantId"
  partition_key_version = 1
  throughput            = 400

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/*"
    }
  }
}

resource "azurerm_cosmosdb_sql_container" "agents" {
  name                  = "agents"
  resource_group_name   = azurerm_resource_group.main.name
  account_name          = azurerm_cosmosdb_account.main.name
  database_name         = azurerm_cosmosdb_sql_database.main.name
  partition_key_path    = "/tenantId"
  partition_key_version = 1
  throughput            = 400

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/*"
    }
  }
}

# App Service Plan
resource "azurerm_service_plan" "main" {
  name                = "plan-grc-platform-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "B1"

  tags = {
    Environment = var.environment
    Project     = "grc-ai-platform"
  }
}

# Function App for Backend API
resource "azurerm_linux_function_app" "backend" {
  name                = "func-grc-backend-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  storage_account_name       = azurerm_storage_account.main.name
  storage_account_access_key = azurerm_storage_account.main.primary_access_key
  service_plan_id            = azurerm_service_plan.main.id

  site_config {
    application_stack {
      node_version = "18"
    }

    cors {
      allowed_origins = ["*"]
    }
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"     = "node"
    "WEBSITE_NODE_DEFAULT_VERSION" = "~18"
    "APPINSIGHTS_INSTRUMENTATIONKEY" = azurerm_application_insights.main.instrumentation_key
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.main.connection_string
    "COSMOS_DB_ENDPOINT" = azurerm_cosmosdb_account.main.endpoint
    "COSMOS_DB_KEY" = azurerm_cosmosdb_account.main.primary_key
    "KEY_VAULT_URL" = azurerm_key_vault.main.vault_uri
    "OAUTH_SECRET" = "your-oauth-secret-change-in-production"
    "NODE_ENV" = "production"
  }

  identity {
    type = "SystemAssigned"
  }

  tags = {
    Environment = var.environment
    Project     = "grc-ai-platform"
  }
}

# Container Registry
resource "azurerm_container_registry" "main" {
  name                = "acrgrcplatform${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true

  tags = {
    Environment = var.environment
    Project     = "grc-ai-platform"
  }
}

# Key Vault access policy for Function App
resource "azurerm_key_vault_access_policy" "function_app" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_linux_function_app.backend.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List"
  ]
}

# Static Web App for Frontend
resource "azurerm_static_site" "frontend" {
  name                = "stapp-grc-frontend-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = "East Asia"  # Closest Static Web Apps region to Australia
  sku_tier            = "Free"
  sku_size            = "Free"

  tags = {
    Environment = var.environment
    Project     = "grc-ai-platform"
  }
}

# Outputs
output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "cosmos_db_endpoint" {
  value = azurerm_cosmosdb_account.main.endpoint
}

output "key_vault_url" {
  value = azurerm_key_vault.main.vault_uri
}

output "function_app_name" {
  value = azurerm_linux_function_app.backend.name
}

output "function_app_url" {
  value = "https://${azurerm_linux_function_app.backend.default_hostname}"
}

output "static_web_app_url" {
  value = "https://${azurerm_static_site.frontend.default_host_name}"
}

output "container_registry_login_server" {
  value = azurerm_container_registry.main.login_server
}

output "application_insights_instrumentation_key" {
  value = azurerm_application_insights.main.instrumentation_key
  sensitive = true
}