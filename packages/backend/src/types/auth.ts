/**
 * Authentication and Authorization Type Definitions
 * For multi-tenant GRC AI Platform with Azure B2C integration
 */

// Azure AD B2C token structure
export interface AzureB2CToken {
  // Standard JWT claims
  iss: string; // Issuer
  aud: string; // Audience
  exp: number; // Expiration time
  iat: number; // Issued at
  nbf: number; // Not before
  
  // Azure B2C specific claims
  oid: string; // Object ID (user identifier)
  sub: string; // Subject (alternative user identifier)
  email?: string; // Email address
  emails?: string[]; // Email addresses array
  name?: string; // Display name
  given_name?: string; // First name
  family_name?: string; // Last name
  
  // Custom claims (configured in Azure B2C)
  extension_TenantId?: string; // Primary tenant ID
  extension_UserRoles?: string; // Comma-separated roles
  
  // Token metadata
  ver: string; // Version
  tid: string; // Tenant ID (Azure AD B2C tenant)
  azp: string; // Authorized party
  scp: string; // Scope
  
  // Additional Azure B2C claims
  auth_time?: number; // Authentication time
  idp?: string; // Identity provider
  tfp?: string; // Trust framework policy (B2C policy name)
}

// User roles in the multi-tenant system
export type UserRole = 
  | 'PlatformOwner'     // SaaS platform administrator (cross-tenant access)
  | 'TenantOwner'       // Full tenant management access
  | 'AgentUser'         // Operational dashboard access, can use agents
  | 'Auditor'           // Read-only audit access
  | 'ComplianceOfficer'; // Compliance-specific views and reports

// Permission structure for fine-grained access control
export interface Permission {
  resource: string; // Resource name (*, agents, llm-configs, mcp-servers, etc.)
  actions: ('read' | 'write' | 'delete' | 'admin')[]; // Allowed actions
}

