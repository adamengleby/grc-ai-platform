/**
 * React Hook for MCP SSE Integration
 * Provides real-time tool streaming capabilities for React components
 * Uses hybrid architecture: gets config from backend, connects directly to MCP servers
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { mcpSSEClient, MCPToolProgress } from '@/services/mcpSSEClient';
import { mcpRegistryClient, MCPServerInfo } from '@/services/mcpRegistryClient';

export interface MCPToolCall {
  id: string;
  tool: string;
  args: any;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;
  result?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
  progressUpdates: MCPToolProgress[];
}

export interface UseMCPSSEReturn {
  // Connection state
  isConnected: boolean;
  connectionError: string | null;
  sessionInfo: { sessionId: string; endpoint: string } | null;
  
  // MCP Server Registry
  mcpServers: MCPServerInfo[];
  loadingServers: boolean;
  registryError: string | null;
  refreshServers: () => Promise<void>;
  
  // Tool execution
  callTool: (toolName: string, args: any, options?: { timeout?: number }) => Promise<any>;
  activeCalls: MCPToolCall[];
  
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => void;
  
  // Health & status
  health: any | null;
  serverStatus: any | null;
  refreshStatus: () => Promise<void>;
}

export function useMCPSSE(): UseMCPSSEReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{ sessionId: string; endpoint: string } | null>(null);
  const [activeCalls, setActiveCalls] = useState<MCPToolCall[]>([]);
  const [health, setHealth] = useState<any | null>(null);
  const [serverStatus, setServerStatus] = useState<any | null>(null);
  
  // MCP Registry state
  const [mcpServers, setMcpServers] = useState<MCPServerInfo[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  
  const callsRef = useRef<Map<string, MCPToolCall>>(new Map());

  // Initialize connection on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []);

  // Connect to MCP SSE server
  const connect = useCallback(async () => {
    try {
      console.log('[useMCPSSE] Connecting to MCP SSE server...');
      setConnectionError(null);
      
      const connection = await mcpSSEClient.connect();
      
      setIsConnected(true);
      setSessionInfo({
        sessionId: connection.sessionId,
        endpoint: connection.endpoint
      });
      
      console.log('[useMCPSSE] Connected successfully:', connection.sessionId);
      
      // Get initial status
      await refreshStatus();
      
    } catch (error: any) {
      console.error('[useMCPSSE] Connection failed:', error);
      setConnectionError(error.message);
      setIsConnected(false);
    }
  }, []);

  // Disconnect from MCP SSE server
  const disconnect = useCallback(() => {
    mcpSSEClient.disconnect();
    setIsConnected(false);
    setSessionInfo(null);
    setActiveCalls([]);
    callsRef.current.clear();
  }, []);

  // Refresh server status and health
  const refreshStatus = useCallback(async () => {
    try {
      const [healthData, statusData] = await Promise.all([
        mcpSSEClient.getHealth(),
        mcpSSEClient.getStatus()
      ]);
      
      setHealth(healthData);
      setServerStatus(statusData);
    } catch (error) {
      console.error('[useMCPSSE] Failed to refresh status:', error);
    }
  }, []);

  // Call MCP tool with progress tracking
  const callTool = useCallback(async (
    toolName: string, 
    args: any, 
    options: { timeout?: number } = {}
  ): Promise<any> => {
    const callId = `${toolName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const toolCall: MCPToolCall = {
      id: callId,
      tool: toolName,
      args,
      status: 'pending',
      startTime: new Date(),
      progressUpdates: []
    };

    // Add to active calls
    callsRef.current.set(callId, toolCall);
    setActiveCalls(Array.from(callsRef.current.values()));

    try {
      // Update status to running
      toolCall.status = 'running';
      setActiveCalls(Array.from(callsRef.current.values()));

      console.log(`[useMCPSSE] Calling tool: ${toolName}`, args);

      const result = await mcpSSEClient.callTool(toolName, args, {
        timeout: options.timeout,
        onProgress: (progress: MCPToolProgress) => {
          console.log(`[useMCPSSE] Progress for ${toolName}:`, progress);
          
          const currentCall = callsRef.current.get(callId);
          if (currentCall) {
            currentCall.progress = progress.progress;
            currentCall.progressUpdates.push(progress);
            callsRef.current.set(callId, currentCall);
            setActiveCalls(Array.from(callsRef.current.values()));
          }
        }
      });

      // Mark as completed
      toolCall.status = 'completed';
      toolCall.result = result;
      toolCall.endTime = new Date();
      
      callsRef.current.set(callId, toolCall);
      setActiveCalls(Array.from(callsRef.current.values()));

      console.log(`[useMCPSSE] Tool ${toolName} completed successfully`);
      
      // Remove from active calls after a delay
      setTimeout(() => {
        callsRef.current.delete(callId);
        setActiveCalls(Array.from(callsRef.current.values()));
      }, 5000);

      return result;

    } catch (error: any) {
      console.error(`[useMCPSSE] Tool ${toolName} failed:`, error);
      
      // Mark as error
      toolCall.status = 'error';
      toolCall.error = error.message;
      toolCall.endTime = new Date();
      
      callsRef.current.set(callId, toolCall);
      setActiveCalls(Array.from(callsRef.current.values()));

      // Remove from active calls after a delay
      setTimeout(() => {
        callsRef.current.delete(callId);
        setActiveCalls(Array.from(callsRef.current.values()));
      }, 10000);

      throw error;
    }
  }, []);

  // Load MCP servers from backend registry
  const refreshServers = useCallback(async () => {
    setLoadingServers(true);
    setRegistryError(null);
    
    try {
      console.log('[useMCPSSE] Loading MCP servers from backend registry...');
      const registry = await mcpRegistryClient.getEnabledMCPServers();
      
      setMcpServers(registry.mcp_servers);
      console.log(`[useMCPSSE] Loaded ${registry.mcp_servers.length} MCP servers from registry`);
      
    } catch (error: any) {
      console.error('[useMCPSSE] Error loading MCP servers:', error);
      setRegistryError(error.message);
      setMcpServers([]);
    } finally {
      setLoadingServers(false);
    }
  }, []);

  // Load MCP servers on mount
  useEffect(() => {
    refreshServers();
  }, [refreshServers]);

  return {
    // Connection state
    isConnected,
    connectionError,
    sessionInfo,
    
    // MCP Server Registry
    mcpServers,
    loadingServers,
    registryError,
    refreshServers,
    
    // Tool execution
    callTool,
    activeCalls,
    
    // Connection management
    connect,
    disconnect,
    
    // Health & status
    health,
    serverStatus,
    refreshStatus
  };
}

export default useMCPSSE;