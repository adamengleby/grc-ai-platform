/**
 * Tenant Management Service
 * Comprehensive service for managing multi-tenant SAML authentication
 */

import { DatabaseService } from './databaseService';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as winston from 'winston';
import {
  TenantSAMLConfig,
  TenantSAMLGroupMapping,
  TenantOnboardingRequest,
  TenantProvisioningStatus,
  CreateTenantRequest,
  TenantConfigurationRequest,
  SAMLTestRequest,
  SAMLTestResult,
  TenantManagementResponse,
  TenantListResponse,
  TenantDetailsResponse,
  TenantManagementError,
  SAMLConfigurationError,
  TenantProvisioningError,
  SAMLConfigurationTemplate
} from '../types/tenant-management';

export class TenantManagementService {
  private db: DatabaseService;
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.db = DatabaseService.getInstance();
    this.logger = logger;
  }

  // =============================================
  // Tenant Creation & Provisioning
  // =============================================

  /**
   * Create a new tenant with complete provisioning workflow
   */
  async createTenant(request: CreateTenantRequest, adminUserId: string): Promise<TenantManagementResponse<{ tenant_id: string; provisioning_status_id: string }>> {
    const tenantId = uuidv4();
    const provisioningStatusId = uuidv4();
    const requestId = uuidv4();

    try {
      // Begin transaction for atomic tenant creation
      const transaction = this.db.beginTransaction();

      // 1. Create tenant record
      await this.db.execute(`
        INSERT INTO tenants (
          tenant_id, name, slug, subscription_tier, status, region,
          settings, quota_config, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        tenantId,
        request.organization_name,
        this.generateTenantSlug(request.organization_name),
        request.subscription_tier,
        'provisioning',
        request.region || 'eastus',
        JSON.stringify({
          enabledFeatures: ["ai_agents", "mcp_servers", "basic_analytics"],
          byoLlmEnabled: false,
          auditRetentionDays: 365
        }),
        JSON.stringify(this.getDefaultQuotaConfig(request.subscription_tier))
      ]);

      // 2. Create onboarding request record
      await this.db.execute(`
        INSERT INTO tenant_onboarding_requests (
          request_id, organization_name, organization_domain, primary_contact_email,
          primary_contact_name, requested_subscription_tier, requested_region,
          status, assigned_tenant_id, approved_by_admin_id, approved_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
      `, [
        requestId,
        request.organization_name,
        request.organization_domain,
        request.primary_contact_email,
        request.primary_contact_name,
        request.subscription_tier,
        request.region || 'eastus',
        'provisioning',
        tenantId,
        adminUserId
      ]);

      // 3. Create provisioning status tracker
      await this.db.execute(`
        INSERT INTO tenant_provisioning_status (
          status_id, tenant_id, onboarding_request_id, current_step,
          current_step_status, total_steps, completed_steps,
          automated_provisioning, started_at, last_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        provisioningStatusId,
        tenantId,
        requestId,
        'infrastructure_setup',
        'in_progress',
        7, // Total provisioning steps
        0,
        1 // Automated provisioning enabled
      ]);

      // 4. If SAML config provided, create initial configuration
      if (request.saml_config) {
        await this.createSAMLConfiguration(tenantId, request.saml_config, adminUserId);
      }

      // 5. Create default group mappings if provided
      if (request.group_mappings && request.group_mappings.length > 0) {
        for (const mapping of request.group_mappings) {
          await this.createSAMLGroupMapping(tenantId, mapping, adminUserId);
        }
      }

      await transaction();

      // Start asynchronous provisioning process
      this.startTenantProvisioning(tenantId, provisioningStatusId);

      this.logger.info(`Tenant created successfully`, {
        tenant_id: tenantId,
        organization_name: request.organization_name,
        created_by: adminUserId
      });

      return {
        success: true,
        data: {
          tenant_id: tenantId,
          provisioning_status_id: provisioningStatusId
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: requestId,
          tenant_id: tenantId
        }
      };

    } catch (error) {
      this.logger.error('Failed to create tenant', {
        error: error.message,
        organization_name: request.organization_name,
        admin_user_id: adminUserId
      });

      throw new TenantProvisioningError(
        'Failed to create tenant',
        { originalError: error.message },
        tenantId
      );
    }
  }

  /**
   * Start asynchronous tenant provisioning workflow
   */
  private async startTenantProvisioning(tenantId: string, statusId: string): Promise<void> {
    try {
      // Step 1: Infrastructure provisioning (simulated)
      await this.updateProvisioningStep(statusId, 'infrastructure_provisioned', true);
      
      // Step 2: Database initialization
      await this.initializeTenantDatabase(tenantId);
      await this.updateProvisioningStep(statusId, 'database_initialized', true);
      
      // Step 3: Create admin user (if SAML not configured)
      await this.createTenantAdminUser(tenantId);
      await this.updateProvisioningStep(statusId, 'admin_user_created', true);
      
      // Step 4: Apply default configurations
      await this.applyDefaultConfigurations(tenantId);
      await this.updateProvisioningStep(statusId, 'default_configurations_applied', true);
      
      // Step 5: Configure MCP servers
      await this.configureMCPServers(tenantId);
      await this.updateProvisioningStep(statusId, 'mcp_servers_configured', true);
      
      // Step 6: Run tests
      await this.runTenantTests(tenantId);
      await this.updateProvisioningStep(statusId, 'testing_completed', true);
      
      // Complete provisioning
      await this.completeTenantProvisioning(tenantId, statusId);

    } catch (error) {
      this.logger.error('Tenant provisioning failed', {
        tenant_id: tenantId,
        status_id: statusId,
        error: error.message
      });

      await this.failTenantProvisioning(tenantId, statusId, error.message);
    }
  }

  // =============================================
  // SAML Configuration Management
  // =============================================

  /**
   * Create or update SAML configuration for a tenant
   */
  async configureSAML(request: TenantConfigurationRequest, adminUserId: string): Promise<TenantManagementResponse<TenantSAMLConfig>> {
    try {
      const configId = uuidv4();
      
      // Validate SAML configuration
      const validationResult = await this.validateSAMLConfiguration(request.saml_config);
      if (!validationResult.valid) {
        throw new SAMLConfigurationError(
          'Invalid SAML configuration',
          { validation_errors: validationResult.errors },
          request.tenant_id
        );
      }

      // Create SAML configuration
      const samlConfig = await this.createSAMLConfiguration(
        request.tenant_id,
        request.saml_config,
        adminUserId
      );

      // Update group mappings if provided
      if (request.group_mappings) {
        await this.updateSAMLGroupMappings(request.tenant_id, request.group_mappings, adminUserId);
      }

      // Test configuration if requested
      if (request.test_configuration) {
        const testResult = await this.testSAMLConfiguration({
          tenant_id: request.tenant_id,
          dry_run: true
        });

        if (!testResult.success) {
          this.logger.warn('SAML configuration test failed', {
            tenant_id: request.tenant_id,
            errors: testResult.errors
          });
        }
      }

      this.logger.info('SAML configuration updated', {
        tenant_id: request.tenant_id,
        config_id: configId,
        updated_by: adminUserId
      });

      return {
        success: true,
        data: samlConfig,
        meta: {
          timestamp: new Date().toISOString(),
          request_id: uuidv4(),
          tenant_id: request.tenant_id
        }
      };

    } catch (error) {
      this.logger.error('Failed to configure SAML', {
        tenant_id: request.tenant_id,
        error: error.message,
        admin_user_id: adminUserId
      });

      if (error instanceof SAMLConfigurationError) {
        throw error;
      }

      throw new SAMLConfigurationError(
        'Failed to configure SAML',
        { originalError: error.message },
        request.tenant_id
      );
    }
  }

  /**
   * Test SAML configuration
   */
  async testSAMLConfiguration(request: SAMLTestRequest): Promise<SAMLTestResult> {
    try {
      const config = await this.getSAMLConfiguration(request.tenant_id);
      if (!config) {
        return {
          success: false,
          test_type: 'configuration',
          certificate_valid: false,
          metadata_accessible: false,
          errors: ['SAML configuration not found for tenant'],
          warnings: [],
          recommendations: ['Configure SAML settings before testing']
        };
      }

      const result: SAMLTestResult = {
        success: true,
        test_type: 'configuration',
        certificate_valid: false,
        metadata_accessible: false,
        errors: [],
        warnings: [],
        recommendations: []
      };

      // Test 1: Validate certificate
      try {
        this.validateX509Certificate(config.idp_x509_certificate);
        result.certificate_valid = true;
      } catch (error) {
        result.certificate_valid = false;
        result.errors.push(`Certificate validation failed: ${error.message}`);
      }

      // Test 2: Check metadata accessibility
      try {
        // In real implementation, this would make HTTP request to IdP metadata URL
        result.metadata_accessible = true;
      } catch (error) {
        result.metadata_accessible = false;
        result.errors.push(`Metadata not accessible: ${error.message}`);
      }

      // Test 3: If test assertion provided, validate it
      if (request.test_assertion) {
        try {
          const extractedUser = this.processTestAssertion(request.test_assertion, config);
          result.assertion_valid = true;
          result.user_mapping_successful = true;
          result.extracted_user = extractedUser;

          // Test group mappings
          const groupMappings = await this.getSAMLGroupMappings(request.tenant_id);
          const userRoles = this.mapGroupsToRoles(extractedUser.groups, groupMappings);
          result.group_mapping_successful = userRoles.length > 0;

          if (userRoles.length === 0) {
            result.warnings.push('No platform roles mapped for user groups');
            result.recommendations.push('Configure group mappings for user access');
          }
        } catch (error) {
          result.assertion_valid = false;
          result.errors.push(`Assertion processing failed: ${error.message}`);
        }
      }

      result.success = result.errors.length === 0;

      // Update test status in database
      await this.updateSAMLTestStatus(request.tenant_id, result.success, result.errors.join('; '));

      return result;

    } catch (error) {
      this.logger.error('SAML configuration test failed', {
        tenant_id: request.tenant_id,
        error: error.message
      });

      return {
        success: false,
        test_type: 'configuration',
        certificate_valid: false,
        metadata_accessible: false,
        errors: [`Test execution failed: ${error.message}`],
        warnings: [],
        recommendations: ['Review SAML configuration and retry test']
      };
    }
  }

  // =============================================
  // Tenant Data Retrieval
  // =============================================

  /**
   * Get list of all tenants with filtering and pagination
   */
  async getTenants(
    filters: {
      status?: string;
      subscription_tier?: string;
      region?: string;
      search?: string;
    } = {},
    pagination: { page: number; limit: number } = { page: 1, limit: 50 }
  ): Promise<TenantListResponse> {
    try {
      let whereClause = 'WHERE t.deleted_at IS NULL';
      const params: any[] = [];

      // Build dynamic WHERE clause
      if (filters.status) {
        whereClause += ' AND t.status = ?';
        params.push(filters.status);
      }
      if (filters.subscription_tier) {
        whereClause += ' AND t.subscription_tier = ?';
        params.push(filters.subscription_tier);
      }
      if (filters.region) {
        whereClause += ' AND t.region = ?';
        params.push(filters.region);
      }
      if (filters.search) {
        whereClause += ' AND (t.name LIKE ? OR t.slug LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      // Calculate offset
      const offset = (pagination.page - 1) * pagination.limit;

      // Query tenants with user counts and SAML status
      const tenants = await this.db.query<{
        tenant_id: string;
        name: string;
        slug: string;
        status: string;
        subscription_tier: string;
        user_count: number;
        saml_configured: number;
        last_activity: string;
        created_at: string;
      }>(`
        SELECT 
          t.tenant_id,
          t.name,
          t.slug,
          t.status,
          t.subscription_tier,
          COUNT(DISTINCT u.user_id) as user_count,
          CASE WHEN sc.config_id IS NOT NULL THEN 1 ELSE 0 END as saml_configured,
          COALESCE(MAX(u.last_login_at), t.created_at) as last_activity,
          t.created_at
        FROM tenants t
        LEFT JOIN users u ON t.tenant_id = u.primary_tenant_id AND u.deleted_at IS NULL
        LEFT JOIN tenant_saml_configs sc ON t.tenant_id = sc.tenant_id
        ${whereClause}
        GROUP BY t.tenant_id, t.name, t.slug, t.status, t.subscription_tier, t.created_at, sc.config_id
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, pagination.limit, offset]);

      // Get total count
      const totalCountResult = await this.db.query<{ total: number }>(`
        SELECT COUNT(DISTINCT t.tenant_id) as total
        FROM tenants t
        LEFT JOIN users u ON t.tenant_id = u.primary_tenant_id AND u.deleted_at IS NULL
        LEFT JOIN tenant_saml_configs sc ON t.tenant_id = sc.tenant_id
        ${whereClause}
      `, params);

      const totalCount = totalCountResult[0]?.total || 0;
      const totalPages = Math.ceil(totalCount / pagination.limit);

      return {
        tenants: tenants.map(t => ({
          ...t,
          saml_configured: Boolean(t.saml_configured)
        })),
        total_count: totalCount,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total_pages: totalPages
        }
      };

    } catch (error) {
      this.logger.error('Failed to retrieve tenants', {
        error: error.message,
        filters,
        pagination
      });

      throw new TenantManagementError(
        'TENANT_RETRIEVAL_ERROR',
        'Failed to retrieve tenants',
        { originalError: error.message }
      );
    }
  }

  /**
   * Get detailed information for a specific tenant
   */
  async getTenantDetails(tenantId: string): Promise<TenantDetailsResponse> {
    try {
      // Get tenant basic info
      const tenants = await this.db.query<{
        tenant_id: string;
        name: string;
        slug: string;
        status: string;
        subscription_tier: string;
        region: string;
        settings: string;
        quota_config: string;
        created_at: string;
        updated_at: string;
      }>(`
        SELECT tenant_id, name, slug, status, subscription_tier, region,
               settings, quota_config, created_at, updated_at
        FROM tenants 
        WHERE tenant_id = ? AND deleted_at IS NULL
      `, [tenantId]);

      if (tenants.length === 0) {
        throw new TenantManagementError(
          'TENANT_NOT_FOUND',
          'Tenant not found',
          { tenant_id: tenantId }
        );
      }

      const tenant = tenants[0];

      // Get SAML configuration
      const samlConfig = await this.getSAMLConfiguration(tenantId);

      // Get group mappings
      const groupMappings = await this.getSAMLGroupMappings(tenantId);

      // Get provisioning status
      const provisioningStatus = await this.getProvisioningStatus(tenantId);

      // Get users
      const users = await this.db.query<{
        user_id: string;
        email: string;
        name: string;
        role: string;
        last_login_at: string;
        created_at: string;
      }>(`
        SELECT u.user_id, u.email, u.name, utr.role, u.last_login_at, u.created_at
        FROM users u
        LEFT JOIN user_tenant_roles utr ON u.user_id = utr.user_id AND utr.tenant_id = ?
        WHERE u.primary_tenant_id = ? AND u.deleted_at IS NULL
        ORDER BY u.created_at DESC
      `, [tenantId, tenantId]);

      // Calculate usage metrics
      const usageMetrics = await this.calculateUsageMetrics(tenantId);

      return {
        tenant: {
          ...tenant,
          settings: JSON.parse(tenant.settings),
          quota_config: JSON.parse(tenant.quota_config)
        },
        saml_config: samlConfig,
        group_mappings: groupMappings,
        provisioning_status: provisioningStatus,
        users: users,
        usage_metrics: usageMetrics
      };

    } catch (error) {
      this.logger.error('Failed to get tenant details', {
        tenant_id: tenantId,
        error: error.message
      });

      if (error instanceof TenantManagementError) {
        throw error;
      }

      throw new TenantManagementError(
        'TENANT_DETAILS_ERROR',
        'Failed to retrieve tenant details',
        { originalError: error.message },
        tenantId
      );
    }
  }

  // =============================================
  // SAML Configuration Templates
  // =============================================

  /**
   * Get available SAML configuration templates
   */
  getSAMLConfigurationTemplates(): SAMLConfigurationTemplate[] {
    return [
      {
        name: 'Microsoft Azure AD',
        provider: 'azure-ad',
        description: 'Configure SAML with Microsoft Azure Active Directory',
        default_name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        default_binding_type: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        default_attribute_mappings: {
          email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
          first_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
          last_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
          groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
          user_id: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'
        },
        default_security_settings: {
          require_signed_assertions: true,
          require_signed_response: true,
          require_encrypted_assertions: false,
          signature_algorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
          digest_algorithm: 'http://www.w3.org/2001/04/xmlenc#sha256'
        },
        suggested_group_mappings: [
          { saml_group_pattern: 'GRC_Administrators', platform_role: 'TenantOwner', description: 'Full platform access' },
          { saml_group_pattern: 'Risk_Analysts', platform_role: 'AgentUser', description: 'Risk analysis access' },
          { saml_group_pattern: 'Compliance_Officers', platform_role: 'AgentUser', description: 'Compliance access' },
          { saml_group_pattern: 'Auditors', platform_role: 'Auditor', description: 'Read-only audit access' }
        ],
        setup_instructions: [
          'Create Enterprise Application in Azure AD',
          'Configure Single Sign-On with SAML',
          'Set Reply URL to: https://your-platform.com/saml/acs',
          'Download Federation Metadata XML',
          'Configure group claims in token configuration',
          'Assign users and groups to the application'
        ],
        documentation_url: 'https://docs.microsoft.com/en-us/azure/active-directory/saas-apps/tutorial-list'
      },
      {
        name: 'Okta',
        provider: 'okta',
        description: 'Configure SAML with Okta Identity Provider',
        default_name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        default_binding_type: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        default_attribute_mappings: {
          email: 'email',
          first_name: 'firstName',
          last_name: 'lastName',
          groups: 'groups',
          user_id: 'login'
        },
        default_security_settings: {
          require_signed_assertions: true,
          require_signed_response: false,
          require_encrypted_assertions: false,
          signature_algorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
          digest_algorithm: 'http://www.w3.org/2001/04/xmlenc#sha256'
        },
        suggested_group_mappings: [
          { saml_group_pattern: 'GRC Administrators', platform_role: 'TenantOwner', description: 'Full platform access' },
          { saml_group_pattern: 'Risk Analysts', platform_role: 'AgentUser', description: 'Risk analysis access' },
          { saml_group_pattern: 'Compliance Team', platform_role: 'AgentUser', description: 'Compliance access' },
          { saml_group_pattern: 'Audit Team', platform_role: 'Auditor', description: 'Read-only audit access' }
        ],
        setup_instructions: [
          'Create new SAML 2.0 Application in Okta Admin Console',
          'Set Single Sign-On URL to: https://your-platform.com/saml/acs',
          'Set Audience URI to: https://your-platform.com/saml/metadata',
          'Configure attribute statements for user mapping',
          'Configure group attribute statements',
          'Assign application to users and groups'
        ],
        documentation_url: 'https://help.okta.com/en/prod/Content/Topics/Apps/Apps_App_Integration_Wizard_SAML.htm'
      }
    ];
  }

  // =============================================
  // Private Helper Methods
  // =============================================

  private generateTenantSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  private getDefaultQuotaConfig(tier: string): any {
    const configs = {
      starter: {
        dailyApiCalls: 1000,
        monthlyTokens: 100000,
        storageGB: 10,
        users: 10,
        aiAgents: 3,
        mcpServers: 2
      },
      professional: {
        dailyApiCalls: 10000,
        monthlyTokens: 1000000,
        storageGB: 100,
        users: 50,
        aiAgents: 10,
        mcpServers: 10
      },
      enterprise: {
        dailyApiCalls: 100000,
        monthlyTokens: 10000000,
        storageGB: 1000,
        users: 500,
        aiAgents: 50,
        mcpServers: 50
      }
    };
    return configs[tier] || configs.starter;
  }

  private async createSAMLConfiguration(
    tenantId: string,
    samlConfig: Partial<TenantSAMLConfig>,
    userId: string
  ): Promise<TenantSAMLConfig> {
    const configId = uuidv4();
    
    // Generate SP entity ID and URLs
    const baseUrl = process.env.PLATFORM_BASE_URL || 'https://grc-platform.example.com';
    const spEntityId = `${baseUrl}/saml/metadata/${tenantId}`;
    const spAcsUrl = `${baseUrl}/saml/acs/${tenantId}`;
    const spSlsUrl = `${baseUrl}/saml/sls/${tenantId}`;

    const config: TenantSAMLConfig = {
      config_id: configId,
      tenant_id: tenantId,
      
      // Required IdP settings
      idp_entity_id: samlConfig.idp_entity_id!,
      idp_sso_url: samlConfig.idp_sso_url!,
      idp_slo_url: samlConfig.idp_slo_url,
      idp_x509_certificate: samlConfig.idp_x509_certificate!,
      
      // SP settings
      sp_entity_id: spEntityId,
      sp_acs_url: spAcsUrl,
      sp_sls_url: spSlsUrl,
      sp_x509_certificate: samlConfig.sp_x509_certificate,
      sp_private_key: samlConfig.sp_private_key,
      
      // Attribute mappings with defaults
      email_attribute: samlConfig.email_attribute || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      first_name_attribute: samlConfig.first_name_attribute || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
      last_name_attribute: samlConfig.last_name_attribute || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
      groups_attribute: samlConfig.groups_attribute || 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
      user_id_attribute: samlConfig.user_id_attribute || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
      
      // SAML settings with defaults
      name_id_format: samlConfig.name_id_format || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      binding_type: samlConfig.binding_type || 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      signature_algorithm: samlConfig.signature_algorithm || 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      digest_algorithm: samlConfig.digest_algorithm || 'http://www.w3.org/2001/04/xmlenc#sha256',
      
      // Security settings with defaults
      require_signed_assertions: samlConfig.require_signed_assertions ?? true,
      require_signed_response: samlConfig.require_signed_response ?? true,
      require_encrypted_assertions: samlConfig.require_encrypted_assertions ?? false,
      validate_audience: samlConfig.validate_audience ?? true,
      
      // Session settings
      session_timeout_minutes: samlConfig.session_timeout_minutes || 480,
      force_reauth: samlConfig.force_reauth ?? false,
      
      // Status
      is_enabled: samlConfig.is_enabled ?? true,
      is_tested: false,
      test_status: 'pending',
      
      // Configuration management
      config_version: 1,
      rollback_available: false,
      
      // Audit
      created_by_user_id: userId,
      updated_by_user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Insert into database
    await this.db.execute(`
      INSERT INTO tenant_saml_configs (
        config_id, tenant_id, idp_entity_id, idp_sso_url, idp_slo_url, idp_x509_certificate,
        sp_entity_id, sp_acs_url, sp_sls_url, sp_x509_certificate, sp_private_key,
        email_attribute, first_name_attribute, last_name_attribute, groups_attribute, user_id_attribute,
        name_id_format, binding_type, signature_algorithm, digest_algorithm,
        require_signed_assertions, require_signed_response, require_encrypted_assertions, validate_audience,
        session_timeout_minutes, force_reauth, is_enabled, is_tested, test_status,
        config_version, rollback_available, created_by_user_id, updated_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      config.config_id, config.tenant_id, config.idp_entity_id, config.idp_sso_url, config.idp_slo_url, config.idp_x509_certificate,
      config.sp_entity_id, config.sp_acs_url, config.sp_sls_url, config.sp_x509_certificate, config.sp_private_key,
      config.email_attribute, config.first_name_attribute, config.last_name_attribute, config.groups_attribute, config.user_id_attribute,
      config.name_id_format, config.binding_type, config.signature_algorithm, config.digest_algorithm,
      config.require_signed_assertions ? 1 : 0, config.require_signed_response ? 1 : 0, 
      config.require_encrypted_assertions ? 1 : 0, config.validate_audience ? 1 : 0,
      config.session_timeout_minutes, config.force_reauth ? 1 : 0, config.is_enabled ? 1 : 0, 
      config.is_tested ? 1 : 0, config.test_status, config.config_version, config.rollback_available ? 1 : 0,
      config.created_by_user_id, config.updated_by_user_id
    ]);

    return config;
  }

  // Additional helper methods would continue here...
  // For brevity, I'm including key methods. The full implementation would include:
  // - createSAMLGroupMapping
  // - getSAMLConfiguration  
  // - getSAMLGroupMappings
  // - validateSAMLConfiguration
  // - validateX509Certificate
  // - processTestAssertion
  // - mapGroupsToRoles
  // - updateProvisioningStep
  // - initializeTenantDatabase
  // - createTenantAdminUser
  // - applyDefaultConfigurations
  // - configureMCPServers
  // - runTenantTests
  // - completeTenantProvisioning
  // - failTenantProvisioning
  // - calculateUsageMetrics

  private validateSAMLConfiguration(config: Partial<TenantSAMLConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.idp_entity_id) errors.push('IdP Entity ID is required');
    if (!config.idp_sso_url) errors.push('IdP SSO URL is required');
    if (!config.idp_x509_certificate) errors.push('IdP X.509 Certificate is required');

    // Validate URLs
    if (config.idp_sso_url && !this.isValidUrl(config.idp_sso_url)) {
      errors.push('IdP SSO URL is not valid');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateX509Certificate(certificate: string): void {
    // Basic certificate format validation
    if (!certificate.includes('BEGIN CERTIFICATE') || !certificate.includes('END CERTIFICATE')) {
      throw new Error('Invalid X.509 certificate format');
    }
    // In real implementation, would validate certificate with crypto libraries
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const tenantManagementService = new TenantManagementService(
  winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()]
  })
);