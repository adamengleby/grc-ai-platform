/**
 * Test script to verify tenant-level MCP server configuration
 * This creates a sample MCP server configuration for testing
 */

export const createTestMcpServerConfig = (tenantId: string) => {
  const testMcpServer = {
    id: 'mcp-local-grc-server', // Use consistent server ID
    name: 'Local Archer GRC Server',
    description: 'Local RSA Archer GRC Platform integration with privacy protection and caching',
    endpoint: 'http://localhost:3001',
    connectionId: 'archer-connection-1',
    connectionName: 'Archer UAT Connection',
    category: 'grc',
    status: 'connected',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    lastTested: new Date().toISOString()
  };

  // Store in tenant-level storage
  const storageKey = `tenant_mcp_servers_${tenantId}`;
  const existingServers = JSON.parse(localStorage.getItem(storageKey) || '[]');
  
  // Check if server already exists
  const existingIndex = existingServers.findIndex((s: any) => s.id === testMcpServer.id);
  
  if (existingIndex >= 0) {
    // Update existing
    existingServers[existingIndex] = testMcpServer;
  } else {
    // Add new
    existingServers.push(testMcpServer);
  }
  
  localStorage.setItem(storageKey, JSON.stringify(existingServers));
  
  console.log(`[Test] Created MCP server configuration for tenant: ${tenantId}`, testMcpServer);
  return testMcpServer;
};

export const verifyTenantMcpConfig = (tenantId: string) => {
  const storageKey = `tenant_mcp_servers_${tenantId}`;
  const storedServers = localStorage.getItem(storageKey);
  
  console.log(`[Test] Checking tenant MCP servers for ${tenantId}:`, 
    storedServers ? JSON.parse(storedServers) : 'No servers found');
    
  return storedServers ? JSON.parse(storedServers) : [];
};