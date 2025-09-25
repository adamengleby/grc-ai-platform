#!/usr/bin/env node

const { spawn } = require('child_process');

async function getRawRiskRegisterResponse() {
  console.log('🔍 CAPTURING RAW RISK REGISTER API RESPONSE');
  console.log('='.repeat(80));

  // Start the MCP server and capture ALL output
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
  let allServerLogs = [];

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

  mcpServer.stderr.on('data', (data) => {
    const logs = data.toString();
    allServerLogs.push(logs);
    
    // Show all logs related to Risk Register, API calls, and responses
    if (logs.includes('Risk Register') || 
        logs.includes('Archer API') ||
        logs.includes('REST API') ||
        logs.includes('ContentAPI') ||
        logs.includes('makeRequest') ||
        logs.includes('Response') ||
        logs.includes('records') ||
        logs.includes('Error') ||
        logs.includes('HTTP') ||
        logs.includes('Status') ||
        logs.includes('searchRecords')) {
      console.log('📋 SERVER LOG:', logs.trim());
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
      }, 25000);
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
        clientInfo: { name: 'raw-response-test', version: '1.0.0' }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🎯 REQUESTING RISK REGISTER RECORDS WITH FULL LOGGING...');
    console.log('='.repeat(60));
    
    const riskResponse = await sendRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'search_archer_records',
        arguments: {
          tenant_id: 'raw-test-tenant',
          applicationName: 'Risk Register',
          pageSize: 5,
          pageNumber: 1
        }
      }
    });

    console.log('\n📥 COMPLETE MCP RESPONSE OBJECT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(riskResponse, null, 2));
    console.log('='.repeat(80));

    if (riskResponse.result?.content?.[0]?.text) {
      const content = riskResponse.result.content[0].text;
      console.log('\n📄 MCP RESPONSE TEXT CONTENT:');
      console.log('='.repeat(80));
      console.log(content);
      console.log('='.repeat(80));
    }

    if (riskResponse.error) {
      console.log('\n❌ MCP ERROR RESPONSE:');
      console.log('='.repeat(80));
      console.log(JSON.stringify(riskResponse.error, null, 2));
      console.log('='.repeat(80));
    }

    console.log('\n📋 ALL SERVER LOGS CAPTURED:');
    console.log('='.repeat(80));
    allServerLogs.forEach((log, index) => {
      if (log.trim()) {
        console.log(`[${index + 1}] ${log.trim()}`);
      }
    });
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Raw response test failed:', error.message);
    
    console.log('\n📋 SERVER LOGS FROM FAILED REQUEST:');
    console.log('='.repeat(80));
    allServerLogs.forEach((log, index) => {
      if (log.trim()) {
        console.log(`[${index + 1}] ${log.trim()}`);
      }
    });
    console.log('='.repeat(80));
  } finally {
    mcpServer.kill();
    console.log('\n🔚 Raw response capture completed.');
  }
}

getRawRiskRegisterResponse().catch(console.error);