#!/usr/bin/env node

/**
 * AI Agent System Test
 * Tests the new agent-based insights vs direct LLM
 */

const testURL = 'http://localhost:3002';

async function testAgentSystem() {
  console.log('🤖 AI Agent System Test\n');

  try {
    // Test 1: Regular insights (should use agents by default)
    console.log('1️⃣ Testing default insights generation...');
    const regularResponse = await fetch(`${testURL}/tools/generate_insights/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arguments: {
          tenant_id: 'tenant-fintech-001',
          focus_area: 'risks',
          insight_type: 'summary',
          executive_summary: false
        }
      })
    });

    if (regularResponse.ok) {
      const data = await regularResponse.json();
      console.log('✅ Regular insights generated');
      console.log(`   Length: ${data.content?.length || 0} characters`);
      console.log(`   Preview: ${(data.content || '').substring(0, 100)}...`);
    } else {
      console.log('❌ Regular insights failed');
    }

    // Test 2: Force direct LLM (disable agents)
    console.log('\n2️⃣ Testing direct LLM mode...');
    const llmResponse = await fetch(`${testURL}/tools/generate_insights/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arguments: {
          tenant_id: 'tenant-fintech-001',
          focus_area: 'risks',
          insight_type: 'summary',
          executive_summary: false,
          use_agents: false // Disable agents
        }
      })
    });

    if (llmResponse.ok) {
      const data = await llmResponse.json();
      console.log('✅ Direct LLM insights generated');
      console.log(`   Length: ${data.content?.length || 0} characters`);
      console.log(`   Preview: ${(data.content || '').substring(0, 100)}...`);
    } else {
      console.log('❌ Direct LLM insights failed');
    }

    // Test 3: Check health endpoint
    console.log('\n3️⃣ Testing system health...');
    const healthResponse = await fetch(`${testURL}/health`);
    
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ System healthy');
      console.log(`   Status: ${health.status}`);
      console.log(`   Features: ${health.features?.join(', ') || 'N/A'}`);
    } else {
      console.log('❌ Health check failed');
    }

    console.log('\n🎉 Agent system test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test
testAgentSystem();