#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function testComprehensiveRecords() {
  console.log('🔍 Comprehensive Record Count Test\n');
  console.log('Testing applications:', ['Risk Register', 'Risk Review', 'Obligations', 'Incidents', 'Controls', 'Control Self Assessment', 'Remediation Actions']);
  console.log('\n' + '='.repeat(50));

  const applications = [
    'Risk Register',
    'Risk Review', 
    'Obligations',
    'Incidents and Requests',
    'Controls',
    'Control Self Assessments',
    'Remediation Actions'
  ];

  // Compile TypeScript to JavaScript first
  console.log('🔨 Compiling TypeScript...');
  
  const tscProcess = spawn('npx', ['tsc', '--noEmit', 'false', '--outDir', 'temp-dist'], {
    cwd: '/Users/engleby/Desktop/Developer/grc-ai-platform/packages/mcp-server',
    stdio: 'pipe'
  });
  
  let tscOutput = '';
  tscProcess.stdout.on('data', (data) => tscOutput += data.toString());
  tscProcess.stderr.on('data', (data) => tscOutput += data.toString());
  
  await new Promise((resolve) => {
    tscProcess.on('close', (code) => {
      if (code !== 0) {
        console.log('⚠️ TypeScript compilation had issues, but continuing with direct node execution...');
      }
      resolve();
    });
  });

  // Start the MCP server directly with ts-node
  const mcpServer = spawn('npx', ['ts-node', 'src/server/index.ts'], {
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

  // Handle server output
  mcpServer.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        if (response.id) {
          responses[response.id] = response;
        }
      } catch (e) {
        // Ignore non-JSON output - likely debug logs
      }
    }
  });

  // Handle server errors
  mcpServer.stderr.on('data', (data) => {
    const errorText = data.toString();
    if (errorText.includes('Error') || errorText.includes('Failed')) {
      console.log('Server error:', errorText.substring(0, 200));
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
        reject(new Error('Request timeout after 20 seconds'));
      }, 20000);
    });
  }

  try {
    // Initialize server
    console.log('🚀 Initializing MCP server...');
    await sendRequest({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'comprehensive-test', version: '1.0.0' }
      }
    });

    console.log('✅ Server initialized\n');

    // Test each application
    const recordCounts = {};
    
    for (const [index, appName] of applications.entries()) {
      try {
        process.stdout.write(`🔍 [${index + 1}/${applications.length}] ${appName}... `);
        
        const searchResponse = await sendRequest({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'search_archer_records',
            arguments: {
              application_name: appName,
              page_size: 5,
              page_number: 1
            }
          }
        });
        
        if (searchResponse.result && searchResponse.result.content) {
          const content = searchResponse.result.content[0].text;
          
          // Multiple patterns to extract record counts
          const patterns = [
            /Total Records?:\s*(\d+)/i,
            /Found (\d+) records?/i,
            /Returned (\d+) records?/i,
            /(\d+) total records?/i,
            /Records found:\s*(\d+)/i
          ];
          
          let count = null;
          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
              count = parseInt(match[1]);
              break;
            }
          }
          
          if (count !== null) {
            recordCounts[appName] = count;
            console.log(`✅ ${count} records`);
          } else if (content.toLowerCase().includes('no records') || content.includes('0 records')) {
            recordCounts[appName] = 0;
            console.log('✅ 0 records');
          } else if (content.toLowerCase().includes('error')) {
            recordCounts[appName] = 'Error';
            console.log('❌ Error in response');
          } else {
            recordCounts[appName] = 'Unable to parse';
            console.log('⚠️ Unable to parse count');
            // For debugging, show first 150 chars of response
            console.log(`    Response: ${content.substring(0, 150)}...`);
          }
        } else {
          recordCounts[appName] = 'No response';
          console.log('❌ No valid response');
        }
        
      } catch (error) {
        recordCounts[appName] = `Error: ${error.message}`;
        console.log(`❌ ${error.message}`);
      }
      
      // Brief pause between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Final comprehensive summary
    console.log('\n' + '='.repeat(80));
    console.log('🎯 COMPREHENSIVE ARCHER GRC RECORD COUNT SUMMARY');
    console.log('='.repeat(80));
    console.log('Platform: Hostplus UAT Archer Instance (710100)');
    console.log('Endpoint: https://hostplus-uat.archerirm.com.au');
    console.log('Test Date:', new Date().toISOString().split('T')[0]);
    console.log('\nApplications tested:');
    
    let totalRecords = 0;
    let availableApplications = 0;
    
    for (const [appName, count] of Object.entries(recordCounts)) {
      const status = typeof count === 'number' ? 
        (count > 0 ? '✅' : '⚪') : 
        (count === 'Error' ? '❌' : '⚠️');
      
      console.log(`${status} ${appName.padEnd(25)}: ${count}`);
      
      if (typeof count === 'number') {
        totalRecords += count;
        availableApplications++;
      }
    }
    
    console.log('='.repeat(80));
    console.log(`📊 Summary: ${availableApplications}/${applications.length} applications accessible`);
    console.log(`📈 Total records found: ${totalRecords}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    mcpServer.kill();
  }
}

testComprehensiveRecords().catch(console.error);