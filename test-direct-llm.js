#!/usr/bin/env node

/**
 * Test Direct LLM Mode (bypass agents)
 */

const testURL = 'http://localhost:3002';

async function testDirectLLM() {
  console.log('🔧 Testing Direct LLM Mode (No Agents)\n');

  try {
    console.log('1️⃣ Testing direct LLM insights generation...');
    const response = await fetch(`${testURL}/tools/generate_insights/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arguments: {
          tenant_id: 'tenant-fintech-001',
          focus_area: 'risks',
          insight_type: 'summary',
          executive_summary: false,
          use_agents: false // Force disable agents
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Direct LLM insights generated successfully');
      console.log(`   Length: ${data.content?.length || 0} characters`);
      console.log(`   Preview: ${(data.content || '').substring(0, 150)}...`);
    } else {
      const errorText = await response.text();
      console.log('❌ Direct LLM insights failed');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${errorText}`);
    }

    console.log('\n✅ Direct LLM test completed');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test
testDirectLLM();