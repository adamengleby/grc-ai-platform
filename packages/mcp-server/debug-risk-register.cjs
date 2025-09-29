#!/usr/bin/env node

const { spawn } = require('child_process');

async function debugRiskRegisterRetrieval() {
  console.log('🔍 DEBUGGING RISK REGISTER RECORD RETRIEVAL');
  console.log('='.repeat(80));
  console.log('Goal: Verify why Risk Register shows 0 records when it should have data');
  console.log('');

  // Start the MCP server with detailed logging
  const mcpServer = spawn('node', ['dist/server/index.js'], {
    cwd: '/Users/engleby/Desktop/Developer/grc-ai-platform/packages/mcp-server',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ARCHER_BASE_URL: 'https://hostplus-uat.archerirm.com.au',
      ARCHER_USERNAME: 'api_test', 
      ARCHER_PASSWORD: 'Password1!.',
      ARCHER_INSTANCE: '710100',
      ARCHER_USER_DOMAIN_ID: '',
      NODE_ENV: 'development'
    }
  });

  let responses = [];
  let requestId = 1;
  let serverLogs = [];

  // Capture all server output for analysis
  mcpServer.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        if (response.id) {
          responses[response.id] = response;
        }
      } catch (e) {
        // Non-JSON output
      }
    }
  });

  mcpServer.stderr.on('data', (data) => {
    const logs = data.toString();
    serverLogs.push(logs);
    // Only show critical info, not all debug logs
    if (logs.includes('Authentication successful') || 
        logs.includes('session-id') ||
        logs.includes('Risk Register') ||
        logs.includes('Total Records') ||
        logs.includes('records returned') ||
        logs.includes('Error')) {
      console.log('📋 Server:', logs.trim());
    }
  });

  function sendRequest(request) {
    return new Promise((resolve, reject) => {
      const reqId = requestId++;
      request.id = reqId;
      
      mcpServer.stdin.write(JSON.stringify(request) + '\n');
      
      const pollInterval = setInterval(() => {
        if (responses[reqId]) {
          clearInterval(pollInterval);
          clearTimeout(timeout);
          resolve(responses[reqId]);
        }
      }, 100);
      
      const timeout = setTimeout(() => {
        clearInterval(pollInterval);
        reject(new Error('Request timeout'));
      }, 30000);
    });
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🔄 Initializing MCP protocol...');
    await sendRequest({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'debug-risk-register', version: '1.0.0' }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 1: Debug Risk Register specifically
    console.log('\n🎯 STEP 1: Detailed Risk Register Analysis');
    console.log('='.repeat(50));
    
    const riskRegisterResponse = await sendRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'search_archer_records',
        arguments: {
          tenant_id: 'debug-tenant',
          applicationName: 'Risk Register',
          pageSize: 20,
          pageNumber: 1
        }
      }
    });

    if (riskRegisterResponse.result?.content?.[0]?.text) {
      const content = riskRegisterResponse.result.content[0].text;
      console.log('\n📝 FULL RISK REGISTER RESPONSE:');
      console.log('-'.repeat(40));
      console.log(content);
      console.log('-'.repeat(40));
      
      // Parse specific details
      const totalMatch = content.match(/Total Records:\s*([0-9,]+)/i);
      const pageMatch = content.match(/Page \d+ \((\d+) records\)/);
      const recordsReturned = content.match(/Returned (\d+) records/i);
      
      console.log('\n🔍 PARSED DETAILS:');
      console.log(`   Total Records: ${totalMatch ? totalMatch[1] : 'NOT FOUND'}`);
      console.log(`   Page Records: ${pageMatch ? pageMatch[1] : 'NOT FOUND'}`);  
      console.log(`   Returned Records: ${recordsReturned ? recordsReturned[1] : 'NOT FOUND'}`);
    } else {
      console.log('❌ No content in Risk Register response');
    }

    // Step 2: Test different API approaches
    console.log('\n🎯 STEP 2: Test Alternative API Approaches');
    console.log('='.repeat(50));

    // Test debug API endpoint
    const debugResponse = await sendRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'debug_archer_api',
        arguments: {
          tenant_id: 'debug-tenant',
          endpoint: 'contentapi/Risk_Register?$top=5'
        }
      }
    });

    if (debugResponse.result?.content?.[0]?.text) {
      console.log('\n📝 DEBUG API RESPONSE:');
      console.log(debugResponse.result.content[0].text);
    }

    // Step 3: Get Risk Register stats
    console.log('\n🎯 STEP 3: Risk Register Statistics');
    console.log('='.repeat(50));
    
    const statsResponse = await sendRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_archer_stats',
        arguments: {
          tenant_id: 'debug-tenant',
          applicationName: 'Risk Register'
        }
      }
    });

    if (statsResponse.result?.content?.[0]?.text) {
      console.log('\n📊 RISK REGISTER STATS:');
      console.log(statsResponse.result.content[0].text);
    }

    // Step 4: Check application list for Risk Register details
    console.log('\n🎯 STEP 4: Verify Risk Register in Application List');
    console.log('='.repeat(50));
    
    const appsResponse = await sendRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_archer_applications',
        arguments: {
          tenant_id: 'debug-tenant'
        }
      }
    });

    if (appsResponse.result?.content?.[0]?.text) {
      const appsContent = appsResponse.result.content[0].text;
      // Extract Risk Register specific info
      const riskRegisterSection = appsContent.split('\n').find(line => 
        line.includes('Risk Register'));
      console.log('📋 Risk Register in App List:', riskRegisterSection || 'NOT FOUND');
      
      // Count total applications
      const totalAppsMatch = appsContent.match(/Total Applications:\s*(\d+)/);
      console.log(`📊 Total Applications Available: ${totalAppsMatch ? totalAppsMatch[1] : 'UNKNOWN'}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎯 DEBUG ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    console.log('Based on the detailed server logs and API responses above:');
    console.log('');
    console.log('1. Check if Risk Register is correctly identified in the system');
    console.log('2. Verify if the ContentAPI endpoint is responding with data');
    console.log('3. Examine if there are permission/access restrictions');
    console.log('4. Review the exact API response format and content');
    console.log('');
    console.log('📋 SERVER LOGS CAPTURED: ' + serverLogs.length + ' entries');
    console.log('🔍 If Risk Register truly has records but shows 0, the issue is likely:');
    console.log('   - Wrong API endpoint being used');
    console.log('   - Incorrect application ID mapping'); 
    console.log('   - Response parsing not handling the actual format');
    console.log('   - Permission restrictions on record-level access');
    console.log('');
    console.log('📝 Review the server logs above to identify the exact issue.');

  } catch (error) {
    console.error('\n❌ Debug test failed:', error.message);
  } finally {
    mcpServer.kill();
    console.log('\n🔚 Debug session completed.');
  }
}

debugRiskRegisterRetrieval().catch(console.error);