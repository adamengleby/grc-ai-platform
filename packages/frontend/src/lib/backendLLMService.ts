/**
 * Production-Ready Backend LLM Service
 *
 * CRITICAL: This version fixes all field mapping inconsistencies and ensures
 * proper configuration persistence and retrieval.
 *
 * Key improvements:
 * - Standardized field mapping between frontend and backend
 * - Proper API response handling and transformation
 * - Enhanced error handling and validation
 * - Cache invalidation and refresh mechanisms
 * - Consistent data transformation
 */

import { useAuthStore } from '@/app/store/auth';

export interface UserLlmConfig {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  endpoint: string;
  apiKey: string;
  // Secret management fields
  secretName?: string;
  keyVaultReference?: string;
  useSecret?: boolean;
  customHeaders?: Record<string, string>;
  maxTokens: number;
  temperature: number;
  rateLimit?: number;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  isEnabled: boolean;
  isDefault?: boolean;
  createdAt: string;
  lastTested?: string;
  errorMessage?: string;
  usageCount?: number;
  totalTokensUsed?: number;
}

export interface NewLlmConfig {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  endpoint: string;
  apiKey: string;
  // Secret management fields
  secretName?: string;
  keyVaultReference?: string;
  useSecret?: boolean;
  customHeaders?: Record<string, string>;
  maxTokens: number;
  temperature: number;
  rateLimit?: number;
  isEnabled: boolean;
  createdAt: string;
}

import { buildApiUrl } from '@/utils/apiUrls';

/**
 * Field mapping utilities for consistent transformation
 */
class LLMConfigFieldMapper {
  /**
   * Transform backend database record to frontend format
   */
  static transformToFrontend(record: any): UserLlmConfig {
    console.log(`🔄 [LLM Service FIXED] Transforming backend record:`, {
      config_id: record.config_id,
      id: record.id,
      name: record.name,
      provider: record.provider,
      api_key_present: !!record.api_key
    });

    return {
      // ID mapping: config_id (DB) -> id (Frontend)
      id: record.config_id || record.id,
      name: record.name || 'Unknown Configuration',
      description: record.description || '',
      provider: record.provider || 'unknown',
      model: record.model || 'unknown',

      // Endpoint mapping: endpoint_vault_secret (DB) -> endpoint (Frontend)
      endpoint: record.endpoint || record.endpoint_vault_secret || '',

      // API Key mapping: api_key_vault_secret (DB) -> apiKey (Frontend)
      apiKey: record.apiKey || record.api_key || record.api_key_vault_secret || '',

      // Secret management fields
      secretName: record.secretName || record.secret_name,
      keyVaultReference: record.keyVaultReference || record.key_vault_reference,
      useSecret: record.useSecret || record.use_secret || false,

      // Custom headers with JSON parsing
      customHeaders: this.parseJsonField(record.customHeaders || record.custom_headers),

      // Numeric fields with proper conversion
      maxTokens: this.parseNumber(record.maxTokens || record.max_tokens, 4000),
      temperature: this.parseNumber(record.temperature, 0.7),
      rateLimit: this.parseNumber(record.rateLimit || record.rate_limit),

      // Boolean fields with proper conversion
      isEnabled: Boolean(record.isEnabled !== undefined ? record.isEnabled : record.is_enabled),
      isDefault: Boolean(record.isDefault !== undefined ? record.isDefault : record.is_default),

      // Status computation
      status: this.computeStatus(record),

      // Timestamp fields
      createdAt: record.createdAt || record.created_at || new Date().toISOString(),
      lastTested: record.lastTested || record.last_tested_at || record.updated_at,

      // Usage statistics
      usageCount: this.parseNumber(record.usageCount || record.usage_count, 0),
      totalTokensUsed: this.parseNumber(record.totalTokensUsed || record.total_tokens_used, 0),

      // Error state
      errorMessage: record.errorMessage || record.error_message
    };
  }

  /**
   * Transform frontend data to backend format
   */
  static transformToBackend(data: NewLlmConfig | Partial<UserLlmConfig>): any {
    console.log(`🔄 [LLM Service FIXED] Transforming frontend data to backend:`, {
      id: data.id,
      name: data.name,
      provider: data.provider,
      hasApiKey: !!data.apiKey
    });

    const backendData: any = {};

    // Core fields
    if (data.name !== undefined) backendData.name = data.name;
    if (data.description !== undefined) backendData.description = data.description;
    if (data.provider !== undefined) backendData.provider = data.provider;
    if (data.model !== undefined) backendData.model = data.model;

    // Endpoint mapping: endpoint (Frontend) -> endpoint_vault_secret (DB)
    if (data.endpoint !== undefined) backendData.endpoint = data.endpoint;

    // API Key mapping: apiKey (Frontend) -> api_key (Backend API)
    if (data.apiKey !== undefined) backendData.api_key = data.apiKey;

    // Numeric fields
    if (data.maxTokens !== undefined) backendData.max_tokens = data.maxTokens;
    if (data.temperature !== undefined) backendData.temperature = data.temperature;
    if (data.rateLimit !== undefined) backendData.rate_limit = data.rateLimit;

    // Boolean fields: isEnabled (Frontend) -> is_enabled (Backend)
    if (data.isEnabled !== undefined) backendData.is_enabled = data.isEnabled ? 1 : 0;
    if ('isDefault' in data && data.isDefault !== undefined) {
      backendData.is_default = data.isDefault ? 1 : 0;
    }

    // Custom headers as JSON string
    if (data.customHeaders !== undefined) {
      backendData.custom_headers = data.customHeaders && Object.keys(data.customHeaders).length > 0
        ? JSON.stringify(data.customHeaders)
        : null;
    }

    console.log(`🔄 [LLM Service FIXED] Backend transformation result:`, {
      name: backendData.name,
      provider: backendData.provider,
      api_key_present: !!backendData.api_key,
      is_enabled: backendData.is_enabled
    });

    return backendData;
  }

