// Auto-detect and fix MCP server ID mismatch
// Run this in browser console on the GRC AI Platform page

function autoFixMcpServerId() {
  console.log('🔧 Auto-detecting and fixing MCP server ID mismatch...');
  
  // Find all localStorage keys that contain agents
  const allKeys = Object.keys(localStorage);
  const agentKeys = allKeys.filter(key => key.startsWith('user_agents_'));
  
  console.log('Found agent storage keys:', agentKeys);
  
  let totalFixed = 0;
  
  agentKeys.forEach(agentKey => {
    const tenantId = agentKey.replace('user_agents_', '');
    console.log(`\n📂 Processing tenant: ${tenantId}`);
    
    try {
      const agents = JSON.parse(localStorage.getItem(agentKey) || '[]');
      let tenantFixed = 0;
      
      agents.forEach((agent, index) => {
        if (agent.enabledMcpServers && agent.enabledMcpServers.includes('mcp-local-grc-server')) {
          console.log(`  🔧 Fixing agent: ${agent.name}`);
          
          // Replace mcp-local-grc-server with archer-grc
          agent.enabledMcpServers = agent.enabledMcpServers.map(serverId => {
            if (serverId === 'mcp-local-grc-server') {
              console.log(`    ✅ Changed ${serverId} → archer-grc`);
              return 'archer-grc';
            }
            return serverId;
          });
          
          tenantFixed++;
        }
      });
      
      if (tenantFixed > 0) {
        localStorage.setItem(agentKey, JSON.stringify(agents));
        console.log(`  ✅ Fixed ${tenantFixed} agents for tenant ${tenantId}`);
        totalFixed += tenantFixed;
      } else {
        console.log(`  ℹ️ No agents needed fixing for tenant ${tenantId}`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error processing tenant ${tenantId}:`, error);
    }
  });
  
  if (totalFixed > 0) {
    console.log(`\n🎉 Successfully fixed ${totalFixed} agents across all tenants!`);
    console.log('🔄 Please refresh the page to see the changes.');
    
    // Auto-refresh after 2 seconds
    setTimeout(() => {
      console.log('🔄 Auto-refreshing page...');
      window.location.reload();
    }, 2000);
  } else {
    console.log('\nℹ️ No agents needed fixing.');
  }
}

// Also check current auth state
function checkCurrentTenant() {
  console.log('\n🔍 Current authentication state:');
  try {
    const authKeys = Object.keys(localStorage).filter(key => key.includes('auth') || key.includes('tenant'));
    authKeys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value && value.includes('tenant')) {
          console.log(`${key}:`, JSON.parse(value));
        }
      } catch (e) {
        console.log(`${key}:`, value);
      }
    });
  } catch (error) {
    console.log('Could not detect current tenant');
  }
}

console.log('🚀 Starting MCP Server ID Fix...');
checkCurrentTenant();
autoFixMcpServerId();