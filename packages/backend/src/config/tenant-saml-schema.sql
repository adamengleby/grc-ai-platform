-- =============================================
-- Tenant SAML Configuration Schema
-- Extends existing database for per-tenant SSO/SAML
-- =============================================

-- Tenant SAML Identity Provider Configurations
CREATE TABLE IF NOT EXISTS tenant_saml_configs (
  config_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  
  -- SAML Provider Configuration
  idp_entity_id TEXT NOT NULL,
  idp_sso_url TEXT NOT NULL,
  idp_slo_url TEXT,
  idp_x509_certificate TEXT NOT NULL,
  
  -- Service Provider (Our Platform) Configuration  
  sp_entity_id TEXT NOT NULL,
  sp_acs_url TEXT NOT NULL,
  sp_sls_url TEXT,
  sp_x509_certificate TEXT,
  sp_private_key TEXT,
  
  -- SAML Attributes Mapping
  email_attribute TEXT DEFAULT 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  first_name_attribute TEXT DEFAULT 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  last_name_attribute TEXT DEFAULT 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  groups_attribute TEXT DEFAULT 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
  user_id_attribute TEXT DEFAULT 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
  
  -- SAML Settings
  name_id_format TEXT DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  binding_type TEXT DEFAULT 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
  signature_algorithm TEXT DEFAULT 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  digest_algorithm TEXT DEFAULT 'http://www.w3.org/2001/04/xmlenc#sha256',
  
  -- Security & Validation
  require_signed_assertions INTEGER DEFAULT 1,
  require_signed_response INTEGER DEFAULT 1,
  require_encrypted_assertions INTEGER DEFAULT 0,
  validate_audience INTEGER DEFAULT 1,
  
  -- Session Management
  session_timeout_minutes INTEGER DEFAULT 480, -- 8 hours
  force_reauth INTEGER DEFAULT 0,
  
  -- Status & Metadata
  is_enabled INTEGER DEFAULT 1,
  is_tested INTEGER DEFAULT 0,
  test_status TEXT DEFAULT 'pending',
  test_error TEXT,
  last_tested_at TEXT,
  
  -- Configuration Management
  config_version INTEGER DEFAULT 1,
  backup_config TEXT, -- JSON backup of previous config
  rollback_available INTEGER DEFAULT 0,
  
  -- Audit
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users(user_id)
);

-- Tenant SAML Group Role Mappings
CREATE TABLE IF NOT EXISTS tenant_saml_group_mappings (
  mapping_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  
  -- SAML Group Configuration
  saml_group_name TEXT NOT NULL,
  saml_group_dn TEXT, -- Distinguished Name for LDAP-based groups
  
  -- Platform Role Mapping
  platform_role TEXT NOT NULL CHECK(platform_role IN ('TenantOwner', 'TenantAdmin', 'AgentUser', 'Auditor', 'ReadOnly')),
  
  -- Permissions Configuration
  permissions TEXT DEFAULT '[]', -- JSON array of specific permissions
  mcp_tool_groups TEXT DEFAULT '[]', -- JSON array of allowed MCP tool group IDs
  
  -- Auto-provisioning Settings
  auto_provision_user INTEGER DEFAULT 1,
  auto_assign_role INTEGER DEFAULT 1,
  require_manual_approval INTEGER DEFAULT 0,
  
  -- Status
  is_enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 100, -- Lower number = higher priority for overlapping groups
  
  -- Audit
  created_by_user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
  UNIQUE(tenant_id, saml_group_name)
);

-- Platform Admin Configuration (for platform-wide tenant management)
CREATE TABLE IF NOT EXISTS platform_admin_users (
  admin_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  admin_level TEXT NOT NULL CHECK(admin_level IN ('SuperAdmin', 'TenantManager', 'Support')),
  
  -- Admin Permissions
  can_create_tenants INTEGER DEFAULT 0,
  can_modify_tenants INTEGER DEFAULT 0,
  can_delete_tenants INTEGER DEFAULT 0,
  can_view_all_tenants INTEGER DEFAULT 0,
  can_manage_platform_configs INTEGER DEFAULT 0,
  can_access_audit_logs INTEGER DEFAULT 0,
  
  -- Restrictions
  restricted_to_regions TEXT DEFAULT '[]', -- JSON array of allowed regions
  max_tenants_managed INTEGER DEFAULT NULL, -- NULL = unlimited
  
  -- Status
  is_enabled INTEGER DEFAULT 1,
  requires_mfa INTEGER DEFAULT 1,
  
  -- Audit
  granted_by_admin_id TEXT,
  granted_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT,
  
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (granted_by_admin_id) REFERENCES platform_admin_users(admin_id)
);

