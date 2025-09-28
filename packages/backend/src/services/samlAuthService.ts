/**
 * SAML Authentication Service
 * Handles per-tenant SAML authentication flow
 */

import { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import { SAML } from '@node-saml/node-saml';
import * as crypto from 'crypto';
import * as winston from 'winston';
import { DatabaseService } from './databaseService';
import { 
  TenantSAMLConfig, 
  TenantSAMLGroupMapping,
  SAMLAuthResult,
  SAMLUserProfile 
} from '../types/tenant-management';

export interface SAMLAuthRequest {
  tenantSlug: string;
  relayState?: string;
}

export interface SAMLCallbackRequest {
  tenantSlug: string;
  samlResponse: string;
  relayState?: string;
}

export class SAMLAuthService {
  private db: DatabaseService;
  private logger: winston.Logger;
  private samlInstances: Map<string, SAML> = new Map();

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.db = DatabaseService.getInstance();
  }

  /**
   * Initiate SAML authentication for a tenant
   */
  async initiateAuth(request: SAMLAuthRequest): Promise<{ redirectUrl: string; requestId: string }> {
    try {
      // Get tenant SAML configuration
      const samlConfig = await this.getTenantSAMLConfig(request.tenantSlug);
      if (!samlConfig) {
        throw new Error(`SAML configuration not found for tenant: ${request.tenantSlug}`);
      }

      if (!samlConfig.is_enabled) {
        throw new Error(`SAML authentication is disabled for tenant: ${request.tenantSlug}`);
      }

      // Create SAML instance for this tenant
      const saml = this.createSAMLInstance(samlConfig);
      
      // Generate auth request
      const authUrl = await new Promise<string>((resolve, reject) => {
        saml.getAuthorizeUrl(request.relayState || '', (err, url) => {
          if (err) reject(err);
          else resolve(url!);
        });
      });

      // Generate request ID for tracking
      const requestId = crypto.randomUUID();

      this.logger.info('SAML auth initiated', {
        tenantSlug: request.tenantSlug,
        requestId,
        redirectUrl: authUrl
      });

      return {
        redirectUrl: authUrl,
        requestId
      };

    } catch (error) {
      this.logger.error('SAML auth initiation failed', {
        tenantSlug: request.tenantSlug,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle SAML callback and process authentication
   */
  async handleCallback(request: SAMLCallbackRequest): Promise<SAMLAuthResult> {
    try {
      // Get tenant SAML configuration
      const samlConfig = await this.getTenantSAMLConfig(request.tenantSlug);
      if (!samlConfig) {
        throw new Error(`SAML configuration not found for tenant: ${request.tenantSlug}`);
      }

      // Create SAML instance for this tenant
      const saml = this.createSAMLInstance(samlConfig);

      // Validate SAML response
      const profile = await new Promise<any>((resolve, reject) => {
        saml.validatePostResponse({
          SAMLResponse: request.samlResponse
        }, (err, profile) => {
          if (err) reject(err);
          else resolve(profile);
        });
      });

      if (!profile) {
        throw new Error('Invalid SAML response');
      }

      // Extract user information from SAML assertion
      const userProfile = this.extractUserProfile(profile, samlConfig);

      // Process group mappings and determine user roles
      const userRoles = await this.processGroupMappings(
        userProfile.groups,
        samlConfig.tenant_id
      );

      // Create or update user in database
      const user = await this.createOrUpdateUser(userProfile, samlConfig.tenant_id);

      // Update user roles based on SAML groups
      await this.updateUserRoles(user.user_id, userRoles, samlConfig.tenant_id);

      // Generate session token
      const sessionToken = this.generateSessionToken(user, userRoles);

      this.logger.info('SAML authentication successful', {
        tenantSlug: request.tenantSlug,
        userId: user.user_id,
        email: userProfile.email,
        roles: userRoles.map(r => r.role)
      });

      return {
        success: true,
        user: {
          id: user.user_id,
          email: userProfile.email,
          name: userProfile.name,
          tenantId: samlConfig.tenant_id
        },
        roles: userRoles,
        sessionToken,
        expiresAt: new Date(Date.now() + (samlConfig.session_timeout_minutes * 60 * 1000))
      };

    } catch (error) {
      this.logger.error('SAML callback processing failed', {
        tenantSlug: request.tenantSlug,
        error: error.message
      });

      return {
        success: false,
        error: {
          code: 'SAML_AUTH_FAILED',
          message: error.message
        }
      };
    }
  }

  /**
   * Generate SAML metadata for a tenant
   */
  async generateMetadata(tenantSlug: string): Promise<string> {
    try {
      const samlConfig = await this.getTenantSAMLConfig(tenantSlug);
      if (!samlConfig) {
        throw new Error(`SAML configuration not found for tenant: ${tenantSlug}`);
      }

      const saml = this.createSAMLInstance(samlConfig);
      
      return new Promise((resolve, reject) => {
        saml.generateServiceProviderMetadata(
          samlConfig.sp_x509_certificate || null,
          samlConfig.sp_x509_certificate || null,
          (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata!);
          }
        );
      });

    } catch (error) {
      this.logger.error('SAML metadata generation failed', {
        tenantSlug,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test SAML configuration for a tenant
   */
  async testConfiguration(tenantSlug: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const samlConfig = await this.getTenantSAMLConfig(tenantSlug);
      if (!samlConfig) {
        errors.push('SAML configuration not found');
        return { valid: false, errors };
      }

      // Validate required configuration fields
      if (!samlConfig.idp_entity_id) errors.push('IdP Entity ID is required');
      if (!samlConfig.idp_sso_url) errors.push('IdP SSO URL is required');
      if (!samlConfig.idp_x509_certificate) errors.push('IdP X.509 Certificate is required');
      if (!samlConfig.sp_entity_id) errors.push('SP Entity ID is required');
      if (!samlConfig.sp_acs_url) errors.push('SP ACS URL is required');

      // Try to create SAML instance
      try {
        this.createSAMLInstance(samlConfig);
      } catch (error) {
        errors.push(`SAML configuration error: ${error.message}`);
      }

      const valid = errors.length === 0;

      this.logger.info('SAML configuration test completed', {
        tenantSlug,
        valid,
        errorCount: errors.length
      });

      return { valid, errors };

    } catch (error) {
      errors.push(`Configuration test failed: ${error.message}`);
      return { valid: false, errors };
    }
  }

  /**
   * Get tenant SAML configuration by slug
   */
  private async getTenantSAMLConfig(tenantSlug: string): Promise<TenantSAMLConfig | null> {
    const query = `
      SELECT sc.* FROM tenant_saml_configs sc
      JOIN tenants t ON t.tenant_id = sc.tenant_id
      WHERE t.slug = ? AND sc.is_enabled = 1
    `;

    const results = this.db.query<TenantSAMLConfig>(query, [tenantSlug]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Create SAML instance for tenant configuration
   */
  private createSAMLInstance(config: TenantSAMLConfig): SAML {
    const cacheKey = config.tenant_id;
    
    if (this.samlInstances.has(cacheKey)) {
      return this.samlInstances.get(cacheKey)!;
    }

    const samlOptions = {
      issuer: config.sp_entity_id,
      callbackUrl: config.sp_acs_url,
      entryPoint: config.idp_sso_url,
      identifierFormat: config.name_id_format,
      cert: config.idp_x509_certificate,
      privateCert: config.sp_private_key || undefined,
      signatureAlgorithm: config.signature_algorithm,
      digestAlgorithm: config.digest_algorithm,
      validateInResponseTo: false,
      disableRequestedAuthnContext: true,
      acceptedClockSkewMs: 30000, // 30 seconds
      attributeConsumingServiceIndex: false,
      authnRequestBinding: 'HTTP-POST',
      wantAssertionsSigned: config.require_signed_assertions === 1,
      wantAuthnResponseSigned: config.require_signed_response === 1
    };

    const saml = new SAML(samlOptions);
    this.samlInstances.set(cacheKey, saml);
    
    return saml;
  }

  /**
   * Extract user profile from SAML assertion
   */
  private extractUserProfile(profile: any, config: TenantSAMLConfig): SAMLUserProfile {
    const getAttributeValue = (attrName: string): string | string[] => {
      return profile[attrName] || profile.attributes?.[attrName] || '';
    };

    const email = getAttributeValue(config.email_attribute) as string;
    const firstName = getAttributeValue(config.first_name_attribute) as string;
    const lastName = getAttributeValue(config.last_name_attribute) as string;
    const groups = getAttributeValue(config.groups_attribute) as string | string[];
    const nameId = profile.nameID || profile.nameId || email;

    return {
      nameId,
      email,
      name: `${firstName} ${lastName}`.trim() || email,
      firstName,
      lastName,
      groups: Array.isArray(groups) ? groups : [groups].filter(Boolean)
    };
  }

  /**
   * Process SAML groups and determine platform roles
   */
  private async processGroupMappings(
    samlGroups: string[],
    tenantId: string
  ): Promise<Array<{ role: string; permissions: string[]; mcpToolGroups: string[] }>> {
    const query = `
      SELECT platform_role, permissions, mcp_tool_groups, priority
      FROM tenant_saml_group_mappings
      WHERE tenant_id = ? AND saml_group_name IN (${samlGroups.map(() => '?').join(',')})
        AND is_enabled = 1
      ORDER BY priority ASC
    `;

    const mappings = this.db.query<TenantSAMLGroupMapping>(
      query,
      [tenantId, ...samlGroups]
    );

    // Use highest priority (lowest number) role if multiple matches
    const uniqueRoles = new Map();
    
    mappings.forEach(mapping => {
      if (!uniqueRoles.has(mapping.platform_role)) {
        uniqueRoles.set(mapping.platform_role, {
          role: mapping.platform_role,
          permissions: JSON.parse(mapping.permissions || '[]'),
          mcpToolGroups: JSON.parse(mapping.mcp_tool_groups || '[]')
        });
      }
    });

    return Array.from(uniqueRoles.values());
  }

  /**
   * Create or update user from SAML profile
   */
  private async createOrUpdateUser(profile: SAMLUserProfile, tenantId: string): Promise<any> {
    // Check if user exists by SAML nameId or email
    let existingUser = this.db.query(
      'SELECT * FROM users WHERE saml_name_id = ? OR email = ?',
      [profile.nameId, profile.email]
    )[0];

    if (existingUser) {
      // Update existing user
      this.db.execute(`
        UPDATE users SET
          email = ?,
          name = ?,
          saml_name_id = ?,
          authentication_method = 'saml',
          last_login_at = datetime('now'),
          updated_at = datetime('now')
        WHERE user_id = ?
      `, [profile.email, profile.name, profile.nameId, existingUser.user_id]);

      return existingUser;
    } else {
      // Create new user
      const userId = crypto.randomUUID();
      
      this.db.execute(`
        INSERT INTO users (
          user_id, email, name, primary_tenant_id, 
          saml_name_id, authentication_method, status,
          last_login_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'saml', 'active', datetime('now'), datetime('now'), datetime('now'))
      `, [userId, profile.email, profile.name, tenantId, profile.nameId]);

      return { user_id: userId, email: profile.email, name: profile.name };
    }
  }

  /**
   * Update user roles based on SAML group mappings
   */
  private async updateUserRoles(
    userId: string,
    roles: Array<{ role: string; permissions: string[]; mcpToolGroups: string[] }>,
    tenantId: string
  ): Promise<void> {
    // Remove existing roles for this tenant
    this.db.execute(
      'DELETE FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
      [userId, tenantId]
    );

    // Add new roles
    for (const roleInfo of roles) {
      const roleId = crypto.randomUUID();
      
      this.db.execute(`
        INSERT INTO user_tenant_roles (
          id, user_id, tenant_id, role, permissions, assigned_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
      `, [
        roleId,
        userId,
        tenantId,
        roleInfo.role,
        JSON.stringify(roleInfo.permissions)
      ]);
    }
  }

  /**
   * Generate session token for authenticated user
   */
  private generateSessionToken(
    user: any,
    roles: Array<{ role: string; permissions: string[]; mcpToolGroups: string[] }>
  ): string {
    const payload = {
      userId: user.user_id,
      email: user.email,
      roles: roles.map(r => r.role),
      permissions: roles.flatMap(r => r.permissions),
      mcpToolGroups: roles.flatMap(r => r.mcpToolGroups),
      iat: Math.floor(Date.now() / 1000)
    };

    // In production, use proper JWT signing
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }
}

// Singleton instance
export const samlAuthService = new SAMLAuthService(
  winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [new winston.transports.Console()]
  })
);