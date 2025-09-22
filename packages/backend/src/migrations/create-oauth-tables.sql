-- OAuth 2.0 + OIDC Database Schema for Multi-tenant GRC Platform
-- Migration: Create OAuth configuration tables

-- Tenant OAuth/OIDC Configuration
CREATE TABLE IF NOT EXISTS tenant_oauth_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  tenant_slug TEXT NOT NULL UNIQUE,
  provider_type TEXT NOT NULL DEFAULT 'auth0', -- 'auth0', 'azure-ad-b2c', 'okta', 'custom'
  
  -- OAuth 2.0 + OIDC Configuration
  issuer_base_url TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_ref TEXT NOT NULL, -- Reference to Key Vault secret or encrypted value
  
  -- Endpoints (auto-discovered from issuer_base_url/.well-known/openid_configuration)
  authorization_endpoint TEXT,
  token_endpoint TEXT,
  userinfo_endpoint TEXT,
  jwks_uri TEXT,
  end_session_endpoint TEXT,
  
  -- OAuth Configuration
  audience TEXT,
  scopes TEXT NOT NULL DEFAULT 'openid profile email', -- Space-separated scopes
  response_type TEXT NOT NULL DEFAULT 'code',
  response_mode TEXT NOT NULL DEFAULT 'query',
  grant_type TEXT NOT NULL DEFAULT 'authorization_code',
  
  -- URLs
  redirect_uri TEXT NOT NULL,
  post_logout_redirect_uri TEXT,
  
  -- Session Configuration
  session_timeout_minutes INTEGER DEFAULT 480, -- 8 hours
  refresh_token_enabled BOOLEAN DEFAULT 1,
  pkce_enabled BOOLEAN DEFAULT 1, -- PKCE for enhanced security
  
  -- Claims Mapping (JSON)
  claims_mapping TEXT, -- JSON mapping of OIDC claims to internal user fields
  
  -- Status and Metadata
  is_enabled BOOLEAN DEFAULT 0,
  is_production BOOLEAN DEFAULT 0,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- OAuth Users (linked via OIDC subject ID)
