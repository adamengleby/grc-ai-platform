#!/usr/bin/env node

const { spawn } = require('child_process');

async function debugContentAPI() {
  console.log('🔍 DEBUGGING CONTENTAPI IMPLEMENTATION');
  console.log('=' .repeat(60));

  // Start the MCP server
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

  let allLogs = [];

  // Capture all logs
  mcpServer.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        allLogs.push(`STDERR: ${line}`);
        console.log(`STDERR: ${line}`);
      }
    });
  });

  mcpServer.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        allLogs.push(`STDOUT: ${line}`);
        // Only log non-JSON lines to console to avoid noise
        try {
          JSON.parse(line);
        } catch {
          console.log(`STDOUT: ${line}`);
        }
      }
    });
  });

  function sendRequest(request) {
    return new Promise((resolve) => {
      mcpServer.stdin.write(JSON.stringify(request) + '\n');
      setTimeout(() => resolve('sent'), 2000);
    });
  }

  try {
    console.log('\n⏳ Waiting for server startup...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n📡 Initializing MCP...');
    await sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'debug-contentapi', version: '1.0.0' }
      }
    });

    console.log('\n⏳ Waiting for initialization...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🎯 Testing Risk Register search...');
    await sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search_archer_records',
        arguments: {
          tenant_id: 'debug-test',
          applicationName: 'Risk Register',
          pageSize: 5,
          pageNumber: 1
        }
      }
    });

    console.log('\n⏳ Waiting for search response...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n📝 COMPLETE LOG ANALYSIS:');
    console.log('='.repeat(80));
    
    const relevantLogs = allLogs.filter(log => 
      log.includes('Level mapping') ||
      log.includes('ContentAPI') ||
      log.includes('contentapi') ||
      log.includes('Searching records') ||
      log.includes('Total record count') ||
      log.includes('Retrieved') ||
      log.includes('Error') ||
      log.includes('Failed')
    );
    
    if (relevantLogs.length > 0) {
      console.log('🔍 Relevant API logs:');
      relevantLogs.forEach(log => console.log(log));
    } else {
      console.log('❌ No relevant logs found - possible authentication or connection issue');
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    mcpServer.kill();
    console.log('\n🔚 Debug complete');
    process.exit(0);
  }
}

debugContentAPI().catch(console.error);