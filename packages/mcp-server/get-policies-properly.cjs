#!/usr/bin/env node

const { spawn } = require('child_process');

async function getPoliciesViaMCP() {
  console.log('🎯 GETTING POLICIES VIA MCP SERVER');
  console.log('='.repeat(60));
  console.log('Using the MCP server to properly find and retrieve policies');
  console.log('');

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
    // Show relevant logs
    if (logs.includes('Policy') || logs.includes('Found') || logs.includes('Total') || logs.includes('ERROR')) {
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
      }, 25000);
    });
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🔄 Step 1: Initializing MCP protocol...');
    await sendRequest({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'policies-test', version: '1.0.0' }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\\n🔄 Step 2: Getting all Archer applications...');
    const appsResponse = await sendRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_archer_applications',
        arguments: {
          tenant_id: 'policies-test'
        }
      }
    });

    if (appsResponse.result?.content?.[0]?.text) {
      const appsContent = appsResponse.result.content[0].text;
      console.log('✅ Got applications list');
      
      // Look for policy-related applications in the response
      const policyMatches = appsContent.match(/.*[Pp]olic.*$/gm);
      if (policyMatches) {
        console.log('\\n🎯 Found Policy-related applications:');
        policyMatches.forEach(match => console.log(`   ${match}`));
      }
    }

    console.log('\\n🔄 Step 3: Trying to search for policies using various names...');
    
    const policyNames = [
      'Policies, Standard and Frameworks',
      'Policies',
      'Policy',
      'SOC Policies'
    ];

    for (const policyName of policyNames) {
      try {
        console.log(`\\n🔍 Testing: "${policyName}"`);
        
        const policyResponse = await sendRequest({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'search_archer_records',
            arguments: {
              tenant_id: 'policies-test',
              applicationName: policyName,
              pageSize: 10,
              pageNumber: 1
            }
          }
        });

        if (policyResponse.result?.content?.[0]?.text) {
          const content = policyResponse.result.content[0].text;
          
          // Check if we got actual records or an error
          if (content.includes('Total Records:')) {
            const countMatch = content.match(/Total Records?:\\s*([0-9,]+)/i);
            const count = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : 0;
            
            if (count > 0) {
              console.log(`✅ SUCCESS: "${policyName}" has ${count} policies!`);
              console.log('\\n📄 Policy Response:');
              console.log('-'.repeat(80));
              console.log(content);
              console.log('-'.repeat(80));
              return; // Found policies, exit
            } else {
              console.log(`📭 "${policyName}": 0 records`);
            }
          } else if (content.includes('Error') || content.includes('not found')) {
            console.log(`❌ "${policyName}": ${content.split('\\n')[0]}`);
          } else {
            console.log(`⚠️ "${policyName}": Unexpected response format`);
          }
        } else {
          console.log(`❌ "${policyName}": No response content`);
        }
        
      } catch (error) {
        console.log(`❌ "${policyName}": Error - ${error.message}`);
      }
    }

    console.log('\\n❌ No policies found with the tested names');

  } catch (error) {
    console.error('\\n❌ MCP policies test failed:', error.message);
  } finally {
    mcpServer.kill();
    console.log('\\n🔚 Policies test completed.');
  }
}

getPoliciesViaMCP().catch(console.error);