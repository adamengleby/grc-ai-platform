// Debug MCP connections and server configurations
// Run this in browser console

function debugMCPConnections() {
  console.log('🔍 Debugging MCP connections...');
  
  // Find all MCP-related localStorage keys
  const allKeys = Object.keys(localStorage);
  const mcpKeys = allKeys.filter(key => 
    key.includes('mcp') || 
    key.includes('server') ||
    key.includes('connection')
  );
  
  console.log('Found MCP-related keys:', mcpKeys);
  
  mcpKeys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      console.log(`\n📋 ${key}:`, JSON.parse(value));
    } catch (e) {
      console.log(`\n📋 ${key}:`, value);
    }
  });
  
  // Also check agent configurations
  const agentKeys = allKeys.filter(key => key.includes('agent'));
  console.log('\n🤖 Agent configurations:');
  agentKeys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      const parsed = JSON.parse(value);
      console.log(`\n📋 ${key}:`, parsed);
      
      // Show enabled MCP servers for each agent
      if (Array.isArray(parsed)) {
        parsed.forEach(agent => {
          if (agent.enabledMcpServers && agent.enabledMcpServers.length > 0) {
            console.log(`  🤖 Agent "${agent.name}" enabled MCP servers:`, agent.enabledMcpServers);
          }
        });
      }
    } catch (e) {
      console.log(`\n📋 ${key}:`, localStorage.getItem(key));
    }
  });
  
  // Get current tenant ID
  console.log('\n🏢 Current tenant context:');
  try {
    const authKeys = allKeys.filter(key => key.includes('auth'));
    authKeys.forEach(key => {
      const value = localStorage.getItem(key);
      console.log(`${key}:`, value);
    });
  } catch (e) {
    console.log('Could not find tenant context');
  }
  
  console.log('\n🔧 Analysis:');
  console.log('Look for:');
  console.log('1. MCP server configurations (should have server ID matching agent enabledMcpServers)');
  console.log('2. MCP connection configurations (should link server to Archer credentials)');
  console.log('3. Agent enabled servers should match available server IDs');
  console.log('4. Server should be marked as healthy/connected');
}

debugMCPConnections();