CREATE TABLE IF NOT EXISTS oauth_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  
  -- OIDC Identity
  oidc_subject_id TEXT NOT NULL, -- From OIDC 'sub' claim
  oidc_provider TEXT NOT NULL, -- Which OAuth provider
  
  -- User Information
  email TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT 0,
  display_name TEXT,
  given_name TEXT,
  family_name TEXT,
  picture_url TEXT,
  locale TEXT,
  
  -- Authorization
  roles TEXT, -- JSON array of roles
  permissions TEXT, -- JSON array of permissions
  
  -- OIDC Claims Storage
  oidc_claims TEXT, -- JSON storage for additional OIDC claims
  
  -- Session Management
  last_login_at DATETIME,
  login_count INTEGER DEFAULT 0,
  
  -- Account Status
  is_active BOOLEAN DEFAULT 1,
  is_email_verified BOOLEAN DEFAULT 0,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tenant_id, oidc_subject_id),
  UNIQUE(tenant_id, email),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- OAuth Token Management (for audit and revocation)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tenant_id TEXT NOT NULL,
  
  -- Token Information
  access_token_hash TEXT NOT NULL, -- Hashed access token for identification
  refresh_token_hash TEXT, -- Hashed refresh token
  id_token_hash TEXT, -- Hashed ID token
  
  -- Token Metadata
  token_type TEXT DEFAULT 'Bearer',
  expires_at DATETIME NOT NULL,
  scopes TEXT, -- Space-separated granted scopes
  audience TEXT,
  
  -- Token Lifecycle
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME,
  revocation_reason TEXT,
  
  -- Client Information
  client_id TEXT,
  user_agent TEXT,
  ip_address TEXT,
  
  FOREIGN KEY (user_id) REFERENCES oauth_users(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_oauth_configs_tenant_id ON tenant_oauth_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_oauth_configs_tenant_slug ON tenant_oauth_configs(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_tenant_oauth_configs_enabled ON tenant_oauth_configs(is_enabled);

CREATE INDEX IF NOT EXISTS idx_oauth_users_tenant_id ON oauth_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oauth_users_oidc_subject ON oauth_users(oidc_subject_id);
CREATE INDEX IF NOT EXISTS idx_oauth_users_email ON oauth_users(email);
CREATE INDEX IF NOT EXISTS idx_oauth_users_active ON oauth_users(is_active);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_tenant_id ON oauth_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_revoked_at ON oauth_tokens(revoked_at);

-- Insert default OAuth configurations for demo tenants
INSERT OR REPLACE INTO tenant_oauth_configs (
  tenant_id, tenant_slug, provider_type,
  issuer_base_url, client_id, client_secret_ref,
  audience, scopes, redirect_uri, post_logout_redirect_uri,
  is_enabled, claims_mapping
) VALUES 
(
  'acme-corp',
  'acme',
  'auth0',
  'https://dev-grc-platform.us.auth0.com',
  'dev-acme-client-id',
  'AUTH0_ACME_CLIENT_SECRET',
  'https://api.acme-corp.grc-platform.com',
  'openid profile email tenant:read agent:manage',
  'http://localhost:3005/auth/acme/callback',
  'http://localhost:5173/login?tenant=acme',
  1,
  '{"tenant_id": "custom:tenant_id", "roles": "custom:roles", "permissions": "custom:permissions"}'
),
(
  'fintech-solutions',
  'fintech',
  'auth0',
  'https://dev-grc-platform.us.auth0.com',
  'dev-fintech-client-id',
  'AUTH0_FINTECH_CLIENT_SECRET',
  'https://api.fintech-solutions.grc-platform.com',
  'openid profile email tenant:read',
  'http://localhost:3005/auth/fintech/callback',
  'http://localhost:5173/login?tenant=fintech',
  1,
  '{"tenant_id": "custom:tenant_id", "roles": "custom:roles", "permissions": "custom:permissions"}'
),
(
  'platform-admin',
  'admin',
  'auth0',
  'https://dev-grc-platform.us.auth0.com',
  'dev-platform-admin-client-id',
  'AUTH0_PLATFORM_CLIENT_SECRET',
  'https://api.grc-platform.com',
  'openid profile email platform:admin cross-tenant:access',
  'http://localhost:3005/auth/admin/callback',
  'http://localhost:5173/login?tenant=admin',
  1,
  '{"tenant_id": "custom:tenant_id", "roles": "custom:roles", "permissions": "custom:permissions"}'
);

-- Insert sample OAuth users for development
INSERT OR REPLACE INTO oauth_users (
  tenant_id, oidc_subject_id, oidc_provider,
  email, display_name, given_name, family_name,
  roles, permissions, is_active, is_email_verified
) VALUES 
(
  'acme-corp',
  'auth0|acme-user-001',
  'auth0',
  'user1@acme.com',
  'Sarah Chen',
  'Sarah',
  'Chen',
  '["TenantOwner"]',
  '["read", "write", "admin"]',
  1,
  1
),
(
  'acme-corp',
  'auth0|acme-analyst-001',
  'auth0',
  'analyst@acme.com',
  'Mike Johnson',
  'Mike',
  'Johnson',
  '["AgentUser"]',
  '["read", "write"]',
  1,
  1
),
(
  'acme-corp',
  'auth0|acme-auditor-001',
  'auth0',
  'audit@acme.com',
  'Lisa Wang',
  'Lisa',
  'Wang',
  '["Auditor", "ComplianceOfficer"]',
  '["read"]',
  1,
  1
),
(
  'fintech-solutions',
  'auth0|fintech-owner-001',
  'auth0',
  'owner@fintech.com',
  'David Smith',
  'David',
  'Smith',
  '["TenantOwner"]',
  '["read", "write", "admin"]',
  1,
  1
),
(
  'platform-admin',
  'auth0|platform-admin-001',
  'auth0',
  'admin@platform.com',
  'Alex Rodriguez',
  'Alex',
  'Rodriguez',
  '["PlatformOwner"]',
  '["read", "write", "delete", "admin", "cross-tenant"]',
  1,
  1
);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS trigger_tenant_oauth_configs_updated_at
  AFTER UPDATE ON tenant_oauth_configs
BEGIN
  UPDATE tenant_oauth_configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trigger_oauth_users_updated_at
  AFTER UPDATE ON oauth_users
BEGIN
  UPDATE oauth_users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;