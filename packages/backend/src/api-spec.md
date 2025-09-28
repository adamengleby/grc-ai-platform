# GRC AI Platform REST API Specification v1.0

This document defines the comprehensive REST API for the multi-tenant GRC AI Platform, replacing all localStorage functionality with secure, tenant-isolated backend services.

## Base Configuration

- **Base URL**: `https://api.grc-ai-platform.com/api/v1`
- **Authentication**: Azure AD B2C JWT tokens
- **Content-Type**: `application/json`
- **Tenant Isolation**: All requests require `X-Tenant-ID` header
- **Rate Limiting**: Per-tenant quotas enforced
- **Versioning**: URL path versioning (`/api/v1/`, `/api/v2/`, etc.)

## Global Headers

All requests must include:
```
Authorization: Bearer {azure_b2c_jwt_token}
X-Tenant-ID: {tenant_uuid}
Content-Type: application/json
X-Request-ID: {uuid} // Optional but recommended for tracing
```

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable error message",
    "details": {
      "field": "specific_field_name",
      "reason": "detailed_reason"
    },
    "request_id": "uuid",
    "timestamp": "2024-08-27T10:00:00Z"
  }
}
```

## Standard HTTP Status Codes

- `200` - OK (successful GET, PUT, PATCH)
- `201` - Created (successful POST)
- `204` - No Content (successful DELETE)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid/missing auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `422` - Unprocessable Entity (business logic error)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## 1. AUTHENTICATION & TENANT MANAGEMENT

### 1.1 User Authentication

#### POST /auth/login
Azure B2C redirect flow initiation.

**Request:**
```json
{
  "email": "user@example.com",
  "redirect_uri": "https://app.grc-platform.com/callback"
}
```

**Response (302):**
```
Location: https://tenant.b2clogin.com/tenant.onmicrosoft.com/oauth2/v2.0/authorize?...
```

#### POST /auth/callback
Handle Azure B2C callback and issue application token.

**Request:**
```json
{
  "code": "azure_auth_code",
  "state": "csrf_token"
}
```

**Response (200):**
```json
{
  "access_token": "jwt_token",
  "refresh_token": "refresh_jwt",
  "expires_in": 3600,
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "primary_tenant_id": "uuid",
    "roles": ["TenantOwner"],
    "mfa_enabled": true,
    "last_login_at": "2024-08-27T10:00:00Z"
  },
  "tenant": {
    "tenant_id": "uuid",
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "subscription_tier": "professional",
    "status": "active"
  }
}
```

#### GET /auth/me
Get current user information and tenant context.

**Response (200):**
```json
{
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "roles": ["TenantOwner"],
    "permissions": [
      {
        "resource": "*",
        "actions": ["read", "write", "delete", "admin"]
      }
    ],
    "mfa_enabled": true,
    "last_login_at": "2024-08-27T10:00:00Z"
  },
  "tenant": {
    "tenant_id": "uuid",
    "name": "Acme Corporation",
    "subscription_tier": "professional",
    "status": "active",
    "settings": {
      "enabledFeatures": ["ai_agents", "mcp_servers"],
      "byoLlmEnabled": true,
      "auditRetentionDays": 2555
    },
    "quota": {
      "dailyApiCalls": 10000,
      "monthlyTokens": 5000000,
      "currentUsage": {
        "apiCalls": 1247,
        "tokens": 245000
      }
    }
  }
}
```

#### GET /auth/tenants
Get available tenants for the current user.

**Response (200):**
```json
{
  "tenants": [
    {
      "tenant_id": "uuid",
      "name": "Acme Corporation",
      "slug": "acme-corp",
      "subscription_tier": "professional",
      "user_roles": ["TenantOwner"],
      "status": "active"
    },
    {
      "tenant_id": "uuid",
      "name": "Beta Industries",
      "slug": "beta-industries", 
      "subscription_tier": "enterprise",
      "user_roles": ["AgentUser"],
      "status": "active"
    }
  ]
}
```

#### POST /auth/switch-tenant
Switch active tenant context.

**Request:**
```json
{
  "tenant_id": "uuid"
}
```

**Response (200):**
```json
{
  "access_token": "new_jwt_with_tenant_context",
  "tenant": {
    "tenant_id": "uuid",
    "name": "Beta Industries",
    "subscription_tier": "enterprise",
    "status": "active"
  }
}
```

---

## 2. AI AGENT MANAGEMENT

### 2.1 Agent CRUD Operations

#### GET /agents
List all AI agents for the current tenant.

**Query Parameters:**
- `enabled` (boolean): Filter by enabled status
- `limit` (int): Max results (default: 50)
- `offset` (int): Pagination offset
- `sort` (string): Sort field (name, created_at, usage_count)
- `order` (string): Sort order (asc, desc)

**Response (200):**
```json
{
  "agents": [
    {
      "agent_id": "uuid",
      "name": "GRC Risk Analyzer",
      "description": "AI agent for analyzing governance, risk, and compliance data",
      "persona": "professional_analyst",
      "system_prompt": "You are a GRC analyst...",
      "llm_config_id": "uuid",
      "enabled_mcp_servers": ["server-1", "server-2"],
      "avatar": "https://cdn.example.com/avatar.png",
      "color": "#4F46E5",
      "is_enabled": true,
      "usage_count": 247,
      "last_used_at": "2024-08-27T09:30:00Z",
      "created_by": {
        "user_id": "uuid",
        "name": "John Doe"
      },
      "created_at": "2024-07-15T10:00:00Z",
      "updated_at": "2024-08-19T09:00:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

#### GET /agents/{agent_id}
Get a specific AI agent with full configuration context.

**Response (200):**
```json
{
  "agent": {
    "agent_id": "uuid",
    "name": "GRC Risk Analyzer",
    "description": "AI agent for analyzing governance, risk, and compliance data",
    "persona": "professional_analyst",
    "system_prompt": "You are a GRC analyst...",
    "llm_config_id": "uuid",
    "enabled_mcp_servers": ["server-1", "server-2"],
    "avatar": "https://cdn.example.com/avatar.png",
    "color": "#4F46E5",
    "is_enabled": true,
    "usage_count": 247,
    "last_used_at": "2024-08-27T09:30:00Z",
    "created_at": "2024-07-15T10:00:00Z",
    "updated_at": "2024-08-19T09:00:00Z"
  },
  "llm_config": {
    "config_id": "uuid",
    "name": "Azure GPT-4 Production",
    "provider": "azure_openai",
    "model": "gpt-4",
    "is_enabled": true
  },
  "mcp_servers": [
    {
      "server_id": "server-1",
      "name": "archer-grc-connector",
      "display_name": "Archer GRC Connector",
      "is_enabled": true,
      "available_tools": ["get_risks", "get_controls", "search_records"]
    }
  ],
  "validation": {
    "is_valid": true,
    "issues": []
  }
}
```

#### POST /agents
Create a new AI agent.

**Request:**
```json
{
  "name": "Compliance Monitor",
  "description": "Continuous monitoring of compliance requirements",
  "persona": "compliance_officer",
  "system_prompt": "You are a compliance monitoring specialist...",
  "llm_config_id": "uuid",
  "enabled_mcp_servers": ["server-1", "server-3"],
  "avatar": "https://cdn.example.com/compliance-avatar.png",
  "color": "#059669"
}
```

**Response (201):**
```json
{
  "agent": {
    "agent_id": "uuid",
    "name": "Compliance Monitor",
    "description": "Continuous monitoring of compliance requirements",
    "persona": "compliance_officer",
    "system_prompt": "You are a compliance monitoring specialist...",
    "llm_config_id": "uuid",
    "enabled_mcp_servers": ["server-1", "server-3"],
    "avatar": "https://cdn.example.com/compliance-avatar.png",
    "color": "#059669",
    "is_enabled": true,
    "usage_count": 0,
    "created_at": "2024-08-27T10:00:00Z",
    "updated_at": "2024-08-27T10:00:00Z"
  }
}
```

#### PUT /agents/{agent_id}
Update an existing AI agent.

**Request:**
```json
{
  "name": "Updated Agent Name",
  "description": "Updated description",
  "system_prompt": "Updated system prompt...",
  "enabled_mcp_servers": ["server-1", "server-2", "server-4"],
  "is_enabled": false
}
```

**Response (200):**
```json
{
  "agent": {
    "agent_id": "uuid",
    "name": "Updated Agent Name",
    // ... full updated agent object
    "updated_at": "2024-08-27T10:15:00Z"
  }
}
```

#### DELETE /agents/{agent_id}
Delete (soft delete) an AI agent.

**Response (204):** No content

### 2.2 Agent Presets and Templates

#### GET /agents/presets
Get available agent presets/templates.

**Response (200):**
```json
{
  "presets": [
    {
      "preset_id": "grc-risk-analyst",
      "name": "GRC Risk Analyst",
      "description": "Specialized in risk assessment and analysis",
      "persona": "risk_analyst",
      "system_prompt": "You are a risk management expert...",
      "recommended_tools": ["archer-connector", "risk-calculator"],
      "avatar": "https://cdn.example.com/risk-analyst.png",
      "color": "#DC2626",
      "category": "risk_management"
    }
  ]
}
```

#### POST /agents/from-preset
Create an agent from a preset.

**Request:**
```json
{
  "preset_id": "grc-risk-analyst",
  "llm_config_id": "uuid",
  "mcp_server_ids": ["server-1", "server-2"],
  "customizations": {
    "name": "Custom Risk Analyzer",
    "description": "Tailored for our specific risk framework"
  }
}
```

**Response (201):**
```json
{
  "agent": {
    "agent_id": "uuid",
    "name": "Custom Risk Analyzer",
    // ... full agent object created from preset
  }
}
```

### 2.3 Agent Usage and Metrics

#### POST /agents/{agent_id}/usage
Record agent usage (called after agent interaction).

**Request:**
```json
{
  "session_id": "uuid",
  "tokens_used": 1247,
  "response_time_ms": 850,
  "tools_used": ["get_risks", "search_records"],
  "success": true
}
```

**Response (200):**
```json
{
  "recorded": true,
  "new_usage_count": 248
}
```

#### GET /agents/{agent_id}/metrics
Get detailed usage metrics for an agent.

**Query Parameters:**
- `period` (string): day, week, month, quarter, year
- `start_date` (ISO date): Start of custom period
- `end_date` (ISO date): End of custom period

**Response (200):**
```json
{
  "agent_id": "uuid",
  "period": {
    "start": "2024-08-01T00:00:00Z",
    "end": "2024-08-27T23:59:59Z",
    "type": "month"
  },
  "metrics": {
    "total_requests": 247,
    "total_tokens_consumed": 145892,
    "average_response_time_ms": 850,
    "error_count": 3,
    "error_rate": 0.012,
    "estimated_cost": 29.45,
    "currency": "USD",
    "most_used_tools": [
      {"tool": "get_risks", "usage_count": 89},
      {"tool": "search_records", "usage_count": 67}
    ],
    "daily_usage": [
      {"date": "2024-08-27", "requests": 12, "tokens": 5247},
      {"date": "2024-08-26", "requests": 8, "tokens": 3891}
    ]
  }
}
```

---

## 3. LLM CONFIGURATION MANAGEMENT

### 3.1 LLM Config CRUD

#### GET /llm-configs
List all LLM configurations for the current tenant.

**Response (200):**
```json
{
  "configs": [
    {
      "config_id": "uuid",
      "name": "Azure GPT-4 Production",
      "provider": "azure_openai",
      "model": "gpt-4",
      "temperature": 0.3,
      "max_tokens": 2000,
      "response_format": "text",
      "is_enabled": true,
      "is_default": true,
      "last_tested_at": "2024-08-27T08:00:00Z",
      "last_test_status": "success",
      "usage_count": 1247,
      "total_tokens_used": 2457891,
      "created_at": "2024-07-01T00:00:00Z",
      "updated_at": "2024-08-26T14:30:00Z"
    },
    {
      "config_id": "uuid",
      "name": "Claude-3 Sonnet",
      "provider": "anthropic",
      "model": "claude-3-sonnet-20240229",
      "temperature": 0.2,
      "max_tokens": 4000,
      "is_enabled": true,
      "is_default": false,
      "last_tested_at": "2024-08-26T10:00:00Z",
      "last_test_status": "success",
      "usage_count": 89,
      "total_tokens_used": 124578
    }
  ]
}
```

#### GET /llm-configs/{config_id}
Get a specific LLM configuration.

**Response (200):**
```json
{
  "config": {
    "config_id": "uuid",
    "name": "Azure GPT-4 Production",
    "provider": "azure_openai",
    "model": "gpt-4",
    "temperature": 0.3,
    "max_tokens": 2000,
    "response_format": "text",
    "is_enabled": true,
    "is_default": true,
    "last_tested_at": "2024-08-27T08:00:00Z",
    "last_test_status": "success",
    "last_test_error": null,
    "usage_count": 1247,
    "total_tokens_used": 2457891,
    "created_by": {
      "user_id": "uuid",
      "name": "John Doe"
    },
    "created_at": "2024-07-01T00:00:00Z",
    "updated_at": "2024-08-26T14:30:00Z"
  }
}
```

#### POST /llm-configs
Create a new LLM configuration.

**Request:**
```json
{
  "name": "Custom Azure OpenAI",
  "provider": "azure_openai",
  "model": "gpt-35-turbo",
  "temperature": 0.1,
  "max_tokens": 1500,
  "response_format": "text",
  "api_key": "sensitive-api-key", // Will be stored in Key Vault
  "endpoint": "https://custom.openai.azure.com"
}
```

**Response (201):**
```json
{
  "config": {
    "config_id": "uuid",
    "name": "Custom Azure OpenAI",
    "provider": "azure_openai",
    "model": "gpt-35-turbo",
    "temperature": 0.1,
    "max_tokens": 1500,
    "response_format": "text",
    "is_enabled": true,
    "is_default": false,
    // Note: Sensitive fields like api_key are not returned
    "created_at": "2024-08-27T10:00:00Z",
    "updated_at": "2024-08-27T10:00:00Z"
  }
}
```

#### PUT /llm-configs/{config_id}
Update an existing LLM configuration.

**Request:**
```json
{
  "name": "Updated Config Name",
  "temperature": 0.4,
  "max_tokens": 2500,
  "is_enabled": false
}
```

**Response (200):**
```json
{
  "config": {
    "config_id": "uuid",
    "name": "Updated Config Name",
    // ... full updated config object
    "updated_at": "2024-08-27T10:15:00Z"
  }
}
```

#### DELETE /llm-configs/{config_id}
Delete an LLM configuration (soft delete).

**Response (204):** No content

### 3.2 LLM Testing and Validation

#### POST /llm-configs/{config_id}/test
Test an LLM configuration for connectivity and functionality.

**Request:**
```json
{
  "test_prompt": "Hello, please respond with 'Configuration test successful.'"
}
```

**Response (200):**
```json
{
  "test_result": {
    "success": true,
    "response_text": "Configuration test successful.",
    "response_time_ms": 1247,
    "tokens_used": {
      "prompt_tokens": 15,
      "completion_tokens": 8,
      "total_tokens": 23
    },
    "model_version": "gpt-4-0613",
    "test_timestamp": "2024-08-27T10:00:00Z"
  }
}
```

#### GET /llm-configs/providers
Get available LLM providers and their supported models.

**Response (200):**
```json
{
  "providers": [
    {
      "provider": "azure_openai",
      "display_name": "Azure OpenAI",
      "supported_models": [
        {
          "model": "gpt-4",
          "display_name": "GPT-4",
          "max_tokens": 8192,
          "supports_tools": true,
          "cost_per_1k_tokens": 0.03
        },
        {
          "model": "gpt-35-turbo",
          "display_name": "GPT-3.5 Turbo",
          "max_tokens": 4096,
          "supports_tools": true,
          "cost_per_1k_tokens": 0.002
        }
      ],
      "required_fields": [
        {"field": "api_key", "type": "string", "secure": true},
        {"field": "endpoint", "type": "url", "secure": false}
      ]
    },
    {
      "provider": "anthropic",
      "display_name": "Anthropic Claude",
      "supported_models": [
        {
          "model": "claude-3-sonnet-20240229",
          "display_name": "Claude 3 Sonnet",
          "max_tokens": 200000,
          "supports_tools": true,
          "cost_per_1k_tokens": 0.015
        }
      ],
      "required_fields": [
        {"field": "api_key", "type": "string", "secure": true}
      ]
    }
  ]
}
```

---

## 4. MCP SERVER MANAGEMENT

### 4.1 Global MCP Server Registry

#### GET /mcp-servers/registry
Get approved MCP servers from the global registry (platform admin only).

**Response (200):**
```json
{
  "servers": [
    {
      "server_id": "uuid",
      "name": "archer-grc-connector",
      "display_name": "Archer GRC Connector",
      "description": "Connect to RSA Archer GRC Platform for risk and compliance data",
      "category": "grc",
      "version": "2.1.0",
      "vendor": "GRC Solutions Inc.",
      "is_approved": true,
      "security_review_status": "approved",
      "available_tools": [
        {
          "name": "get_risks",
          "description": "Retrieve risk records from Archer",
          "input_schema": {
            "type": "object",
            "properties": {
              "application_id": {"type": "number"},
              "filters": {"type": "object"}
            }
          }
        }
      ],
      "required_permissions": ["read_risks", "read_controls"],
      "compliance_frameworks": ["ISO27001", "SOC2", "CPS230"],
      "documentation_url": "https://docs.example.com/archer-connector",
      "icon_url": "https://cdn.example.com/icons/archer.png"
    }
  ]
}
```

#### POST /mcp-servers/registry
Add new MCP server to global registry (platform admin only).

**Request:**
```json
{
  "name": "new-connector",
  "display_name": "New System Connector",
  "description": "Connector for new system integration",
  "category": "integration",
  "version": "1.0.0",
  "vendor": "Partner Corp",
  "server_type": "stdio",
  "executable_path": "/usr/local/bin/new-connector",
  "args": ["--config", "/etc/new-connector/config.json"],
  "available_tools": [
    {
      "name": "get_data",
      "description": "Retrieve data from new system",
      "input_schema": {
        "type": "object",
        "properties": {
          "query": {"type": "string"}
        }
      }
    }
  ],
  "required_permissions": ["read_data"],
  "documentation_url": "https://docs.partner.com/connector"
}
```

**Response (201):**
```json
{
  "server": {
    "server_id": "uuid",
    "name": "new-connector",
    // ... full server object
    "is_approved": false,
    "security_review_status": "pending"
  }
}
```

### 4.2 Tenant MCP Server Management

#### GET /mcp-servers
Get MCP servers enabled for the current tenant.

**Response (200):**
```json
{
  "servers": [
    {
      "tenant_server_id": "uuid",
      "server_id": "uuid",
      "name": "archer-grc-connector",
      "display_name": "Archer GRC Connector",
      "custom_name": "Our Archer Instance", // Tenant customization
      "description": "Connect to RSA Archer GRC Platform",
      "category": "grc",
      "is_enabled": true,
      "configuration_values": {
        "instance_url": "https://archer.acmecorp.com",
        "instance_name": "production"
      },
      "allowed_tools": ["get_risks", "get_controls"], // Subset of available tools
      "usage_count": 1247,
      "last_used_at": "2024-08-27T09:30:00Z",
      "health_status": "healthy",
      "last_health_check": "2024-08-27T09:00:00Z",
      "enabled_at": "2024-07-15T10:00:00Z"
    }
  ]
}
```

#### POST /mcp-servers/enable
Enable an MCP server from the global registry for the current tenant.

**Request:**
```json
{
  "server_id": "uuid", // From global registry
  "custom_name": "Our Custom Server Name",
  "configuration_values": {
    "instance_url": "https://system.acmecorp.com",
    "api_key": "sensitive-key" // Will be stored in Key Vault
  },
  "allowed_tools": ["get_risks", "get_controls"], // Subset of available tools
  "restricted_permissions": ["write_data"] // Additional restrictions
}
```

**Response (201):**
```json
{
  "tenant_server": {
    "tenant_server_id": "uuid",
    "server_id": "uuid",
    "name": "archer-grc-connector",
    "custom_name": "Our Custom Server Name",
    "is_enabled": true,
    "configuration_values": {
      "instance_url": "https://system.acmecorp.com"
      // Sensitive values not returned
    },
    "allowed_tools": ["get_risks", "get_controls"],
    "health_status": "unknown",
    "enabled_at": "2024-08-27T10:00:00Z"
  }
}
```

#### PUT /mcp-servers/{tenant_server_id}
Update tenant-specific MCP server configuration.

**Request:**
```json
{
  "custom_name": "Updated Server Name",
  "is_enabled": false,
  "configuration_values": {
    "instance_url": "https://new-system.acmecorp.com"
  },
  "allowed_tools": ["get_risks"] // Reduced tool set
}
```

**Response (200):**
```json
{
  "tenant_server": {
    "tenant_server_id": "uuid",
    // ... full updated server object
    "updated_at": "2024-08-27T10:15:00Z"
  }
}
```

#### DELETE /mcp-servers/{tenant_server_id}
Disable/remove MCP server for the current tenant.

**Response (204):** No content

### 4.3 MCP Server Testing and Health

#### POST /mcp-servers/{tenant_server_id}/test
Test MCP server connectivity and functionality.

**Request:**
```json
{
  "test_tool": "get_risks",
  "test_parameters": {
    "application_id": 123,
    "limit": 1
  }
}
```

**Response (200):**
```json
{
  "test_result": {
    "success": true,
    "response_time_ms": 1247,
    "tool_response": {
      "result": "Sample risk data retrieved successfully",
      "record_count": 1
    },
    "server_version": "2.1.0",
    "test_timestamp": "2024-08-27T10:00:00Z"
  }
}
```

#### GET /mcp-servers/{tenant_server_id}/health
Get current health status of an MCP server.

**Response (200):**
```json
{
  "health": {
    "status": "healthy", // healthy, unhealthy, unknown
    "last_check": "2024-08-27T09:00:00Z",
    "response_time_ms": 450,
    "uptime_percentage": 99.8,
    "error_count_24h": 2,
    "last_error": {
      "timestamp": "2024-08-27T08:30:00Z",
      "error": "Connection timeout",
      "resolved": true
    }
  }
}
```

### 4.4 MCP Tool Execution

#### GET /mcp-servers/tools
Get all available MCP tools across enabled servers for the current tenant.

**Response (200):**
```json
{
  "tools": [
    {
      "tool_name": "get_risks",
      "server_id": "uuid",
      "server_name": "archer-grc-connector",
      "description": "Retrieve risk records from Archer",
      "input_schema": {
        "type": "object",
        "properties": {
          "application_id": {"type": "number"},
          "filters": {"type": "object"}
        },
        "required": ["application_id"]
      },
      "is_available": true
    }
  ]
}
```

#### POST /mcp-servers/execute
Execute an MCP tool (used by LLM service).

**Request:**
```json
{
  "tool_name": "get_risks",
  "server_id": "uuid", // Optional: specific server, otherwise auto-route
  "parameters": {
    "application_id": 123,
    "filters": {"status": "Open"}
  },
  "context": {
    "agent_id": "uuid",
    "user_id": "uuid",
    "session_id": "uuid"
  }
}
```

**Response (200):**
```json
{
  "execution_result": {
    "success": true,
    "tool_name": "get_risks",
    "server_id": "uuid",
    "server_name": "archer-grc-connector",
    "result": {
      "risks": [
        {
          "risk_id": 12345,
          "title": "Data Breach Risk",
          "status": "Open",
          "likelihood": "Medium",
          "impact": "High"
        }
      ],
      "total_count": 1
    },
    "execution_time_ms": 847,
    "timestamp": "2024-08-27T10:00:00Z"
  }
}
```

---

## 5. ARCHER CONNECTIONS & CREDENTIALS

### 5.1 Connection Management

#### GET /connections/archer
Get Archer connections for the current tenant.

**Response (200):**
```json
{
  "connections": [
    {
      "connection_id": "uuid",
      "name": "Production Archer",
      "description": "Main production Archer instance",
      "is_active": true,
      "last_test_status": "success",
      "last_tested_at": "2024-08-27T08:00:00Z",
      "usage_count": 1247,
      "last_used_at": "2024-08-27T09:30:00Z",
      "created_at": "2024-07-01T00:00:00Z"
    }
  ]
}
```

#### POST /connections/archer
Create a new Archer connection.

**Request:**
```json
{
  "name": "Production Archer",
  "description": "Main production instance",
  "connection_config": {
    "instance_url": "https://archer.acmecorp.com",
    "username": "service_account",
    "password": "sensitive-password", // Will be stored in Key Vault
    "instance_name": "PROD"
  }
}
```

**Response (201):**
```json
{
  "connection": {
    "connection_id": "uuid",
    "name": "Production Archer",
    "description": "Main production instance",
    "is_active": true,
    "last_test_status": "pending",
    "created_at": "2024-08-27T10:00:00Z"
  }
}
```

#### POST /connections/archer/{connection_id}/test
Test an Archer connection.

**Response (200):**
```json
{
  "test_result": {
    "success": true,
    "connection_time_ms": 450,
    "authentication_status": "success",
    "available_applications": [
      {"id": 123, "name": "Risk Register"},
      {"id": 456, "name": "Control Assessments"}
    ],
    "test_timestamp": "2024-08-27T10:00:00Z"
  }
}
```

---

## 6. CHAT & SESSION MANAGEMENT

### 6.1 Chat Sessions

#### GET /chat/sessions
Get chat sessions for the current user and tenant.

**Query Parameters:**
- `agent_id` (uuid): Filter by specific agent
- `active_only` (boolean): Only active sessions
- `limit` (int): Max results
- `offset` (int): Pagination

**Response (200):**
```json
{
  "sessions": [
    {
      "session_id": "uuid",
      "session_name": "Risk Analysis Discussion",
      "agent": {
        "agent_id": "uuid",
        "name": "GRC Risk Analyzer",
        "avatar": "https://cdn.example.com/avatar.png"
      },
      "is_active": true,
      "last_message_at": "2024-08-27T09:30:00Z",
      "message_count": 12,
      "created_at": "2024-08-27T09:00:00Z"
    }
  ]
}
```

#### POST /chat/sessions
Create a new chat session.

**Request:**
```json
{
  "agent_id": "uuid",
  "session_name": "Risk Analysis Discussion",
  "session_context": {
    "initial_topic": "Q3 risk assessment"
  }
}
```

**Response (201):**
```json
{
  "session": {
    "session_id": "uuid",
    "session_name": "Risk Analysis Discussion",
    "agent_id": "uuid",
    "is_active": true,
    "message_count": 0,
    "created_at": "2024-08-27T10:00:00Z"
  }
}
```

#### GET /chat/sessions/{session_id}/messages
Get messages in a chat session.

**Query Parameters:**
- `limit` (int): Max messages (default: 50)
- `before_sequence` (int): Messages before this sequence number
- `include_system` (boolean): Include system messages

**Response (200):**
```json
{
  "messages": [
    {
      "message_id": "uuid",
      "sequence_number": 1,
      "role": "user",
      "content": "What are the current high-risk findings?",
      "content_type": "text",
      "tokens_used": 12,
      "created_at": "2024-08-27T09:00:00Z"
    },
    {
      "message_id": "uuid",
      "sequence_number": 2,
      "role": "assistant",
      "content": "I'll analyze the current high-risk findings for you...",
      "content_type": "text",
      "tool_calls": [
        {
          "tool_name": "get_risks",
          "parameters": {"status": "High"}
        }
      ],
      "tokens_used": 245,
      "processing_time_ms": 1247,
      "created_at": "2024-08-27T09:00:15Z"
    }
  ],
  "has_more": false
}
```

#### POST /chat/sessions/{session_id}/messages
Send a message in a chat session.

**Request:**
```json
{
  "content": "What are the current high-risk findings?",
  "content_type": "text"
}
```

**Response (201):**
```json
{
  "user_message": {
    "message_id": "uuid",
    "sequence_number": 3,
    "role": "user",
    "content": "What are the current high-risk findings?",
    "created_at": "2024-08-27T10:00:00Z"
  },
  "agent_response": {
    "message_id": "uuid",
    "sequence_number": 4,
    "role": "assistant",
    "content": "Based on the current risk data, I found 3 high-risk findings...",
    "tool_calls": [
      {
        "tool_name": "get_risks",
        "parameters": {"status": "High"},
        "result": "Risk data retrieved successfully"
      }
    ],
    "tokens_used": 347,
    "processing_time_ms": 1834,
    "created_at": "2024-08-27T10:00:05Z"
  }
}
```

---

## 7. USER MANAGEMENT

### 7.1 User Administration

#### GET /users
Get users in the current tenant (admin only).

**Response (200):**
```json
{
  "users": [
    {
      "user_id": "uuid",
      "email": "john.doe@acmecorp.com",
      "name": "John Doe",
      "roles": ["TenantOwner"],
      "status": "active",
      "mfa_enabled": true,
      "last_login_at": "2024-08-27T09:00:00Z",
      "created_at": "2024-07-01T00:00:00Z"
    }
  ]
}
```

#### POST /users/invite
Invite a new user to the tenant.

**Request:**
```json
{
  "email": "newuser@acmecorp.com",
  "name": "New User",
  "roles": ["AgentUser"],
  "send_invitation": true
}
```

**Response (201):**
```json
{
  "user": {
    "user_id": "uuid",
    "email": "newuser@acmecorp.com",
    "name": "New User",
    "roles": ["AgentUser"],
    "status": "pending_invitation",
    "invitation_sent": true,
    "created_at": "2024-08-27T10:00:00Z"
  }
}
```

#### PUT /users/{user_id}/roles
Update user roles (admin only).

**Request:**
```json
{
  "roles": ["AgentUser", "Auditor"]
}
```

**Response (200):**
```json
{
  "user": {
    "user_id": "uuid",
    "roles": ["AgentUser", "Auditor"],
    "updated_at": "2024-08-27T10:15:00Z"
  }
}
```

---

## 8. AUDIT & COMPLIANCE

### 8.1 Audit Events

#### GET /audit/events
Get audit events for the current tenant.

**Query Parameters:**
- `event_type` (string): Filter by event type
- `event_category` (string): Filter by category
- `severity` (string): Filter by severity
- `user_id` (uuid): Filter by user
- `start_date` (ISO date): Start of date range
- `end_date` (ISO date): End of date range
- `limit` (int): Max results
- `offset` (int): Pagination

**Response (200):**
```json
{
  "events": [
    {
      "event_id": "uuid",
      "event_type": "agent_created",
      "event_category": "configuration",
      "severity": "info",
      "user_email": "john.doe@acmecorp.com",
      "resource_type": "agent",
      "resource_id": "uuid",
      "event_summary": "AI agent 'GRC Risk Analyzer' created",
      "client_ip": "192.168.1.100",
      "compliance_frameworks": ["ISO27001", "SOC2"],
      "event_timestamp": "2024-08-27T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 1247,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

#### GET /audit/events/{event_id}
Get detailed audit event information.

**Response (200):**
```json
{
  "event": {
    "event_id": "uuid",
    "event_type": "agent_modified",
    "event_category": "configuration",
    "severity": "info",
    "user": {
      "user_id": "uuid",
      "email": "john.doe@acmecorp.com",
      "name": "John Doe"
    },
    "resource_type": "agent",
    "resource_id": "uuid",
    "event_summary": "AI agent configuration updated",
    "event_details": {
      "agent_name": "GRC Risk Analyzer",
      "changes": ["enabled_mcp_servers", "system_prompt"],
      "change_reason": "Added new MCP server integration"
    },
    "before_state": {
      "enabled_mcp_servers": ["server-1"],
      "system_prompt": "Previous prompt..."
    },
    "after_state": {
      "enabled_mcp_servers": ["server-1", "server-2"],
      "system_prompt": "Updated prompt..."
    },
    "client_ip": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "request_id": "uuid",
    "session_id": "session-123",
    "compliance_frameworks": ["ISO27001", "SOC2"],
    "event_hash": "sha256-hash-for-integrity",
    "event_timestamp": "2024-08-27T10:00:00Z"
  }
}
```

### 8.2 Compliance Reporting

#### GET /audit/compliance-report
Generate compliance report for specified framework and period.

**Query Parameters:**
- `framework` (string): ISO27001, SOC2, CPS230, GDPR
- `start_date` (ISO date): Report start date
- `end_date` (ISO date): Report end date
- `format` (string): json, pdf, csv

**Response (200):**
```json
{
  "report": {
    "framework": "ISO27001",
    "period": {
      "start": "2024-08-01T00:00:00Z",
      "end": "2024-08-27T23:59:59Z"
    },
    "tenant": {
      "tenant_id": "uuid",
      "name": "Acme Corporation"
    },
    "summary": {
      "total_events": 1247,
      "security_events": 89,
      "configuration_changes": 234,
      "user_actions": 924,
      "compliance_violations": 0
    },
    "controls_assessment": [
      {
        "control_id": "A.9.2.5",
        "control_name": "Review of user access rights",
        "status": "compliant",
        "evidence_count": 12,
        "last_review": "2024-08-25T10:00:00Z"
      }
    ],
    "recommendations": [
      {
        "priority": "medium",
        "recommendation": "Enable MFA for all users",
        "current_compliance": 85.7,
        "target_compliance": 100.0
      }
    ],
    "generated_at": "2024-08-27T10:00:00Z"
  }
}
```

---

## 9. ANALYTICS & METRICS

### 9.1 Usage Analytics

#### GET /analytics/usage
Get usage analytics for the current tenant.

**Query Parameters:**
- `period` (string): day, week, month, quarter, year
- `start_date` (ISO date): Custom period start
- `end_date` (ISO date): Custom period end
- `granularity` (string): hour, day, week, month

**Response (200):**
```json
{
  "usage": {
    "period": {
      "start": "2024-08-01T00:00:00Z",
      "end": "2024-08-27T23:59:59Z",
      "type": "month"
    },
    "summary": {
      "total_requests": 12470,
      "total_tokens": 2458914,
      "unique_users": 23,
      "active_agents": 8,
      "average_response_time_ms": 1247,
      "error_rate": 0.02,
      "estimated_cost": 491.78,
      "currency": "USD"
    },
    "trends": {
      "requests_trend": 15.2, // % change from previous period
      "tokens_trend": 23.8,
      "users_trend": 8.7,
      "cost_trend": 19.4
    },
    "daily_breakdown": [
      {
        "date": "2024-08-27",
        "requests": 567,
        "tokens": 89247,
        "unique_users": 12,
        "cost": 17.85
      }
    ],
    "top_agents": [
      {
        "agent_id": "uuid",
        "agent_name": "GRC Risk Analyzer",
        "requests": 3456,
        "tokens": 567890,
        "cost": 113.58
      }
    ],
    "top_tools": [
      {
        "tool_name": "get_risks",
        "usage_count": 1247,
        "average_response_time_ms": 847
      }
    ]
  }
}
```

### 9.2 Performance Metrics

#### GET /analytics/performance
Get performance metrics for the current tenant.

**Response (200):**
```json
{
  "performance": {
    "current_status": {
      "overall_health": "healthy",
      "api_availability": 99.9,
      "average_response_time_ms": 847,
      "error_rate": 0.02
    },
    "agent_performance": [
      {
        "agent_id": "uuid",
        "agent_name": "GRC Risk Analyzer",
        "average_response_time_ms": 1247,
        "success_rate": 98.5,
        "error_count_24h": 3
      }
    ],
    "mcp_server_performance": [
      {
        "server_id": "uuid",
        "server_name": "archer-grc-connector",
        "average_response_time_ms": 450,
        "uptime_percentage": 99.8,
        "error_count_24h": 1
      }
    ]
  }
}
```

---

## 10. TENANT SETTINGS & CONFIGURATION

### 10.1 Tenant Settings

#### GET /tenant/settings
Get current tenant settings.

**Response (200):**
```json
{
  "tenant": {
    "tenant_id": "uuid",
    "name": "Acme Corporation",
    "subscription_tier": "professional",
    "status": "active",
    "settings": {
      "enabledFeatures": ["ai_agents", "mcp_servers", "advanced_analytics"],
      "byoLlmEnabled": true,
      "auditRetentionDays": 2555,
      "allowedMcpServers": ["*"], // * means all approved servers
      "complianceFrameworks": ["ISO27001", "SOC2"]
    },
    "quota": {
      "dailyApiCalls": 10000,
      "monthlyTokens": 5000000,
      "storageGB": 100,
      "users": 50,
      "currentUsage": {
        "apiCalls": 1247,
        "tokens": 245000,
        "storage": 12.5,
        "users": 8
      }
    }
  }
}
```

#### PUT /tenant/settings
Update tenant settings (admin only).

**Request:**
```json
{
  "settings": {
    "enabledFeatures": ["ai_agents", "mcp_servers", "advanced_analytics", "custom_integrations"],
    "byoLlmEnabled": true,
    "auditRetentionDays": 3650,
    "complianceFrameworks": ["ISO27001", "SOC2", "CPS230"]
  }
}
```

**Response (200):**
```json
{
  "tenant": {
    "tenant_id": "uuid",
    "settings": {
      // ... updated settings
    },
    "updated_at": "2024-08-27T10:15:00Z"
  }
}
```

---

## Response Time SLAs

- **Authentication endpoints**: < 500ms
- **CRUD operations**: < 1000ms
- **MCP tool execution**: < 5000ms (depends on external systems)
- **Analytics queries**: < 2000ms
- **Audit queries**: < 3000ms

## Rate Limiting

Per-tenant rate limits based on subscription tier:

- **Starter**: 100 requests/minute, 1000/hour
- **Professional**: 300 requests/minute, 5000/hour
- **Enterprise**: 1000 requests/minute, 20000/hour

Rate limit headers included in all responses:
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 247
X-RateLimit-Reset: 1635789600
```

## Webhooks (Future Enhancement)

Event-driven notifications for:
- Agent status changes
- Quota threshold alerts
- Compliance violations
- System health issues

## API Versioning Strategy

- URL path versioning: `/api/v1/`, `/api/v2/`
- Backward compatibility maintained for 2 major versions
- Deprecation notices provided 6 months before removal
- Version-specific documentation and SDKs