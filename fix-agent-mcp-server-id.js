// Quick fix script to update agent MCP server ID in localStorage
// Run this in browser console on the GRC AI Platform

function fixAgentMcpServerId() {
  console.log('🔧 Fixing agent MCP server ID mismatch...');
  
  // Get tenant ID (adjust if needed)
  const tenantId = 'tenant-acme'; // Update this to match your tenant
  
  // Fix agents
  const agentKey = `user_agents_${tenantId}`;
  const agents = JSON.parse(localStorage.getItem(agentKey) || '[]');
  
  let fixed = 0;
  agents.forEach(agent => {
    if (agent.enabledMcpServers && agent.enabledMcpServers.includes('mcp-local-grc-server')) {
      console.log(`Fixing agent: ${agent.name}`);
      agent.enabledMcpServers = agent.enabledMcpServers.map(serverId => 
        serverId === 'mcp-local-grc-server' ? 'archer-grc' : serverId
      );
      fixed++;
    }
  });
  
  if (fixed > 0) {
    localStorage.setItem(agentKey, JSON.stringify(agents));
    console.log(`✅ Fixed ${fixed} agents. Please refresh the page.`);
  } else {
    console.log('ℹ️ No agents needed fixing.');
  }
}

fixAgentMcpServerId();