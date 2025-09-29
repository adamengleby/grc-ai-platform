#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

/**
 * Test script to directly call MCP server and show real Archer data
 */
async function testArcherData() {
  console.log('🔍 Testing Direct Archer Data Retrieval...\n');
  
  try {
    // Path to MCP server
    const mcpServerPath = path.resolve(__dirname, '../mcp-server/src/server/index.ts');
    
    console.log('Starting MCP server connection...');
    
    // Spawn MCP server process with Archer credentials
    const mcpProcess = spawn('npx', ['tsx', mcpServerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ARCHER_BASE_URL: 'https://hostplus-uat.archerirm.com.au',
        ARCHER_USERNAME: 'api_test',
        ARCHER_PASSWORD: 'Password1!.',
        ARCHER_INSTANCE: '710100'
      }
    });

    let responseData = '';
    let errorOutput = '';
    
    // Handle stdout (MCP responses)
    mcpProcess.stdout.on('data', (data) => {
      responseData += data.toString();
    });

    // Handle stderr (errors and logs)
    mcpProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      if (data.toString().includes('GRC Production MCP Server running')) {
        console.log('✅ MCP Server connected!\n');
        
        // Test 1: Get Archer Applications
        console.log('📋 Test 1: Getting Archer Applications...');
        sendMCPRequest(mcpProcess, 'tools/call', {
          name: 'get_archer_applications',
          arguments: {
            tenant_id: 'test-tenant',
            archer_connection: {
              baseUrl: 'https://hostplus-uat.archerirm.com.au:443',
              username: 'api_test',
              password: 'Password1!.',
              instanceId: '710100',
              userDomainId: '1'
            }
          }
        }, 1);
        
        // Test 2: Get Risk Register Records (after delay)
        setTimeout(() => {
          console.log('🎯 Test 2: Getting Risk Register Records...');
          sendMCPRequest(mcpProcess, 'tools/call', {
            name: 'search_archer_records',
            arguments: {
              tenant_id: 'test-tenant',
              applicationName: 'Risk Register',
              pageSize: 10,
              pageNumber: 1,
              includeFullData: true,
              archer_connection: {
                baseUrl: 'https://hostplus-uat.archerirm.com.au:443',
                username: 'api_test',
                password: 'Password1!.',
                instanceId: '710100',
                userDomainId: '1'
              }
            }
          }, 2);
        }, 3000);
        
        // Test 3: Get Controls Records
        setTimeout(() => {
          console.log('⚙️ Test 3: Getting Controls Records...');
          sendMCPRequest(mcpProcess, 'tools/call', {
            name: 'search_archer_records',
            arguments: {
              tenant_id: 'test-tenant',
              applicationName: 'Controls',
              pageSize: 10,
              pageNumber: 1,
              includeFullData: true,
              archer_connection: {
                baseUrl: 'https://hostplus-uat.archerirm.com.au:443',
                username: 'api_test',
                password: 'Password1!.',
                instanceId: '710100',
                userDomainId: '1'
              }
            }
          }, 3);
        }, 6000);
        
        // Close after tests
        setTimeout(() => {
          mcpProcess.kill();
        }, 12000);
      }
    });

    // Handle responses
    let requestId = 0;
    const pendingRequests = new Map();
    
    function sendMCPRequest(process, method, params, id) {
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };
      
      pendingRequests.set(id, Date.now());
      process.stdin.write(JSON.stringify(request) + '\n');
    }
    
    // Parse responses
    let buffer = '';
    mcpProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            if (response.id && pendingRequests.has(response.id)) {
              console.log(`\n📊 Response for Test ${response.id}:`);
              console.log('='.repeat(50));
              
              if (response.result && response.result.content) {
                const content = response.result.content.find(item => item.type === 'text');
                if (content) {
                  console.log(content.text);
                } else {
                  console.log('Raw response:', JSON.stringify(response.result, null, 2));
                }
              } else if (response.error) {
                console.log('❌ Error:', response.error.message);
              } else {
                console.log('Raw response:', JSON.stringify(response, null, 2));
              }
              
              console.log('='.repeat(50));
              pendingRequests.delete(response.id);
            }
          } catch (e) {
            // Ignore non-JSON lines
          }
        }
      }
    });

    // Handle process exit
    mcpProcess.on('exit', (code) => {
      console.log(`\n🏁 MCP server exited with code ${code}`);
      
      if (errorOutput && !errorOutput.includes('running on stdio')) {
        console.log('\nServer output:');
        console.log(errorOutput);
      }
      
      console.log('\n✅ Test completed! The data above shows what is being retrieved from your live Archer instance.');
    });

  } catch (error) {
    console.error('❌ Error testing Archer data:', error);
  }
}

// Run the test
testArcherData();