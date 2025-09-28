/**
 * Privacy Settings Service
 * Manages privacy and data masking settings for LLM protection
 */

import { v4 as uuidv4 } from 'uuid';
import { SQLiteDatabase } from '../config/sqliteDatabase';
import winston from 'winston';

export interface PrivacySettings {
  setting_id?: string;
  tenant_id: string;
  user_id?: string;
  enable_privacy_masking: boolean;
  masking_level: 'light' | 'moderate' | 'strict';
  enable_tokenization: boolean;
  custom_sensitive_fields: string[];
  privacy_key?: string;
  scope: 'user' | 'tenant';
  created_at?: Date;
  updated_at?: Date;
}

export class PrivacySettingsService {
  private db: SQLiteDatabase;
  private logger: winston.Logger;

  constructor(db: SQLiteDatabase, logger: winston.Logger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Get privacy settings for user or tenant
   */
  async getPrivacySettings(tenantId: string, userId?: string): Promise<PrivacySettings | null> {
    try {
      let query: string;
      let params: string[];

      if (userId) {
        // Get user-specific settings first
        query = `
          SELECT * FROM privacy_settings 
          WHERE tenant_id = ? AND user_id = ? AND scope = 'user'
          ORDER BY updated_at DESC LIMIT 1
        `;
        params = [tenantId, userId];
      } else {
        // Get tenant-wide settings
        query = `
          SELECT * FROM privacy_settings 
          WHERE tenant_id = ? AND scope = 'tenant' AND user_id IS NULL
          ORDER BY updated_at DESC LIMIT 1
        `;
        params = [tenantId];
      }

      const results = this.db.query<any>(query, params);
      
      if (results.length === 0) {
        // If no user settings, try tenant settings as fallback
        if (userId) {
          return this.getPrivacySettings(tenantId); // Get tenant settings
        }
        return null;
      }

      const row = results[0];
      return {
        setting_id: row.setting_id,
        tenant_id: row.tenant_id,
        user_id: row.user_id,
        enable_privacy_masking: Boolean(row.enable_privacy_masking),
        masking_level: row.masking_level as 'light' | 'moderate' | 'strict',
        enable_tokenization: Boolean(row.enable_tokenization),
        custom_sensitive_fields: JSON.parse(row.custom_sensitive_fields || '[]'),
        privacy_key: row.privacy_key,
        scope: row.scope as 'user' | 'tenant',
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at)
      };
    } catch (error) {
      this.logger.error('[PrivacySettings] Error getting privacy settings:', error);
      throw error;
    }
  }

  /**
   * Create or update privacy settings
   */
  async upsertPrivacySettings(settings: Omit<PrivacySettings, 'setting_id' | 'created_at' | 'updated_at'>): Promise<PrivacySettings> {
    try {
      const settingId = uuidv4();
      const now = new Date().toISOString();
      
      // Check if settings exist
      const existing = await this.getPrivacySettings(settings.tenant_id, settings.user_id);
      
      if (existing) {
        // Update existing settings
        const query = `
          UPDATE privacy_settings SET
            enable_privacy_masking = ?,
            masking_level = ?,
            enable_tokenization = ?,
            custom_sensitive_fields = ?,
            privacy_key = ?,
            updated_at = ?
          WHERE setting_id = ?
        `;
        
        this.db.execute(query, [
          settings.enable_privacy_masking ? 1 : 0,
          settings.masking_level,
          settings.enable_tokenization ? 1 : 0,
          JSON.stringify(settings.custom_sensitive_fields),
          settings.privacy_key || null,
          now,
          existing.setting_id
        ]);

        this.logger.info(`[PrivacySettings] Updated privacy settings for tenant ${settings.tenant_id}, user ${settings.user_id || 'tenant-wide'}`);
        
        return {
          ...settings,
          setting_id: existing.setting_id,
          created_at: existing.created_at,
          updated_at: new Date(now)
        };
      } else {
        // Create new settings
        const query = `
          INSERT INTO privacy_settings (
            setting_id, tenant_id, user_id, enable_privacy_masking,
            masking_level, enable_tokenization, custom_sensitive_fields,
            privacy_key, scope, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        this.db.execute(query, [
          settingId,
          settings.tenant_id,
          settings.user_id || null,
          settings.enable_privacy_masking ? 1 : 0,
          settings.masking_level,
          settings.enable_tokenization ? 1 : 0,
          JSON.stringify(settings.custom_sensitive_fields),
          settings.privacy_key || null,
          settings.scope,
          now,
          now
        ]);

        this.logger.info(`[PrivacySettings] Created privacy settings for tenant ${settings.tenant_id}, user ${settings.user_id || 'tenant-wide'}`);
        
        return {
          ...settings,
          setting_id: settingId,
          created_at: new Date(now),
          updated_at: new Date(now)
        };
      }
    } catch (error) {
      this.logger.error('[PrivacySettings] Error upserting privacy settings:', error);
      throw error;
    }
  }

  /**
   * Get default privacy settings (safe defaults)
   */
  getDefaultPrivacySettings(tenantId: string, userId?: string): PrivacySettings {
    return {
      tenant_id: tenantId,
      user_id: userId,
      enable_privacy_masking: true, // Default to SAFE
      masking_level: 'strict', // Default to MOST SECURE
      enable_tokenization: false,
      custom_sensitive_fields: [
        'employee_id', 'ssn', 'social_security', 'account_number', 
        'credit_card', 'passport', 'license', 'salary', 'wage',
        'address', 'phone', 'email', 'name'
      ],
      scope: userId ? 'user' : 'tenant'
    };
  }

  /**
   * Delete privacy settings
   */
  async deletePrivacySettings(tenantId: string, userId?: string): Promise<boolean> {
    try {
      let query: string;
      let params: string[];

      if (userId) {
        query = 'DELETE FROM privacy_settings WHERE tenant_id = ? AND user_id = ?';
        params = [tenantId, userId];
      } else {
        query = 'DELETE FROM privacy_settings WHERE tenant_id = ? AND scope = "tenant"';
        params = [tenantId];
      }

      this.db.execute(query, params);
      
      this.logger.info(`[PrivacySettings] Deleted privacy settings for tenant ${tenantId}, user ${userId || 'tenant-wide'}`);
      return true;
    } catch (error) {
      this.logger.error('[PrivacySettings] Error deleting privacy settings:', error);
      return false;
    }
  }

  /**
   * Get privacy settings for all users in tenant (admin function)
   */
  async getTenantPrivacySettings(tenantId: string): Promise<PrivacySettings[]> {
    try {
      const query = `
        SELECT * FROM privacy_settings 
        WHERE tenant_id = ? 
        ORDER BY scope DESC, updated_at DESC
      `;
      
      const results = this.db.query<any>(query, [tenantId]);
      
      return results.map(row => ({
        setting_id: row.setting_id,
        tenant_id: row.tenant_id,
        user_id: row.user_id,
        enable_privacy_masking: Boolean(row.enable_privacy_masking),
        masking_level: row.masking_level as 'light' | 'moderate' | 'strict',
        enable_tokenization: Boolean(row.enable_tokenization),
        custom_sensitive_fields: JSON.parse(row.custom_sensitive_fields || '[]'),
        privacy_key: row.privacy_key,
        scope: row.scope as 'user' | 'tenant',
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at)
      }));
    } catch (error) {
      this.logger.error('[PrivacySettings] Error getting tenant privacy settings:', error);
      throw error;
    }
  }
}