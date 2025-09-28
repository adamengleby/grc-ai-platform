/**
 * Comprehensive API Test Suite
 * Tests all CRUD operations for Agents, LLM Configs, MCP Configs
 * Verifies entity relationships and current vs target endpoints
 */

const BASE_URL = 'http://localhost:8080/api/v1';
const TENANT_ID = 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d';
const USER_ID = 'user-001';

const headers = {
  'Content-Type': 'application/json',
  'x-tenant-id': TENANT_ID,
  'x-user-id': USER_ID
};

// Test results storage
const testResults = {
  currentEndpoints: {},
  targetEndpoints: {},
  crudOperations: {},
  entityRelationships: {},
  summary: {}
};

/**
 * Helper function to make API requests
 */
async function apiRequest(method, endpoint, data = null) {
  const url = `${BASE_URL}${endpoint}`;
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

/**
 * Test current endpoints (with "simple-" prefix)
 */
async function testCurrentEndpoints() {
  console.log('🧪 Testing Current Endpoints (simple- prefix)...\n');

  const endpoints = [
    { method: 'GET', path: '/simple-agents', name: 'List Agents' },
    { method: 'GET', path: '/simple-llm-configs', name: 'List LLM Configs' },
    { method: 'GET', path: '/simple-mcp-configs', name: 'List MCP Configs' },
    { method: 'GET', path: '/simple-credentials', name: 'List Credentials' }
  ];

  for (const endpoint of endpoints) {
    const result = await apiRequest(endpoint.method, endpoint.path);
    testResults.currentEndpoints[endpoint.name] = {
      path: endpoint.path,
      status: result.status,
      ok: result.ok,
      hasData: result.data?.data ? true : false,
      dataCount: result.data?.data?.agents?.length || result.data?.data?.llm_configs?.length || result.data?.data?.mcp_servers?.length || 0
    };

    console.log(`${result.ok ? '✅' : '❌'} ${endpoint.name}: ${endpoint.path} - Status: ${result.status}`);
    if (result.data?.data) {
      console.log(`   📊 Data count: ${testResults.currentEndpoints[endpoint.name].dataCount}`);
    }
  }
}

/**
 * Test target endpoints (clean naming)
 */
async function testTargetEndpoints() {
  console.log('\n🎯 Testing Target Endpoints (clean naming)...\n');

  const endpoints = [
    { method: 'GET', path: '/agents', name: 'List Agents Clean' },
    { method: 'GET', path: '/llm-configs', name: 'List LLM Configs Clean' },
    { method: 'GET', path: '/mcp-configs', name: 'List MCP Configs Clean' },
    { method: 'GET', path: '/credentials', name: 'List Credentials Clean' }
  ];

  for (const endpoint of endpoints) {
    const result = await apiRequest(endpoint.method, endpoint.path);
    testResults.targetEndpoints[endpoint.name] = {
      path: endpoint.path,
      status: result.status,
      ok: result.ok,
      implemented: result.status !== 404
    };

    console.log(`${result.ok ? '✅' : '❌'} ${endpoint.name}: ${endpoint.path} - Status: ${result.status}`);
  }
}

/**
 * Test Agent CRUD operations comprehensively
 */
async function testAgentCRUD() {
  console.log('\n🤖 Testing Agent CRUD Operations...\n');

  const testAgent = {
    name: 'Test Agent CRUD',
    description: 'A test agent for comprehensive CRUD testing',
    systemPrompt: 'You are a test agent for validating CRUD operations.',
    llmConfigId: 'a1234567-89ab-4cde-f012-3456789abcd0', // ACME tenant LLM config
    enabledMcpServers: ['M1A2B3C4-D5E6-F7G8-H9I0-J1K2L3M4N5O6']
  };

  let createdAgentId = null;

  // Test CREATE
  console.log('📝 Testing Agent Creation...');
  const createResult = await apiRequest('POST', '/simple-agents/create', testAgent);
  testResults.crudOperations.agentCreate = {
    status: createResult.status,
    ok: createResult.ok,
    hasData: createResult.data?.data ? true : false
  };

  if (createResult.ok && createResult.data?.data) {
    createdAgentId = createResult.data.data.id;
    console.log(`✅ Agent created with ID: ${createdAgentId}`);
  } else {
    console.log(`❌ Agent creation failed: ${createResult.status}`);
  }

  // Test READ (single agent)
  if (createdAgentId) {
    console.log('\n📖 Testing Agent Read...');
    const readResult = await apiRequest('GET', `/simple-agents/${createdAgentId}`);
    testResults.crudOperations.agentRead = {
      status: readResult.status,
      ok: readResult.ok,
      hasData: readResult.data?.data ? true : false,
      hasLLMConfig: readResult.data?.data?.llmConfigId ? true : false
    };

    if (readResult.ok) {
      console.log(`✅ Agent read successfully`);
      console.log(`   🤖 LLM Config ID: ${readResult.data.data.llmConfigId || 'None'}`);
      console.log(`   🛠️ MCP Servers: ${readResult.data.data.enabledMcpServers?.length || 0}`);
    } else {
      console.log(`❌ Agent read failed: ${readResult.status}`);
    }
  }

  // Test UPDATE (including LLM config persistence)
  if (createdAgentId) {
    console.log('\n✏️ Testing Agent Update...');
    const updateData = {
      name: 'Updated Test Agent',
      description: 'Updated description',
      llmConfigId: 'a1234567-89ab-4cde-f012-3456789abcd1', // Different LLM config
      isEnabled: false // Test pause functionality
    };

    const updateResult = await apiRequest('PUT', `/simple-agents/${createdAgentId}`, updateData);
    testResults.crudOperations.agentUpdate = {
      status: updateResult.status,
      ok: updateResult.ok,
      hasData: updateResult.data?.data ? true : false,
      llmConfigPersisted: updateResult.data?.data?.llmConfigId === updateData.llmConfigId,
      isEnabledUpdated: updateResult.data?.data?.isEnabled === updateData.isEnabled
    };

    if (updateResult.ok) {
      console.log(`✅ Agent updated successfully`);
      console.log(`   🤖 LLM Config persisted: ${testResults.crudOperations.agentUpdate.llmConfigPersisted ? 'Yes' : 'No'}`);
      console.log(`   ⏸️ Pause status updated: ${testResults.crudOperations.agentUpdate.isEnabledUpdated ? 'Yes' : 'No'}`);
    } else {
      console.log(`❌ Agent update failed: ${updateResult.status}`);
    }
  }

  // Test LIST (verify disabled agents are included)
  console.log('\n📋 Testing Agent List (including disabled)...');
  const listResult = await apiRequest('GET', '/simple-agents');
  testResults.crudOperations.agentList = {
    status: listResult.status,
    ok: listResult.ok,
    totalAgents: listResult.data?.data?.agents?.length || 0,
    hasDisabledAgents: listResult.data?.data?.agents?.some(agent => !agent.isEnabled) || false
  };

  if (listResult.ok) {
    console.log(`✅ Agent list retrieved successfully`);
    console.log(`   📊 Total agents: ${testResults.crudOperations.agentList.totalAgents}`);
    console.log(`   ⏸️ Includes disabled agents: ${testResults.crudOperations.agentList.hasDisabledAgents ? 'Yes' : 'No'}`);
  }

  // Test DELETE
  if (createdAgentId) {
    console.log('\n🗑️ Testing Agent Deletion...');
    const deleteResult = await apiRequest('DELETE', `/simple-agents/${createdAgentId}`);
    testResults.crudOperations.agentDelete = {
      status: deleteResult.status,
      ok: deleteResult.ok
    };

    if (deleteResult.ok) {
      console.log(`✅ Agent deleted successfully`);
    } else {
      console.log(`❌ Agent deletion failed: ${deleteResult.status}`);
    }
  }
}

/**
 * Test LLM Config CRUD operations
 */
async function testLLMConfigCRUD() {
  console.log('\n🤖 Testing LLM Config CRUD Operations...\n');

  // Test LIST
  const listResult = await apiRequest('GET', '/simple-llm-configs');
  testResults.crudOperations.llmConfigList = {
    status: listResult.status,
    ok: listResult.ok,
    totalConfigs: listResult.data?.data?.llm_configs?.length || 0
  };

  console.log(`${listResult.ok ? '✅' : '❌'} LLM Config List: Status ${listResult.status}`);
  if (listResult.ok) {
    console.log(`   📊 Total LLM configs: ${testResults.crudOperations.llmConfigList.totalConfigs}`);
  }

  // Test CREATE (if endpoint exists)
  const testLLMConfig = {
    name: 'Test LLM Config',
    provider: 'openai',
    model: 'gpt-4',
    endpoint: 'https://api.openai.com/v1',
    temperature: 0.7,
    maxTokens: 2000
  };

  const createResult = await apiRequest('POST', '/simple-llm-configs', testLLMConfig);
  testResults.crudOperations.llmConfigCreate = {
    status: createResult.status,
    ok: createResult.ok,
    implemented: createResult.status !== 404
  };

  console.log(`${createResult.ok ? '✅' : '❌'} LLM Config Create: Status ${createResult.status}`);
}

/**
 * Test MCP Config CRUD operations
 */
async function testMCPConfigCRUD() {
  console.log('\n🛠️ Testing MCP Config CRUD Operations...\n');

  // Test LIST
  const listResult = await apiRequest('GET', '/simple-mcp-configs');
  testResults.crudOperations.mcpConfigList = {
    status: listResult.status,
    ok: listResult.ok,
    totalConfigs: listResult.data?.data?.mcp_servers?.length || 0
  };

  console.log(`${listResult.ok ? '✅' : '❌'} MCP Config List: Status ${listResult.status}`);
  if (listResult.ok) {
    console.log(`   📊 Total MCP configs: ${testResults.crudOperations.mcpConfigList.totalConfigs}`);
  }
}

/**
 * Test entity relationships
 */
async function testEntityRelationships() {
  console.log('\n🔗 Testing Entity Relationships...\n');

  // Get agents and check their relationships
  const agentsResult = await apiRequest('GET', '/simple-agents');
  const llmConfigsResult = await apiRequest('GET', '/simple-llm-configs');
  const mcpConfigsResult = await apiRequest('GET', '/simple-mcp-configs');

  if (agentsResult.ok && llmConfigsResult.ok) {
    const agents = agentsResult.data.data.agents || [];
    const llmConfigs = llmConfigsResult.data.data.llm_configs || [];

    const agentsWithLLM = agents.filter(agent => agent.llmConfigId);
    const validLLMReferences = agentsWithLLM.filter(agent =>
      llmConfigs.some(config => config.config_id === agent.llmConfigId)
    );

    testResults.entityRelationships.agentLLMRelationship = {
      totalAgents: agents.length,
      agentsWithLLM: agentsWithLLM.length,
      validLLMReferences: validLLMReferences.length,
      orphanedReferences: agentsWithLLM.length - validLLMReferences.length
    };

    console.log(`🤖 Agent -> LLM Config Relationships:`);
    console.log(`   Total agents: ${agents.length}`);
    console.log(`   Agents with LLM config: ${agentsWithLLM.length}`);
    console.log(`   Valid LLM references: ${validLLMReferences.length}`);
    console.log(`   Orphaned references: ${agentsWithLLM.length - validLLMReferences.length}`);
  }

  if (agentsResult.ok && mcpConfigsResult.ok) {
    const agents = agentsResult.data.data.agents || [];
    const mcpConfigs = mcpConfigsResult.data.data.mcp_servers || [];

    const agentsWithMCP = agents.filter(agent => agent.enabledMcpServers?.length > 0);

    testResults.entityRelationships.agentMCPRelationship = {
      totalAgents: agents.length,
      agentsWithMCP: agentsWithMCP.length
    };

    console.log(`🛠️ Agent -> MCP Config Relationships:`);
    console.log(`   Total agents: ${agents.length}`);
    console.log(`   Agents with MCP servers: ${agentsWithMCP.length}`);
  }
}

/**
 * Generate summary report
 */
function generateSummary() {
  console.log('\n📊 COMPREHENSIVE TEST SUMMARY\n');
  console.log('=' .repeat(50));

  // Current vs Target Endpoints
  console.log('\n🔄 ENDPOINT MIGRATION STATUS:');
  console.log('Current endpoints (simple- prefix):');
  Object.entries(testResults.currentEndpoints).forEach(([name, result]) => {
    console.log(`  ${result.ok ? '✅' : '❌'} ${name}: ${result.path} (${result.dataCount} items)`);
  });

  console.log('\nTarget endpoints (clean naming):');
  Object.entries(testResults.targetEndpoints).forEach(([name, result]) => {
    console.log(`  ${result.implemented ? '✅' : '❌'} ${name}: ${result.path} ${result.implemented ? '(Implemented)' : '(Not Implemented)'}`);
  });

  // CRUD Operations Status
  console.log('\n🔧 CRUD OPERATIONS STATUS:');
  console.log('Agents CRUD:');
  Object.entries(testResults.crudOperations).forEach(([operation, result]) => {
    if (operation.startsWith('agent')) {
      console.log(`  ${result.ok ? '✅' : '❌'} ${operation}: Status ${result.status}`);
    }
  });

  // Critical Issues Found
  console.log('\n🚨 CRITICAL ISSUES IDENTIFIED:');
  const issues = [];

  // Check LLM config persistence
  if (testResults.crudOperations.agentUpdate && !testResults.crudOperations.agentUpdate.llmConfigPersisted) {
    issues.push('❌ LLM Config not persisting after agent updates');
  } else if (testResults.crudOperations.agentUpdate?.llmConfigPersisted) {
    console.log('✅ LLM Config persistence: FIXED');
  }

  // Check disabled agents visibility
  if (testResults.crudOperations.agentList && !testResults.crudOperations.agentList.hasDisabledAgents) {
    issues.push('❌ Disabled agents not showing in list (pause/deletion bug)');
  } else if (testResults.crudOperations.agentList?.hasDisabledAgents) {
    console.log('✅ Disabled agents visibility: FIXED');
  }

  // Check endpoint migration
  const cleanEndpointsImplemented = Object.values(testResults.targetEndpoints).every(result => result.implemented);
  if (!cleanEndpointsImplemented) {
    issues.push('❌ Clean endpoint naming not fully implemented');
  }

  if (issues.length === 0) {
    console.log('✅ No critical issues found!');
  } else {
    issues.forEach(issue => console.log(issue));
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('1. Migrate frontend from /simple-* to clean endpoint names');
  console.log('2. Consolidate duplicate endpoint implementations');
  console.log('3. Implement proper route-based architecture');
  console.log('4. Add comprehensive input validation');
  console.log('5. Ensure all entity relationships are properly maintained');

  testResults.summary = {
    currentEndpointsWorking: Object.values(testResults.currentEndpoints).filter(r => r.ok).length,
    targetEndpointsImplemented: Object.values(testResults.targetEndpoints).filter(r => r.implemented).length,
    crudOperationsWorking: Object.values(testResults.crudOperations).filter(r => r.ok).length,
    criticalIssues: issues.length
  };
}

/**
 * Main test execution
 */
async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive API Test Suite...\n');
  console.log(`🎯 Testing against: ${BASE_URL}`);
  console.log(`👤 Tenant: ${TENANT_ID}\n`);

  try {
    await testCurrentEndpoints();
    await testTargetEndpoints();
    await testAgentCRUD();
    await testLLMConfigCRUD();
    await testMCPConfigCRUD();
    await testEntityRelationships();
    generateSummary();

    console.log('\n🎉 Comprehensive test suite completed!');
    console.log(`📊 Final Score: ${testResults.summary.currentEndpointsWorking + testResults.summary.crudOperationsWorking}/10 operations working`);

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run the tests
runComprehensiveTests();