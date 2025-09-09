import { config } from '@/config';

export interface ArcherCredentials {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  password: string;
  instanceId: string;
  instanceName: string;
  userDomainId: string;
  isDefault: boolean;
  created: string;
  lastTested?: string;
  status: 'connected' | 'disconnected' | 'testing' | 'error';
  lastError?: string;
}

/**
 * MCP Client for direct communication with Archer MCP Server
 * Uses MCP standard JSON-RPC protocol over HTTP transport
 * Handles real-time data retrieval from Archer GRC platform
 */
export class MCPClient {
  private isConnected = false;
  private currentCredentials: ArcherCredentials | null = null;
  private mcpServerUrl: string = 'http://localhost:3006';

  constructor() {
    // Don't initialize automatically - wait for credentials
  }

  /**
   * Initialize connection to HTTP MCP server with credentials
   */
  public async initializeMCPConnection(credentials: ArcherCredentials): Promise<void> {
    this.currentCredentials = credentials;
    try {
      console.log('[MCP Client] Connecting to HTTP MCP server...');
      console.log(`[MCP Client] Server URL: ${this.mcpServerUrl}`);
      
      // Test connection to HTTP MCP server
      const response = await fetch(`${this.mcpServerUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        this.isConnected = true;
        console.log('[MCP Client] Connected to HTTP MCP server');
      } else {
        throw new Error(`HTTP MCP server returned status: ${response.status}`);
      }

    } catch (error) {
      console.error('[MCP Client] Failed to connect to HTTP MCP server:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Make MCP JSON-RPC request with credentials injection for tool calls
   */
  private async makeMCPToolCall(toolName: string, toolArgs: any): Promise<any> {
    // Inject credentials for Archer GRC tool calls
    const params = {
      name: toolName,
      arguments: {
        ...toolArgs,
        credentials: this.currentCredentials
      }
    };

    return await this.sendMCPRequest('tools/call', params);
  }

  /**
   * Send request to MCP server using standard JSON-RPC
   */
  private async sendMCPRequest(method: string, params: any, timeoutMs = 30000): Promise<any> {
    if (!this.isConnected) {
      throw new Error('MCP server not connected');
    }

    // Use MCP standard JSON-RPC format
    const mcpRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: method,
      params: params
    };

    console.log(`[MCP Client] Sending JSON-RPC request:`, mcpRequest);

    try {
      const response = await fetch(`${this.mcpServerUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mcpRequest)
      });

      if (!response.ok) {
        throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
      }

      const jsonResponse = await response.json();
      console.log(`[MCP Client] MCP JSON-RPC response:`, jsonResponse);

      if (jsonResponse.error) {
        throw new Error(`MCP JSON-RPC error: ${jsonResponse.error.message}`);
      }

      return jsonResponse.result;
    } catch (error) {
      console.error(`[MCP Client] MCP JSON-RPC request failed:`, error);
      throw error;
    }
  }

  /**
   * Ensure MCP connection is initialized - requires credentials
   */
  private async ensureMCPConnection(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('MCP connection not initialized. Call initializeMCPConnection() with valid credentials first.');
    }
  }

  /**
   * Get Archer applications
   */
  async getArcherApplications(tenantId: string): Promise<any[]> {
    try {
      await this.ensureMCPConnection();

      const result = await this.makeMCPToolCall('get_archer_applications', {
        tenant_id: tenantId
      });

      return this.parseToolResult(result);
    } catch (error) {
      console.error('[MCP Client] Error getting applications:', error);
      throw error;
    }
  }

  /**
   * Search records in Archer application
   */
  async searchArcherRecords(tenantId: string, applicationName: string, pageSize = 100, pageNumber = 1): Promise<any> {
    try {
      await this.ensureMCPConnection();

      const result = await this.makeMCPToolCall('search_archer_records', {
        tenant_id: tenantId,
        applicationName,
        pageSize,
        pageNumber,
        includeFullData: true
      });

      return this.parseToolResult(result);
    } catch (error) {
      console.error(`[MCP Client] Error searching ${applicationName} records:`, error);
      throw error;
    }
  }

  /**
   * Get application statistics
   */
  async getArcherStats(tenantId: string, applicationName: string): Promise<any> {
    try {
      const result = await this.makeMCPToolCall('get_archer_stats', {
        tenant_id: tenantId,
        applicationName
      });

      return this.parseToolResult(result);
    } catch (error) {
      console.error(`[MCP Client] Error getting ${applicationName} stats:`, error);
      throw error;
    }
  }

  /**
   * Test Archer connection
   */
  async testArcherConnection(tenantId: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        console.error('[MCP Client] MCP not connected for connection test');
        return false;
      }

      const result = await this.makeMCPToolCall('test_archer_connection', {
        tenant_id: tenantId
      });

      return result && !result.error;
    } catch (error) {
      console.error('[MCP Client] Error testing connection:', error);
      return false;
    }
  }

  /**
   * Test Archer connection with specific credentials
   */
  async testArcherConnectionWithCredentials(tenantId: string, credentials: ArcherCredentials): Promise<boolean> {
    try {
      // Disconnect existing connection if any
      if (this.isConnected) {
        await this.disconnect();
      }

      // Initialize with new credentials
      await this.initializeMCPConnection(credentials);

      // Test the connection
      return await this.testArcherConnection(tenantId);
    } catch (error) {
      console.error('[MCP Client] Error testing connection with credentials:', error);
      return false;
    }
  }

  /**
   * Get list of available MCP tools
   */
  async getMCPTools(): Promise<any[]> {
    try {
      // Try to connect if not already connected
      if (!this.isConnected) {
        try {
          await this.connectToHttpServer();
        } catch (error) {
          console.error('[MCP Client] Failed to connect to MCP server:', error);
          return [];
        }
      }

      const result = await this.sendMCPRequest('tools/list', {});
      return result?.tools || [];
    } catch (error) {
      console.error('[MCP Client] Error getting MCP tools:', error);
      return [];
    }
  }

  /**
   * Connect to MCP server without credentials (for tool listing)
   */
  private async connectToHttpServer(): Promise<void> {
    try {
      console.log('[MCP Client] Attempting to connect to MCP server...');
      
      // Try health check first
      const response = await fetch(`${this.mcpServerUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        this.isConnected = true;
        console.log('[MCP Client] Connected to MCP server via health check');
      } else {
        // If health check fails, try a basic MCP JSON-RPC request
        const mcpResponse = await fetch(`${this.mcpServerUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'health-check',
            method: 'tools/list',
            params: {}
          })
        });

        if (mcpResponse.ok) {
          this.isConnected = true;
          console.log('[MCP Client] Connected to MCP server via JSON-RPC');
        } else {
          throw new Error(`MCP server not available: ${mcpResponse.status}`);
        }
      }
    } catch (error) {
      console.error('[MCP Client] Failed to connect to MCP server:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Call any MCP tool by name
   */
  async callMCPTool(toolName: string, args: any): Promise<any> {
    try {
      await this.ensureMCPConnection();

      return await this.makeMCPToolCall(toolName, args);
    } catch (error) {
      console.error(`[MCP Client] Error calling tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Initialize MCP client with credentials from connection ID
   * This method should be called by the frontend with both config and credentials
   */
  async initializeWithConnection(connectionId: string, credentials: ArcherCredentials): Promise<void> {
    console.log(`[MCP Client] Initializing with connection ID: ${connectionId}`);
    console.log(`[MCP Client] Using credentials for: ${credentials.name} (${credentials.baseUrl})`);
    
    // Disconnect existing connection if any
    if (this.isConnected) {
      await this.disconnect();
    }

    // Initialize with the provided credentials
    await this.initializeMCPConnection(credentials);
    
    console.log(`[MCP Client] Successfully initialized with connection: ${connectionId}`);
  }

  /**
   * Parse tool result from MCP response
   */
  private parseToolResult(result: any): any {
    if (result && result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((item: any) => item.type === 'text');
      if (textContent && textContent.text) {
        // Try to extract structured data from text response
        const text = textContent.text;
        
        // Look for JSON-like data in the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (e) {
            // If not valid JSON, return the text
          }
        }
        
        // Return parsed text data
        return this.parseTextResponse(text);
      }
    }
    
    return result;
  }

  /**
   * Parse text response into structured data
   */
  private parseTextResponse(text: string): any {
    const lines = text.split('\n').filter(line => line.trim());
    const data: any = {};
    
    // Extract key metrics from text
    for (const line of lines) {
      // Total Records: 1,234
      const totalMatch = line.match(/Total Records?:\s*([0-9,]+)/i);
      if (totalMatch) {
        data.totalRecords = parseInt(totalMatch[1].replace(/,/g, ''));
      }
      
      // Total Applications: 42 (or Applications: 42)
      const appsMatch = line.match(/Total Applications?:\s*(\d+)/i) || line.match(/Applications?:\s*(\d+)/i);
      if (appsMatch) {
        data.totalApplications = parseInt(appsMatch[1]);
      }
      
      // Extract application names - be more flexible with whitespace
      const appNameMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
      if (appNameMatch) {
        if (!data.applications) data.applications = [];
        data.applications.push({
          name: appNameMatch[2].trim(),
          status: 'Active',
          id: null
        });
      }
    }
    
    // If this is an applications response, return the array directly
    if (text.includes('Total Applications:') && data.applications) {
      console.log(`[MCP Client] Parsed ${data.applications.length} applications from text response`);
      return data.applications;
    }
    
    return data;
  }

  /**
   * Cleanup MCP connection
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.currentCredentials = null;
    console.log('[MCP Client] Disconnected from HTTP MCP server');
  }

  /**
   * Check if MCP client is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const mcpClient = new MCPClient();