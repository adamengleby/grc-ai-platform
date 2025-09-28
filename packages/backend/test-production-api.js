/**
 * Production API Test Suite
 * Tests against actual production URLs to verify real functionality
 */

const PRODUCTION_BACKEND = 'https://grc-backend-simple.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io/api/v1';
const TENANT_ID = 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d';
const USER_ID = 'user-001';

const headers = {
  'Content-Type': 'application/json',
  'x-tenant-id': TENANT_ID,
  'x-user-id': USER_ID
};

async function apiRequest(method, endpoint, data = null) {
  const url = `${PRODUCTION_BACKEND}${endpoint}`;
  const options = {
    method,
    headers,
    body: data ? JSON.stringify(data) : null
  };

  try {
    const response = await fetch(url, options);
    const responseData = await response.json();
    return {
      status: response.status,
      ok: response.ok,
      data: responseData
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

async function testProductionEndpoints() {
  console.log('🚀 Testing Production API Endpoints...');
  console.log(`🎯 Backend: ${PRODUCTION_BACKEND}`);
  console.log(`👤 Tenant: ${TENANT_ID}\n`);

  // Test health check
  console.log('🏥 Testing Health Check...');
  const healthResult = await apiRequest('GET', '/health');
  console.log(`${healthResult.ok ? '✅' : '❌'} Health Check: Status ${healthResult.status}`);
  if (healthResult.ok && healthResult.data.fixes) {
    console.log('   📋 Fixes deployed:', Object.keys(healthResult.data.fixes).length);
  }

  // Test agent list
  console.log('\n📋 Testing Agent List...');
  const listResult = await apiRequest('GET', '/simple-agents');
  console.log(`${listResult.ok ? '✅' : '❌'} Agent List: Status ${listResult.status}`);
  if (listResult.ok) {
    const agentCount = listResult.data?.data?.agents?.length || 0;
    const disabledCount = listResult.data?.data?.agents?.filter(a => !a.isEnabled)?.length || 0;
    console.log(`   📊 Total agents: ${agentCount}`);
    console.log(`   ⏸️ Disabled agents: ${disabledCount}`);
  }

  // Test LLM configs
  console.log('\n🤖 Testing LLM Configs...');
  const llmResult = await apiRequest('GET', '/simple-llm-configs');
  console.log(`${llmResult.ok ? '✅' : '❌'} LLM Configs: Status ${llmResult.status}`);
  if (llmResult.ok) {
    const configCount = llmResult.data?.data?.llm_configs?.length || 0;
    console.log(`   🧠 Available LLM configs: ${configCount}`);
  }

  // Test MCP configs
  console.log('\n🛠️ Testing MCP Configs...');
  const mcpResult = await apiRequest('GET', '/simple-mcp-configs');
  console.log(`${mcpResult.ok ? '✅' : '❌'} MCP Configs: Status ${mcpResult.status}`);
  if (mcpResult.ok) {
    const mcpCount = mcpResult.data?.data?.mcp_servers?.length || 0;
    console.log(`   🔧 Available MCP servers: ${mcpCount}`);
  }

  // Test agent creation
  console.log('\n📝 Testing Agent Creation...');
  const testAgent = {
    name: 'Production Test Agent',
    description: 'Testing agent creation in production',
    systemPrompt: 'You are a test agent for production validation.',
    llmConfigId: 'a1234567-89ab-4cde-f012-3456789abcd0',
    enabledMcpServers: ['M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6']
  };

  const createResult = await apiRequest('POST', '/simple-agents/create', testAgent);
  console.log(`${createResult.ok ? '✅' : '❌'} Agent Creation: Status ${createResult.status}`);

  let createdAgentId = null;
  if (createResult.ok && createResult.data?.data?.id) {
    createdAgentId = createResult.data.data.id;
    console.log(`   🆔 Created agent ID: ${createdAgentId}`);
  } else if (createResult.data?.error) {
    console.log(`   ❌ Error: ${createResult.data.error}`);
  }

  // Test agent update (if creation worked)
  if (createdAgentId) {
    console.log('\n✏️ Testing Agent Update...');
    const updateData = {
      name: 'Updated Production Test Agent',
      llmConfigId: 'a1234567-89ab-4cde-f012-3456789abcd1',
      isEnabled: false
    };

    const updateResult = await apiRequest('PUT', `/simple-agents/${createdAgentId}`, updateData);
    console.log(`${updateResult.ok ? '✅' : '❌'} Agent Update: Status ${updateResult.status}`);

    if (updateResult.ok && updateResult.data?.data) {
      const llmConfigPersisted = updateResult.data.data.llmConfigId === updateData.llmConfigId;
      const isEnabledUpdated = updateResult.data.data.isEnabled === updateData.isEnabled;
      console.log(`   🤖 LLM Config persisted: ${llmConfigPersisted ? 'Yes' : 'No'}`);
      console.log(`   ⏸️ Pause status updated: ${isEnabledUpdated ? 'Yes' : 'No'}`);
    }

    // Test agent deletion
    console.log('\n🗑️ Testing Agent Deletion...');
    const deleteResult = await apiRequest('DELETE', `/simple-agents/${createdAgentId}`);
    console.log(`${deleteResult.ok ? '✅' : '❌'} Agent Deletion: Status ${deleteResult.status}`);
  }

  // Summary
  console.log('\n📊 PRODUCTION TEST SUMMARY');
  console.log('=' .repeat(40));

  const results = [
    { name: 'Health Check', ok: healthResult.ok },
    { name: 'Agent List', ok: listResult.ok },
    { name: 'LLM Configs', ok: llmResult.ok },
    { name: 'MCP Configs', ok: mcpResult.ok },
    { name: 'Agent Creation', ok: createResult.ok }
  ];

  const workingCount = results.filter(r => r.ok).length;
  const totalCount = results.length;

  console.log(`\n🎯 Production API Score: ${workingCount}/${totalCount} endpoints working`);

  results.forEach(result => {
    console.log(`${result.ok ? '✅' : '❌'} ${result.name}`);
  });

  if (workingCount === totalCount) {
    console.log('\n🎉 All production endpoints working correctly!');
  } else {
    console.log('\n⚠️ Some endpoints need attention in production.');
  }
}

// Run production tests
testProductionEndpoints().catch(console.error);