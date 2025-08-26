#!/usr/bin/env node

const { spawn } = require('child_process');

async function testAllApplications() {
  console.log('🎯 COMPREHENSIVE APPLICATION TEST');
  console.log('='.repeat(80));
  console.log('Testing all requested applications for record counts');
  console.log('');

  const targetApps = [
    'Risk Register',
    'Risk Review', 
    'Obligations',
    'Incidents',
    'Control',
    'Control self assessment',
    'remediation actions'
  ];

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

  mcpServer.stdout.on('data', (data) => {
    const lines = data.toString().split('\\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        if (response.id) {
          responses[response.id] = response;
        }
      } catch (e) {
        // Ignore non-JSON output
      }
    }
  });

  mcpServer.stderr.on('data', (data) => {
    const logs = data.toString();
    // Only show key logs
    if (logs.includes('Total:') || logs.includes('ERROR') || logs.includes('Failed')) {
      console.log('📋 SERVER:', logs.trim());
    }
  });

  function sendRequest(request) {
    return new Promise((resolve, reject) => {
      const reqId = requestId++;
      request.id = reqId;
      
      mcpServer.stdin.write(JSON.stringify(request) + '\\n');
      
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
        clientInfo: { name: 'comprehensive-test', version: '1.0.0' }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\\n🎯 TESTING ALL REQUESTED APPLICATIONS');
    console.log('='.repeat(60));
    
    const results = {};
    
    for (const appName of targetApps) {
      try {
        console.log(`\\n📋 Testing: ${appName}`);
        
        const response = await sendRequest({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'search_archer_records',
            arguments: {
              tenant_id: 'comprehensive-test',
              applicationName: appName,
              pageSize: 10,
              pageNumber: 1
            }
          }
        });

        if (response.result?.content?.[0]?.text) {
          const content = response.result.content[0].text;
          
          // Extract record count
          const countMatch = content.match(/Total Records?:\\s*([0-9,]+)/i);
          const count = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : 0;
          
          results[appName] = {
            count: count,
            status: 'SUCCESS',
            hasData: count > 0
          };
          
          console.log(`✅ ${appName}: ${count.toLocaleString()} records`);
        } else {
          results[appName] = {
            count: 0,
            status: 'NO_RESPONSE',
            hasData: false
          };
          console.log(`❌ ${appName}: No response`);
        }
        
      } catch (error) {
        results[appName] = {
          count: 0,
          status: 'ERROR',
          error: error.message,
          hasData: false
        };
        console.log(`❌ ${appName}: Error - ${error.message}`);
      }
    }

    console.log('\\n' + '='.repeat(80));
    console.log('🎯 COMPREHENSIVE TEST RESULTS');
    console.log('='.repeat(80));
    
    const summary = {
      total_applications: targetApps.length,
      successful: 0,
      with_data: 0,
      empty: 0,
      errors: 0
    };

    for (const [appName, result] of Object.entries(results)) {
      const status = result.hasData ? '✅ HAS DATA' : result.count === 0 ? '📭 EMPTY' : '❌ ERROR';
      console.log(`${status} ${appName}: ${result.count.toLocaleString()} records`);
      
      if (result.status === 'SUCCESS') summary.successful++;
      if (result.hasData) summary.with_data++;
      if (result.count === 0 && result.status === 'SUCCESS') summary.empty++;
      if (result.status === 'ERROR') summary.errors++;
    }
    
    console.log('\\n📊 SUMMARY:');
    console.log(`Total Applications Tested: ${summary.total_applications}`);
    console.log(`Successful Queries: ${summary.successful}`);
    console.log(`Applications with Data: ${summary.with_data}`);
    console.log(`Empty Applications: ${summary.empty}`);
    console.log(`Query Errors: ${summary.errors}`);
    
    if (summary.with_data > 0) {
      console.log('\\n🎉 SUCCESS: Found data in multiple applications!');
    } else {
      console.log('\\n⚠️ WARNING: No applications contain data');
    }

  } catch (error) {
    console.error('\\n❌ Comprehensive test failed:', error.message);
  } finally {
    mcpServer.kill();
    console.log('\\n🔚 Comprehensive test completed.');
  }
}

testAllApplications().catch(console.error);