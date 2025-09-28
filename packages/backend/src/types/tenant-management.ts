/**
 * Tenant Management Types
 * Comprehensive type definitions for per-tenant SSO/SAML authentication
 */

// =============================================
// Core Tenant Types
// =============================================

export interface TenantSAMLConfig {
  config_id: string;
  tenant_id: string;
  
  // SAML Identity Provider Configuration
  idp_entity_id: string;
  idp_sso_url: string;
  idp_slo_url?: string;
  idp_x509_certificate: string;
  
  // Service Provider (Our Platform) Configuration
  sp_entity_id: string;
  sp_acs_url: string;
  sp_sls_url?: string;
  sp_x509_certificate?: string;
  sp_private_key?: string;
  
  // SAML Attribute Mapping
  email_attribute: string;
  first_name_attribute: string;
  last_name_attribute: string;
  groups_attribute: string;
  user_id_attribute: string;
  
  // SAML Settings
  name_id_format: string;
  binding_type: string;
  signature_algorithm: string;
  digest_algorithm: string;
  
  // Security Configuration
  require_signed_assertions: boolean;
  require_signed_response: boolean;
  require_encrypted_assertions: boolean;
  validate_audience: boolean;
  
  // Session Management
  session_timeout_minutes: number;
  force_reauth: boolean;
  
  // Status
  is_enabled: boolean;
  is_tested: boolean;
  test_status: 'pending' | 'testing' | 'success' | 'failed' | 'configured';
  test_error?: string;
  last_tested_at?: string;
  
  // Configuration Management
  config_version: number;
  backup_config?: string;
  rollback_available: boolean;
  
  // Audit
  created_by_user_id?: string;
  updated_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantSAMLGroupMapping {
  mapping_id: string;
  tenant_id: string;
  
  // SAML Group Configuration
  saml_group_name: string;
  saml_group_dn?: string; // Distinguished Name for LDAP
  
  // Platform Role Mapping
  platform_role: 'TenantOwner' | 'TenantAdmin' | 'AgentUser' | 'Auditor' | 'ReadOnly';
  
  // Permissions
  permissions: string[]; // Specific permissions array
  mcp_tool_groups: string[]; // MCP tool group IDs
  
  // Auto-provisioning
  auto_provision_user: boolean;
  auto_assign_role: boolean;
  require_manual_approval: boolean;
  
  // Status
  is_enabled: boolean;
  priority: number; // Lower = higher priority
  
  // Audit
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// Platform Admin Types
// =============================================

export interface PlatformAdminUser {
  admin_id: string;
  user_id: string;
  admin_level: 'SuperAdmin' | 'TenantManager' | 'Support';
  
  // Admin Permissions
  can_create_tenants: boolean;
  can_modify_tenants: boolean;
  can_delete_tenants: boolean;
  can_view_all_tenants: boolean;
  can_manage_platform_configs: boolean;
  can_access_audit_logs: boolean;
  
  // Restrictions
  restricted_to_regions: string[];
  max_tenants_managed?: number;
  
  // Status
  is_enabled: boolean;
  requires_mfa: boolean;
  
  // Audit
  granted_by_admin_id?: string;
  granted_at: string;
  last_login_at?: string;
}

// =============================================
// Tenant Onboarding Types
// =============================================

export interface TenantOnboardingRequest {
  request_id: string;
  
  // Organization Information
  organization_name: string;
  organization_domain: string;
  primary_contact_email: string;
  primary_contact_name: string;
  primary_contact_phone?: string;
  
  // Subscription Details
  requested_subscription_tier: 'starter' | 'professional' | 'enterprise';
  estimated_users?: number;
  requested_region: string;
  
  // Technical Requirements
  has_existing_sso: boolean;
  sso_provider?: 'azure-ad' | 'okta' | 'ping' | 'adfs' | 'google' | 'custom';
  technical_contact_email?: string;
  technical_contact_name?: string;
  
  // Business Requirements
  compliance_frameworks: string[]; // ['SOX', 'GDPR', 'ISO27001']
  use_cases?: string;
  integration_requirements?: any; // JSON object
  
  // Status
  status: 'submitted' | 'reviewing' | 'approved' | 'provisioning' | 
          'configuring' | 'testing' | 'completed' | 'rejected' | 'cancelled';
  rejection_reason?: string;
  
  // Provisioning Details
  assigned_tenant_id?: string;
  assigned_admin_id?: string;
  provisioned_at?: string;
  completed_at?: string;
  
  // Workflow
  review_notes?: string;
  reviewed_by_admin_id?: string;
  reviewed_at?: string;
  approved_by_admin_id?: string;
  approved_at?: string;
  
  // Audit
  created_at: string;
  updated_at: string;
}

export interface TenantProvisioningStatus {
  status_id: string;
  tenant_id: string;
  onboarding_request_id?: string;
  
  // Provisioning Steps
  infrastructure_provisioned: boolean;
  database_initialized: boolean;
  saml_configured: boolean;
  admin_user_created: boolean;
  default_configurations_applied: boolean;
  mcp_servers_configured: boolean;
  testing_completed: boolean;
  
  // Current Status
  current_step: string;
  current_step_status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  current_step_details?: string;
  error_details?: string;
  
  // Progress
  total_steps: number;
  completed_steps: number;
  estimated_completion_time?: string;
  
  // Automation
  automated_provisioning: boolean;
  requires_manual_intervention: boolean;
  manual_intervention_reason?: string;
  
  // Audit
  started_at: string;
  completed_at?: string;
  failed_at?: string;
  last_updated_at: string;
}

// =============================================
// Request/Response Types
// =============================================

export interface CreateTenantRequest {
  organization_name: string;
  organization_domain: string;
  primary_contact_email: string;
  primary_contact_name: string;
  subscription_tier: 'starter' | 'professional' | 'enterprise';
  region?: string;
  
  // Optional SAML Configuration
  saml_config?: Partial<TenantSAMLConfig>;
  group_mappings?: Omit<TenantSAMLGroupMapping, 'mapping_id' | 'tenant_id' | 'created_at' | 'updated_at'>[];
}

export interface TenantConfigurationRequest {
  tenant_id: string;
  saml_config: Partial<TenantSAMLConfig>;
  group_mappings?: TenantSAMLGroupMapping[];
  test_configuration?: boolean;
}

export interface SAMLTestRequest {
  tenant_id: string;
  test_assertion?: string; // Base64 encoded SAML assertion for testing
  dry_run?: boolean;
}

export interface SAMLTestResult {
  success: boolean;
  test_type: 'configuration' | 'assertion' | 'end_to_end';
  
  // Test Results
  certificate_valid: boolean;
  metadata_accessible: boolean;
  assertion_valid?: boolean;
  user_mapping_successful?: boolean;
  group_mapping_successful?: boolean;
  
  // Extracted Data (if successful)
  extracted_user?: {
    email: string;
    first_name: string;
    last_name: string;
    user_id: string;
    groups: string[];
  };
  
  // Error Information
  errors: string[];
  warnings: string[];
  
  // Recommendations
  recommendations: string[];
}

// =============================================
// Service Response Types
// =============================================

export interface TenantManagementResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    request_id: string;
    tenant_id?: string;
  };
}

