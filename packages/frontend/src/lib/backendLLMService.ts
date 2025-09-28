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
  rateLimit?: number; // Requests per minute - optional for custom configuration
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  isEnabled: boolean;
  createdAt: string;
  lastTested?: string;
  errorMessage?: string;
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
  rateLimit?: number; // Requests per minute - optional for custom configuration
  isEnabled: boolean;
  createdAt: string;
}

import { buildApiUrl } from '@/utils/apiUrls';

export class BackendLLMService {
  private get baseUrl() {
    return buildApiUrl('').replace(/\/$/, ''); // Remove trailing slash
  }

  async getAllLlmConfigs(): Promise<UserLlmConfig[]> {
    try {
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

      console.log('🤖 [LLM Service] Getting LLM configs with headers:', { tenantId: tenant?.id, userId: user?.id });

      const response = await fetch(buildApiUrl('simple-llm-configs'), {
        headers
      });
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch LLM configurations');
      }
      
      const rawConfigs = data.data?.llm_configs || [];
      console.log('🔍 Raw API Response - llm_configs:', rawConfigs);
      rawConfigs.forEach((config, i) => {
        console.log(`  Raw Config ${i}:`, { config_id: config.config_id, id: config.id, name: config.name });
      });
      
      const transformedConfigs = rawConfigs.map(config => this.transformDatabaseRecord(config));
      console.log('🔄 Transformed Configs:');
      transformedConfigs.forEach((config, i) => {
        console.log(`  Transformed ${i}:`, { id: config.id, name: config.name, idType: typeof config.id });
      });
      
      return transformedConfigs;
    } catch (error) {
      console.error('Error fetching LLM configurations:', error);
      return [];
    }
  }

  async createLlmConfig(config: NewLlmConfig): Promise<UserLlmConfig> {
    const response = await fetch(buildApiUrl('simple-llm-configs'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: config.id,
        name: config.name,
        description: config.description,
        provider: config.provider,
        model: config.model,
        endpoint: config.endpoint,
        api_key: config.apiKey,
        custom_headers: config.customHeaders ? JSON.stringify(config.customHeaders) : null,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        rate_limit: config.rateLimit,
        is_enabled: config.isEnabled ? 1 : 0
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create LLM configuration');
    }

    return this.transformDatabaseRecord(data.data.llm_config);
  }

  async updateLlmConfig(configId: string, updates: Partial<NewLlmConfig>): Promise<UserLlmConfig> {
    const updateData: any = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.provider !== undefined) updateData.provider = updates.provider;
    if (updates.model !== undefined) updateData.model = updates.model;
    if (updates.endpoint !== undefined) updateData.endpoint = updates.endpoint;
    if (updates.apiKey !== undefined) updateData.api_key = updates.apiKey;
    if (updates.customHeaders !== undefined) {
      updateData.custom_headers = updates.customHeaders ? JSON.stringify(updates.customHeaders) : null;
    }
    if (updates.maxTokens !== undefined) updateData.max_tokens = updates.maxTokens;
    if (updates.temperature !== undefined) updateData.temperature = updates.temperature;
    if (updates.rateLimit !== undefined) updateData.rate_limit = updates.rateLimit;
    if (updates.isEnabled !== undefined) updateData.is_enabled = updates.isEnabled ? 1 : 0;

    const response = await fetch(buildApiUrl(`simple-llm-configs/${configId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to update LLM configuration');
    }

    console.log('🔄 Update Response:', data);
    const recordToTransform = data.data.llm_config || data.data.config || data.data;
    console.log('🔄 Record to Transform:', recordToTransform);
    
    if (!recordToTransform) {
      throw new Error('No LLM configuration data returned from update');
    }

    return this.transformDatabaseRecord(recordToTransform);
  }

  async deleteLlmConfig(configId: string): Promise<void> {
    const response = await fetch(buildApiUrl(`simple-llm-configs/${configId}`), {
      method: 'DELETE'
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete LLM configuration');
    }
  }

  async toggleLlmConfig(configId: string, enabled: boolean): Promise<UserLlmConfig> {
    return this.updateLlmConfig(configId, { isEnabled: enabled });
  }

  private transformDatabaseRecord(record: any): UserLlmConfig {
    return {
      id: record.config_id || record.id,
      name: record.name || 'Unknown',
      description: record.description || '',
      provider: record.provider || 'unknown',
      model: record.model || 'unknown',
      endpoint: record.endpoint || record.base_url || '',
      apiKey: record.api_key || '',
      customHeaders: record.custom_headers ? JSON.parse(record.custom_headers) : undefined,
      maxTokens: record.max_tokens || 4000,
      temperature: record.temperature || 0.7,
      rateLimit: record.rate_limit,
      status: record.is_enabled ? 'connected' : 'disconnected',
      isEnabled: !!record.is_enabled,
      createdAt: record.created_at,
      lastTested: record.updated_at,
      errorMessage: undefined
    };
  }
}

export const backendLLMService = new BackendLLMService();

export function createLLMService(): BackendLLMService {
  return backendLLMService;
}