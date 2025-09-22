/**
 * MCP Connection Manager
 * Manages dynamic MCP server connections based on tenant configuration
 * Replaces hardcoded connections with configurable MCP settings
 */

import { ArcherCredentials, getAllCredentials } from './credentialsApi';

export interface MCPConnection {
  serverId: string;
  endpoint: string;
  credentials?: ArcherCredentials;
  privacyConfig: {
    enableMasking: boolean;
    maskingLevel: 'light' | 'moderate' | 'strict';
    enableTokenization: boolean;
  };
  isHealthy: boolean;
  lastHealthCheck?: string;
}

class MCPConnectionManager {
  private connections: Map<string, MCPConnection> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize MCP connections for a tenant based on their configuration
   */
  async initializeTenantConnections(tenantId: string): Promise<MCPConnection[]> {
    try {
      console.log(`[MCP Manager] Initializing connections for tenant: ${tenantId}`);
      
      // Get MCP servers directly from tenant configuration (single source of truth)
      const storageKey = `tenant_mcp_servers_${tenantId}`;
      const storedServers = localStorage.getItem(storageKey);
      
      if (!storedServers) {
        console.log(`[MCP Manager] No MCP servers configured for tenant: ${tenantId}`);
        return [];
      }

      const mcpServers = JSON.parse(storedServers);
      const enabledServers = mcpServers.filter((server: any) => server.isEnabled);
      
      if (enabledServers.length === 0) {
        console.log(`[MCP Manager] No enabled MCP servers for tenant: ${tenantId}`);
        return [];
      }

      console.log(`[MCP Manager] Found ${enabledServers.length} enabled servers:`, enabledServers.map((s: any) => s.id));

      const connections: MCPConnection[] = [];

      // Initialize connections for each enabled server
      for (const server of enabledServers) {
        try {
          console.log(`[MCP Manager] Creating connection for server: ${server.id}`);
          const connection = await this.createConnection(server.id, {
            endpoint: server.endpoint || 'http://localhost:3001',
            name: server.name,
            description: server.description
          });
          if (connection) {
            connections.push(connection);
            this.connections.set(`${tenantId}:${server.id}`, connection);
            console.log(`[MCP Manager] Successfully created connection: ${tenantId}:${server.id}`);
          }
        } catch (error) {
          console.error(`[MCP Manager] Failed to initialize server ${server.id}:`, error);
        }
      }

      // Start health checking
      this.startHealthChecking();

      console.log(`[MCP Manager] Initialized ${connections.length} connections for tenant: ${tenantId}`);
      return connections;

    } catch (error) {
      console.error(`[MCP Manager] Failed to initialize connections for tenant ${tenantId}:`, error);
      return [];
    }
  }

  /**
   * Create a single MCP connection
   */
  private async createConnection(
    serverId: string, 
    serverConfig: any
  ): Promise<MCPConnection | null> {
    try {
      // Get connection credentials
      let credentials: ArcherCredentials | undefined;
      if (serverConfig.connectionId) {
        const allCredentials = await getAllCredentials();
        credentials = allCredentials.find(c => c.id === serverConfig.connectionId);
        if (!credentials) {
          console.error(`[MCP Manager] Credentials not found for connection: ${serverConfig.connectionId}`);
          return null;
        }
      }

      // Determine endpoint based on server type
      const endpoint = this.resolveServerEndpoint(serverId, serverConfig);

      const connection: MCPConnection = {
        serverId,
        endpoint,
        credentials,
        privacyConfig: {
          enableMasking: serverConfig.privacyConfig?.enableMasking ?? true,
          maskingLevel: serverConfig.privacyConfig?.maskingLevel ?? 'moderate',
          enableTokenization: serverConfig.privacyConfig?.enableTokenization ?? false,
        },
        isHealthy: false, // Will be determined by health check
      };

      // Perform initial health check
      connection.isHealthy = await this.checkConnectionHealth(connection);
      connection.lastHealthCheck = new Date().toISOString();

      console.log(`[MCP Manager] Created connection for server ${serverId}: healthy=${connection.isHealthy}`);
      return connection;

    } catch (error) {
      console.error(`[MCP Manager] Error creating connection for server ${serverId}:`, error);
      return null;
    }
  }

  /**
   * Resolve server endpoint based on configuration
   */
  private resolveServerEndpoint(_serverId: string, serverConfig: any): string {
    // For production, this would dynamically resolve endpoints
    // based on server registry, deployment configuration, etc.
    
    // Use endpoint from server config if available, otherwise default to backend port 3005
    return serverConfig.endpoint || 'http://localhost:3005';
  }

  /**
   * Get MCP connection for a tenant and optional server
   */
  getTenantConnection(tenantId: string, serverId?: string): MCPConnection | null {
    if (serverId) {
      return this.connections.get(`${tenantId}:${serverId}`) || null;
    }

    // Return first healthy connection for tenant
    for (const [key, connection] of this.connections.entries()) {
      if (key.startsWith(`${tenantId}:`) && connection.isHealthy) {
        return connection;
      }
    }

    return null;
  }

  /**
   * Get all connections for a tenant
   */
  getTenantConnections(tenantId: string): MCPConnection[] {
    const connections: MCPConnection[] = [];
    
    for (const [key, connection] of this.connections.entries()) {
      if (key.startsWith(`${tenantId}:`)) {
        connections.push(connection);
      }
    }
    
    return connections;
  }

  /**
   * Check health of a connection
   */
  private async checkConnectionHealth(connection: MCPConnection): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${connection.endpoint}/tools`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      clearTimeout(timeoutId);
      return response.ok;

    } catch (error) {
      console.warn(`[MCP Manager] Health check failed for ${connection.serverId}:`, error);
      return false;
    }
  }

  /**
   * Start periodic health checking
   */
  private startHealthChecking(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      for (const [, connection] of this.connections.entries()) {
        connection.isHealthy = await this.checkConnectionHealth(connection);
        connection.lastHealthCheck = new Date().toISOString();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health checking
   */
  stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Update connection configuration
   */
  async updateConnection(tenantId: string, serverId: string, serverConfig: any): Promise<boolean> {
    try {
      const connectionKey = `${tenantId}:${serverId}`;
      // Create new connection with updated config
      const newConnection = await this.createConnection(serverId, serverConfig);
      
      if (newConnection) {
        this.connections.set(connectionKey, newConnection);
        console.log(`[MCP Manager] Updated connection for ${serverId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[MCP Manager] Failed to update connection ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Remove connection
   */
  removeConnection(tenantId: string, serverId: string): void {
    const connectionKey = `${tenantId}:${serverId}`;
    this.connections.delete(connectionKey);
    console.log(`[MCP Manager] Removed connection for ${serverId}`);
  }

  /**
   * Get connection health status
   */
  getConnectionHealthStatus(): Array<{
    tenantId: string;
    serverId: string;
    isHealthy: boolean;
    lastHealthCheck?: string;
    endpoint: string;
  }> {
    const status = [];
    
    for (const [connectionKey, connection] of this.connections.entries()) {
      const [tenantId, serverId] = connectionKey.split(':');
      status.push({
        tenantId,
        serverId,
        isHealthy: connection.isHealthy,
        lastHealthCheck: connection.lastHealthCheck,
        endpoint: connection.endpoint,
      });
    }
    
    return status;
  }

  /**
   * Clean up connections
   */
  cleanup(): void {
    this.stopHealthChecking();
    this.connections.clear();
    console.log('[MCP Manager] Cleaned up all connections');
  }
}

// Export singleton instance
export const mcpConnectionManager = new MCPConnectionManager();