  /**
   * Parse JSON field safely
   */
  private static parseJsonField(value: any): any {
    if (!value) return undefined;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  /**
   * Parse numeric field safely
   */
  private static parseNumber(value: any, defaultValue?: number): number | undefined {
    if (value === undefined || value === null) return defaultValue;
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Compute status from record data
   */
  private static computeStatus(record: any): 'connected' | 'disconnected' | 'error' | 'testing' {
    if (record.status) return record.status;
    if (record.last_test_status === 'testing') return 'testing';
    if (record.last_test_status === 'error' || record.error_message) return 'error';
    return record.is_enabled || record.isEnabled ? 'connected' : 'disconnected';
  }
}

export class BackendLLMServiceFixed {
  private get baseUrl() {
    return buildApiUrl('').replace(/\/$/, '');
  }

  private configCache: Map<string, UserLlmConfig[]> = new Map();
  private cacheTimestamp: Date | null = null;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * CRITICAL: Get all LLM configurations with proper field mapping and caching
   */
  async getAllLlmConfigs(forceRefresh = false): Promise<UserLlmConfig[]> {
    try {
      // Check cache first unless force refresh
      const cacheKey = 'llm_configs';
      if (!forceRefresh && this.configCache.has(cacheKey) && this.cacheTimestamp) {
        const cacheAge = Date.now() - this.cacheTimestamp.getTime();
        if (cacheAge < this.CACHE_DURATION) {
          console.log(`💾 [LLM Service FIXED] Returning cached configurations (age: ${cacheAge}ms)`);
          return this.configCache.get(cacheKey) || [];
        }
      }

      console.log(`🔍 [LLM Service FIXED] Fetching LLM configurations from backend (force: ${forceRefresh})`);

      // Get auth context for headers
      const authService = await import('@/lib/auth');
      const user = authService.authService.getCurrentUser();
      const tenant = authService.authService.getCurrentTenant();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (user?.id) {
        headers['x-user-id'] = user.id;
      }
      if (tenant?.id) {
        headers['x-tenant-id'] = tenant.id;
      }

      console.log('🔗 [LLM Service FIXED] Request headers:', {
        tenantId: tenant?.id,
        userId: user?.id,
        url: buildApiUrl('simple-llm-configs')
      });

      const response = await fetch(buildApiUrl('simple-llm-configs'), {
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch LLM configurations');
      }

      const rawConfigs = data.data?.llm_configs || [];
      console.log('📥 [LLM Service FIXED] Raw API response - llm_configs count:', rawConfigs.length);

      if (rawConfigs.length > 0) {
        console.log('📋 [LLM Service FIXED] Sample raw config:', {
          config_id: rawConfigs[0].config_id,
          id: rawConfigs[0].id,
          name: rawConfigs[0].name,
          provider: rawConfigs[0].provider,
          api_key_field: rawConfigs[0].api_key || rawConfigs[0].apiKey
        });
      }

      // Transform using standardized field mapping
      const transformedConfigs = rawConfigs.map((config: any) => {
        return LLMConfigFieldMapper.transformToFrontend(config);
      });

      console.log('✅ [LLM Service FIXED] Transformed configurations:', transformedConfigs.length);
      if (transformedConfigs.length > 0) {
        console.log('📋 [LLM Service FIXED] Sample transformed config:', {
          id: transformedConfigs[0].id,
          name: transformedConfigs[0].name,
          provider: transformedConfigs[0].provider,
          apiKey: transformedConfigs[0].apiKey?.substring(0, 10) + '...'
        });
      }

      // Update cache
      this.configCache.set(cacheKey, transformedConfigs);
      this.cacheTimestamp = new Date();

      return transformedConfigs;
    } catch (error) {
      console.error('❌ [LLM Service FIXED] Error fetching LLM configurations:', error);
      return [];
    }
  }

  /**
   * CRITICAL: Create LLM configuration with proper field mapping
   */
  async createLlmConfig(config: NewLlmConfig): Promise<UserLlmConfig> {
    console.log(`➕ [LLM Service FIXED] Creating LLM configuration:`, {
      name: config.name,
      provider: config.provider,
      model: config.model,
      hasApiKey: !!config.apiKey
    });

    // Transform frontend data to backend format
    const backendData = LLMConfigFieldMapper.transformToBackend(config);

    console.log(`📤 [LLM Service FIXED] Sending backend data:`, {
      name: backendData.name,
      provider: backendData.provider,
      api_key_present: !!backendData.api_key,
      is_enabled: backendData.is_enabled
    });

    const response = await fetch(buildApiUrl('simple-llm-configs'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(backendData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create LLM configuration');
    }

    console.log(`📥 [LLM Service FIXED] Create response:`, {
      success: data.success,
      llm_config_present: !!data.data?.llm_config
    });

    // Transform response using standardized field mapping
    const transformedConfig = LLMConfigFieldMapper.transformToFrontend(data.data.llm_config);

    // Invalidate cache
    this.configCache.clear();
    this.cacheTimestamp = null;

    console.log(`✅ [LLM Service FIXED] Configuration created:`, {
      id: transformedConfig.id,
      name: transformedConfig.name
    });

    return transformedConfig;
  }

  /**
   * CRITICAL: Update LLM configuration with proper field mapping and persistence
   */
  async updateLlmConfig(configId: string, updates: Partial<NewLlmConfig>): Promise<UserLlmConfig> {
    console.log(`📝 [LLM Service FIXED] Updating LLM configuration ${configId}:`, {
      fieldsToUpdate: Object.keys(updates),
      hasApiKey: !!updates.apiKey,
      isEnabled: updates.isEnabled
    });

    // Transform frontend updates to backend format
    const backendUpdates = LLMConfigFieldMapper.transformToBackend(updates);

    console.log(`📤 [LLM Service FIXED] Backend update data:`, {
      fields: Object.keys(backendUpdates),
      api_key_update: !!backendUpdates.api_key,
      is_enabled_update: backendUpdates.is_enabled
    });

    const response = await fetch(buildApiUrl(`simple-llm-configs/${configId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(backendUpdates)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to update LLM configuration');
    }

    console.log('📥 [LLM Service FIXED] Update response:', {
      success: data.success,
      llm_config_present: !!data.data?.llm_config
    });

    // Extract the configuration data from response
    const recordToTransform = data.data.llm_config || data.data.config || data.data;

    if (!recordToTransform) {
      throw new Error('No LLM configuration data returned from update');
    }

    // Transform response using standardized field mapping
    const transformedConfig = LLMConfigFieldMapper.transformToFrontend(recordToTransform);

    // Invalidate cache
    this.configCache.clear();
    this.cacheTimestamp = null;

    console.log(`✅ [LLM Service FIXED] Configuration updated:`, {
      id: transformedConfig.id,
      name: transformedConfig.name,
      apiKey: transformedConfig.apiKey?.substring(0, 10) + '...'
    });

    return transformedConfig;
  }

  /**
   * Delete LLM configuration
   */
  async deleteLlmConfig(configId: string): Promise<void> {
    console.log(`🗑️ [LLM Service FIXED] Deleting LLM configuration: ${configId}`);

    const response = await fetch(buildApiUrl(`simple-llm-configs/${configId}`), {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete LLM configuration');
    }

    // Invalidate cache
    this.configCache.clear();
    this.cacheTimestamp = null;

    console.log(`✅ [LLM Service FIXED] Configuration deleted: ${configId}`);
  }

  /**
   * Toggle LLM configuration enabled state
   */
  async toggleLlmConfig(configId: string, enabled: boolean): Promise<UserLlmConfig> {
    console.log(`🔄 [LLM Service FIXED] Toggling LLM configuration ${configId} to ${enabled ? 'enabled' : 'disabled'}`);
    return this.updateLlmConfig(configId, { isEnabled: enabled });
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    console.log(`🗑️ [LLM Service FIXED] Clearing configuration cache`);
    this.configCache.clear();
    this.cacheTimestamp = null;
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): { hasCache: boolean; age?: number; count?: number } {
    const cacheKey = 'llm_configs';
    const hasCache = this.configCache.has(cacheKey);

    if (!hasCache || !this.cacheTimestamp) {
      return { hasCache: false };
    }

    const age = Date.now() - this.cacheTimestamp.getTime();
    const count = this.configCache.get(cacheKey)?.length || 0;

    return { hasCache: true, age, count };
  }

  /**
   * Test field mapping consistency (for debugging)
   */
  async testFieldMapping(): Promise<any> {
    try {
      console.log(`🧪 [LLM Service FIXED] Testing field mapping consistency...`);

      const response = await fetch(buildApiUrl('simple-llm-configs/test-field-mapping'));
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Field mapping test failed');
      }

      console.log(`✅ [LLM Service FIXED] Field mapping test completed`);
      return data.data;
    } catch (error) {
      console.error('❌ [LLM Service FIXED] Field mapping test failed:', error);
      throw error;
    }
  }
}

export const backendLLMServiceFixed = new BackendLLMServiceFixed();

export function createLLMServiceFixed(): BackendLLMServiceFixed {
  return backendLLMServiceFixed;
}

// Backward compatibility export
export { backendLLMServiceFixed as backendLLMService };