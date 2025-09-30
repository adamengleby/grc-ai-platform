// Create missing MCP server configuration
// Run this in browser console

function createMCPServer() {
  console.log('🔧 Creating missing MCP server configuration...');
  
  const tenantId = 'tenant-acme'; // From the debug output
  
  // Create MCP server configuration
  const mcpServers = [{
    id: 'mcp-local-grc-server',
    name: 'Archer GRC Server',
    description: 'RSA Archer GRC Platform integration',
    endpoint: 'http://localhost:3001',
    category: 'GRC',
    status: 'connected',
    isHealthy: true,
    lastHealthCheck: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }];
  
  // Save MCP servers
  const mcpServersKey = `user_mcp_servers_${tenantId}`;
  localStorage.setItem(mcpServersKey, JSON.stringify(mcpServers));
  console.log(`✅ Created MCP server configuration at key: ${mcpServersKey}`);
  
  // Create MCP server config (connection to Archer)
  const mcpConfigs = [{
    serverId: 'mcp-local-grc-server',
    serverName: 'Archer GRC Server',
    connectionId: 'archer-connection-1', // You may need to adjust this
    connectionName: 'Default Archer Connection',
    isEnabled: true,
    lastConfigured: new Date().toISOString(),
    testStatus: 'success'
  }];
  
  // Save MCP server configs  
  const mcpConfigsKey = `mcp_server_configs_${tenantId}`;
  localStorage.setItem(mcpConfigsKey, JSON.stringify(mcpConfigs));
  console.log(`✅ Created MCP server config at key: ${mcpConfigsKey}`);
  
  console.log('\n🎉 MCP server configuration created!');
  console.log('🔄 Please refresh the page to see the changes.');
  
  // Auto-refresh after 2 seconds
  setTimeout(() => {
    console.log('🔄 Auto-refreshing page...');
    window.location.reload();
  }, 2000);
}

createMCPServer();