// User information from the database
export interface User {
  user_id: string;
  azure_b2c_object_id: string; // Links to Azure B2C
  email: string;
  name: string;
  primary_tenant_id: string;
  status: 'active' | 'suspended' | 'pending_verification';
  mfa_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

// Tenant information
export interface Tenant {
  tenant_id: string;
  name: string;
  slug: string; // URL-friendly identifier
  subscription_tier: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'provisioning' | 'terminated';
  region: string;
  settings: TenantSettings;
  quota: TenantQuota;
  keyvault_name?: string; // Azure Key Vault for tenant secrets
  created_at: string;
  updated_at: string;
}

// Tenant configuration settings
export interface TenantSettings {
  enabledFeatures: string[];
  mcpToolsEnabled: string[];
  byoLlmEnabled: boolean;
  auditRetentionDays: number;
  allowedMcpServers: string[]; // '*' means all approved servers
  complianceFrameworks: ('ISO27001' | 'CPS230' | 'SOC2' | 'GDPR')[];
}

// Tenant resource quotas
export interface TenantQuota {
  dailyApiCalls: number;
  monthlyTokens: number;
  storageGB: number;
  users: number;
  currentUsage: {
    apiCalls: number;
    tokens: number;
    storage: number;
    users: number;
  };
}

// User-tenant-role association
export interface UserTenantRole {
  id: string;
  user_id: string;
  tenant_id: string;
  role: UserRole;
  permissions: Permission[];
  assigned_by_user_id?: string;
  assigned_at: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// Authentication context for requests
export interface AuthContext {
  user: {
    userId: string;
    email: string;
    name: string;
    azureObjectId: string;
    tenantId: string;
    roles: UserRole[];
    permissions: Permission[];
  };
  tenant: {
    tenantId: string;
    name: string;
    subscriptionTier: string;
    status: string;
  };
  tokenData: AzureB2CToken;
}

// Login request/response types
export interface LoginRequest {
  email: string;
  redirect_uri: string;
}

export interface LoginResponse {
  redirect_url: string;
  state: string; // CSRF protection
}

export interface CallbackRequest {
  code: string;
  state: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  user: {
    user_id: string;
    email: string;
    name: string;
    primary_tenant_id: string;
    roles: UserRole[];
    mfa_enabled: boolean;
    last_login_at: string;
  };
  tenant: {
    tenant_id: string;
    name: string;
    slug: string;
    subscription_tier: string;
    status: string;
  };
}

export interface UserInfoResponse {
  user: {
    user_id: string;
    email: string;
    name: string;
    roles: UserRole[];
    permissions: Permission[];
    mfa_enabled: boolean;
    last_login_at: string;
  };
  tenant: {
    tenant_id: string;
    name: string;
    subscription_tier: string;
    status: string;
    settings: TenantSettings;
    quota: TenantQuota;
  };
}

export interface AvailableTenantsResponse {
  tenants: {
    tenant_id: string;
    name: string;
    slug: string;
    subscription_tier: string;
    user_roles: UserRole[];
    status: string;
  }[];
}

export interface TenantSwitchRequest {
  tenant_id: string;
}

export interface TenantSwitchResponse {
  access_token: string; // New token with tenant context
  tenant: {
    tenant_id: string;
    name: string;
    subscription_tier: string;
    status: string;
  };
}

// Security event logging types
export interface SecurityEvent {
  eventType: 'authentication_success' | 'authentication_failure' | 'authorization_failure' | 
            'unauthorized_tenant_access' | 'cross_tenant_access_attempt' | 'quota_exceeded' |
            'suspicious_activity' | 'token_refresh' | 'logout';
  userId?: string;
  tenantId?: string;
  details?: Record<string, any>;
  clientIp?: string;
  userAgent?: string;
  timestamp?: string;
}

// Role permission mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  PlatformOwner: [
    { resource: '*', actions: ['read', 'write', 'delete', 'admin'] },
    { resource: 'cross-tenant', actions: ['read', 'write', 'delete', 'admin'] },
    { resource: 'mcp-registry', actions: ['read', 'write', 'delete', 'admin'] },
    { resource: 'platform-settings', actions: ['read', 'write', 'delete', 'admin'] }
  ],
  TenantOwner: [
    { resource: '*', actions: ['read', 'write', 'delete', 'admin'] },
    { resource: 'users', actions: ['read', 'write', 'delete'] },
    { resource: 'tenant-settings', actions: ['read', 'write'] },
    { resource: 'audit', actions: ['read'] },
    { resource: 'billing', actions: ['read'] }
  ],
  AgentUser: [
    { resource: 'dashboard', actions: ['read'] },
    { resource: 'agents', actions: ['read', 'write'] },
    { resource: 'mcp-tools', actions: ['read', 'write'] },
    { resource: 'chat', actions: ['read', 'write'] },
    { resource: 'llm-configs', actions: ['read'] },
    { resource: 'connections', actions: ['read'] }
  ],
  Auditor: [
    { resource: 'audit', actions: ['read'] },
    { resource: 'compliance', actions: ['read'] },
    { resource: 'reports', actions: ['read'] },
    { resource: 'dashboard', actions: ['read'] }
  ],
  ComplianceOfficer: [
    { resource: 'audit', actions: ['read'] },
    { resource: 'compliance', actions: ['read', 'write'] },
    { resource: 'reports', actions: ['read'] },
    { resource: 'dashboard', actions: ['read'] },
    { resource: 'risk-assessments', actions: ['read', 'write'] }
  ]
};

// Resource type mappings for authorization
export const RESOURCE_TYPES = {
  AGENTS: 'agents',
  LLM_CONFIGS: 'llm-configs',
  MCP_SERVERS: 'mcp-servers',
  CHAT_SESSIONS: 'chat',
  CONNECTIONS: 'connections',
  USERS: 'users',
  AUDIT: 'audit',
  COMPLIANCE: 'compliance',
  DASHBOARD: 'dashboard',
  TENANT_SETTINGS: 'tenant-settings',
  PLATFORM_SETTINGS: 'platform-settings',
  MCP_REGISTRY: 'mcp-registry'
} as const;

export type ResourceType = typeof RESOURCE_TYPES[keyof typeof RESOURCE_TYPES];

// HTTP action to permission mapping
export const HTTP_ACTION_PERMISSIONS: Record<string, string[]> = {
  GET: ['read'],
  POST: ['write'],
  PUT: ['write'],
  PATCH: ['write'],
  DELETE: ['delete']
};

// Common authorization error codes
export const AUTH_ERROR_CODES = {
  MISSING_AUTH_TOKEN: 'MISSING_AUTH_TOKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  MISSING_TENANT_ID: 'MISSING_TENANT_ID',
  INVALID_TENANT_ID: 'INVALID_TENANT_ID',
  TENANT_ACCESS_DENIED: 'TENANT_ACCESS_DENIED',
  TENANT_INACTIVE: 'TENANT_INACTIVE',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_ACCESS_DENIED: 'RESOURCE_ACCESS_DENIED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  CROSS_TENANT_ACCESS_DENIED: 'CROSS_TENANT_ACCESS_DENIED',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED'
} as const;

export type AuthErrorCode = typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES];