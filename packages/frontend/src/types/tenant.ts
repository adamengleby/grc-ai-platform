// Tenant and user role definitions based on platform architecture
export interface Tenant {
  id: string;
  name: string;
  subscriptionTier: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'provisioning';
  region: string;
  createdAt: string;
  updatedAt: string;
  settings: TenantSettings;
  quota: TenantQuota;
}

export interface TenantSettings {
  enabledFeatures: string[];
  mcpToolsEnabled: string[];
  byoLlmEnabled: boolean;
  auditRetentionDays: number;
  allowedMcpServers: string[];
  complianceFrameworks: ('ISO27001' | 'CPS230' | 'SOC2' | 'GDPR')[];
}

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

export interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  roles: UserRole[];
  lastLogin: string;
  isActive: boolean;
  mfaEnabled: boolean;
}

export type UserRole = 
  | 'PlatformOwner'   // SaaS platform administrator (cross-tenant access)
  | 'TenantOwner'     // Full tenant management access
  | 'AgentUser'       // Operational dashboard access
  | 'Auditor'         // Read-only audit access
  | 'ComplianceOfficer'; // Compliance-specific views

export interface TenantContext {
  tenant: Tenant;
  user: User;
  permissions: Permission[];
  switchTenant: (tenantId: string) => Promise<void>;
}

export interface Permission {
  resource: string;
  actions: ('read' | 'write' | 'delete' | 'admin')[];
}

// Azure AD B2C token structure
export interface AzureB2CToken {
  tenantId: string;
  userId: string;
  email: string;
  name: string;
  roles: UserRole[];
  iat: number;
  exp: number;
  aud: string;
  iss: string;
}