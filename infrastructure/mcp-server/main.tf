terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~>3.1"
    }
  }
}

provider "azurerm" {
  features {}
}

# Variables
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "Australia East"
}

variable "resource_group_name" {
  description = "Resource group for MCP server"
  type        = string
  default     = "rg-mcp-server-prod"
}

# Get current client config
data "azurerm_client_config" "current" {}

# Random string for unique naming
resource "random_string" "unique_suffix" {
  length  = 6
  special = false
  upper   = false
}

# Dedicated Resource Group for MCP Server
resource "azurerm_resource_group" "mcp_server" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    Environment = var.environment
    Service     = "mcp-server"
    Purpose     = "standalone-mcp-service"
    Terraform   = "true"
  }
}

# Virtual Network for MCP Server (Private Network)
resource "azurerm_virtual_network" "mcp_vnet" {
  name                = "vnet-mcp-server-${var.environment}"
  address_space       = ["10.2.0.0/16"]
  location            = azurerm_resource_group.mcp_server.location
  resource_group_name = azurerm_resource_group.mcp_server.name

  tags = {
    Environment = var.environment
    Service     = "mcp-server"
  }
}

# Subnet for Container Instances
resource "azurerm_subnet" "mcp_subnet" {
  name                 = "subnet-mcp-containers"
  resource_group_name  = azurerm_resource_group.mcp_server.name
  virtual_network_name = azurerm_virtual_network.mcp_vnet.name
  address_prefixes     = ["10.2.1.0/24"]

  delegation {
    name = "aci-delegation"
    service_delegation {
      name    = "Microsoft.ContainerInstance/containerGroups"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

# Subnet for Private Endpoints (cannot be delegated)
resource "azurerm_subnet" "mcp_private_endpoints_subnet" {
  name                 = "subnet-mcp-private-endpoints"
  resource_group_name  = azurerm_resource_group.mcp_server.name
  virtual_network_name = azurerm_virtual_network.mcp_vnet.name
  address_prefixes     = ["10.2.2.0/24"]
}

# Network Security Group for MCP Server
resource "azurerm_network_security_group" "mcp_nsg" {
  name                = "nsg-mcp-server-${var.environment}"
  location            = azurerm_resource_group.mcp_server.location
  resource_group_name = azurerm_resource_group.mcp_server.name

  # Allow inbound from main application VNet only
  security_rule {
    name                       = "AllowApplicationVNet"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "3006"
    source_address_prefix      = "10.1.0.0/16"  # Main application VNet
    destination_address_prefix = "*"
  }

  # Allow HTTPS outbound for Archer GRC connection
  security_rule {
    name                       = "AllowHTTPSOutbound"
    priority                   = 100
    direction                  = "Outbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # Allow HTTP outbound for health checks
  security_rule {
    name                       = "AllowHTTPOutbound"
    priority                   = 110
    direction                  = "Outbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # Deny all other inbound traffic
  security_rule {
    name                       = "DenyAllInbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = {
    Environment = var.environment
    Service     = "mcp-server"
  }
}

# Associate NSG with subnet
resource "azurerm_subnet_network_security_group_association" "mcp_nsg_association" {
  subnet_id                 = azurerm_subnet.mcp_subnet.id
  network_security_group_id = azurerm_network_security_group.mcp_nsg.id
}

# Container Registry for MCP Server Images
resource "azurerm_container_registry" "mcp_registry" {
  name                = "acrmcpserver${var.environment}${random_string.unique_suffix.result}"
  resource_group_name = azurerm_resource_group.mcp_server.name
  location            = azurerm_resource_group.mcp_server.location
  sku                 = "Premium"
  admin_enabled       = true

  # No public access - only via private endpoint
  public_network_access_enabled = false

  tags = {
    Environment = var.environment
    Service     = "mcp-server"
  }
}

# Private DNS Zone for Container Registry
resource "azurerm_private_dns_zone" "acr_dns_zone" {
  name                = "privatelink.azurecr.io"
  resource_group_name = azurerm_resource_group.mcp_server.name

  tags = {
    Environment = var.environment
    Service     = "mcp-server"
  }
}

# Link Private DNS Zone to VNet
resource "azurerm_private_dns_zone_virtual_network_link" "acr_dns_link" {
  name                  = "acr-dns-link"
  resource_group_name   = azurerm_resource_group.mcp_server.name
  private_dns_zone_name = azurerm_private_dns_zone.acr_dns_zone.name
  virtual_network_id    = azurerm_virtual_network.mcp_vnet.id

  tags = {
    Environment = var.environment
    Service     = "mcp-server"
  }
}

# Private Endpoint for Container Registry
resource "azurerm_private_endpoint" "acr_private_endpoint" {
  name                = "pe-acr-mcp-${var.environment}"
  location            = azurerm_resource_group.mcp_server.location
  resource_group_name = azurerm_resource_group.mcp_server.name
  subnet_id           = azurerm_subnet.mcp_private_endpoints_subnet.id

  private_service_connection {
    name                           = "acr-private-connection"
    private_connection_resource_id = azurerm_container_registry.mcp_registry.id
    subresource_names              = ["registry"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "acr-dns-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.acr_dns_zone.id]
  }

  tags = {
    Environment = var.environment
    Service     = "mcp-server"
  }
}

# Log Analytics Workspace for MCP Server monitoring
resource "azurerm_log_analytics_workspace" "mcp_logs" {
  name                = "log-mcp-server-${var.environment}"
  location            = azurerm_resource_group.mcp_server.location
  resource_group_name = azurerm_resource_group.mcp_server.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = {
    Environment = var.environment
    Service     = "mcp-server"
  }
}

# Key Vault for MCP Server secrets
resource "azurerm_key_vault" "mcp_keyvault" {
  name                        = "kv-mcp-server-${var.environment}"
  location                    = azurerm_resource_group.mcp_server.location
  resource_group_name         = azurerm_resource_group.mcp_server.name
  enabled_for_disk_encryption = true
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days  = 7
  purge_protection_enabled    = false
  sku_name                    = "standard"

  # No public access - private endpoint only
  public_network_access_enabled = false

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
    Service     = "mcp-server"
  }
}

# Private DNS Zone for Key Vault
resource "azurerm_private_dns_zone" "keyvault_dns_zone" {
  name                = "privatelink.vaultcore.azure.net"
  resource_group_name = azurerm_resource_group.mcp_server.name

  tags = {
    Environment = var.environment
    Service     = "mcp-server"
  }
}

# Link Key Vault DNS Zone to VNet
resource "azurerm_private_dns_zone_virtual_network_link" "keyvault_dns_link" {
  name                  = "keyvault-dns-link"
  resource_group_name   = azurerm_resource_group.mcp_server.name
  private_dns_zone_name = azurerm_private_dns_zone.keyvault_dns_zone.name
  virtual_network_id    = azurerm_virtual_network.mcp_vnet.id

  tags = {
    Environment = var.environment
    Service     = "mcp-server"
  }
}

# Private Endpoint for Key Vault
resource "azurerm_private_endpoint" "keyvault_private_endpoint" {
  name                = "pe-kv-mcp-${var.environment}"
  location            = azurerm_resource_group.mcp_server.location
  resource_group_name = azurerm_resource_group.mcp_server.name
  subnet_id           = azurerm_subnet.mcp_private_endpoints_subnet.id

  private_service_connection {
    name                           = "keyvault-private-connection"
    private_connection_resource_id = azurerm_key_vault.mcp_keyvault.id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "keyvault-dns-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.keyvault_dns_zone.id]
  }

  tags = {
    Environment = var.environment
    Service     = "mcp-server"
  }
}

# Outputs
output "mcp_server_resource_group" {
  value = azurerm_resource_group.mcp_server.name
}

output "mcp_server_vnet_id" {
  value = azurerm_virtual_network.mcp_vnet.id
}

output "mcp_server_subnet_id" {
  value = azurerm_subnet.mcp_subnet.id
}

output "mcp_container_registry" {
  value = azurerm_container_registry.mcp_registry.login_server
}

output "mcp_keyvault_url" {
  value = azurerm_key_vault.mcp_keyvault.vault_uri
}

output "mcp_log_analytics_workspace_id" {
  value = azurerm_log_analytics_workspace.mcp_logs.id
}