export interface TenantListResponse {
  tenants: Array<{
    tenant_id: string;
    name: string;
    slug: string;
    status: string;
    subscription_tier: string;
    user_count: number;
    saml_configured: boolean;
    last_activity: string;
    created_at: string;
  }>;
  total_count: number;
  pagination: {
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface TenantDetailsResponse {
  tenant: {
    tenant_id: string;
    name: string;
    slug: string;
    status: string;
    subscription_tier: string;
    region: string;
    settings: any;
    quota_config: any;
    created_at: string;
    updated_at: string;
  };
  saml_config?: TenantSAMLConfig;
  group_mappings: TenantSAMLGroupMapping[];
  provisioning_status?: TenantProvisioningStatus;
  users: Array<{
    user_id: string;
    email: string;
    name: string;
    role: string;
    last_login_at?: string;
    created_at: string;
  }>;
  usage_metrics: {
    total_users: number;
    active_users_30d: number;
    api_calls_30d: number;
    storage_used_gb: number;
    mcp_tools_enabled: number;
    ai_agents_configured: number;
  };
}

// =============================================
// Configuration Templates
// =============================================

export interface SAMLConfigurationTemplate {
  name: string;
  provider: 'azure-ad' | 'okta' | 'ping' | 'adfs' | 'google' | 'generic';
  description: string;
  
  // Default Settings
  default_name_id_format: string;
  default_binding_type: string;
  default_attribute_mappings: {
    email: string;
    first_name: string;
    last_name: string;
    groups: string;
    user_id: string;
  };
  
  // Security Defaults
  default_security_settings: {
    require_signed_assertions: boolean;
    require_signed_response: boolean;
    require_encrypted_assertions: boolean;
    signature_algorithm: string;
    digest_algorithm: string;
  };
  
  // Common Group Mappings
  suggested_group_mappings: Array<{
    saml_group_pattern: string;
    platform_role: string;
    description: string;
  }>;
  
  // Setup Instructions
  setup_instructions: string[];
  documentation_url?: string;
}

// =============================================
// Event Types for Audit Logging
// =============================================

export interface TenantManagementAuditEvent {
  event_type: 'tenant_created' | 'tenant_updated' | 'tenant_deleted' | 'tenant_suspended' |
             'saml_configured' | 'saml_tested' | 'group_mapping_added' | 'group_mapping_updated' |
             'user_provisioned' | 'user_deprovisioned' | 'admin_access_granted';
  tenant_id: string;
  user_id?: string;
  admin_id?: string;
  details: any;
  before_state?: any;
  after_state?: any;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
}

// =============================================
// Error Types
// =============================================

export class TenantManagementError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any,
    public tenant_id?: string
  ) {
    super(message);
    this.name = 'TenantManagementError';
  }
}

export class SAMLConfigurationError extends TenantManagementError {
  constructor(message: string, details?: any, tenant_id?: string) {
    super('SAML_CONFIGURATION_ERROR', message, details, tenant_id);
    this.name = 'SAMLConfigurationError';
  }
}

export class TenantProvisioningError extends TenantManagementError {
  constructor(message: string, details?: any, tenant_id?: string) {
    super('TENANT_PROVISIONING_ERROR', message, details, tenant_id);
    this.name = 'TenantProvisioningError';
  }
}