import { NewMcpServerConfig } from '@/features/settings/components/AddMcpServerModal';

export const createDefaultMcpServers = (): NewMcpServerConfig[] => {
  // No default servers - users must configure their own Archer connections
  return [];
};

export const initializeDefaultMcpServers = (tenantId: string) => {
  const storageKey = `user_mcp_servers_${tenantId}`;
  const existing = localStorage.getItem(storageKey);
  
  if (!existing) {
    const defaultServers = createDefaultMcpServers();
    localStorage.setItem(storageKey, JSON.stringify(defaultServers));
    console.log('[MCP Setup] Initialized default MCP servers for tenant:', tenantId);
    return defaultServers;
  }
  
  // Clean up duplicates if they exist
  const existingServers = JSON.parse(existing);
  const cleanedServers = cleanupDuplicateMcpServers(existingServers);
  
  if (cleanedServers.length !== existingServers.length) {
    localStorage.setItem(storageKey, JSON.stringify(cleanedServers));
    console.log('[MCP Setup] Cleaned up duplicate MCP servers for tenant:', tenantId);
    return cleanedServers;
  }
  
  return existingServers;
};

// Clean up duplicate MCP servers that may have been created
export const cleanupDuplicateMcpServers = (servers: any[]) => {
  const seen = new Set();
  return servers.filter(server => {
    // Remove duplicates based on endpoint
    const key = server.endpoint.toLowerCase();
    
    // Also remove the redundant Archer GRC Proxy entry
    if (server.id === 'mcp-archer-proxy' || key.includes('/mcp')) {
      console.log('[MCP Cleanup] Removing duplicate/redundant server:', server.name);
      return false;
    }
    
    if (seen.has(key)) {
      console.log('[MCP Cleanup] Removing duplicate server:', server.name);
      return false;
    }
    
    seen.add(key);
    return true;
  });
};

// Test MCP server connection
export const testMcpServerConnection = async (endpoint: string): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('[MCP Test] Testing connection to:', endpoint);
    
    // Try to reach the MCP server health endpoint or root
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      timeout: 5000
    } as any);
    
    if (response.ok) {
      return {
        success: true,
        message: 'MCP server is responding'
      };
    } else {
      return {
        success: false,
        message: `Server responded with status ${response.status}`
      };
    }
  } catch (error: any) {
    console.error('[MCP Test] Connection failed:', error);
    return {
      success: false,
      message: error.message || 'Connection failed'
    };
  }
};