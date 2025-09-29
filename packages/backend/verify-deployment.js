/**
 * Verify Production Deployment Success
 * Tests all fixed endpoints to confirm deployment worked
 */

const PRODUCTION_BACKEND = 'https://grc-backend-simple.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io/api/v1';
const TENANT_ID = 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d';

async function verifyDeployment() {
  console.log('🔍 VERIFYING PRODUCTION DEPLOYMENT SUCCESS...\n');

  const headers = {
    'Content-Type': 'application/json',
    'x-tenant-id': TENANT_ID,
    'x-user-id': 'user-001'
  };

  // Test 1: Health check should show fixes deployed
  console.log('🏥 Testing Health Check for Deployment Status...');
  try {
    const response = await fetch(`${PRODUCTION_BACKEND}/health`, { headers });
    const data = await response.json();

    if (data.fixes) {
      console.log('✅ Backend deployment successful!');
      console.log('📋 Fixes deployed:', Object.keys(data.fixes).join(', '));
      console.log('🎯 Build version:', data.version);
    } else {
      console.log('❌ Backend still running old code');
    }
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }

  // Test 2: Agent creation should work
  console.log('\n📝 Testing Agent Creation (Was Failing)...');
  try {
    const response = await fetch(`${PRODUCTION_BACKEND}/simple-agents/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Deployment Test Agent',
        description: 'Testing if agent creation works after deployment',
        llmConfigId: 'a1234567-89ab-4cde-f012-3456789abcd0'
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Agent creation FIXED!');
      console.log(`🆔 Created agent: ${data.data?.id}`);
      return data.data?.id; // Return for further testing
    } else {
      console.log(`❌ Agent creation still failing: ${response.status}`);
    }
  } catch (error) {
    console.log('❌ Agent creation error:', error.message);
  }

  // Test 3: LLM configs should have data
  console.log('\n🤖 Testing LLM Configs (Should Have Mock Data)...');
  try {
    const response = await fetch(`${PRODUCTION_BACKEND}/simple-llm-configs`, { headers });
    const data = await response.json();

    const configCount = data.data?.llm_configs?.length || 0;
    if (configCount > 0) {
      console.log(`✅ LLM configs available: ${configCount}`);
      console.log('📋 Available configs:', data.data.llm_configs.map(c => c.name).join(', '));
    } else {
      console.log('❌ No LLM configs available');
    }
  } catch (error) {
    console.log('❌ LLM configs error:', error.message);
  }

  // Test 4: MCP servers should have data
  console.log('\n🛠️ Testing MCP Configs (Should Have Mock Data)...');
  try {
    const response = await fetch(`${PRODUCTION_BACKEND}/simple-mcp-configs`, { headers });
    const data = await response.json();

    const mcpCount = data.data?.mcp_servers?.length || 0;
    if (mcpCount > 0) {
      console.log(`✅ MCP servers available: ${mcpCount}`);
    } else {
      console.log('❌ No MCP servers available');
    }
  } catch (error) {
    console.log('❌ MCP configs error:', error.message);
  }

  console.log('\n🎯 DEPLOYMENT VERIFICATION COMPLETE');
}

verifyDeployment().catch(console.error);