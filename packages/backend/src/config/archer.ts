import fs from 'fs';
import path from 'path';

/**
 * Archer Configuration Management
 * Supports multiple configuration sources with priority:
 * 1. Environment variables (highest priority)
 * 2. Configuration file
 * 3. Default values
 */

export interface ArcherConfig {
  baseUrl: string;
  username: string;
  password: string;
  instanceId: string;
  userDomainId?: string;
  enabled: boolean;
  timeout?: number;
}

export interface TenantArcherConfig {
  [tenantId: string]: ArcherConfig;
}

class ArcherConfigManager {
  private config: TenantArcherConfig = {};
  private configFilePath: string;

  constructor() {
    this.configFilePath = path.join(__dirname, '../../../config/archer-config.json');
    this.loadConfiguration();
  }

  /**
   * Load configuration from multiple sources
   */
  private loadConfiguration(): void {
    // 1. Load from configuration file if it exists
    this.loadFromFile();

    // 2. Override with environment variables
    this.loadFromEnvironment();

    console.log('[Archer Config] Configuration loaded for tenants:', Object.keys(this.config));
  }

  /**
   * Load from configuration file
   */
  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const fileContent = fs.readFileSync(this.configFilePath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        
        // Merge file configuration
        Object.keys(fileConfig).forEach(tenantId => {
          this.config[tenantId] = {
            ...this.getDefaultConfig(),
            ...fileConfig[tenantId]
          };
        });

        console.log(`[Archer Config] Loaded configuration file: ${this.configFilePath}`);
      }
    } catch (error) {
      console.error('[Archer Config] Error loading configuration file:', error);
    }
  }

  /**
   * Load from environment variables
   */
  private loadFromEnvironment(): void {
    // Check for global Archer configuration
    if (process.env.ARCHER_BASE_URL) {
      const envConfig: ArcherConfig = {
        baseUrl: process.env.ARCHER_BASE_URL,
        username: process.env.ARCHER_USERNAME || '',
        password: process.env.ARCHER_PASSWORD || '',
        instanceId: process.env.ARCHER_INSTANCE || '',
        userDomainId: process.env.ARCHER_DOMAIN || '1',
        enabled: process.env.ARCHER_ENABLED !== 'false',
        timeout: parseInt(process.env.ARCHER_TIMEOUT || '30000')
      };

      // Apply to default tenant if not specified
      const defaultTenant = process.env.DEFAULT_TENANT_ID || 'acme-corp';
      this.config[defaultTenant] = envConfig;

      console.log(`[Archer Config] Environment configuration applied to tenant: ${defaultTenant}`);
    }

    // Check for tenant-specific environment variables
    // Format: ARCHER_TENANT_[TENANT_ID]_BASE_URL, etc.
    const envVars = Object.keys(process.env).filter(key => key.startsWith('ARCHER_TENANT_'));
    const tenantConfigs: { [key: string]: Partial<ArcherConfig> } = {};

    envVars.forEach(envVar => {
      const parts = envVar.split('_');
      if (parts.length >= 4) {
        const tenantId = parts[2];
        const configKey = parts.slice(3).join('_').toLowerCase();
        
        if (!tenantConfigs[tenantId]) {
          tenantConfigs[tenantId] = {};
        }

        const value = process.env[envVar];
        switch (configKey) {
          case 'base_url':
            tenantConfigs[tenantId].baseUrl = value;
            break;
          case 'username':
            tenantConfigs[tenantId].username = value;
            break;
          case 'password':
            tenantConfigs[tenantId].password = value;
            break;
          case 'instance':
            tenantConfigs[tenantId].instanceId = value;
            break;
          case 'domain':
            tenantConfigs[tenantId].userDomainId = value;
            break;
          case 'enabled':
            tenantConfigs[tenantId].enabled = value?.toLowerCase() !== 'false';
            break;
          case 'timeout':
            tenantConfigs[tenantId].timeout = parseInt(value || '30000');
            break;
        }
      }
    });

    // Apply tenant-specific configurations
    Object.keys(tenantConfigs).forEach(tenantId => {
      this.config[tenantId] = {
        ...this.getDefaultConfig(),
        ...this.config[tenantId],
        ...tenantConfigs[tenantId]
      } as ArcherConfig;

      console.log(`[Archer Config] Tenant-specific environment configuration applied: ${tenantId}`);
    });
  }

  /**
   * Get default configuration - now returns empty config requiring proper setup
   */
  private getDefaultConfig(): ArcherConfig {
    return {
      baseUrl: '',
      username: '',
      password: '',
      instanceId: '',
      userDomainId: '',
      enabled: false,
      timeout: 30000
    };
  }

  /**
   * Get configuration for a specific tenant
   */
  getConfig(tenantId: string): ArcherConfig | null {
    if (this.config[tenantId]) {
      return { ...this.config[tenantId] };
    }

    // Fallback to default tenant configuration
    const defaultTenant = Object.keys(this.config)[0];
    if (defaultTenant) {
      console.log(`[Archer Config] Using default tenant config for ${tenantId}`);
      return { ...this.config[defaultTenant] };
    }

    console.warn(`[Archer Config] No configuration found for tenant: ${tenantId}`);
    return null;
  }

  /**
   * Check if Archer is enabled for a tenant
   */
  isEnabled(tenantId: string): boolean {
    const config = this.getConfig(tenantId);
    return config?.enabled === true && 
           !!config.baseUrl && 
           !!config.username && 
           !!config.instanceId;
  }

  /**
   * Get all configured tenants
   */
  getConfiguredTenants(): string[] {
    return Object.keys(this.config).filter(tenantId => this.isEnabled(tenantId));
  }

  /**
   * Save configuration to file
   */
  async saveConfiguration(tenantConfigs: TenantArcherConfig): Promise<void> {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.configFilePath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Save to file
      fs.writeFileSync(this.configFilePath, JSON.stringify(tenantConfigs, null, 2));
      
      // Reload configuration
      this.config = {};
      this.loadConfiguration();

      console.log(`[Archer Config] Configuration saved to: ${this.configFilePath}`);
    } catch (error) {
      console.error('[Archer Config] Error saving configuration:', error);
      throw error;
    }
  }

  /**
   * Add or update tenant configuration
   */
  async setTenantConfig(tenantId: string, config: Partial<ArcherConfig>): Promise<void> {
    const currentConfig = this.getConfig(tenantId) || this.getDefaultConfig();
    const newConfig = { ...currentConfig, ...config };

    // Update in-memory configuration
    this.config[tenantId] = newConfig;

    // Save to file
    await this.saveConfiguration(this.config);
  }

  /**
   * Test connection for a tenant
   */
  async testConnection(tenantId: string): Promise<{ success: boolean; message: string }> {
    const config = this.getConfig(tenantId);
    if (!config) {
      return { success: false, message: 'No configuration found for tenant' };
    }

    if (!this.isEnabled(tenantId)) {
      return { success: false, message: 'Archer integration disabled or incomplete configuration' };
    }

    try {
      // Import MCP client here to avoid circular dependencies
      const { mcpClient } = await import('../services/mcpClient');
      const result = await mcpClient.testArcherConnection(tenantId);
      
      return { 
        success: result, 
        message: result ? 'Connection successful' : 'Connection failed' 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Connection error: ${(error as Error).message}` 
      };
    }
  }
}

// Export singleton instance
export const archerConfigManager = new ArcherConfigManager();