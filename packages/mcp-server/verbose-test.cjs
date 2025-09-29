#!/usr/bin/env node

const { spawn } = require('child_process');

async function verboseRiskRegisterTest() {
  console.log('🔍 VERBOSE RISK REGISTER TEST - FULL SERVER LOGGING');
  console.log('='.repeat(80));

  // Start the MCP server and capture ALL stderr output
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
    const lines = data.toString().split('\n').filter(line => line.trim());
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

  // Show ALL server logs without filtering
  mcpServer.stderr.on('data', (data) => {
    const logs = data.toString().split('\n');
    logs.forEach(log => {
      if (log.trim()) {
        console.log('🗣️ SERVER:', log.trim());
      }
    });
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
      }, 25000);
    });
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🔄 Initializing MCP protocol...');
    await sendRequest({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'verbose-test', version: '1.0.0' }
      }
    });

    console.log('\n✅ MCP initialized, waiting for server setup...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🎯 REQUESTING RISK REGISTER - WATCH FOR ALL SERVER LOGS...');
    console.log('='.repeat(60));
    
    const riskResponse = await sendRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'search_archer_records',
        arguments: {
          tenant_id: 'verbose-test-tenant',
          applicationName: 'Risk Register',
          pageSize: 5,
          pageNumber: 1
        }
      }
    });

    console.log('\n📥 FINAL MCP RESPONSE:');
    console.log('='.repeat(40));
    if (riskResponse.result?.content?.[0]?.text) {
      console.log(riskResponse.result.content[0].text);
    } else {
      console.log('No content in response');
      console.log(JSON.stringify(riskResponse, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Verbose test failed:', error.message);
  } finally {
    console.log('\n🔚 Terminating server...');
    mcpServer.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Verbose test completed.');
  }
}

verboseRiskRegisterTest().catch(console.error);