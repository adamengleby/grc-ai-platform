/**
 * MCP Registry Client
 * Gets MCP server connection info from backend registry
 * Frontend uses this to discover which MCP servers to connect to
 */

export interface MCPServerInfo {
  server_id: string;
  server_name: string;
  display_name: string;
  description: string;
  category: string;
  server_type: 'stdio' | 'sse' | 'http';
  endpoint: string;
  health_endpoint?: string;
  is_enabled: boolean;
  available_tools: string[];
  allowed_tools: string[];
  custom_name?: string;
  configuration_values: Record<string, any>;
}

export interface MCPServerRegistry {
  mcp_servers: MCPServerInfo[];
  total: number;
  tenant_id: string;
}

export class MCPRegistryClient {
  private readonly backendUrl = import.meta.env.DEV
    ? 'http://localhost:3005/api/v1'
    : 'https://func-grc-backend-prod.azurewebsites.net/api/v1';

  /**
   * Get enabled MCP servers for current tenant from backend registry
   */
  async getEnabledMCPServers(): Promise<MCPServerRegistry> {
    try {
      const response = await fetch(`${this.backendUrl}/simple-mcp-configs`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get MCP servers: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get MCP servers');
      }

      return data.data;
    } catch (error) {
      console.error('[MCP Registry] Error getting enabled servers:', error);
      throw error;
    }
  }

  /**
   * Get available MCP servers from registry (for enabling)
   */
  async getAvailableMCPServers(): Promise<MCPServerInfo[]> {
    try {
      const response = await fetch(`${this.backendUrl}/simple-mcp-configs/registry`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get MCP registry: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get MCP registry');
      }

      return data.data.servers || [];
    } catch (error) {
      console.error('[MCP Registry] Error getting available servers:', error);
      throw error;
    }
  }

  /**
   * Get direct SSE connection info for a specific MCP server
   */
  getMCPServerEndpoint(serverId: string): { sseUrl: string; toolsUrl: string } {
    // For now, all MCP servers use the same MCP standard endpoint
    // In production, different servers might have different endpoints
    const baseUrl = 'http://localhost:3006';
    
    return {
      sseUrl: `${baseUrl}/mcp`,  // MCP standard endpoint for SSE
      toolsUrl: `${baseUrl}/mcp` // MCP standard endpoint for tools
    };
  }

  /**
   * Test connection to an MCP server
   */
  async testMCPServerConnection(serverId: string): Promise<{ healthy: boolean; responseTime?: number; error?: string }> {
    try {
      const endpoints = this.getMCPServerEndpoint(serverId);
      const startTime = Date.now();
      
      const response = await fetch(`${endpoints.toolsUrl.replace('/mcp', '/health')}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          healthy: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const healthData = await response.json();
      
      return {
        healthy: healthData.status === 'healthy',
        responseTime,
        error: healthData.status !== 'healthy' ? 'Server reported unhealthy status' : undefined
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Singleton instance
export const mcpRegistryClient = new MCPRegistryClient();