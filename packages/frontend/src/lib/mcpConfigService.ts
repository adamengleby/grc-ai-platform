import { ServerConfiguration, TestResult, ConfigurationTest } from '@/types/mcp-config';

export class McpConfigService {
  private static instance: McpConfigService;
  private configurations: Map<string, ServerConfiguration> = new Map();

  private constructor() {}

  public static getInstance(): McpConfigService {
    if (!McpConfigService.instance) {
      McpConfigService.instance = new McpConfigService();
    }
    return McpConfigService.instance;
  }

  // Get storage key for a configuration
  private getStorageKey(tenantId: string, serverId: string): string {
    return `mcp_server_config_${tenantId}_${serverId}`;
  }

  // Save configuration to local storage
  async saveConfiguration(config: ServerConfiguration): Promise<void> {
    try {
      const storageKey = this.getStorageKey(config.tenantId, config.serverId);
      localStorage.setItem(storageKey, JSON.stringify(config));
      
      this.configurations.set(config.serverId, config);
      
      // In a real application, this would be an API call
      console.log('Configuration saved:', config);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw new Error('Failed to save server configuration');
    }
  }

  // Load configuration from local storage
  async loadConfiguration(tenantId: string, serverId: string): Promise<ServerConfiguration | null> {
    try {
      const storageKey = this.getStorageKey(tenantId, serverId);
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const config = JSON.parse(stored) as ServerConfiguration;
        this.configurations.set(serverId, config);
        return config;
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to load configuration for ${serverId}:`, error);
      return null;
    }
  }

  // Load all configurations for a tenant
  async loadTenantConfigurations(tenantId: string, serverIds: string[]): Promise<Record<string, ServerConfiguration>> {
    const configurations: Record<string, ServerConfiguration> = {};
    
    for (const serverId of serverIds) {
      const config = await this.loadConfiguration(tenantId, serverId);
      if (config) {
        configurations[serverId] = config;
      }
    }
    
    return configurations;
  }

  // Delete configuration
  async deleteConfiguration(tenantId: string, serverId: string): Promise<void> {
    try {
      const storageKey = this.getStorageKey(tenantId, serverId);
      localStorage.removeItem(storageKey);
      
      this.configurations.delete(serverId);
      
      console.log(`Configuration deleted for ${serverId}`);
    } catch (error) {
      console.error(`Failed to delete configuration for ${serverId}:`, error);
      throw new Error('Failed to delete server configuration');
    }
  }

  // Test configuration
  async testConfiguration(test: ConfigurationTest): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Simulate API call to test connection
      await this.simulateConnectionTest(test);
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        message: 'Connection test successful',
        responseTime,
        timestamp: new Date().toISOString(),
        details: {
          testType: test.testType,
          templateId: test.templateId
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
        responseTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Simulate connection test (replace with actual implementation)
  private async simulateConnectionTest(test: ConfigurationTest): Promise<void> {
    // Add realistic delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Validate required fields based on template
    const requiredFields = this.getRequiredFieldsForTemplate(test.templateId);
    const missingFields = requiredFields.filter(field => 
      !test.values[field] || test.values[field] === ''
    );
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    // Simulate different success rates based on template
    const successRate = this.getSuccessRateForTemplate(test.templateId);
    const random = Math.random();
    
    if (random > successRate) {
      const errorMessages = [
        'Connection timeout - check your network settings',
        'Authentication failed - verify credentials',
        'Server not reachable - check endpoint URL',
        'SSL certificate verification failed'
      ];
      
      throw new Error(errorMessages[Math.floor(Math.random() * errorMessages.length)]);
    }
  }

  // Get required fields for a template (simplified)
  private getRequiredFieldsForTemplate(templateId: string): string[] {
    const templateRequiredFields: Record<string, string[]> = {
      'archer-grc': ['instanceUrl', 'username', 'password', 'instanceName'],
      'servicenow': ['instanceName', 'username', 'password'],
      'jira': ['baseUrl', 'email', 'apiToken'],
      'rest-api': ['baseUrl'],
      'database': ['host', 'port', 'database', 'username', 'password']
    };
    
    return templateRequiredFields[templateId] || [];
  }

  // Get success rate for template (for simulation)
  private getSuccessRateForTemplate(templateId: string): number {
    const templateSuccessRates: Record<string, number> = {
      'archer-grc': 0.8,
      'servicenow': 0.85,
      'jira': 0.9,
      'rest-api': 0.75,
      'database': 0.7
    };
    
    return templateSuccessRates[templateId] || 0.8;
  }

  // Get configuration from memory cache
  getConfigurationFromCache(serverId: string): ServerConfiguration | null {
    return this.configurations.get(serverId) || null;
  }

  // Validate configuration values
  validateConfiguration(config: ServerConfiguration): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic validation
    if (!config.serverId) {
      errors.push('Server ID is required');
    }
    
    if (!config.tenantId) {
      errors.push('Tenant ID is required');
    }
    
    if (!config.templateId) {
      errors.push('Template ID is required');
    }
    
    if (!config.values || Object.keys(config.values).length === 0) {
      errors.push('Configuration values are required');
    }
    
    // Template-specific validation
    const requiredFields = this.getRequiredFieldsForTemplate(config.templateId);
    const missingFields = requiredFields.filter(field => 
      !config.values[field] || config.values[field] === ''
    );
    
    if (missingFields.length > 0) {
      errors.push(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Export configurations for backup
  async exportConfigurations(tenantId: string): Promise<ServerConfiguration[]> {
    const configurations: ServerConfiguration[] = [];
    
    // Get all keys that match the tenant pattern
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`mcp_server_config_${tenantId}_`)) {
        try {
          const config = JSON.parse(localStorage.getItem(key) || '');
          configurations.push(config);
        } catch (error) {
          console.error(`Failed to parse configuration from key ${key}:`, error);
        }
      }
    }
    
    return configurations;
  }

  // Import configurations from backup
  async importConfigurations(configurations: ServerConfiguration[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    for (const config of configurations) {
      try {
        await this.saveConfiguration(config);
        success++;
      } catch (error) {
        console.error(`Failed to import configuration for ${config.serverId}:`, error);
        failed++;
      }
    }
    
    return { success, failed };
  }
}