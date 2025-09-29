/**
 * MCP Setup Utilities
 * Helper functions to configure MCP servers for tenants
 * Provides easy setup for common configurations like Archer GRC
 */

import { mcpBridge } from './mcpBridge';
import { mcpConnectionManager } from './mcpConnectionManager';

export interface SetupMCPServerRequest {
  tenantId: string;
  serverType: 'archer-grc' | 'custom';
  serverId: string;
  connectionId: string; // Reference to stored credentials
  privacySettings?: {
    enableMasking?: boolean;
    maskingLevel?: 'light' | 'moderate' | 'strict';
    enableTokenization?: boolean;
    customSensitiveFields?: string[];
  };
  performanceSettings?: {
    pageSize?: number;
    requestTimeout?: number;
    enableCaching?: boolean;
  };
}

export interface MCPServerSetupResult {
  success: boolean;
  serverId?: string;
  error?: string;
  healthCheck?: {
    isHealthy: boolean;
    responseTime?: number;
    availableTools?: number;
  };
}

/**
 * Set up Archer GRC MCP server for a tenant
 */
export async function setupArcherMCPServer(
  tenantId: string,
  connectionId: string,
  options: {
    enablePrivacyMasking?: boolean;
    maskingLevel?: 'light' | 'moderate' | 'strict';
    enableCaching?: boolean;
  } = {}
): Promise<MCPServerSetupResult> {
  try {
    const uuid = crypto.randomUUID();
    const serverId = `mcp-${uuid}`;
    
    console.log(`[MCP Setup] Setting up MCP server ${serverId} for tenant: ${tenantId}`);

    // Create MCP server configuration
    const serverConfig = {
      serverId,
      connectionId,
      privacyConfig: {
        enableMasking: options.enablePrivacyMasking ?? true,
        maskingLevel: options.maskingLevel ?? 'moderate',
        enableTokenization: false,
        customSensitiveFields: [
          'owner', 'manager', 'contact', 'person', 'employee', 
          'coordinator', 'lead', 'representative', 'name'
        ],
      },
      performanceConfig: {
        pageSize: 500,
        requestTimeout: 30000,
        maxRetries: 3,
        enableCaching: options.enableCaching ?? true,
        enableBackgroundSync: true,
      },
      lastUpdated: new Date().toISOString(),
    };

    // Get or create tenant MCP configuration
    let mcpConfig = await mcpBridge.getTenantConfiguration(tenantId);
    
    if (!mcpConfig) {
      mcpConfig = {
        tenantId,
        servers: {},
        globalSettings: {
          defaultMaskingLevel: options.maskingLevel ?? 'moderate',
          enableAuditLogging: true,
        },
      };
    }

    // Add the new server configuration
    mcpConfig.servers[serverId] = serverConfig;

    // Save the configuration
    const saveSuccess = await mcpBridge.updateTenantConfiguration(tenantId, mcpConfig);
    
    if (!saveSuccess) {
      return {
        success: false,
        error: 'Failed to save MCP server configuration'
      };
    }

    // Initialize the connection in the connection manager
    await mcpConnectionManager.initializeTenantConnections(tenantId);

    // Perform health check
    const connection = mcpConnectionManager.getTenantConnection(tenantId, serverId);
    const healthCheck = {
      isHealthy: connection?.isHealthy ?? false,
      responseTime: undefined as number | undefined,
      availableTools: undefined as number | undefined,
    };

    if (connection?.isHealthy) {
      try {
        const startTime = Date.now();
        const response = await fetch(`${connection.endpoint}/tools`);
        healthCheck.responseTime = Date.now() - startTime;
        
        if (response.ok) {
          const data = await response.json();
          healthCheck.availableTools = data.tools?.length || 0;
        }
      } catch (error) {
        console.warn('[MCP Setup] Health check details failed:', error);
      }
    }

    console.log(`[MCP Setup] Successfully configured Archer GRC MCP server: ${serverId}`);
    
    return {
      success: true,
      serverId,
      healthCheck,
    };

  } catch (error) {
    console.error('[MCP Setup] Failed to setup Archer MCP server:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Update MCP server privacy settings
 */
export async function updateMCPPrivacySettings(
  tenantId: string,
  serverId: string,
  privacySettings: {
    enableMasking: boolean;
    maskingLevel: 'light' | 'moderate' | 'strict';
    enableTokenization: boolean;
    customSensitiveFields: string[];
  }
): Promise<boolean> {
  try {
    const mcpConfig = await mcpBridge.getTenantConfiguration(tenantId);
    
    if (!mcpConfig || !mcpConfig.servers[serverId]) {
      throw new Error(`MCP server ${serverId} not found for tenant ${tenantId}`);
    }

    // Update privacy configuration
    mcpConfig.servers[serverId].privacyConfig = {
      ...mcpConfig.servers[serverId].privacyConfig,
      ...privacySettings,
    };

    mcpConfig.servers[serverId].lastUpdated = new Date().toISOString();

    // Save the updated configuration
    const success = await mcpBridge.updateTenantConfiguration(tenantId, mcpConfig);
    
    if (success) {
      // Update the connection manager
      await mcpConnectionManager.updateConnection(tenantId, serverId, mcpConfig.servers[serverId]);
    }

    return success;

  } catch (error) {
    console.error('[MCP Setup] Failed to update privacy settings:', error);
    return false;
  }
}

/**
 * Get MCP server status for a tenant
 */
export async function getMCPServerStatus(tenantId: string): Promise<{
  configuredServers: number;
  healthyServers: number;
  servers: Array<{
    serverId: string;
    isHealthy: boolean;
    lastHealthCheck?: string;
    connectionId: string;
    privacyEnabled: boolean;
    availableTools?: number;
  }>;
}> {
  try {
    const mcpConfig = await mcpBridge.getTenantConfiguration(tenantId);
    const connections = mcpConnectionManager.getTenantConnections(tenantId);
    
    if (!mcpConfig) {
      return {
        configuredServers: 0,
        healthyServers: 0,
        servers: []
      };
    }

    const servers = [];
    let healthyCount = 0;

    for (const [serverId, serverConfig] of Object.entries(mcpConfig.servers)) {
      const connection = connections.find(c => c.serverId === serverId);
      const isHealthy = connection?.isHealthy ?? false;
      
      if (isHealthy) healthyCount++;

      servers.push({
        serverId,
        isHealthy,
        lastHealthCheck: connection?.lastHealthCheck,
        connectionId: serverConfig.connectionId,
        privacyEnabled: serverConfig.privacyConfig?.enableMasking ?? false,
      });
    }

    return {
      configuredServers: Object.keys(mcpConfig.servers).length,
      healthyServers: healthyCount,
      servers
    };

  } catch (error) {
    console.error('[MCP Setup] Failed to get server status:', error);
    return {
      configuredServers: 0,
      healthyServers: 0,
      servers: []
    };
  }
}

/**
 * Remove MCP server configuration
 */
export async function removeMCPServer(tenantId: string, serverId: string): Promise<boolean> {
  try {
    const mcpConfig = await mcpBridge.getTenantConfiguration(tenantId);
    
    if (!mcpConfig || !mcpConfig.servers[serverId]) {
      return false; // Server doesn't exist
    }

    // Remove from configuration
    delete mcpConfig.servers[serverId];

    // Save updated configuration
    const success = await mcpBridge.updateTenantConfiguration(tenantId, mcpConfig);
    
    if (success) {
      // Remove from connection manager
      mcpConnectionManager.removeConnection(tenantId, serverId);
    }

    console.log(`[MCP Setup] Removed MCP server: ${serverId} for tenant: ${tenantId}`);
    return success;

  } catch (error) {
    console.error('[MCP Setup] Failed to remove MCP server:', error);
    return false;
  }
}

/**
 * Test MCP server connection
 */
export async function testMCPServerConnection(
  tenantId: string,
  serverId?: string
): Promise<{
  success: boolean;
  responseTime?: number;
  availableTools?: number;
  error?: string;
}> {
  try {
    const connection = mcpConnectionManager.getTenantConnection(tenantId, serverId);
    
    if (!connection) {
      return {
        success: false,
        error: 'No MCP connection found'
      };
    }

    const startTime = Date.now();
    const response = await fetch(`${connection.endpoint}/tools`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    return {
      success: true,
      responseTime,
      availableTools: data.tools?.length || 0
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}