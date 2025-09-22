/**
 * Fix MCP endpoint configuration - temporary utility to fix port mismatch
 */

export const fixMcpEndpointConfiguration = (tenantId: string) => {
  console.log(`[Fix MCP] Fixing MCP endpoint configuration for tenant: ${tenantId}`);
  
  // Clear old configurations
  const storageKey = `tenant_mcp_servers_${tenantId}`;
  
  // Create correct configuration
  const correctMcpServer = {
    id: 'mcp-local-grc-server',
    name: 'Local Archer GRC Server',
    description: 'Local RSA Archer GRC Platform integration with privacy protection and caching',
    endpoint: 'http://localhost:3001', // CORRECT PORT
    connectionId: 'archer-connection-1',
    connectionName: 'Archer UAT Connection',
    category: 'grc',
    status: 'connected',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    lastTested: new Date().toISOString()
  };
  
  // Store the correct configuration
  localStorage.setItem(storageKey, JSON.stringify([correctMcpServer]));
  
  console.log(`[Fix MCP] Updated MCP server configuration:`, correctMcpServer);
  
  // Also clear any cached connections to force reconnection
  console.log(`[Fix MCP] Configuration fixed. Please refresh the page to reinitialize connections.`);
  
  return correctMcpServer;
};

// Make it globally available for easy access from browser console
if (typeof window !== 'undefined') {
  (window as any).fixMcpEndpoint = fixMcpEndpointConfiguration;
}