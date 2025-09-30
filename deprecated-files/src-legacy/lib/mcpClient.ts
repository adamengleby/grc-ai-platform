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
  private proxyUrl = 'http://localhost:3001'; // MCP HTTP bridge server

  /**
   * Initialize and connect to the MCP server through HTTP proxy
   */
  async connect(): Promise<boolean> {
    try {
      console.log('[MCP Client] Connecting to MCP server via HTTP proxy...');
      
      // Check if tools are available
      const toolsResponse = await fetch(`${this.proxyUrl}/tools`);
      if (!toolsResponse.ok) {
        throw new Error(`MCP bridge server not accessible: ${toolsResponse.status}`);
      }
      
      const toolsData = await toolsResponse.json();
      console.log('[MCP Client] Tools response:', toolsData);
      
      this.availableTools = toolsData.tools ? toolsData.tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      })) : [];
      
      this.isConnected = true;
      console.log(`[MCP Client] Connected to MCP server. Available tools: ${this.availableTools.map(t => t.name).join(', ')}`);
      return true;
    } catch (error) {
      console.error('[MCP Client] Failed to connect:', error);
      this.isConnected = false;
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
      
      // Call the MCP server through HTTP bridge
      const response = await fetch(`${this.proxyUrl}/tools/${toolName}/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ arguments: parameters })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // The bridge server returns the MCP result directly
      const content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      const confidence = 0.89; // Default confidence for MCP responses
      const processingTime = Date.now() - startTime;
      
      return {
        content,
        confidence,
        toolsUsed: [toolName],
        evidence: [
          {
            source: 'Archer GRC Platform',
            excerpt: content.substring(0, 200) + '...',
            relevance: confidence
          }
        ],
        complianceFlags: this.extractComplianceFlags(content),
        processingTime
      };
    } catch (error) {
      console.error(`[MCP Client] Tool call failed for ${toolName}:`, error);
      throw new Error(`Failed to execute tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
