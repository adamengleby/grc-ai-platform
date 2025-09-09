/**
 * MCP Streamable HTTP Client (2025-06-18 Specification)
 * Implements MCP Streamable HTTP transport with optional SSE streaming
 * Replaces deprecated SSE transport with current standard
 * Includes OAuth token and Archer session support for MCP tool access control
 */

import { getCurrentOAuthToken } from '@/app/store/oauthToken';
import { useArcherSessionStore } from '@/app/store/archerSession';

export interface MCPToolProgress {
  tool: string;
  progress: number;
  status: string;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface MCPStreamableConnection {
  sessionId: string;
  endpoint: string;
  isConnected: boolean;
  supportsStreaming: boolean;
}

export class MCPSSEClient {
  private connection: MCPStreamableConnection | null = null;
  private messageId = 1;

  private readonly mcpStandardUrl = 'http://localhost:3006/mcp';  // MCP Streamable HTTP endpoint
  private readonly backendUrl = 'http://localhost:3005/api/v1';  // Backend for configs only

  /**
   * Test connection to MCP server (Streamable HTTP doesn't require persistent connection)
   */
  async connect(): Promise<MCPStreamableConnection> {
    if (this.connection?.isConnected) {
      return this.connection;
    }

    console.log('[MCP Streamable HTTP] Testing connection to MCP server...');

    try {
      // Test connection with a simple tools/list request
      const response = await fetch(this.mcpStandardUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'connection-test',
          method: 'tools/list',
          params: {}
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`MCP error: ${data.error.message}`);
      }

      // Check if server supports streaming
      const supportsStreaming = response.headers.get('content-type')?.includes('text/event-stream') || false;

      this.connection = {
        sessionId: crypto.randomUUID(),
        endpoint: this.mcpStandardUrl,
        isConnected: true,
        supportsStreaming
      };

      console.log(`[MCP Streamable HTTP] Connection established`);
      console.log(`[MCP Streamable HTTP] Supports streaming: ${supportsStreaming}`);
      
      return this.connection;

    } catch (error: any) {
      console.error('[MCP Streamable HTTP] Connection failed:', error);
      throw new Error(`Failed to connect to MCP server: ${error.message}`);
    }
  }

  /**
   * Call MCP tool using Streamable HTTP transport
   * Supports both direct HTTP responses and optional SSE streaming
   */
  async callTool(
    toolName: string, 
    args: any, 
    options: {
      onProgress?: (progress: MCPToolProgress) => void;
      timeout?: number;
      streaming?: boolean;
    } = {}
  ): Promise<any> {
    const connection = this.connection || await this.connect();
    
    // Get current OAuth token for MCP tool access control
    const oauthToken = getCurrentOAuthToken();
    
    // Get current Archer session for MCP tool calls
    const archerSession = useArcherSessionStore.getState().session;
    
    // Add OAuth token and Archer session ID to arguments for MCP server validation
    const argsWithAuth = {
      ...args,
      oauth_token: oauthToken, // Include OAuth token in tool arguments
      sessionId: args.archer_session_id || archerSession?.sessionId // Prefer passed session ID, fallback to store
    };
    
    const requestId = this.messageId++;
    const mcpRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: argsWithAuth
      }
    };

    console.log(`[MCP Streamable HTTP] Calling tool: ${toolName}`, { 
      args, 
      hasOAuthToken: !!oauthToken,
      hasSessionId: !!(args.archer_session_id || archerSession?.sessionId),
      sessionIdSource: args.archer_session_id ? 'parameter' : (archerSession?.sessionId ? 'store' : 'none'),
      actualSessionId: args.archer_session_id || archerSession?.sessionId
    });

    // Determine if we should request streaming
    const shouldStream = options.streaming && connection.supportsStreaming && options.onProgress;
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Request SSE streaming if supported and desired
      if (shouldStream) {
        headers['Accept'] = 'text/event-stream';
        console.log(`[MCP Streamable HTTP] Requesting SSE streaming for ${toolName}`);
      }

      const response = await fetch(connection.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(mcpRequest),
        signal: AbortSignal.timeout(options.timeout || 60000)
      });

      if (!response.ok) {
        throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
      }

      // Check if we got a streaming response
      const isStreaming = response.headers.get('content-type')?.includes('text/event-stream');

      if (isStreaming && shouldStream) {
        return await this.handleStreamingResponse(response, toolName, options.onProgress!);
      } else {
        // Handle regular JSON response
        const jsonResponse = await response.json();
        console.log(`[MCP Streamable HTTP] Received JSON response for ${toolName}:`, jsonResponse);

        if (jsonResponse.error) {
          throw new Error(`MCP JSON-RPC error: ${jsonResponse.error.message}`);
        }

        return jsonResponse.result;
      }
      
    } catch (error) {
      console.error(`[MCP Streamable HTTP] Tool call failed for ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Handle streaming SSE response for tool calls
   */
  private async handleStreamingResponse(
    response: Response, 
    toolName: string,
    onProgress: (progress: MCPToolProgress) => void
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = response.body?.getReader();
      if (!reader) {
        reject(new Error('No response body for streaming'));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: any = null;

      const readStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              if (finalResult !== null) {
                resolve(finalResult);
              } else {
                reject(new Error('Stream ended without final result'));
              }
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === 'progress') {
                    onProgress({
                      tool: toolName,
                      progress: data.progress || 0,
                      status: data.status || 'processing',
                      data: data.data,
                      timestamp: new Date().toISOString()
                    });
                  } else if (data.result !== undefined) {
                    finalResult = data.result;
                  } else if (data.error) {
                    reject(new Error(`MCP Streaming error: ${data.error.message}`));
                    return;
                  }
                } catch (parseError) {
                  console.warn('[MCP Streamable HTTP] Failed to parse streaming data:', line);
                }
              }
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      readStream();
    });
  }

  /**
   * Get available tools via MCP standard JSON-RPC
   */
  async getTools(): Promise<any[]> {
    try {
      // Use MCP standard tools/list method
      const response = await fetch(this.mcpStandardUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'get-tools',
          method: 'tools/list'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'Failed to get tools');
      }
      
      return data.result.tools || [];
    } catch (error) {
      console.error('[MCP SSE Client] Error getting tools:', error);
      throw error;
    }
  }

  /**
   * Check MCP server health
   */
  async getHealth(): Promise<any> {
    const response = await fetch(`${this.mcpStandardUrl.replace('/mcp', '/health')}`);
    return await response.json();
  }

  /**
   * Get server status including active connections
   */
  async getStatus(): Promise<any> {
    const response = await fetch(`${this.mcpStandardUrl.replace('/mcp', '/status')}`);
    return await response.json();
  }

  /**
   * Disconnect from MCP server (Streamable HTTP doesn't maintain persistent connections)
   */
  disconnect(): void {
    this.connection = null;
    console.log('[MCP Streamable HTTP] Connection cleared');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection?.isConnected || false;
  }

  /**
   * Get current session info
   */
  getSessionInfo(): { sessionId: string; endpoint: string } | null {
    if (!this.connection) return null;
    
    return {
      sessionId: this.connection.sessionId,
      endpoint: this.connection.endpoint
    };
  }
}

// Export singleton instance
export const mcpSSEClient = new MCPSSEClient();