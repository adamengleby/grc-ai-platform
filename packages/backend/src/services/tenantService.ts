/**
 * Tenant Service
 * Handles tenant management operations
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from './databaseService';
import { AuditService } from './auditService';

export interface Tenant {
  tenant_id: string;
  name: string;
  slug: string;
  subscription_tier: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'provisioning' | 'terminated';
  region: string;
  settings?: string; // JSON
  quota_config?: string; // JSON
  keyvault_name?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface TenantUser {
  user_id: string;
  azure_b2c_object_id: string;
  email: string;
  name: string;
  primary_tenant_id: string;
  status: 'active' | 'suspended' | 'pending_verification';
  mfa_enabled: boolean;
  last_login_at?: string;
  password_last_changed?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface UserTenantRole {
  id: string;
  user_id: string;
  tenant_id: string;
  role: 'PlatformOwner' | 'TenantOwner' | 'AgentUser' | 'Auditor' | 'ComplianceOfficer';
  permissions?: string; // JSON array
  assigned_by_user_id?: string;
  assigned_at: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantSettings {
  setting_id: string;
  tenant_id: string;
  organization_name?: string;
  organization_logo_url?: string;
  branding_colors?: string; // JSON
  default_llm_config_id?: string;
  default_retention_days: number;
  enabled_features?: string; // JSON array
  security_policies?: string; // JSON
  compliance_frameworks?: string; // JSON array
  byollm_enabled: boolean;
  byollm_allowed_providers?: string; // JSON array
  created_at: string;
  updated_at: string;
}

export class TenantService {
  private db: DatabaseService;
  private auditService: AuditService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.auditService = new AuditService();
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    const query = `
      SELECT 
        tenant_id,
        name,
        slug,
        subscription_tier,
        status,
        region,
        settings,
        quota_config,
        keyvault_name,
        created_at,
        updated_at,
        deleted_at
      FROM tenants
      WHERE tenant_id = ? AND deleted_at IS NULL
    `;

    const results = await this.db.query(query, [tenantId]);
    if (results.length === 0) {
      return null;
    }

    const tenant = results[0];
    return {
      ...tenant,
      settings: this.safeJsonParse(tenant.settings),
      quota_config: this.safeJsonParse(tenant.quota_config)
    };
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const query = `
      SELECT 
        tenant_id,
        name,
        slug,
        subscription_tier,
        status,
        region,
        settings,
        quota_config,
        keyvault_name,
        created_at,
        updated_at,
        deleted_at
      FROM tenants
      WHERE slug = ? AND deleted_at IS NULL
    `;

    const results = await this.db.query(query, [slug]);
    if (results.length === 0) {
      return null;
    }

    const tenant = results[0];
    return {
      ...tenant,
      settings: this.safeJsonParse(tenant.settings),
      quota_config: this.safeJsonParse(tenant.quota_config)
    };
  }

  /**
   * Get user by Azure B2C Object ID
   */
  async getUserByB2CObjectId(objectId: string): Promise<TenantUser | null> {
    const query = `
      SELECT 
        user_id,
        azure_b2c_object_id,
        email,
        name,
        primary_tenant_id,
        status,
        mfa_enabled,
        last_login_at,
        password_last_changed,
        created_at,
        updated_at,
        deleted_at
      FROM users
      WHERE azure_b2c_object_id = ? AND deleted_at IS NULL
    `;

    const results = await this.db.query(query, [objectId]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get user tenant roles
   */
  async getUserTenantRoles(userId: string, tenantId: string): Promise<UserTenantRole[]> {
    const query = `
      SELECT 
        id,
        user_id,
        tenant_id,
        role,
        permissions,
        assigned_by_user_id,
        assigned_at,
        expires_at,
        created_at,
        updated_at
      FROM user_tenant_roles
      WHERE user_id = ? AND tenant_id = ?
        AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY assigned_at DESC
    `;

    const results = await this.db.query(query, [userId, tenantId, new Date().toISOString()]);
    return results.map(role => ({
      ...role,
      permissions: this.safeJsonParse(role.permissions)
    }));
  }

  /**
   * Check if user has specific role in tenant
   */
  async hasUserRole(
    userId: string, 
    tenantId: string, 
    roles: string[]
  ): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM user_tenant_roles
      WHERE user_id = ? AND tenant_id = ? 
        AND role IN (${roles.map(() => '?').join(', ')})
        AND (expires_at IS NULL OR expires_at > ?)
    `;

    const params = [userId, tenantId, ...roles, new Date().toISOString()];
    const results = await this.db.query(query, params);
    return results[0]?.count > 0;
  }

  /**
   * Get tenant settings
   */
  async getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
    const query = `
      SELECT 
        setting_id,
        tenant_id,
        organization_name,
        organization_logo_url,
        branding_colors,
        default_llm_config_id,
        default_retention_days,
        enabled_features,
        security_policies,
        compliance_frameworks,
        byollm_enabled,
        byollm_allowed_providers,
        created_at,
        updated_at
      FROM tenant_settings
      WHERE tenant_id = ?
    `;

    const results = await this.db.query(query, [tenantId], tenantId);
    if (results.length === 0) {
      return null;
    }

    const settings = results[0];
    return {
      ...settings,
      branding_colors: this.safeJsonParse(settings.branding_colors),
      enabled_features: this.safeJsonParse(settings.enabled_features),
      security_policies: this.safeJsonParse(settings.security_policies),
      compliance_frameworks: this.safeJsonParse(settings.compliance_frameworks),
      byollm_allowed_providers: this.safeJsonParse(settings.byollm_allowed_providers)
    };
  }

  /**
   * Create or update tenant settings
   */
  async upsertTenantSettings(
    tenantId: string,
    userId: string,
    settings: Partial<TenantSettings>
  ): Promise<TenantSettings> {
    // Check if settings exist
    const existing = await this.getTenantSettings(tenantId);
    const now = new Date().toISOString();

    if (existing) {
      // Update existing settings
      const updateFields: string[] = [];
      const params: any[] = [];

      if (settings.organization_name !== undefined) {
        updateFields.push('organization_name = ?');
        params.push(settings.organization_name);
      }
      if (settings.organization_logo_url !== undefined) {
        updateFields.push('organization_logo_url = ?');
        params.push(settings.organization_logo_url);
      }
      if (settings.branding_colors !== undefined) {
        updateFields.push('branding_colors = ?');
        params.push(JSON.stringify(settings.branding_colors));
      }
      if (settings.default_llm_config_id !== undefined) {
        updateFields.push('default_llm_config_id = ?');
        params.push(settings.default_llm_config_id);
      }
      if (settings.default_retention_days !== undefined) {
        updateFields.push('default_retention_days = ?');
        params.push(settings.default_retention_days);
      }
      if (settings.enabled_features !== undefined) {
        updateFields.push('enabled_features = ?');
        params.push(JSON.stringify(settings.enabled_features));
      }
      if (settings.security_policies !== undefined) {
        updateFields.push('security_policies = ?');
        params.push(JSON.stringify(settings.security_policies));
      }
      if (settings.compliance_frameworks !== undefined) {
        updateFields.push('compliance_frameworks = ?');
        params.push(JSON.stringify(settings.compliance_frameworks));
      }
      if (settings.byollm_enabled !== undefined) {
        updateFields.push('byollm_enabled = ?');
        params.push(settings.byollm_enabled);
      }
      if (settings.byollm_allowed_providers !== undefined) {
        updateFields.push('byollm_allowed_providers = ?');
        params.push(JSON.stringify(settings.byollm_allowed_providers));
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = ?');
        params.push(now);
        params.push(tenantId);

        const updateQuery = `
          UPDATE tenant_settings 
          SET ${updateFields.join(', ')}
          WHERE tenant_id = ?
        `;

        await this.db.execute(updateQuery, params, tenantId);

        // Log audit event
        await this.auditService.logEvent({
          eventType: 'tenant_settings_updated',
          eventCategory: 'configuration',
          severity: 'info',
          userId,
          tenantId,
          resourceType: 'tenant_settings',
          resourceId: tenantId,
          eventSummary: 'Tenant settings updated',
          eventDetails: settings
        });
      }
    } else {
      // Create new settings
      const settingId = uuidv4();
      
      const insertQuery = `
        INSERT INTO tenant_settings (
          setting_id,
          tenant_id,
          organization_name,
          organization_logo_url,
          branding_colors,
          default_llm_config_id,
          default_retention_days,
          enabled_features,
          security_policies,
          compliance_frameworks,
          byollm_enabled,
          byollm_allowed_providers,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        settingId,
        tenantId,
        settings.organization_name || null,
        settings.organization_logo_url || null,
        JSON.stringify(settings.branding_colors || {}),
        settings.default_llm_config_id || null,
        settings.default_retention_days || 90,
        JSON.stringify(settings.enabled_features || []),
        JSON.stringify(settings.security_policies || {}),
        JSON.stringify(settings.compliance_frameworks || []),
        settings.byollm_enabled || false,
        JSON.stringify(settings.byollm_allowed_providers || []),
        now,
        now
      ];

      await this.db.execute(insertQuery, params, tenantId);

      // Log audit event
      await this.auditService.logEvent({
        eventType: 'tenant_settings_created',
        eventCategory: 'configuration',
        severity: 'info',
        userId,
        tenantId,
        resourceType: 'tenant_settings',
        resourceId: tenantId,
        eventSummary: 'Tenant settings created',
        eventDetails: settings
      });
    }

    // Return updated settings
    const updatedSettings = await this.getTenantSettings(tenantId);
    if (!updatedSettings) {
      throw new Error('Failed to retrieve updated tenant settings');
    }

    return updatedSettings;
  }

  /**
   * Get tenant users
   */
  async getTenantUsers(tenantId: string): Promise<{
    users: (TenantUser & { roles: string[] })[];
    total: number;
  }> {
    const query = `
      SELECT DISTINCT
        u.user_id,
        u.azure_b2c_object_id,
        u.email,
        u.name,
        u.primary_tenant_id,
        u.status,
        u.mfa_enabled,
        u.last_login_at,
        u.password_last_changed,
        u.created_at,
        u.updated_at
      FROM users u
      INNER JOIN user_tenant_roles utr ON u.user_id = utr.user_id
      WHERE utr.tenant_id = ? AND u.deleted_at IS NULL
        AND (utr.expires_at IS NULL OR utr.expires_at > ?)
      ORDER BY u.name ASC
    `;

    const users = await this.db.query(query, [tenantId, new Date().toISOString()]);

    // Get roles for each user
    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const roles = await this.getUserTenantRoles(user.user_id, tenantId);
        return {
          ...user,
          roles: roles.map(role => role.role)
        };
      })
    );

    return {
      users: usersWithRoles,
      total: usersWithRoles.length
    };
  }

  /**
   * Update user's last login time
   */
  async updateUserLastLogin(userId: string): Promise<void> {
    const query = `
      UPDATE users 
      SET last_login_at = ?, updated_at = ?
      WHERE user_id = ?
    `;

    const now = new Date().toISOString();
    await this.db.execute(query, [now, now, userId]);
  }

  /**
   * Safely parse JSON strings
   */
  private safeJsonParse(jsonString: string): any {
    try {
      return JSON.parse(jsonString || '{}');
    } catch {
      return {};
    }
  }
}