// Frontend types for tenant management that mirror backend interfaces

export interface Tenant {
  tenant_id: string;
  name: string;
  slug: string;
  description?: string;
  domain?: string;
  logo_url?: string;
  contact_email: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface TenantSAMLConfig {
  config_id: string;
  tenant_id: string;
  idp_entity_id: string;
  idp_sso_url: string;
  idp_x509_certificate: string;
  sp_entity_id: string;
  sp_acs_url: string;
  sp_private_key?: string;
  sp_x509_certificate?: string;
  name_id_format: string;
  signature_algorithm: string;
  digest_algorithm: string;
  require_signed_assertions: boolean;
  require_signed_response: boolean;
  email_attribute: string;
  first_name_attribute: string;
  last_name_attribute: string;
  groups_attribute: string;
  session_timeout_minutes: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantSAMLGroupMapping {
  mapping_id: string;
  tenant_id: string;
  saml_group_name: string;
  platform_role: string;
  permissions: string[];
  mcp_tool_groups: string[];
  priority: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  description?: string;
  domain?: string;
  contact_email: string;
}

export interface TenantConfigurationRequest {
  tenant_id: string;
  saml_config: Omit<TenantSAMLConfig, 'config_id' | 'tenant_id' | 'created_at' | 'updated_at'>;
  group_mappings?: Omit<TenantSAMLGroupMapping, 'mapping_id' | 'tenant_id' | 'created_at' | 'updated_at'>[];
}

export interface TenantManagementResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface SAMLTestResult {
  valid: boolean;
  errors: string[];
}

export interface TenantListResponse {
  tenants: Tenant[];
  total: number;
  page: number;
  limit: number;
}

// UI State interfaces
export interface TenantFormData {
  name: string;
  slug: string;
  description: string;
  domain: string;
  contact_email: string;
}

export interface SAMLConfigFormData {
  idp_entity_id: string;
  idp_sso_url: string;
  idp_x509_certificate: string;
  sp_entity_id: string;
  sp_acs_url: string;
  sp_private_key: string;
  sp_x509_certificate: string;
  name_id_format: string;
  signature_algorithm: string;
  digest_algorithm: string;
  require_signed_assertions: boolean;
  require_signed_response: boolean;
  email_attribute: string;
  first_name_attribute: string;
  last_name_attribute: string;
  groups_attribute: string;
  session_timeout_minutes: number;
  is_enabled: boolean;
}

export interface GroupMappingFormData {
  saml_group_name: string;
  platform_role: string;
  permissions: string[];
  mcp_tool_groups: string[];
  priority: number;
  is_enabled: boolean;
}

// Common platform roles and permissions
export const PLATFORM_ROLES = [
  'TenantOwner',
  'Administrator', 
  'User',
  'ReadOnly',
  'Auditor'
] as const;

export const PLATFORM_PERMISSIONS = [
  'read_analytics',
  'write_analytics', 
  'manage_agents',
  'manage_users',
  'manage_settings',
  'view_audit_logs',
  'export_data'
] as const;

export const MCP_TOOL_GROUPS = [
  'archer_admin',
  'archer_readonly',
  'file_access',
  'database_access',
  'reporting_tools'
] as const;