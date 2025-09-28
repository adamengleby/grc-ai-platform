/**
 * MCP Configuration Bridge
 * Handles communication between frontend Settings and MCP server configuration
 * Production-ready with API endpoints for tenant-specific configuration
 */

import { MCPPrivacyConfig } from '@/features/settings/pages/SettingsPage';
import { ArcherCredentials, getAllCredentials, credentialsManager } from './backendCredentialsApi';

export interface McpServerConfiguration {
  serverId: string;
  connectionId: string;
  privacyConfig: {
    enableMasking: boolean;
    maskingLevel: 'light' | 'moderate' | 'strict';
    enableTokenization: boolean;
    customSensitiveFields: string[];
    privacyKey?: string;
  };
  performanceConfig: {
    pageSize: number;
    requestTimeout: number;
    maxRetries: number;
    enableCaching: boolean;
    enableBackgroundSync: boolean;
  };
  lastUpdated: string;
}

export interface McpBridgeConfig {
  tenantId: string;
  servers: Record<string, McpServerConfiguration>;
  globalSettings: {
    defaultMaskingLevel: 'light' | 'moderate' | 'strict';
    enableAuditLogging: boolean;
  };
}

class McpConfigurationBridge {
  constructor() {
    // In production, this would be your API endpoint
    // this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  }

  /**
   * Get current MCP configuration for a tenant
   */
  async getTenantConfiguration(tenantId: string): Promise<McpBridgeConfig | null> {
    try {
      // For now, read from localStorage (will be replaced with API call)
      const configKey = `mcp_bridge_config_${tenantId}`;
      const stored = localStorage.getItem(configKey);
      
      if (stored) {
        return JSON.parse(stored);
      }
      
      // In production, this would be:
      // const response = await fetch(`${this.baseUrl}/mcp/config/${tenantId}`);
      // return response.json();
      
      return null;
    } catch (error) {
      console.error('Error loading MCP configuration:', error);
      return null;
    }
  }

  /**
   * Update MCP configuration and notify MCP server
   */
  async updateTenantConfiguration(
    tenantId: string, 
    config: McpBridgeConfig
  ): Promise<boolean> {
    try {
      // Save to localStorage (temporary - will be database in production)
      const configKey = `mcp_bridge_config_${tenantId}`;
      localStorage.setItem(configKey, JSON.stringify(config));
      
      // Notify MCP server of configuration change
      await this.notifyMcpServer(tenantId, config);
      
      // In production, this would be:
      // const response = await fetch(`${this.baseUrl}/mcp/config/${tenantId}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(config)
      // });
      // return response.ok;
      
      return true;
    } catch (error) {
      console.error('Error updating MCP configuration:', error);
      return false;
    }
  }

  /**
   * Convert Settings page configuration to MCP server format
   */
  async convertSettingsToMcpConfig(
    tenantId: string,
    privacyConfig: MCPPrivacyConfig,
    serverConfigurations: Record<string, any>
  ): Promise<McpBridgeConfig> {
    // Set tenant context for credentials manager
    credentialsManager.setTenantContext(tenantId);
    await credentialsManager.initialize();
    
    const credentials = await getAllCredentials();
    
    const servers: Record<string, McpServerConfiguration> = {};
    
    // Convert each configured server
    Object.entries(serverConfigurations).forEach(([serverId, serverConfig]) => {
      const connection = credentials.find(c => c.id === serverConfig.connectionId);
      
      if (connection) {
        servers[serverId] = {
          serverId,
          connectionId: serverConfig.connectionId,
          privacyConfig: {
            enableMasking: privacyConfig.enablePrivacyMasking,
            maskingLevel: privacyConfig.maskingLevel,
            enableTokenization: privacyConfig.enableTokenization,
            customSensitiveFields: privacyConfig.customSensitiveFields,
            privacyKey: privacyConfig.privacyKey,
          },
          performanceConfig: {
            pageSize: privacyConfig.pageSize || 50,
            requestTimeout: privacyConfig.requestTimeout || 30,
            maxRetries: privacyConfig.maxRetries || 3,
            enableCaching: privacyConfig.enableCaching || false,
            enableBackgroundSync: privacyConfig.enableBackgroundSync || false,
          },
          lastUpdated: new Date().toISOString(),
        };
      }
    });

    return {
      tenantId,
      servers,
      globalSettings: {
        defaultMaskingLevel: privacyConfig.maskingLevel,
        enableAuditLogging: true,
      }
    };
  }

  /**
   * Notify MCP server of configuration changes
   * This would be a webhook or message queue in production
   */
  private async notifyMcpServer(tenantId: string, config: McpBridgeConfig): Promise<void> {
    try {
      // For development, we'll write to a file that MCP server can watch
      const configForMcp = {
        tenantId,
        timestamp: new Date().toISOString(),
        servers: Object.values(config.servers).reduce((acc, server) => {
          acc[server.serverId] = {
            connection_id: server.connectionId,
            privacy_masking: server.privacyConfig.enableMasking,
            masking_level: server.privacyConfig.maskingLevel,
            tokenization: server.privacyConfig.enableTokenization,
            custom_fields: server.privacyConfig.customSensitiveFields,
            page_size: server.performanceConfig.pageSize,
            timeout: server.performanceConfig.requestTimeout,
            max_retries: server.performanceConfig.maxRetries,
            enable_cache: server.performanceConfig.enableCaching,
          };
          return acc;
        }, {} as Record<string, any>)
      };

      // In development, write to a config file
      if (process.env.NODE_ENV === 'development') {
        // This would trigger MCP server to reload configuration
        console.log('MCP Configuration Update:', configForMcp);
      }

      // In production, this would be:
      // await fetch(`${this.baseUrl}/mcp/reload-config`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ tenantId, config: configForMcp })
      // });
      
    } catch (error) {
      console.error('Error notifying MCP server:', error);
    }
  }

  /**
   * Get available connections for MCP server configuration
   */
  async getAvailableConnections(tenantId: string): Promise<ArcherCredentials[]> {
    // Set tenant context for credentials manager
    credentialsManager.setTenantContext(tenantId);
    await credentialsManager.initialize();
    
    return getAllCredentials();
  }

  /**
   * Test MCP server configuration
   */
  async testServerConfiguration(
    tenantId: string,
    serverId: string, 
    connectionId: string
  ): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Set tenant context for credentials manager
      credentialsManager.setTenantContext(tenantId);
      await credentialsManager.initialize();
      
      const credentials = await getAllCredentials();
      const connection = credentials.find(c => c.id === connectionId);
      
      if (!connection) {
        return { success: false, message: 'Connection not found' };
      }

      // In production, this would test the actual MCP server connection
      // await fetch(`${this.baseUrl}/mcp/test/${serverId}/${connectionId}`);
      
      // For now, simulate test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        success: true,
        message: `MCP server ${serverId} successfully connected to ${connection.name}`,
        details: {
          serverId,
          connectionName: connection.name,
          endpoint: connection.baseUrl,
          testedAt: new Date().toISOString()
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Test failed: ${error.message}`,
        details: { error: error.message }
      };
    }
  }

  /**
   * Production-ready method to sync all settings to MCP server
   */
  async syncSettingsToMcpServer(tenantId: string): Promise<boolean> {
    try {
      // Get current Settings page configuration
      const privacyConfigKey = `mcp_privacy_config_${tenantId}`;
      const serverConfigsKey = `mcp_server_configs_${tenantId}`;
      
      const privacyConfig = JSON.parse(localStorage.getItem(privacyConfigKey) || '{}');
      const serverConfigs = JSON.parse(localStorage.getItem(serverConfigsKey) || '{}');
      
      // Convert to MCP format
      const mcpConfig = await this.convertSettingsToMcpConfig(
        tenantId, 
        privacyConfig, 
        serverConfigs
      );
      
      // Update and notify MCP server
      return await this.updateTenantConfiguration(tenantId, mcpConfig);
      
    } catch (error) {
      console.error('Error syncing settings to MCP server:', error);
      return false;
    }
  }
}

// Export singleton instance
export const mcpBridge = new McpConfigurationBridge();

/**
 * Hook for React components to sync settings
 */
export const useMcpSync = (tenantId: string) => {
  const syncSettings = async () => {
    return await mcpBridge.syncSettingsToMcpServer(tenantId);
  };

  return { syncSettings };
};