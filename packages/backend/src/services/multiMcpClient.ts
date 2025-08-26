import { McpServerDefinition, TenantMcpServerConfiguration, McpToolExecutionRequest, McpToolExecutionResult, McpServerHealth, McpTool } from '../types/mcp';
import { agentConfigService } from './agentConfigService';
import { credentialsManager } from './credentialsService';

/**
 * Enhanced MCP Client with multi-server routing capabilities
 * Handles routing tool calls to appropriate MCP servers based on agent configuration
 * Implements health checking, failover, and comprehensive security
 */
export class MultiMcpClient {
  private serverConnections = new Map<string, ServerConnection>();
  private serverHealthCache = new Map<string, McpServerHealth>();
  private healthCheckInterval = 30000; // 30 seconds
  private requestTimeout = 30000; // 30 seconds

  constructor() {
    // Start periodic health checking
    this.startHealthMonitoring();
  }

  /**
   * Get tools available to a specific agent from all enabled MCP servers
   * @param tenantId - Tenant ID for isolation
   * @param agentId - Agent ID
   */
  async getAgentTools(tenantId: string, agentId: string): Promise<McpTool[]> {
    // Validate input parameters
    this.validateParameters({ tenantId, agentId });

    // Get agent's enabled MCP servers
    const enabledServers = await agentConfigService.getEnabledMcpServers(tenantId, agentId);
    
    if (enabledServers.length === 0) {
      console.warn(`[Multi MCP Client] No enabled servers found for agent ${agentId} in tenant ${tenantId}`);
      return [];
    }

    console.log(`[Multi MCP Client] Loading tools for agent ${agentId} from ${enabledServers.length} servers`);

    const allTools: McpTool[] = [];
    const toolLoadPromises = enabledServers.map(async (serverConfig) => {
      try {
        const serverDefinition = await agentConfigService.getMcpServerDefinition(serverConfig.serverId);
        if (!serverDefinition) {
          console.error(`[Multi MCP Client] Server definition not found: ${serverConfig.serverId}`);
          return [];
        }

        // Check server health before attempting to load tools
        const health = await this.checkServerHealth(serverDefinition);
        if (health.status !== 'healthy') {
          console.warn(`[Multi MCP Client] Server ${serverConfig.serverId} is unhealthy: ${health.status}`);
          return [];
        }

        // Get tools from this server
        const serverTools = await this.getServerTools(serverDefinition, serverConfig);
        return serverTools;
        
      } catch (error) {
        console.error(`[Multi MCP Client] Error loading tools from server ${serverConfig.serverId}:`, error);
        return [];
      }
    });

    // Wait for all tool loading to complete
    const toolResults = await Promise.allSettled(toolLoadPromises);
    
    toolResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allTools.push(...result.value);
      } else {
        console.error(`[Multi MCP Client] Failed to load tools from server ${enabledServers[index].serverId}:`, result.reason);
      }
    });

    console.log(`[Multi MCP Client] Loaded ${allTools.length} tools from ${enabledServers.length} servers for agent ${agentId}`);
    return allTools;
  }

  /**
   * Execute a tool call by routing to the appropriate MCP server
   * @param request - Tool execution request
   */
  async executeToolCall(request: McpToolExecutionRequest): Promise<McpToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Validate request parameters
      this.validateExecutionRequest(request);

      console.log(`[Multi MCP Client] Executing tool ${request.toolName} for tenant ${request.tenantId}, agent ${request.agentId || 'unknown'}`);

      // Find the server that provides this tool
      const serverConfig = await this.findServerForTool(request.tenantId, request.agentId!, request.toolName);
      if (!serverConfig) {
        throw new Error(`No server found that provides tool: ${request.toolName}`);
      }

      const serverDefinition = await agentConfigService.getMcpServerDefinition(serverConfig.serverId);
      if (!serverDefinition) {
        throw new Error(`Server definition not found: ${serverConfig.serverId}`);
      }

      // Check server health before executing
      const health = await this.checkServerHealth(serverDefinition);
      if (health.status !== 'healthy') {
        throw new Error(`Server ${serverConfig.serverId} is unhealthy: ${health.status}`);
      }

      // Get or cache credentials
      const credentials = await this.getExecutionCredentials(request);

      // Execute the tool call
      const result = await this.executeOnServer(serverDefinition, serverConfig, {
        toolName: request.toolName,
        arguments: {
          ...request.arguments,
          tenant_id: request.tenantId,
          connection_id: request.connectionId,
          agent_id: request.agentId,
          enabled_servers: request.enabledMcpServers,
          // Pass credentials as archer_connection for MCP server compatibility
          archer_connection: credentials
        },
        credentials
      });

      const processingTime = Date.now() - startTime;

      // Update usage metrics
      await this.updateUsageMetrics(serverConfig, processingTime, true);

      return {
        success: true,
        result,
        toolName: request.toolName,
        serverId: serverConfig.serverId,
        agentId: request.agentId,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[Multi MCP Client] Tool execution failed:`, error);

      return {
        success: false,
        error: errorMessage,
        toolName: request.toolName,
        serverId: 'unknown',
        agentId: request.agentId,
        processingTime
      };
    }
  }

  /**
   * Get health status for all servers accessible to a tenant
   * @param tenantId - Tenant ID
   */
  async getTenantServerHealth(tenantId: string): Promise<McpServerHealth[]> {
    this.validateParameters({ tenantId });

    // For now, return health for default servers
    // In production, this would query tenant-specific enabled servers
    const serverIds = ['archer-mcp-server', 'compliance-mcp-server', 'risk-analytics-mcp-server'];
    
    const healthPromises = serverIds.map(async (serverId) => {
      const serverDefinition = await agentConfigService.getMcpServerDefinition(serverId);
      if (!serverDefinition) {
        return {
          serverId,
          status: 'unknown' as const,
          responseTime: 0,
          lastCheck: new Date().toISOString(),
          error: 'Server definition not found',
          endpoint: 'unknown'
        };
      }

      return await this.checkServerHealth(serverDefinition);
    });

    const healthResults = await Promise.allSettled(healthPromises);
    
    return healthResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          serverId: serverIds[index],
          status: 'unknown' as const,
          responseTime: 0,
          lastCheck: new Date().toISOString(),
          error: result.reason?.message || 'Health check failed',
          endpoint: 'unknown'
        };
      }
    });
  }

  /**
   * Check health of a specific MCP server
   * @param serverDefinition - Server definition
   */
  async checkServerHealth(serverDefinition: McpServerDefinition): Promise<McpServerHealth> {
    const startTime = Date.now();
    
    // Check cache first
    const cachedHealth = this.serverHealthCache.get(serverDefinition.id);
    if (cachedHealth && (Date.now() - new Date(cachedHealth.lastCheck).getTime()) < this.healthCheckInterval) {
      return cachedHealth;
    }

    try {
      const response = await fetch(serverDefinition.healthEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout for health checks
      });

      const responseTime = Date.now() - startTime;
      const health: McpServerHealth = {
        serverId: serverDefinition.id,
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        endpoint: serverDefinition.endpoint
      };

      if (!response.ok) {
        health.error = `HTTP ${response.status}: ${response.statusText}`;
        health.status = 'unhealthy';
      }

      // Cache the health result
      this.serverHealthCache.set(serverDefinition.id, health);
      return health;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const health: McpServerHealth = {
        serverId: serverDefinition.id,
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: serverDefinition.endpoint
      };

      // Cache the failed health result
      this.serverHealthCache.set(serverDefinition.id, health);
      return health;
    }
  }

  /**
   * Get tools from a specific MCP server
   */
  private async getServerTools(serverDefinition: McpServerDefinition, serverConfig: TenantMcpServerConfiguration): Promise<McpTool[]> {
    try {
      const response = await fetch(`${serverDefinition.endpoint}/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.requestTimeout)
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const tools = data.tools || [];

      // Enhance tools with server information
      return tools.map((tool: any) => ({
        ...tool,
        serverId: serverDefinition.id,
        riskLevel: tool.riskLevel || 'medium',
        complianceImpact: tool.complianceImpact || []
      }));

    } catch (error) {
      console.error(`[Multi MCP Client] Error fetching tools from ${serverDefinition.id}:`, error);
      return [];
    }
  }

  /**
   * Find which server provides a specific tool for an agent
   */
  private async findServerForTool(tenantId: string, agentId: string, toolName: string): Promise<TenantMcpServerConfiguration | null> {
    const enabledServers = await agentConfigService.getEnabledMcpServers(tenantId, agentId);
    
    for (const serverConfig of enabledServers) {
      const serverDefinition = await agentConfigService.getMcpServerDefinition(serverConfig.serverId);
      if (serverDefinition) {
        const tools = await this.getServerTools(serverDefinition, serverConfig);
        if (tools.some(tool => tool.name === toolName)) {
          return serverConfig;
        }
      }
    }

    return null;
  }

  /**
   * Execute tool on a specific server
   */
  private async executeOnServer(serverDefinition: McpServerDefinition, serverConfig: TenantMcpServerConfiguration, request: any): Promise<any> {
    const response = await fetch(`${serverDefinition.endpoint}/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: request.toolName,
        arguments: request.arguments,
        credentials: request.credentials
      }),
      signal: AbortSignal.timeout(serverConfig.serverConfig.timeout)
    });

    if (!response.ok) {
      throw new Error(`Tool execution failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get execution credentials for the request
   */
  private async getExecutionCredentials(request: McpToolExecutionRequest): Promise<any> {
    if (request.credentials) {
      // Cache the provided credentials
      await credentialsManager.cacheCredentials(request.tenantId, request.connectionId, request.credentials);
      return request.credentials;
    }

    // Get cached credentials
    const credentials = await credentialsManager.getCredentials(request.tenantId, request.connectionId);
    if (!credentials) {
      throw new Error('Credentials must be provided for MCP tool calls');
    }

    return credentials;
  }

  /**
   * Update usage metrics for a server configuration
   */
  private async updateUsageMetrics(serverConfig: TenantMcpServerConfiguration, processingTime: number, success: boolean): Promise<void> {
    // In production, this would update the database
    // For now, just log the metrics
    console.log(`[Multi MCP Client] Usage metrics - Server: ${serverConfig.serverId}, Time: ${processingTime}ms, Success: ${success}`);
  }

  /**
   * Start periodic health monitoring for all servers
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      try {
        // Clear cache to force fresh health checks
        this.serverHealthCache.clear();
        console.log('[Multi MCP Client] Performing periodic health check');
      } catch (error) {
        console.error('[Multi MCP Client] Error during periodic health check:', error);
      }
    }, this.healthCheckInterval);
  }

  /**
   * Validate common parameters
   */
  private validateParameters(params: Record<string, any>): void {
    for (const [key, value] of Object.entries(params)) {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        throw new Error(`${key} is required and cannot be empty`);
      }
    }
  }

  /**
   * Validate tool execution request
   */
  private validateExecutionRequest(request: McpToolExecutionRequest): void {
    if (!request.toolName?.trim()) {
      throw new Error('Tool name is required');
    }
    if (!request.tenantId?.trim()) {
      throw new Error('Tenant ID is required');  
    }
    if (!request.connectionId?.trim()) {
      throw new Error('Connection ID is required');
    }
    if (!request.arguments || typeof request.arguments !== 'object') {
      throw new Error('Arguments must be provided as an object');
    }
  }
}

interface ServerConnection {
  endpoint: string;
  connected: boolean;
  lastUsed: string;
  errorCount: number;
}

// Singleton instance
export const multiMcpClient = new MultiMcpClient();