#!/usr/bin/env node

const { spawn } = require('child_process');

async function testMultipleApps() {
  console.log('🔍 TESTING MULTIPLE APPLICATIONS FOR ACTUAL RECORD COUNTS');
  console.log('='.repeat(80));

  const appsToTest = [
    'Risk Register',
    'Controls', 
    'Obligations',
    'Incidents and Requests',
    'Business Processes',
    'Business Unit',
    'Contacts'
  ];

  const mcpServer = spawn('node', ['dist/server/index.js'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ARCHER_BASE_URL: 'https://hostplus-uat.archerirm.com.au',
      ARCHER_USERNAME: 'api_test',
      ARCHER_PASSWORD: 'Password1!.',
      ARCHER_INSTANCE: '710100',
      ARCHER_USER_DOMAIN_ID: ''
    }
  });

  let appResults = {};

  mcpServer.stderr.on('data', (data) => {
    const msg = data.toString();
    // Look for record count messages
    const countMatch = msg.match(/Total record count: (\d+)/);
    if (countMatch) {
      const count = parseInt(countMatch[1]);
      console.log(`📊 Found ${count} records`);
    }
  });

  let requestId = 1;
  function sendRequest(request) {
    return new Promise((resolve) => {
      request.id = requestId++;
      mcpServer.stdin.write(JSON.stringify(request) + '\n');
      setTimeout(() => resolve('sent'), 3000);
    });
  }

  try {
    console.log('\n⏳ Starting server...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📡 Initializing...');
    await sendRequest({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-multiple-apps', version: '1.0.0' }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🎯 Testing applications for record counts...\n');

    for (const [index, appName] of appsToTest.entries()) {
      console.log(`[${index + 1}/${appsToTest.length}] Testing ${appName}...`);
      
      await sendRequest({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'search_archer_records',
          arguments: {
            tenant_id: 'test',
            applicationName: appName,
            pageSize: 5,
            pageNumber: 1
          }
        }
      });

      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    console.log('\n⏳ Waiting for final results...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n✅ Test completed! Check the record counts above.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mcpServer.kill();
    process.exit(0);
  }
}

testMultipleApps().catch(console.error);