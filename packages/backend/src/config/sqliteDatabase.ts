/**
 * SQLite Database Configuration for Development
 * Provides a lightweight, file-based database for development and testing
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import winston from 'winston';

export class SQLiteDatabase {
  private db: Database.Database;
  private logger: winston.Logger;

  constructor(logger: winston.Logger, dbPath: string = ':memory:') {
    this.logger = logger;
    
    // Use file-based database for persistence
    const actualDbPath = dbPath === ':memory:' ? ':memory:' : path.resolve(dbPath);
    this.db = new Database(actualDbPath);
    
    // Enable foreign keys
    this.db.exec('PRAGMA foreign_keys = ON');
    
    this.logger.info(`SQLite database initialized: ${actualDbPath}`);
    
    // Initialize schema
    this.initializeSchema();
  }

  /**
   * Execute query (SELECT)
   */
  query<T = any>(sql: string, params: any[] = []): T[] {
    try {
      const stmt = this.db.prepare(sql);
      const results = stmt.all(...params);
      
      this.logger.debug('Database query executed', {
        sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
        rowCount: results.length
      });
      
      return results as T[];
    } catch (error) {
      this.logger.error('Database query failed', {
        sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute statement (INSERT, UPDATE, DELETE)
   */
  execute(sql: string, params: any[] = []): void {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      
      this.logger.debug('Database statement executed', {
        sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
        changes: result.changes
      });
    } catch (error) {
      this.logger.error('Database statement failed', {
        sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Begin transaction
   */
  beginTransaction(): any {
    return this.db.transaction((callback: any) => callback());
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    this.logger.info('SQLite database closed');
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    try {
      // Core tenant management tables
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tenants (
          tenant_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          subscription_tier TEXT NOT NULL DEFAULT 'starter',
          status TEXT NOT NULL DEFAULT 'active',
          region TEXT NOT NULL DEFAULT 'eastus',
          settings TEXT DEFAULT '{}',
          quota_config TEXT DEFAULT '{}',
          keyvault_name TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          deleted_at TEXT NULL
        );
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          user_id TEXT PRIMARY KEY,
          azure_b2c_object_id TEXT UNIQUE,
          email TEXT NOT NULL,
          name TEXT NOT NULL,
          primary_tenant_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          mfa_enabled INTEGER DEFAULT 0,
          last_login_at TEXT,
          password_last_changed TEXT,
          saml_name_id TEXT UNIQUE,
          saml_session_index TEXT,
          authentication_method TEXT DEFAULT 'saml',
          last_saml_assertion TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          deleted_at TEXT NULL,
          FOREIGN KEY (primary_tenant_id) REFERENCES tenants(tenant_id)
        );
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_tenant_roles (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          role TEXT NOT NULL,
          permissions TEXT DEFAULT '[]',
          assigned_by_user_id TEXT,
          assigned_at TEXT DEFAULT (datetime('now')),
          expires_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(user_id),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (assigned_by_user_id) REFERENCES users(user_id),
          UNIQUE(user_id, tenant_id, role)
        );
      `);

      // AI Agent tables
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ai_agents (
          agent_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          persona TEXT,
          system_prompt TEXT,
          llm_config_id TEXT,
          enabled_mcp_servers TEXT DEFAULT '[]',
          avatar TEXT,
          color TEXT,
          is_enabled INTEGER DEFAULT 1,
          usage_count INTEGER DEFAULT 0,
          last_used_at TEXT,
          created_by_user_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          deleted_at TEXT NULL,
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
        );
      `);

      // LLM Configuration tables
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS llm_configurations (
          config_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          temperature REAL DEFAULT 0.3,
          max_tokens INTEGER DEFAULT 2000,
          rate_limit INTEGER DEFAULT NULL,
          response_format TEXT DEFAULT 'text',
          api_key_vault_secret TEXT,
          endpoint_vault_secret TEXT,
          is_enabled INTEGER DEFAULT 1,
          is_default INTEGER DEFAULT 0,
          last_tested_at TEXT,
          last_test_status TEXT,
          last_test_error TEXT,
          usage_count INTEGER DEFAULT 0,
          total_tokens_used INTEGER DEFAULT 0,
          created_by_user_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          deleted_at TEXT NULL,
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
          UNIQUE(tenant_id, name)
        );
      `);

      // MCP Server Registry
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS mcp_server_registry (
          server_id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          server_type TEXT NOT NULL,
          executable_path TEXT,
          args TEXT,
          env TEXT,
          available_tools TEXT,
          required_permissions TEXT,
          version TEXT,
          vendor TEXT,
          documentation_url TEXT,
          icon_url TEXT,
          is_approved INTEGER DEFAULT 0,
          compliance_frameworks TEXT,
          security_review_status TEXT DEFAULT 'pending',
          security_review_notes TEXT,
          created_by_user_id TEXT,
          approved_by_user_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          approved_at TEXT,
          FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
          FOREIGN KEY (approved_by_user_id) REFERENCES users(user_id)
        );
      `);

      // Tenant MCP Server Configurations
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tenant_mcp_servers (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          server_id TEXT NOT NULL,
          is_enabled INTEGER DEFAULT 1,
          custom_name TEXT,
          configuration_values TEXT DEFAULT '{}',
          allowed_tools TEXT,
          restricted_permissions TEXT,
          usage_count INTEGER DEFAULT 0,
          last_used_at TEXT,
          health_status TEXT DEFAULT 'unknown',
          last_health_check TEXT,
          enabled_by_user_id TEXT,
          enabled_at TEXT DEFAULT (datetime('now')),
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (server_id) REFERENCES mcp_server_registry(server_id),
          FOREIGN KEY (enabled_by_user_id) REFERENCES users(user_id),
          UNIQUE(tenant_id, server_id)
        );
      `);

      // Connection Credentials (encrypted storage)
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS connection_credentials (
          credential_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          connection_type TEXT NOT NULL,
          base_url TEXT NOT NULL,
          username TEXT NOT NULL,
          encrypted_password TEXT NOT NULL,
          instance_id TEXT,
          instance_name TEXT,
          user_domain_id TEXT DEFAULT '1',
          database_name TEXT,
          port INTEGER,
          is_default INTEGER DEFAULT 0,
          is_enabled INTEGER DEFAULT 1,
          last_tested_at TEXT,
          test_status TEXT DEFAULT 'pending',
          last_error TEXT,
          created_by_user_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          deleted_at TEXT NULL,
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
          UNIQUE(tenant_id, name)
        );
      `);

      // Audit Events
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS audit_events (
          event_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          event_category TEXT NOT NULL,
          severity TEXT NOT NULL,
          user_id TEXT,
          user_email TEXT,
          resource_type TEXT,
          resource_id TEXT,
          event_summary TEXT,
          event_details TEXT,
          client_ip TEXT,
          user_agent TEXT,
          request_id TEXT,
          session_id TEXT,
          compliance_frameworks TEXT,
          before_state TEXT,
          after_state TEXT,
          event_hash TEXT,
          event_timestamp TEXT DEFAULT (datetime('now')),
          ingested_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
      `);

      // Chat Sessions
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          session_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          session_name TEXT,
          session_context TEXT,
          is_active INTEGER DEFAULT 1,
          last_message_at TEXT DEFAULT (datetime('now')),
          message_count INTEGER DEFAULT 0,
          retention_policy TEXT DEFAULT 'standard',
          auto_delete_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          deleted_at TEXT NULL,
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (user_id) REFERENCES users(user_id),
          FOREIGN KEY (agent_id) REFERENCES ai_agents(agent_id)
        );
      `);

      // User Preferences
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          preference_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          theme TEXT DEFAULT 'light',
          language TEXT DEFAULT 'en-US',
          timezone TEXT DEFAULT 'UTC',
          ui_preferences TEXT DEFAULT '{}',
          notification_preferences TEXT DEFAULT '{}',
          privacy_settings TEXT DEFAULT '{}',
          advanced_settings TEXT DEFAULT '{}',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (user_id) REFERENCES users(user_id),
          UNIQUE(tenant_id, user_id)
        );
      `);

      // MCP Tool Access Control Tables
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS mcp_tool_groups (
          group_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          group_name TEXT NOT NULL,
          description TEXT,
          created_by_user_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
          UNIQUE(tenant_id, group_name)
        );
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS mcp_tool_group_tools (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          server_id TEXT NOT NULL,
          tool_name TEXT NOT NULL,
          allowed_scopes TEXT DEFAULT '[]',
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (group_id) REFERENCES mcp_tool_groups(group_id) ON DELETE CASCADE,
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (server_id) REFERENCES mcp_server_registry(server_id),
          UNIQUE(group_id, server_id, tool_name)
        );
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS mcp_role_tool_access (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          role_name TEXT NOT NULL,
          group_id TEXT NOT NULL,
          granted_at TEXT DEFAULT (datetime('now')),
          granted_by_user_id TEXT,
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (group_id) REFERENCES mcp_tool_groups(group_id) ON DELETE CASCADE,
          FOREIGN KEY (granted_by_user_id) REFERENCES users(user_id),
          UNIQUE(tenant_id, role_name, group_id)
        );
      `);

      // OAuth Sessions for MCP Token Management
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS oauth_sessions (
          session_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          user_id TEXT,
          saml_groups TEXT NOT NULL,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_at TEXT NOT NULL,
          allowed_tools TEXT DEFAULT '[]',
          created_at TEXT DEFAULT (datetime('now')),
          last_accessed TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
      `);

      // Archer Sessions for MCP Tool Access
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS archer_sessions (
          session_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          user_id TEXT,
          username TEXT NOT NULL,
          session_token TEXT NOT NULL,
          instance_id TEXT NOT NULL,
          base_url TEXT NOT NULL,
          user_domain_id TEXT,
          expires_at TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
        );
      `);

      // Tenant Settings  
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tenant_settings (
          setting_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL UNIQUE,
          organization_name TEXT,
          organization_logo_url TEXT,
          branding_colors TEXT DEFAULT '{}',
          default_llm_config_id TEXT,
          default_retention_days INTEGER DEFAULT 90,
          enabled_features TEXT DEFAULT '[]',
          security_policies TEXT DEFAULT '{}',
          compliance_frameworks TEXT DEFAULT '[]',
          byollm_enabled INTEGER DEFAULT 0,
          byollm_allowed_providers TEXT DEFAULT '[]',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (default_llm_config_id) REFERENCES llm_configurations(config_id)
        );
      `);

      // SAML Configuration Tables for Per-Tenant Authentication
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tenant_saml_configs (
          config_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL UNIQUE,
          idp_entity_id TEXT NOT NULL,
          idp_sso_url TEXT NOT NULL,
          idp_slo_url TEXT,
          idp_x509_certificate TEXT NOT NULL,
          sp_entity_id TEXT NOT NULL,
          sp_acs_url TEXT NOT NULL,
          sp_sls_url TEXT,
          sp_x509_certificate TEXT,
          sp_private_key TEXT,
          email_attribute TEXT DEFAULT 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
          first_name_attribute TEXT DEFAULT 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
          last_name_attribute TEXT DEFAULT 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
          groups_attribute TEXT DEFAULT 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
          user_id_attribute TEXT DEFAULT 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
          name_id_format TEXT DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          binding_type TEXT DEFAULT 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
          signature_algorithm TEXT DEFAULT 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
          digest_algorithm TEXT DEFAULT 'http://www.w3.org/2001/04/xmlenc#sha256',
          require_signed_assertions INTEGER DEFAULT 1,
          require_signed_response INTEGER DEFAULT 1,
          require_encrypted_assertions INTEGER DEFAULT 0,
          validate_audience INTEGER DEFAULT 1,
          session_timeout_minutes INTEGER DEFAULT 480,
          force_reauth INTEGER DEFAULT 0,
          is_enabled INTEGER DEFAULT 1,
          is_tested INTEGER DEFAULT 0,
          test_status TEXT DEFAULT 'pending',
          test_error TEXT,
          last_tested_at TEXT,
          config_version INTEGER DEFAULT 1,
          backup_config TEXT,
          rollback_available INTEGER DEFAULT 0,
          created_by_user_id TEXT,
          updated_by_user_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
          FOREIGN KEY (updated_by_user_id) REFERENCES users(user_id)
        );
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tenant_saml_group_mappings (
          mapping_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          saml_group_name TEXT NOT NULL,
          saml_group_dn TEXT,
          platform_role TEXT NOT NULL CHECK(platform_role IN ('TenantOwner', 'TenantAdmin', 'AgentUser', 'Auditor', 'ReadOnly')),
          permissions TEXT DEFAULT '[]',
          mcp_tool_groups TEXT DEFAULT '[]',
          auto_provision_user INTEGER DEFAULT 1,
          auto_assign_role INTEGER DEFAULT 1,
          require_manual_approval INTEGER DEFAULT 0,
          is_enabled INTEGER DEFAULT 1,
          priority INTEGER DEFAULT 100,
          created_by_user_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
          UNIQUE(tenant_id, saml_group_name)
        );
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS platform_admin_users (
          admin_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          admin_level TEXT NOT NULL CHECK(admin_level IN ('SuperAdmin', 'TenantManager', 'Support')),
          can_create_tenants INTEGER DEFAULT 0,
          can_modify_tenants INTEGER DEFAULT 0,
          can_delete_tenants INTEGER DEFAULT 0,
          can_view_all_tenants INTEGER DEFAULT 0,
          can_manage_platform_configs INTEGER DEFAULT 0,
          can_access_audit_logs INTEGER DEFAULT 0,
          restricted_to_regions TEXT DEFAULT '[]',
          max_tenants_managed INTEGER DEFAULT NULL,
          is_enabled INTEGER DEFAULT 1,
          requires_mfa INTEGER DEFAULT 1,
          granted_by_admin_id TEXT,
          granted_at TEXT DEFAULT (datetime('now')),
          last_login_at TEXT,
          FOREIGN KEY (user_id) REFERENCES users(user_id),
          FOREIGN KEY (granted_by_admin_id) REFERENCES platform_admin_users(admin_id)
        );
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tenant_onboarding_requests (
          request_id TEXT PRIMARY KEY,
          organization_name TEXT NOT NULL,
          organization_domain TEXT NOT NULL,
          primary_contact_email TEXT NOT NULL,
          primary_contact_name TEXT NOT NULL,
          primary_contact_phone TEXT,
          requested_subscription_tier TEXT NOT NULL DEFAULT 'starter',
          estimated_users INTEGER,
          requested_region TEXT DEFAULT 'eastus',
          has_existing_sso INTEGER DEFAULT 0,
          sso_provider TEXT,
          technical_contact_email TEXT,
          technical_contact_name TEXT,
          compliance_frameworks TEXT DEFAULT '[]',
          use_cases TEXT,
          integration_requirements TEXT,
          status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN (
            'submitted', 'reviewing', 'approved', 'provisioning', 
            'configuring', 'testing', 'completed', 'rejected', 'cancelled'
          )),
          rejection_reason TEXT,
          assigned_tenant_id TEXT,
          assigned_admin_id TEXT,
          provisioned_at TEXT,
          completed_at TEXT,
          review_notes TEXT,
          reviewed_by_admin_id TEXT,
          reviewed_at TEXT,
          approved_by_admin_id TEXT,
          approved_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (assigned_admin_id) REFERENCES platform_admin_users(admin_id),
          FOREIGN KEY (reviewed_by_admin_id) REFERENCES platform_admin_users(admin_id),
          FOREIGN KEY (approved_by_admin_id) REFERENCES platform_admin_users(admin_id),
          FOREIGN KEY (assigned_tenant_id) REFERENCES tenants(tenant_id)
        );
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tenant_provisioning_status (
          status_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL UNIQUE,
          onboarding_request_id TEXT,
          infrastructure_provisioned INTEGER DEFAULT 0,
          database_initialized INTEGER DEFAULT 0,
          saml_configured INTEGER DEFAULT 0,
          admin_user_created INTEGER DEFAULT 0,
          default_configurations_applied INTEGER DEFAULT 0,
          mcp_servers_configured INTEGER DEFAULT 0,
          testing_completed INTEGER DEFAULT 0,
          current_step TEXT DEFAULT 'pending',
          current_step_status TEXT DEFAULT 'not_started',
          current_step_details TEXT,
          error_details TEXT,
          total_steps INTEGER DEFAULT 7,
          completed_steps INTEGER DEFAULT 0,
          estimated_completion_time TEXT,
          automated_provisioning INTEGER DEFAULT 1,
          requires_manual_intervention INTEGER DEFAULT 0,
          manual_intervention_reason TEXT,
          started_at TEXT DEFAULT (datetime('now')),
          completed_at TEXT,
          failed_at TEXT,
          last_updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
          FOREIGN KEY (onboarding_request_id) REFERENCES tenant_onboarding_requests(request_id)
        );
      `);

      // Privacy Settings Table - Critical for LLM data protection
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS privacy_settings (
          setting_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          user_id TEXT,
          enable_privacy_masking INTEGER DEFAULT 1,
          masking_level TEXT DEFAULT 'strict' CHECK(masking_level IN ('light', 'moderate', 'strict')),
          enable_tokenization INTEGER DEFAULT 0,
          custom_sensitive_fields TEXT DEFAULT '[]',
          privacy_key TEXT,
          scope TEXT DEFAULT 'user' CHECK(scope IN ('user', 'tenant')),
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(tenant_id, user_id)
        );
      `);

      // Tenant Secrets Table - Azure Key Vault references for secure secret management
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tenant_secrets (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          tenant_id TEXT NOT NULL,
          secret_name TEXT NOT NULL,
          secret_type TEXT NOT NULL CHECK (secret_type IN ('api-key', 'connection-string', 'certificate', 'custom')),
          description TEXT,
          key_vault_reference TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(tenant_id, secret_name),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
        );
      `);

      // Create index for privacy settings lookups
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_privacy_settings_tenant_user 
        ON privacy_settings(tenant_id, user_id);
      `);

      // Insert sample data for development
      this.insertSampleData();

      this.logger.info('Database schema initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database schema', error);
      throw error;
    }
  }

  /**
   * Insert sample data for development
   */
  private insertSampleData(): void {
    try {
      // Check if sample data already exists
      const existingTenant = this.query('SELECT COUNT(*) as count FROM tenants');
      if (existingTenant[0].count > 0) {
        return; // Sample data already exists
      }

      const tenantId = 'A1B2C3D4-E5F6-7G8H-9I0J-K1L2M3N4O5P6';
      const userId = 'U1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6';

      // Insert sample tenant
      this.execute(`
        INSERT INTO tenants (tenant_id, name, slug, subscription_tier, status, region, settings, quota_config)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tenantId,
        'Demo Tenant',
        'demo-tenant',
        'professional',
        'active',
        'eastus',
        JSON.stringify({
          enabledFeatures: ["ai_agents", "mcp_servers", "advanced_analytics"],
          byoLlmEnabled: true,
          auditRetentionDays: 2555
        }),
        JSON.stringify({
          dailyApiCalls: 10000,
          monthlyTokens: 5000000,
          storageGB: 100,
          users: 50
        })
      ]);

      // Insert sample user
      this.execute(`
        INSERT INTO users (user_id, azure_b2c_object_id, email, name, primary_tenant_id, status, mfa_enabled, saml_name_id, authentication_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        'demo-user-object-id-123',
        'demo@example.com',
        'Demo User',
        tenantId,
        'active',
        0,
        'demo@example.com',
        'saml'
      ]);

      // Insert user role
      this.execute(`
        INSERT INTO user_tenant_roles (id, user_id, tenant_id, role, assigned_at)
        VALUES (?, ?, ?, ?, ?)
      `, [
        'R1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6',
        userId,
        tenantId,
        'TenantOwner',
        new Date().toISOString()
      ]);

      // Insert sample LLM configuration
      const llmConfigId = 'L1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6';
      this.execute(`
        INSERT INTO llm_configurations (
          config_id, tenant_id, name, provider, model, temperature, max_tokens, 
          response_format, is_enabled, is_default, last_test_status, usage_count, 
          total_tokens_used, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        llmConfigId,
        tenantId,
        'GPT-4 Development',
        'openai',
        'gpt-4',
        0.3,
        2000,
        'text',
        1,
        1,
        'success',
        150,
        45000,
        userId
      ]);

      // Insert sample MCP server first (needed for agents)
      const mcpServerId = 'M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6';
      this.execute(`
        INSERT INTO mcp_server_registry (
          server_id, name, display_name, description, category, server_type,
          available_tools, is_approved, security_review_status, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        mcpServerId,
        'archer-connector',
        'Archer GRC Connector',
        'Connects to RSA Archer GRC platform for compliance data',
        'grc',
        'stdio',
        JSON.stringify(['get_archer_applications', 'search_archer_records', 'get_application_fields']),
        1,
        'approved',
        userId
      ]);

      // Enable MCP server for tenant
      this.execute(`
        INSERT INTO tenant_mcp_servers (
          id, tenant_id, server_id, is_enabled, custom_name, configuration_values,
          allowed_tools, usage_count, health_status, enabled_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'T1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6',
        tenantId,
        mcpServerId,
        1,
        'Archer Connector',
        JSON.stringify({}),
        JSON.stringify(['get_archer_applications', 'search_archer_records']),
        0,
        'healthy',
        userId
      ]);

      // Insert sample AI agents
      const agentIds = {
        grcAnalyst: 'agent-001-grc-analyst',
        riskAssessor: 'agent-002-risk-assessor',
        complianceOfficer: 'agent-003-compliance-officer'
      };

      this.execute(`
        INSERT INTO ai_agents (
          agent_id, tenant_id, name, description, persona, system_prompt, 
          llm_config_id, enabled_mcp_servers, avatar, color, is_enabled, 
          usage_count, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        agentIds.grcAnalyst,
        tenantId,
        'GRC Business Analyst',
        'Expert AI assistant for Governance, Risk & Compliance analysis with access to Archer GRC platform',
        'professional',
        'You are a senior GRC (Governance, Risk & Compliance) business analyst with deep expertise in enterprise risk management, regulatory compliance, and internal controls. You help organizations identify, assess, and mitigate risks while ensuring compliance with various regulatory frameworks.',
        llmConfigId,
        JSON.stringify([mcpServerId]),
        '🎯',
        '#3B82F6',
        1,
        25,
        userId
      ]);

      this.execute(`
        INSERT INTO ai_agents (
          agent_id, tenant_id, name, description, persona, system_prompt, 
          llm_config_id, enabled_mcp_servers, avatar, color, is_enabled, 
          usage_count, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        agentIds.riskAssessor,
        tenantId,
        'Risk Assessment Specialist',
        'Specialized in quantitative risk analysis, threat modeling, and risk scoring methodologies',
        'analytical',
        'You are a specialized risk assessment analyst focused on quantitative risk analysis, threat modeling, and enterprise risk scoring. You excel at translating complex risk scenarios into actionable business insights and recommendations.',
        llmConfigId,
        JSON.stringify([mcpServerId]),
        '⚠️',
        '#EF4444',
        1,
        18,
        userId
      ]);

      this.execute(`
        INSERT INTO ai_agents (
          agent_id, tenant_id, name, description, persona, system_prompt, 
          llm_config_id, enabled_mcp_servers, avatar, color, is_enabled, 
          usage_count, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        agentIds.complianceOfficer,
        tenantId,
        'Compliance Officer',
        'Regulatory compliance expert specializing in framework mapping and gap analysis',
        'methodical',
        'You are a compliance officer with extensive experience in regulatory frameworks including SOX, GDPR, ISO 27001, and industry-specific regulations. You specialize in compliance gap analysis, control mapping, and regulatory reporting.',
        llmConfigId,
        JSON.stringify([mcpServerId]),
        '✅',
        '#10B981',
        1,
        12,
        userId
      ]);


      // Insert sample connection credential
      const credentialId = 'C1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6';
      this.execute(`
        INSERT INTO connection_credentials (
          credential_id, tenant_id, name, connection_type, base_url, username, 
          encrypted_password, instance_id, instance_name, user_domain_id, 
          is_default, test_status, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        credentialId,
        tenantId,
        'Demo Archer Connection',
        'archer-grc',
        'https://demo.archer.example.com',
        'demo_user',
        'encrypted_demo_password_123', // In real implementation, this would be properly encrypted
        'DEMO_INSTANCE',
        'Demo Archer Instance',
        '1',
        1, // is_default
        'success',
        userId
      ]);

      // Insert sample MCP tool groups
      const toolGroupIds = {
        grcAdmins: 'G1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6',
        riskAnalysts: 'G2A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6',
        complianceUsers: 'G3A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6'
      };

      this.execute(`
        INSERT INTO mcp_tool_groups (group_id, tenant_id, group_name, description, created_by_user_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        toolGroupIds.grcAdmins,
        tenantId,
        'GRC Administrators',
        'Full access to all Archer GRC tools including administrative functions',
        userId
      ]);

      this.execute(`
        INSERT INTO mcp_tool_groups (group_id, tenant_id, group_name, description, created_by_user_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        toolGroupIds.riskAnalysts,
        tenantId,
        'Risk Analysts',
        'Access to risk assessment and analysis tools only',
        userId
      ]);

      this.execute(`
        INSERT INTO mcp_tool_groups (group_id, tenant_id, group_name, description, created_by_user_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        toolGroupIds.complianceUsers,
        tenantId,
        'Compliance Users',
        'Read-only access to compliance reporting and search tools',
        userId
      ]);

      // Insert tool-to-group mappings for each group
      const toolGroupMappings = [
        // GRC Administrators - Full access
        { groupId: toolGroupIds.grcAdmins, tools: [
          'get_archer_applications', 'search_archer_records', 'get_application_fields',
          'create_archer_record', 'update_archer_record', 'delete_archer_record',
          'get_archer_users', 'manage_archer_permissions', 'export_archer_data'
        ]},
        // Risk Analysts - Risk-focused tools
        { groupId: toolGroupIds.riskAnalysts, tools: [
          'get_archer_applications', 'search_archer_records', 'get_application_fields',
          'create_archer_record', 'update_archer_record', 'export_archer_data'
        ]},
        // Compliance Users - Read-only tools  
        { groupId: toolGroupIds.complianceUsers, tools: [
          'get_archer_applications', 'search_archer_records', 'get_application_fields',
          'export_archer_data'
        ]}
      ];

      toolGroupMappings.forEach(mapping => {
        mapping.tools.forEach(toolName => {
          const toolMappingId = `T${Math.random().toString(36).substring(2, 15)}`;
          this.execute(`
            INSERT INTO mcp_tool_group_tools (id, group_id, tenant_id, server_id, tool_name, allowed_scopes)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            toolMappingId,
            mapping.groupId,
            tenantId,
            mcpServerId,
            toolName,
            JSON.stringify(['read', 'write'])
          ]);
        });
      });

      // Insert role-to-group access mappings
      const roleAccessMappings = [
        { roleName: 'GRC_Admin', groupId: toolGroupIds.grcAdmins },
        { roleName: 'Risk_Analyst', groupId: toolGroupIds.riskAnalysts },
        { roleName: 'Compliance_Officer', groupId: toolGroupIds.complianceUsers },
        { roleName: 'Compliance_User', groupId: toolGroupIds.complianceUsers }
      ];

      roleAccessMappings.forEach(mapping => {
        const accessId = `A${Math.random().toString(36).substring(2, 15)}`;
        this.execute(`
          INSERT INTO mcp_role_tool_access (id, tenant_id, role_name, group_id, granted_by_user_id)
          VALUES (?, ?, ?, ?, ?)
        `, [
          accessId,
          tenantId,
          mapping.roleName,
          mapping.groupId,
          userId
        ]);
      });

      // Insert sample platform admin
      this.execute(`
        INSERT OR IGNORE INTO platform_admin_users (
          admin_id, user_id, admin_level, can_create_tenants, can_modify_tenants, 
          can_delete_tenants, can_view_all_tenants, can_manage_platform_configs, 
          can_access_audit_logs, is_enabled, requires_mfa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'ADMIN-001-SUPER', userId, 'SuperAdmin',
        1, 1, 1, 1, 1, 1, 1, 1
      ]);

      // Insert sample SAML configuration for demo tenant
      this.execute(`
        INSERT OR IGNORE INTO tenant_saml_configs (
          config_id, tenant_id, idp_entity_id, idp_sso_url, idp_x509_certificate,
          sp_entity_id, sp_acs_url, is_enabled, is_tested, test_status, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'SAML-001-DEMO', tenantId,
        'https://demo-corp.okta.com/exk1234567890',
        'https://demo-corp.okta.com/app/demo-grc-platform/exk1234567890/sso/saml',
        '-----BEGIN CERTIFICATE-----\\nMIIC... (demo certificate)\\n-----END CERTIFICATE-----',
        'https://grc-platform.example.com/saml/metadata',
        'https://grc-platform.example.com/saml/acs',
        1, 0, 'configured', userId
      ]);

      // Insert sample SAML group mappings
      const samlMappings = [
        { mappingId: 'MAPPING-001', groupName: 'GRC_Administrators', role: 'TenantOwner', toolGroups: [toolGroupIds.grcAdmins], priority: 10 },
        { mappingId: 'MAPPING-002', groupName: 'Risk_Analysts', role: 'AgentUser', toolGroups: [toolGroupIds.riskAnalysts], priority: 20 },
        { mappingId: 'MAPPING-003', groupName: 'Compliance_Officers', role: 'AgentUser', toolGroups: [toolGroupIds.complianceUsers], priority: 20 },
        { mappingId: 'MAPPING-004', groupName: 'Auditors', role: 'Auditor', toolGroups: [toolGroupIds.complianceUsers], priority: 30 }
      ];

      samlMappings.forEach(mapping => {
        this.execute(`
          INSERT OR IGNORE INTO tenant_saml_group_mappings (
            mapping_id, tenant_id, saml_group_name, platform_role, 
            mcp_tool_groups, is_enabled, priority, created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          mapping.mappingId, tenantId, mapping.groupName, mapping.role, 
          JSON.stringify(mapping.toolGroups), 1, mapping.priority, userId
        ]);
      });

      this.logger.info('Sample data inserted successfully');
    } catch (error) {
      this.logger.error('Failed to insert sample data', error);
      // Don't throw - sample data is not critical
    }
  }
}

// Singleton instance
let sqliteDb: SQLiteDatabase | null = null;

export const getSQLiteDatabase = (logger: winston.Logger): SQLiteDatabase => {
  if (!sqliteDb) {
    const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : './data/grc-platform.db';
    
    // Ensure data directory exists for file-based database
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    
    sqliteDb = new SQLiteDatabase(logger, dbPath);
  }
  return sqliteDb;
};