-- Tenant Onboarding Requests (for new client signup workflow)
CREATE TABLE IF NOT EXISTS tenant_onboarding_requests (
  request_id TEXT PRIMARY KEY,
  
  -- Organization Information
  organization_name TEXT NOT NULL,
  organization_domain TEXT NOT NULL,
  primary_contact_email TEXT NOT NULL,
  primary_contact_name TEXT NOT NULL,
  primary_contact_phone TEXT,
  
  -- Subscription Details
  requested_subscription_tier TEXT NOT NULL DEFAULT 'starter',
  estimated_users INTEGER,
  requested_region TEXT DEFAULT 'eastus',
  
  -- Technical Requirements
  has_existing_sso INTEGER DEFAULT 0,
  sso_provider TEXT, -- 'azure-ad', 'okta', 'ping', 'adfs', 'google', 'custom'
  technical_contact_email TEXT,
  technical_contact_name TEXT,
  
  -- Business Requirements
  compliance_frameworks TEXT DEFAULT '[]', -- JSON: ['SOX', 'GDPR', 'ISO27001']
  use_cases TEXT, -- Free text description
  integration_requirements TEXT, -- JSON describing integrations needed
  
  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN (
    'submitted', 'reviewing', 'approved', 'provisioning', 
    'configuring', 'testing', 'completed', 'rejected', 'cancelled'
  )),
  rejection_reason TEXT,
  
  -- Provisioning Details (filled during approval)
  assigned_tenant_id TEXT,
  assigned_admin_id TEXT,
  provisioned_at TEXT,
  completed_at TEXT,
  
  -- Workflow
  review_notes TEXT,
  reviewed_by_admin_id TEXT,
  reviewed_at TEXT,
  approved_by_admin_id TEXT,
  approved_at TEXT,
  
  -- Audit
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (assigned_admin_id) REFERENCES platform_admin_users(admin_id),
  FOREIGN KEY (reviewed_by_admin_id) REFERENCES platform_admin_users(admin_id),
  FOREIGN KEY (approved_by_admin_id) REFERENCES platform_admin_users(admin_id),
  FOREIGN KEY (assigned_tenant_id) REFERENCES tenants(tenant_id)
);

-- Tenant Provisioning Status Tracking
CREATE TABLE IF NOT EXISTS tenant_provisioning_status (
  status_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  onboarding_request_id TEXT,
  
  -- Provisioning Steps Status
  infrastructure_provisioned INTEGER DEFAULT 0,
  database_initialized INTEGER DEFAULT 0,
  saml_configured INTEGER DEFAULT 0,
  admin_user_created INTEGER DEFAULT 0,
  default_configurations_applied INTEGER DEFAULT 0,
  mcp_servers_configured INTEGER DEFAULT 0,
  testing_completed INTEGER DEFAULT 0,
  
  -- Detailed Status
  current_step TEXT DEFAULT 'pending',
  current_step_status TEXT DEFAULT 'not_started',
  current_step_details TEXT,
  error_details TEXT,
  
  -- Progress Tracking
  total_steps INTEGER DEFAULT 7,
  completed_steps INTEGER DEFAULT 0,
  estimated_completion_time TEXT, -- ISO duration
  
  -- Automation vs Manual
  automated_provisioning INTEGER DEFAULT 1,
  requires_manual_intervention INTEGER DEFAULT 0,
  manual_intervention_reason TEXT,
  
  -- Audit
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  failed_at TEXT,
  last_updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
  FOREIGN KEY (onboarding_request_id) REFERENCES tenant_onboarding_requests(request_id)
);

-- Update existing users table to support SAML (remove azure_b2c_object_id dependency)
-- Note: In real migration, we'd need careful data migration scripts

-- Add SAML-specific user fields (to be added to existing users table)
-- ALTER TABLE users ADD COLUMN saml_name_id TEXT UNIQUE;
-- ALTER TABLE users ADD COLUMN saml_session_index TEXT;
-- ALTER TABLE users ADD COLUMN authentication_method TEXT DEFAULT 'saml';
-- ALTER TABLE users ADD COLUMN last_saml_assertion TEXT;
-- ALTER TABLE users DROP COLUMN azure_b2c_object_id; -- Remove after migration

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_saml_configs_tenant_id ON tenant_saml_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_saml_group_mappings_tenant_group ON tenant_saml_group_mappings(tenant_id, saml_group_name);
CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_status ON tenant_onboarding_requests(status);
CREATE INDEX IF NOT EXISTS idx_tenant_provisioning_tenant ON tenant_provisioning_status(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_admin_level ON platform_admin_users(admin_level, is_enabled);

-- Sample Data for Development
-- Insert platform super admin (demo purposes)
INSERT OR IGNORE INTO platform_admin_users (
  admin_id, user_id, admin_level, can_create_tenants, can_modify_tenants, 
  can_delete_tenants, can_view_all_tenants, can_manage_platform_configs, 
  can_access_audit_logs, is_enabled, requires_mfa
) VALUES (
  'ADMIN-001-SUPER', 'U1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6', 'SuperAdmin',
  1, 1, 1, 1, 1, 1, 1, 1
);

-- Sample SAML configuration for demo tenant
INSERT OR IGNORE INTO tenant_saml_configs (
  config_id, tenant_id, idp_entity_id, idp_sso_url, idp_x509_certificate,
  sp_entity_id, sp_acs_url, is_enabled, is_tested, test_status
) VALUES (
  'SAML-001-DEMO', 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6',
  'https://demo-corp.okta.com/exk1234567890',
  'https://demo-corp.okta.com/app/demo-grc-platform/exk1234567890/sso/saml',
  '-----BEGIN CERTIFICATE-----\nMIIC... (demo certificate)\n-----END CERTIFICATE-----',
  'https://grc-platform.example.com/saml/metadata',
  'https://grc-platform.example.com/saml/acs',
  1, 0, 'configured'
);

-- Sample SAML group mappings
INSERT OR IGNORE INTO tenant_saml_group_mappings (
  mapping_id, tenant_id, saml_group_name, platform_role, 
  mcp_tool_groups, is_enabled, priority
) VALUES 
  ('MAPPING-001', 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6', 'GRC_Administrators', 'TenantOwner', 
   '["G1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6"]', 1, 10),
  ('MAPPING-002', 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6', 'Risk_Analysts', 'AgentUser', 
   '["G2A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6"]', 1, 20),
  ('MAPPING-003', 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6', 'Compliance_Officers', 'AgentUser', 
   '["G3A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6"]', 1, 20),
  ('MAPPING-004', 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6', 'Auditors', 'Auditor', 
   '["G3A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6"]', 1, 30);