// MCP Client for browser-based React app
// Connects to MCP server through HTTP proxy

export interface McpClientResponse {
  content: string;
  confidence: number;
  toolsUsed: string[];
  evidence: Array<{
    source: string;
    excerpt: string;
    relevance: number;
  }>;
  complianceFlags: Array<{
    framework: string;
    rule: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
  processingTime: number;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}

class McpClientService {
  private isConnected = false;
  private availableTools: McpTool[] = [];
  private proxyUrl = 'http://localhost:3005/api/v1/mcp'; // Backend API with privacy protection

  /**
   * Initialize and connect to the MCP server through HTTP proxy
   */
  async connect(): Promise<boolean> {
    try {
      console.log('[MCP Client] Connecting to MCP server via HTTP proxy...');
      
      // Check if tools are available with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const toolsResponse = await fetch(`${this.proxyUrl}/tools`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!toolsResponse.ok) {
        throw new Error(`MCP bridge server not accessible: ${toolsResponse.status} ${toolsResponse.statusText}`);
      }
      
      const toolsData = await toolsResponse.json();
      console.log('[MCP Client] Tools response:', toolsData);
      
      // Handle different response formats
      if (toolsData.tools && Array.isArray(toolsData.tools)) {
        this.availableTools = toolsData.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description || 'No description available',
          inputSchema: tool.inputSchema || {}
        }));
      } else if (Array.isArray(toolsData)) {
        this.availableTools = toolsData.map((tool: any) => ({
          name: tool.name,
          description: tool.description || 'No description available',
          inputSchema: tool.inputSchema || {}
        }));
      } else {
        console.warn('[MCP Client] Unexpected tools response format:', toolsData);
        this.availableTools = [];
      }
      
      this.isConnected = true;
      console.log(`[MCP Client] Connected to MCP server. Available tools: ${this.availableTools.map(t => t.name).join(', ')}`);
      return true;
    } catch (error) {
      console.error('[MCP Client] Failed to connect:', error);
      this.isConnected = false;
      
      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('[MCP Client] Connection timeout - MCP server may be down');
        } else if (error.message.includes('fetch')) {
          console.error('[MCP Client] Network error - check if MCP proxy is running on port 3001');
        }
      }
      
      return false;
    }
  }


  /**
   * Check if client is connected to MCP server
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get list of available tools from MCP server
   */
  getAvailableTools(): McpTool[] {
    return this.availableTools;
  }

  /**
   * Call MCP tool with parameters through HTTP proxy
   */
  async callTool(toolName: string, parameters: Record<string, any>): Promise<McpClientResponse> {
    if (!this.isConnected) {
      throw new Error('MCP client not connected. Call connect() first.');
    }

    const startTime = Date.now();

    try {
      console.log(`[MCP Client] Calling tool: ${toolName} with parameters:`, parameters);
      
      // Add timeout for tool calls
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      // Call the MCP server through backend API with privacy protection
      const response = await fetch(`${this.proxyUrl}/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          toolName: toolName, 
          arguments: parameters,
          tenantId: parameters.tenant_id || 'default-tenant',
          agentId: 'default-agent',
          connectionId: 'default-connection'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[MCP Client] Tool ${toolName} response:`, result);
      
      // Handle different response formats from MCP server
      let content: string;
      if (result.result) {
        // Standard MCP response format
        content = typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2);
      } else if (result.content) {
        // MCP server response format: {"content": [{"type": "text", "text": "..."}]}
        if (Array.isArray(result.content)) {
          // Extract text from content array
          content = result.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('\n');
        } else {
          content = result.content;
        }
      } else {
        // Raw response
        content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      }
      
      const confidence = 0.89; // Default confidence for MCP responses
      const processingTime = Date.now() - startTime;
      
      return {
        content,
        confidence,
        toolsUsed: [toolName],
        evidence: [
          {
            source: 'Archer GRC Platform',
            excerpt: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
            relevance: confidence
          }
        ],
        complianceFlags: this.extractComplianceFlags(content),
        processingTime
      };
    } catch (error) {
      console.error(`[MCP Client] Tool call failed for ${toolName}:`, error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Tool ${toolName} timed out after 30 seconds`);
        } else {
          throw new Error(`Failed to execute tool ${toolName}: ${error.message}`);
        }
      }
      
      throw new Error(`Failed to execute tool ${toolName}: Unknown error`);
    }
  }

  /**
   * Extract compliance flags from response content
   */
  private extractComplianceFlags(content: string): Array<{
    framework: string;
    rule: string;
    severity: 'info' | 'warning' | 'critical';
  }> {
    const flags = [];
    
    // Check for HIPAA mentions
    if (content.toLowerCase().includes('hipaa')) {
      flags.push({
        framework: 'HIPAA',
        rule: 'Patient Data Protection',
        severity: 'critical' as const
      });
    }
    
    // Check for SOX mentions
    if (content.toLowerCase().includes('sox') || content.toLowerCase().includes('sarbanes')) {
      flags.push({
        framework: 'SOX',
        rule: 'Financial Controls',
        severity: 'warning' as const
      });
    }
    
    // Check for GDPR mentions
    if (content.toLowerCase().includes('gdpr') || content.toLowerCase().includes('data protection')) {
      flags.push({
        framework: 'GDPR',
        rule: 'Data Privacy',
        severity: 'warning' as const
      });
    }
    
    return flags;
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.availableTools = [];
    console.log('[MCP Client] Disconnected from MCP server');
  }

}

// Export singleton instance
export const mcpClient = new McpClientService();
