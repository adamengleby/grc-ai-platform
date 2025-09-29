/**
 * LLM Configuration Service
 * Replaces localStorage LLM config storage with database operations
 * Handles tenant-specific LLM configurations with proper isolation
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from './databaseService';
import { AuditService } from './auditService';

export interface LLMConfiguration {
  config_id?: string;
  tenant_id: string;
  name: string;
  provider: 'azure_openai' | 'openai' | 'anthropic' | 'custom';
  model: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: 'text' | 'json_object';
  api_key_vault_secret?: string;
  endpoint_vault_secret?: string;
  is_enabled?: boolean;
  is_default?: boolean;
  last_tested_at?: Date;
  last_test_status?: 'success' | 'failed' | 'pending';
  last_test_error?: string;
  usage_count?: number;
  total_tokens_used?: number;
  created_by_user_id?: string;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

export interface LLMTestResult {
  success: boolean;
  response_time_ms?: number;
  error_message?: string;
  test_timestamp: Date;
}

export class LLMConfigService {
  private db: DatabaseService;
  private auditService: AuditService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.auditService = new AuditService();
  }

  /**
   * Get specific LLM configuration by ID (used by AgentService)
   */
  async getConfig(tenantId: string, configId: string): Promise<LLMConfiguration | null> {
    const query = `
      SELECT 
        config_id,
        tenant_id,
        name,
        provider,
        model,
        temperature,
        max_tokens,
        response_format,
        api_key_vault_secret,
        endpoint_vault_secret,
        is_enabled,
        is_default,
        last_tested_at,
        last_test_status,
        last_test_error,
        usage_count,
        total_tokens_used,
        created_by_user_id,
        created_at,
        updated_at
      FROM llm_configurations
      WHERE tenant_id = ? AND config_id = ? AND deleted_at IS NULL
    `;

    const results = await this.db.query(query, [tenantId, configId], tenantId);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get all LLM configurations for a tenant
   * Replaces: localStorage.getItem(`user_llm_configs_${tenantId}`)
   */
  async getTenantLLMConfigs(tenantId: string): Promise<LLMConfiguration[]> {
    const query = `
      SELECT 
        config_id,
        tenant_id,
        name,
        provider,
        model,
        temperature,
        max_tokens,
        response_format,
        api_key_vault_secret,
        endpoint_vault_secret,
        is_enabled,
        is_default,
        last_tested_at,
        last_test_status,
        last_test_error,
        usage_count,
        total_tokens_used,
        created_by_user_id,
        created_at,
        updated_at
      FROM llm_configurations
      WHERE tenant_id = ? AND deleted_at IS NULL
      ORDER BY is_default DESC, name ASC
    `;

    return await this.db.query(query, [tenantId], tenantId);
  }

  /**
   * Get specific LLM configuration by ID (alias for getConfig)
   */
  async getLLMConfigById(tenantId: string, configId: string): Promise<LLMConfiguration | null> {
    return await this.getConfig(tenantId, configId);
  }

  /**
   * Get default LLM configuration for tenant
   */
  async getDefaultLLMConfig(tenantId: string): Promise<LLMConfiguration | null> {
    const query = `
      SELECT 
        config_id,
        tenant_id,
        name,
        provider,
        model,
        temperature,
        max_tokens,
        response_format,
        api_key_vault_secret,
        endpoint_vault_secret,
        is_enabled,
        is_default,
        last_tested_at,
        last_test_status,
        last_test_error,
        usage_count,
        total_tokens_used,
        created_by_user_id,
        created_at,
        updated_at
      FROM llm_configurations
      WHERE tenant_id = ? AND is_default = 1 AND deleted_at IS NULL
    `;

    const results = await this.db.query(query, [tenantId], tenantId);
    if (results.length > 0) {
      return results[0];
    }

    // Fallback to first available config
    const configs = await this.getTenantLLMConfigs(tenantId);
    return configs.length > 0 ? configs[0] : null;
  }

  /**
   * Create new LLM configuration
   * Replaces: localStorage.setItem with new config
   */
  async createLLMConfig(
    tenantId: string, 
    userId: string, 
    config: Omit<LLMConfiguration, 'config_id' | 'tenant_id' | 'created_by_user_id' | 'created_at' | 'updated_at'>
  ): Promise<LLMConfiguration> {
    try {
      // Validate tenant access
      if (!await this.validateTenantAccess(tenantId, userId)) {
        throw new Error('Insufficient permissions to create LLM configuration');
      }

      const configId = uuidv4();
      const now = new Date().toISOString();

      // If this is set as default, unset other defaults
      if (config.is_default) {
        await this.unsetAllDefaults(tenantId);
      }

      const insertQuery = `
        INSERT INTO llm_configurations (
          config_id,
          tenant_id,
          name,
          provider,
          model,
          temperature,
          max_tokens,
          response_format,
          api_key_vault_secret,
          endpoint_vault_secret,
          is_enabled,
          is_default,
          usage_count,
          total_tokens_used,
          created_by_user_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        configId,
        tenantId,
        config.name,
        config.provider,
        config.model,
        config.temperature || 0.3,
        config.max_tokens || 2000,
        config.response_format || 'text',
        config.api_key_vault_secret || null,
        config.endpoint_vault_secret || null,
        config.is_enabled !== false,
        config.is_default || false,
        0, // usage_count
        0, // total_tokens_used
        userId,
        now,
        now
      ];

      await this.db.execute(insertQuery, params, tenantId);

      // Log audit event
      await this.auditService.logEvent({
        eventType: 'llm_config_created',
        eventCategory: 'configuration',
        severity: 'info',
        userId,
        tenantId,
        resourceType: 'llm_config',
        resourceId: configId,
        eventSummary: `LLM configuration '${config.name}' created`,
        eventDetails: {
          provider: config.provider,
          model: config.model,
          isDefault: config.is_default
        }
      });

      // Return the created config
      const createdConfig = await this.getConfig(tenantId, configId);
      if (!createdConfig) {
        throw new Error('Failed to retrieve created LLM configuration');
      }

      return createdConfig;
    } catch (error) {
      console.error('[LLMConfigService] Error creating LLM config:', error);
      throw error;
    }
  }

  /**
   * Update existing LLM configuration
   */
  async updateLLMConfig(
    tenantId: string,
    userId: string,
    configId: string,
    updates: Partial<LLMConfiguration>
  ): Promise<LLMConfiguration> {
    try {
      // Validate tenant access and ownership
      if (!await this.validateTenantAccess(tenantId, userId)) {
        throw new Error('Insufficient permissions to update LLM configuration');
      }

      const currentConfig = await this.getLLMConfigById(tenantId, configId);
      if (!currentConfig) {
        throw new Error('LLM configuration not found');
      }

      // If setting as default, unset other defaults
      if (updates.is_default && !currentConfig.is_default) {
        await this.unsetAllDefaults(tenantId);
      }

      const updatedConfig: LLMConfiguration = {
        ...currentConfig,
        ...updates,
        config_id: configId, // Ensure ID doesn't change
        tenant_id: tenantId, // Ensure tenant doesn't change
        updated_at: new Date()
      };

      // TODO: Update in database
      // UPDATE llm_configurations SET ... WHERE config_id = ? AND tenant_id = ?

      console.log('[LLMConfigService] Updated LLM config:', updatedConfig.name);
      return updatedConfig;
    } catch (error) {
      console.error('[LLMConfigService] Error updating LLM config:', error);
      throw error;
    }
  }

  /**
   * Delete LLM configuration (soft delete)
   */
  async deleteLLMConfig(tenantId: string, userId: string, configId: string): Promise<boolean> {
    try {
      // Validate tenant access
      if (!await this.validateTenantAccess(tenantId, userId)) {
        throw new Error('Insufficient permissions to delete LLM configuration');
      }

      const config = await this.getLLMConfigById(tenantId, configId);
      if (!config) {
        throw new Error('LLM configuration not found');
      }

      // Don't allow deleting the last configuration
      const allConfigs = await this.getTenantLLMConfigs(tenantId);
      if (allConfigs.length <= 1) {
        throw new Error('Cannot delete the last LLM configuration');
      }

      // If deleting the default, set another one as default
      if (config.is_default) {
        const nextConfig = allConfigs.find(c => c.config_id !== configId);
        if (nextConfig) {
          await this.updateLLMConfig(tenantId, userId, nextConfig.config_id!, { is_default: true });
        }
      }

      // TODO: Soft delete in database
      // UPDATE llm_configurations SET deleted_at = GETUTCDATE() WHERE config_id = ? AND tenant_id = ?

      console.log('[LLMConfigService] Deleted LLM config:', config.name);
      return true;
    } catch (error) {
      console.error('[LLMConfigService] Error deleting LLM config:', error);
      throw error;
    }
  }

  /**
   * Test LLM configuration connectivity
   */
  async testLLMConfig(tenantId: string, configId: string): Promise<LLMTestResult> {
    try {
      const config = await this.getLLMConfigById(tenantId, configId);
      if (!config) {
        return {
          success: false,
          error_message: 'Configuration not found',
          test_timestamp: new Date()
        };
      }

      const startTime = Date.now();
      
      // TODO: Implement actual LLM connectivity test based on provider
      // This would involve making a simple API call to validate credentials
      
      // Mock test implementation
      const isSuccess = Math.random() > 0.1; // 90% success rate for demo
      const responseTime = Date.now() - startTime;

      const testResult: LLMTestResult = {
        success: isSuccess,
        response_time_ms: responseTime,
        error_message: isSuccess ? undefined : 'Connection timeout',
        test_timestamp: new Date()
      };

      // Update configuration with test results
      await this.updateLLMConfig(tenantId, config.created_by_user_id!, configId, {
        last_tested_at: testResult.test_timestamp,
        last_test_status: testResult.success ? 'success' : 'failed',
        last_test_error: testResult.error_message
      });

      return testResult;
    } catch (error) {
      console.error('[LLMConfigService] Error testing LLM config:', error);
      return {
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        test_timestamp: new Date()
      };
    }
  }

  /**
   * Get LLM usage statistics for tenant
   */
  async getLLMUsageStats(tenantId: string): Promise<{
    total_configs: number;
    total_usage: number;
    total_tokens: number;
    most_used_config: string | null;
  }> {
    try {
      const configs = await this.getTenantLLMConfigs(tenantId);
      
      const stats = {
        total_configs: configs.length,
        total_usage: configs.reduce((sum, config) => sum + (config.usage_count || 0), 0),
        total_tokens: configs.reduce((sum, config) => sum + (config.total_tokens_used || 0), 0),
        most_used_config: null as string | null
      };

      // Find most used configuration
      const mostUsed = configs.reduce((prev, current) => 
        (current.usage_count || 0) > (prev.usage_count || 0) ? current : prev
      );
      
      stats.most_used_config = mostUsed?.name || null;
      
      return stats;
    } catch (error) {
      console.error('[LLMConfigService] Error getting usage stats:', error);
      throw error;
    }
  }

  /**
   * Private helper: Unset all default flags for tenant
   */
  private async unsetAllDefaults(tenantId: string): Promise<void> {
    const query = `
      UPDATE llm_configurations 
      SET is_default = 0, updated_at = ?
      WHERE tenant_id = ? AND is_default = 1 AND deleted_at IS NULL
    `;
    
    await this.db.execute(query, [new Date().toISOString(), tenantId], tenantId);
  }

  /**
   * Private helper: Validate tenant access
   */
  private async validateTenantAccess(tenantId: string, userId: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM user_tenant_roles 
      WHERE user_id = ? AND tenant_id = ? 
        AND role IN ('TenantOwner', 'PlatformOwner')
        AND (expires_at IS NULL OR expires_at > ?)
    `;
    
    const results = await this.db.query(query, [userId, tenantId, new Date().toISOString()], tenantId);
    return results[0]?.count > 0;
  }

  /**
   * Increment usage counter for LLM configuration
   */
  async incrementUsage(tenantId: string, configId: string, tokensUsed: number): Promise<void> {
    try {
      const query = `
        UPDATE llm_configurations 
        SET usage_count = usage_count + 1,
            total_tokens_used = total_tokens_used + ?,
            updated_at = ?
        WHERE tenant_id = ? AND config_id = ? AND deleted_at IS NULL
      `;
      
      await this.db.execute(query, [tokensUsed, new Date().toISOString(), tenantId, configId], tenantId);
    } catch (error) {
      console.error('[LLMConfigService] Error incrementing usage:', error);
      // Non-fatal error, don't throw
    }
  }
}

export default LLMConfigService;