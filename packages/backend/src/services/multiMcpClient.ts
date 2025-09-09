import { McpServerDefinition, TenantMcpServerConfiguration, McpToolExecutionRequest, McpToolExecutionResult, McpServerHealth, McpTool } from '../types/mcp';
import { agentConfigService } from './agentConfigService';
import { credentialsManager } from './credentialsService';
import { DatabaseService } from './databaseService';
import EventSource from 'eventsource';

/**
 * Enhanced MCP Client with SSE transport and multi-server routing capabilities
 * Handles routing tool calls to appropriate MCP servers based on agent configuration
 * Implements SSE connections, health checking, failover, and comprehensive security
 */
export class MultiMcpClient {
  private serverConnections = new Map<string, SSEServerConnection>();
  private serverHealthCache = new Map<string, McpServerHealth>();
  private healthCheckInterval = 120000; // 2 minutes - reduced frequency to improve performance
  private requestTimeout = 30000; // 30 seconds
  private db: DatabaseService;
  private messageId = 1;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: any) => void;
  }>();

  constructor() {
    this.db = DatabaseService.getInstance();
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

      // Handle authentication based on MCP server configuration
      let authData;
      
      // Check if MCP server is configured for session-based authentication
      const configValues = typeof serverConfig.configuration_values === 'string' 
        ? JSON.parse(serverConfig.configuration_values) 
        : serverConfig.configuration_values;
      
      let authMode = configValues?.authMode || 'credentials'; // Default to credentials for backward compatibility
      
      // Force session mode if we have session data available (override config)
      if (request.sessionToken && request.userInfo) {
        authMode = 'session';
      }
      
      if (authMode === 'session' && request.sessionToken && request.userInfo) {
        // Session-based authentication
        console.log(`[Multi MCP Client] Using session-based authentication for user: ${request.userInfo.username}`);
        authData = {
          sessionToken: request.sessionToken,
          baseUrl: request.userInfo.baseUrl,
          username: request.userInfo.username,
          instanceId: request.userInfo.instanceId
        };
      } else if (authMode === 'session' && (!request.sessionToken || !request.userInfo)) {
        // Session mode but no session data available
        throw new Error('MCP server configured for session-based authentication but no session token provided. Please authenticate first.');
      } else {
        // Credential-based authentication
        console.log(`[Multi MCP Client] Using credential-based authentication (authMode: ${authMode})`);
        authData = await this.getExecutionCredentials(request);
      }

      // Execute the tool call
      const result = await this.executeOnServer(serverDefinition, serverConfig, {
        toolName: request.toolName,
        arguments: {
          ...request.arguments,
          tenant_id: request.tenantId,
          connection_id: request.connectionId,
          agent_id: request.agentId,
          enabled_servers: request.enabledMcpServers,
          // Pass auth data as archer_connection for MCP server compatibility
          archer_connection: authData
        },
        credentials: authData
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
   * Get tools from a specific MCP server via SSE
   */
  private async getServerTools(serverDefinition: McpServerDefinition, serverConfig: TenantMcpServerConfiguration): Promise<McpTool[]> {
    try {
      // For SSE servers, use the direct /tools endpoint
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
   * Execute tool on a specific server via SSE
   */
  private async executeOnServer(serverDefinition: McpServerDefinition, serverConfig: TenantMcpServerConfiguration, request: any): Promise<any> {
    // Get or create SSE connection for this server
    const connection = await this.getSSEConnection(serverDefinition);
    
    // Prepare MCP JSON-RPC request
    const requestId = this.messageId++;
    const mcpRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: request.toolName,
        arguments: {
          ...request.arguments,
          // Include auth data for MCP server compatibility
          archer_connection: request.credentials
        }
      }
    };

    console.log(`[Multi MCP Client] Executing tool via SSE: ${request.toolName}`);

    return new Promise(async (resolve, reject) => {
      // Store request for response handling
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        onProgress: request.onProgress
      });

      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Tool call timeout: ${request.toolName}`));
      }, serverConfig.serverConfig.timeout || 30000);

      try {
        // Send request via POST to SSE server
        const response = await fetch(connection.messageEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mcpRequest)
        });

        if (!response.ok) {
          clearTimeout(timeout);
          this.pendingRequests.delete(requestId);
          reject(new Error(`HTTP request failed: ${response.status}`));
        }

        // Response will come via SSE stream
        console.log(`[Multi MCP Client] Request sent, waiting for SSE response...`);
        
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
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

    // For MCP server execution, we need the REAL decrypted password from the database
    // Get the actual credential from database with decrypted password
    try {
      const credentialResult = await this.db.query(`
        SELECT 
          credential_id as id,
          name,
          base_url as baseUrl,
          username,
          encrypted_password,
          instance_id as instanceId,
          instance_name as instanceName,
          user_domain_id as userDomainId,
          is_default as isDefault,
          created_at as created,
          last_tested_at as lastTested,
          test_status as status,
          last_error as lastError
        FROM connection_credentials 
        WHERE credential_id = ? AND tenant_id = ? AND deleted_at IS NULL
        LIMIT 1
      `, [request.connectionId, request.tenantId]);

      if (credentialResult.length === 0) {
        throw new Error(`Connection credential ${request.connectionId} not found for tenant ${request.tenantId}`);
      }

      const credential = credentialResult[0];
      
      // Decrypt password (simple decryption - remove 'encrypted_' prefix)
      const decryptedPassword = credential.encrypted_password?.replace('encrypted_', '') || '';
      
      return {
        id: credential.id,
        name: credential.name,
        baseUrl: credential.baseUrl,
        username: credential.username,
        password: decryptedPassword, // Real decrypted password for MCP server
        instanceId: credential.instanceId,
        instanceName: credential.instanceName,
        userDomainId: credential.userDomainId || '1',
        isDefault: credential.isDefault === 1,
        created: credential.created,
        lastTested: credential.lastTested,
        status: credential.status === 'success' ? 'connected' : 'disconnected',
        lastError: credential.lastError
      };
    } catch (error) {
      console.error(`[Multi MCP Client] Failed to load credentials for connection ${request.connectionId}:`, error);
      throw new Error('Failed to load credentials for MCP tool execution');
    }
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
   * Get or create SSE connection for a server
   */
  private async getSSEConnection(serverDefinition: McpServerDefinition): Promise<SSEServerConnection> {
    const existingConnection = this.serverConnections.get(serverDefinition.id);
    
    if (existingConnection?.isConnected) {
      return existingConnection;
    }

    console.log(`[Multi MCP Client] Establishing SSE connection to ${serverDefinition.id}...`);

    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(`${serverDefinition.endpoint}/sse`);
      
      eventSource.onopen = () => {
        console.log(`[Multi MCP Client] SSE connection established for ${serverDefinition.id}`);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`[Multi MCP Client] Received SSE message from ${serverDefinition.id}:`, data);

          // Handle endpoint announcement (first message)
          if (data.type === 'endpoint') {
            const connection: SSEServerConnection = {
              serverId: serverDefinition.id,
              sessionId: data.sessionId,
              eventSource,
              messageEndpoint: `${serverDefinition.endpoint}/messages/${data.sessionId}`,
              isConnected: true,
              lastUsed: new Date().toISOString(),
              errorCount: 0
            };

            this.serverConnections.set(serverDefinition.id, connection);
            console.log(`[Multi MCP Client] Session established for ${serverDefinition.id}: ${data.sessionId}`);
            resolve(connection);
          }
          // Handle tool responses
          else if (data.id && this.pendingRequests.has(data.id)) {
            const request = this.pendingRequests.get(data.id)!;
            
            if (data.error) {
              request.reject(new Error(data.error.message || 'MCP tool call failed'));
            } else {
              request.resolve(data.result);
            }
            
            this.pendingRequests.delete(data.id);
          }
          // Handle progress updates
          else if (data.type === 'progress' && data.requestId && this.pendingRequests.has(data.requestId)) {
            const request = this.pendingRequests.get(data.requestId);
            if (request?.onProgress) {
              request.onProgress({
                tool: data.tool,
                progress: data.progress,
                status: data.status,
                data: data.data,
                timestamp: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.error(`[Multi MCP Client] Error parsing SSE message from ${serverDefinition.id}:`, error);
        }
      };

      eventSource.onerror = (error) => {
        console.error(`[Multi MCP Client] SSE connection error for ${serverDefinition.id}:`, error);
        this.serverConnections.delete(serverDefinition.id);
        reject(new Error(`Failed to establish SSE connection to ${serverDefinition.id}`));
      };

      // Connection timeout
      setTimeout(() => {
        if (!this.serverConnections.has(serverDefinition.id)) {
          eventSource.close();
          reject(new Error(`SSE connection timeout for ${serverDefinition.id}`));
        }
      }, 10000);
    });
  }

  /**
   * Start periodic health monitoring for all servers
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      try {
        // Let cache expire naturally instead of forcing clears - this improves performance
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

interface SSEServerConnection {
  serverId: string;
  sessionId: string;
  eventSource: EventSource;
  messageEndpoint: string;
  isConnected: boolean;
  lastUsed: string;
  errorCount: number;
}

// Singleton instance
export const multiMcpClient = new MultiMcpClient();