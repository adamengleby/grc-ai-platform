/**
 * Backend Database MCP Configurations API
 * COMPLETE REPLACEMENT for localStorage-based MCP server configurations
 * Uses our new database-backed backend APIs instead of localStorage
 */

export interface MCPServerConfig {
  tenant_server_id: string;
  tenant_id: string;
  server_id: string;
  is_enabled: boolean;
  custom_name: string;
  configuration_values: Record<string, any>;
  allowed_tools: string[];
  usage_count: number;
  health_status: string;
  last_health_check?: string;
  enabled_at: string;
  enabled_by_user_id: string;
  server_name: string;
  display_name: string;
  description: string;
  category: string;
  server_type: string;
  available_tools: string[];
  is_approved: number;
  security_review_status: string;
}

export interface MCPRegistryServer {
  server_id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  server_type: string;
  available_tools: string[];
  is_approved: number;
  security_review_status: string;
  version: string;
  documentation_url?: string;
  created_at: string;
}

class BackendMcpConfigsManager {
  private tenantId: string | null = null;
  private baseUrl = '/api/v1'; // Uses Vite proxy in development

  /**
   * Set tenant context for secure partitioning
   */
  setTenantContext(tenantId: string): void {
    this.tenantId = tenantId;
    console.log(`🔄 [Backend MCP Configs] Set tenant context: ${tenantId}`);
  }

  /**
   * Initialize - no longer needs localStorage setup since backend handles it
   */
  async initialize(): Promise<void> {
    console.log('✅ [Backend MCP Configs] Initialized - using database backend');
    // No initialization needed - backend handles storage
  }

  /**
   * Get all MCP server configurations for the tenant
   * REPLACES: localStorage.getItem(`tenant_mcp_servers_${tenantId}`)
   */
  async getAllMcpConfigs(): Promise<MCPServerConfig[]> {
    if (!this.tenantId) {
      throw new Error('Tenant context not set. Call setTenantContext() first.');
    }

    try {
      console.log('🔍 [Backend MCP Configs] Loading configurations from database...');
      
      const response = await fetch(`${this.baseUrl}/simple-mcp-configs`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load MCP configurations: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load MCP configurations');
      }

      console.log(`✅ [Backend MCP Configs] Loaded ${data.data.mcp_servers.length} configurations from database`);
      return data.data.mcp_servers;
    } catch (error) {
      console.error('❌ [Backend MCP Configs] Failed to load configurations:', error);
      throw error;
    }
  }

  /**
   * Get available MCP servers from registry
   * REPLACES: hardcoded MCP server list
   */
  async getRegistryServers(): Promise<MCPRegistryServer[]> {
    try {
      console.log('🔍 [Backend MCP Configs] Loading registry servers...');
      
      const response = await fetch(`${this.baseUrl}/simple-mcp-configs/registry`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load MCP registry: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load MCP registry');
      }

      console.log(`✅ [Backend MCP Configs] Loaded ${data.data.registry_servers.length} registry servers`);
      return data.data.registry_servers;
    } catch (error) {
      console.error('❌ [Backend MCP Configs] Failed to load registry servers:', error);
      throw error;
    }
  }

  /**
   * Enable MCP server from registry for tenant
   * REPLACES: localStorage.setItem with new MCP server added to array
   */
  async enableMcpServer(config: {
    server_id: string;
    custom_name?: string;
    configuration_values?: Record<string, any>;
    allowed_tools?: string[];
  }): Promise<MCPServerConfig> {
    if (!this.tenantId) {
      throw new Error('Tenant context not set. Call setTenantContext() first.');
    }

    try {
      console.log('➕ [Backend MCP Configs] Enabling MCP server:', config.server_id);

      const response = await fetch(`${this.baseUrl}/simple-mcp-configs/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to enable MCP server: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to enable MCP server');
      }

      console.log('✅ [Backend MCP Configs] MCP server enabled successfully');
      return data.data;
    } catch (error) {
      console.error('❌ [Backend MCP Configs] Failed to enable MCP server:', error);
      throw error;
    }
  }

  /**
   * Update MCP server configuration
   * REPLACES: localStorage.setItem with updated configs array
   */
  async updateMcpConfig(tenantServerId: string, updates: Partial<MCPServerConfig>): Promise<MCPServerConfig> {
    if (!this.tenantId) {
      throw new Error('Tenant context not set. Call setTenantContext() first.');
    }

    try {
      console.log('📝 [Backend MCP Configs] Updating configuration:', tenantServerId);

      const payload: any = {};
      if (updates.is_enabled !== undefined) payload.is_enabled = updates.is_enabled;
      if (updates.custom_name !== undefined) payload.custom_name = updates.custom_name;
      if (updates.configuration_values !== undefined) payload.configuration_values = updates.configuration_values;
      if (updates.allowed_tools !== undefined) payload.allowed_tools = updates.allowed_tools;

      const response = await fetch(`${this.baseUrl}/simple-mcp-configs/${tenantServerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to update MCP configuration: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update MCP configuration');
      }

      console.log('✅ [Backend MCP Configs] Configuration updated successfully');
      return data.data;
    } catch (error) {
      console.error('❌ [Backend MCP Configs] Failed to update configuration:', error);
      throw error;
    }
  }

  /**
   * Delete MCP server configuration
   */
  async deleteMcpConfig(tenantServerId: string): Promise<void> {
    if (!this.tenantId) {
      throw new Error('Tenant context not set. Call setTenantContext() first.');
    }

    try {
      console.log('🗑️ [Backend MCP Configs] Deleting configuration:', tenantServerId);

      const response = await fetch(`${this.baseUrl}/simple-mcp-configs/${tenantServerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete MCP configuration: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete MCP configuration');
      }

      console.log('✅ [Backend MCP Configs] Configuration deleted successfully');
    } catch (error) {
      console.error('❌ [Backend MCP Configs] Failed to delete configuration:', error);
      throw error;
    }
  }

  /**
   * Test database connectivity
   */
  async testDatabase(): Promise<any> {
    try {
      console.log('🧪 [Backend MCP Configs] Testing database connectivity...');

      const response = await fetch(`${this.baseUrl}/simple-mcp-configs/test-database`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Database test failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Database test failed');
      }

      console.log('✅ [Backend MCP Configs] Database test successful');
      return data.data;
    } catch (error) {
      console.error('❌ [Backend MCP Configs] Database test failed:', error);
      throw error;
    }
  }
}

// Export singleton instance - DROP-IN REPLACEMENT for existing localStorage usage
export const mcpConfigsManager = new BackendMcpConfigsManager();

// Export helper functions to match existing API patterns
export const getAllMcpConfigs = () => mcpConfigsManager.getAllMcpConfigs();
export const getRegistryServers = () => mcpConfigsManager.getRegistryServers();
export const enableMcpServer = (config: Parameters<typeof mcpConfigsManager.enableMcpServer>[0]) => 
  mcpConfigsManager.enableMcpServer(config);
export const updateMcpConfig = (tenantServerId: string, updates: Parameters<typeof mcpConfigsManager.updateMcpConfig>[1]) => 
  mcpConfigsManager.updateMcpConfig(tenantServerId, updates);
export const deleteMcpConfig = (tenantServerId: string) => mcpConfigsManager.deleteMcpConfig(tenantServerId);