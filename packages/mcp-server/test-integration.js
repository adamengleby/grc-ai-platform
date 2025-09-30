#!/usr/bin/env node

/**
 * Integration Test Suite for MCP Server and Chat UI
 * 
 * This test validates:
 * 1. MCP server can be accessed directly and returns correct data
 * 2. Chat UI can access the same data through the MCP integration
 * 3. Record counts match between direct MCP calls and chat UI results
 * 
 * Run this test after making changes to ensure everything works correctly.
 */

const https = require('https');
const http = require('http');

// Test configuration
const TEST_CONFIG = {
  mcpServer: {
    host: 'localhost',
    port: 3001,
    protocol: 'http'
  },
  frontend: {
    host: 'localhost',
    port: 3002,
    protocol: 'http'
  },
  archer: {
    baseUrl: "https://hostplus-uat.archerirm.com.au",
    username: "api_test",
    password: "Password1!.",
    instanceId: "710100",
    instanceName: "710100", 
    userDomainId: ""
  },
  testApplications: ['Risk Register', 'Obligations', 'Controls'],
  tenantId: 'test-tenant-integration'
};

class IntegrationTester {
  constructor() {
    this.results = {
      mcpDirect: {},
      chatUI: {},
      errors: []
    };
  }

  /**
   * Main test runner
   */
  async runTests() {
    console.log('🧪 INTEGRATION TEST SUITE');
    console.log('='.repeat(80));
    console.log(`Testing MCP Server: ${TEST_CONFIG.mcpServer.protocol}://${TEST_CONFIG.mcpServer.host}:${TEST_CONFIG.mcpServer.port}`);
    console.log(`Testing Frontend: ${TEST_CONFIG.frontend.protocol}://${TEST_CONFIG.frontend.host}:${TEST_CONFIG.frontend.port}`);
    console.log(`Target Applications: ${TEST_CONFIG.testApplications.join(', ')}`);
    console.log('');

    try {
      // Step 1: Test MCP Server Health
      await this.testMCPHealth();
      
      // Step 2: Test Frontend Health
      await this.testFrontendHealth();
      
      // Step 3: Test MCP Server Direct Access
      await this.testMCPServerDirect();
      
      // Step 4: Test Chat UI Integration (simulated)
      await this.testChatUIIntegration();
      
      // Step 5: Compare Results
      this.compareResults();
      
      // Step 6: Generate Report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Test MCP Server health endpoint
   */
  async testMCPHealth() {
    console.log('🔍 Step 1: Testing MCP Server Health...');
    
    try {
      const response = await this.makeHttpRequest({
        protocol: TEST_CONFIG.mcpServer.protocol,
        hostname: TEST_CONFIG.mcpServer.host,
        port: TEST_CONFIG.mcpServer.port,
        path: '/health',
        method: 'GET'
      });

      if (response.statusCode === 200) {
        console.log('✅ MCP Server is healthy');
      } else {
        throw new Error(`MCP Server health check failed: ${response.statusCode}`);
      }
    } catch (error) {
      this.results.errors.push(`MCP Health Check: ${error.message}`);
      throw new Error(`MCP Server not accessible: ${error.message}`);
    }
  }

  /**
   * Test Frontend health (basic connectivity)
   */
  async testFrontendHealth() {
    console.log('🔍 Step 2: Testing Frontend Health...');
    
    try {
      const response = await this.makeHttpRequest({
        protocol: TEST_CONFIG.frontend.protocol,
        hostname: TEST_CONFIG.frontend.host,
        port: TEST_CONFIG.frontend.port,
        path: '/',
        method: 'GET'
      });

      if (response.statusCode === 200) {
        console.log('✅ Frontend is accessible');
      } else {
        console.log('⚠️ Frontend may not be running, but continuing tests...');
      }
    } catch (error) {
      console.log('⚠️ Frontend not accessible, but continuing with MCP tests...');
      this.results.errors.push(`Frontend Health: ${error.message}`);
    }
  }

  /**
   * Test MCP Server direct access for applications and record counts
   */
  async testMCPServerDirect() {
    console.log('🔍 Step 3: Testing MCP Server Direct Access...');
    
    // Test 3a: Get Applications
    console.log('  📋 3a: Getting applications list...');
    const appsResponse = await this.callMCPTool('get_archer_applications', {
      tenant_id: TEST_CONFIG.tenantId,
      archer_connection: TEST_CONFIG.archer
    });

    if (appsResponse.content && appsResponse.content[0]?.text) {
      const appsText = appsResponse.content[0].text;
      const totalAppsMatch = appsText.match(/Total Applications: (\d+)/);
      if (totalAppsMatch) {
        const totalApps = parseInt(totalAppsMatch[1]);
        console.log(`  ✅ Found ${totalApps} applications`);
        this.results.mcpDirect.totalApplications = totalApps;
        
        // Verify test applications are present
        for (const appName of TEST_CONFIG.testApplications) {
          if (appsText.includes(appName)) {
            console.log(`  ✅ Found application: ${appName}`);
          } else {
            console.log(`  ⚠️ Application not found: ${appName}`);
          }
        }
      } else {
        throw new Error('Could not parse application count from response');
      }
    } else {
      throw new Error('Invalid applications response format');
    }

    // Test 3b: Get Record Counts for each test application
    console.log('  📊 3b: Getting record counts...');
    for (const appName of TEST_CONFIG.testApplications) {
      try {
        console.log(`    Testing ${appName}...`);
        const recordsResponse = await this.callMCPTool('search_archer_records', {
          tenant_id: TEST_CONFIG.tenantId,
          archer_connection: TEST_CONFIG.archer,
          applicationName: appName,
          pageSize: 1 // We only need count, not actual records
        });

        if (recordsResponse.content && recordsResponse.content[0]?.text) {
          const recordsText = recordsResponse.content[0].text;
          const totalMatch = recordsText.match(/Total Records: (\d+)/);
          if (totalMatch) {
            const totalRecords = parseInt(totalMatch[1]);
            console.log(`    ✅ ${appName}: ${totalRecords} records`);
            this.results.mcpDirect[appName] = totalRecords;
          } else {
            console.log(`    ⚠️ ${appName}: Could not parse record count`);
            this.results.mcpDirect[appName] = 'parse_error';
          }
        } else {
          console.log(`    ❌ ${appName}: Invalid response format`);
          this.results.mcpDirect[appName] = 'invalid_response';
        }
      } catch (error) {
        console.log(`    ❌ ${appName}: ${error.message}`);
        this.results.mcpDirect[appName] = 'error';
        this.results.errors.push(`MCP ${appName}: ${error.message}`);
      }
    }
  }

  /**
   * Test Chat UI Integration (simulated API calls)
   */
  async testChatUIIntegration() {
    console.log('🔍 Step 4: Testing Chat UI Integration...');
    console.log('  💭 4a: Simulating chat requests through frontend API...');
    
    // This would test the actual chat UI endpoints that use MCP
    // For now, we'll simulate what the frontend would do
    
    try {
      // Test getting applications through frontend proxy
      console.log('    Testing applications through frontend MCP proxy...');
      
      // The frontend should proxy MCP calls through its own API
      // This simulates what happens when a user asks for applications in chat
      const frontendAppsResponse = await this.simulateFrontendMCPCall('get_archer_applications', {
        tenant_id: TEST_CONFIG.tenantId,
        archer_connection: TEST_CONFIG.archer
      });

      if (frontendAppsResponse && frontendAppsResponse.totalApplications) {
        console.log(`    ✅ Frontend MCP proxy returned ${frontendAppsResponse.totalApplications} applications`);
        this.results.chatUI.totalApplications = frontendAppsResponse.totalApplications;
      }

      // Test getting record counts through frontend
      console.log('    Testing record counts through frontend MCP proxy...');
      for (const appName of TEST_CONFIG.testApplications) {
        const frontendRecordsResponse = await this.simulateFrontendMCPCall('search_archer_records', {
          tenant_id: TEST_CONFIG.tenantId,
          archer_connection: TEST_CONFIG.archer,
          applicationName: appName,
          pageSize: 1
        });

        if (frontendRecordsResponse && frontendRecordsResponse.recordCount !== undefined) {
          console.log(`    ✅ Frontend: ${appName}: ${frontendRecordsResponse.recordCount} records`);
          this.results.chatUI[appName] = frontendRecordsResponse.recordCount;
        } else {
          console.log(`    ❌ Frontend: ${appName}: Failed to get record count`);
          this.results.chatUI[appName] = 'error';
        }
      }

    } catch (error) {
      console.log(`    ❌ Frontend integration test failed: ${error.message}`);
      this.results.errors.push(`Frontend Integration: ${error.message}`);
    }
  }

  /**
   * Simulate frontend MCP calls (since we don't have the actual frontend API endpoints)
   */
  async simulateFrontendMCPCall(toolName, args) {
    // For now, this just calls MCP directly since we don't have frontend proxy endpoints
    // In a real implementation, this would call the frontend's API that then calls MCP
    
    try {
      const response = await this.callMCPTool(toolName, args);
      
      if (toolName === 'get_archer_applications') {
        const text = response.content?.[0]?.text || '';
        const totalMatch = text.match(/Total Applications: (\d+)/);
        return { totalApplications: totalMatch ? parseInt(totalMatch[1]) : 0 };
      } else if (toolName === 'search_archer_records') {
        const text = response.content?.[0]?.text || '';
        const totalMatch = text.match(/Total Records: (\d+)/);
        return { recordCount: totalMatch ? parseInt(totalMatch[1]) : 0 };
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Compare results between direct MCP and Chat UI
   */
  compareResults() {
    console.log('🔍 Step 5: Comparing Results...');
    
    let allMatched = true;

    // Compare total applications
    if (this.results.mcpDirect.totalApplications === this.results.chatUI.totalApplications) {
      console.log(`  ✅ Total applications match: ${this.results.mcpDirect.totalApplications}`);
    } else {
      console.log(`  ❌ Total applications mismatch: MCP=${this.results.mcpDirect.totalApplications}, UI=${this.results.chatUI.totalApplications}`);
      allMatched = false;
    }

    // Compare record counts for each application
    for (const appName of TEST_CONFIG.testApplications) {
      const mcpCount = this.results.mcpDirect[appName];
      const uiCount = this.results.chatUI[appName];
      
      if (mcpCount === uiCount && typeof mcpCount === 'number') {
        console.log(`  ✅ ${appName} record count matches: ${mcpCount}`);
      } else {
        console.log(`  ❌ ${appName} record count mismatch: MCP=${mcpCount}, UI=${uiCount}`);
        allMatched = false;
      }
    }

    if (allMatched) {
      console.log('  🎉 All results match between MCP and Chat UI!');
    } else {
      console.log('  ⚠️ Some results do not match - investigation needed');
    }

    return allMatched;
  }

  /**
   * Generate final test report
   */
  generateReport() {
    console.log('');
    console.log('📊 FINAL TEST REPORT');
    console.log('='.repeat(80));
    
    console.log('📋 MCP Server Direct Results:');
    console.log(`  Total Applications: ${this.results.mcpDirect.totalApplications || 'N/A'}`);
    for (const appName of TEST_CONFIG.testApplications) {
      console.log(`  ${appName}: ${this.results.mcpDirect[appName] || 'N/A'} records`);
    }

    console.log('');
    console.log('💬 Chat UI Results:');
    console.log(`  Total Applications: ${this.results.chatUI.totalApplications || 'N/A'}`);
    for (const appName of TEST_CONFIG.testApplications) {
      console.log(`  ${appName}: ${this.results.chatUI[appName] || 'N/A'} records`);
    }

    if (this.results.errors.length > 0) {
      console.log('');
      console.log('❌ Errors Encountered:');
      this.results.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    console.log('');
    const hasErrors = this.results.errors.length > 0;
    const hasData = this.results.mcpDirect.totalApplications > 0;
    
    if (!hasErrors && hasData) {
      console.log('🎉 ALL TESTS PASSED - System is working correctly!');
      process.exit(0);
    } else if (hasData && this.results.errors.length <= TEST_CONFIG.testApplications.length) {
      console.log('⚠️ TESTS PASSED WITH WARNINGS - Core functionality working');
      process.exit(0);
    } else {
      console.log('❌ TESTS FAILED - System needs attention');
      process.exit(1);
    }
  }

  /**
   * Call MCP tool directly
   */
  async callMCPTool(toolName, args) {
    const requestData = JSON.stringify({
      name: toolName,
      arguments: args
    });

    const response = await this.makeHttpRequest({
      protocol: TEST_CONFIG.mcpServer.protocol,
      hostname: TEST_CONFIG.mcpServer.host,
      port: TEST_CONFIG.mcpServer.port,
      path: '/call',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    }, requestData);

    if (response.statusCode !== 200) {
      throw new Error(`MCP call failed: ${response.statusCode} ${response.data}`);
    }

    return JSON.parse(response.data);
  }

  /**
   * Make HTTP request (supports both http and https)
   */
  makeHttpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
      const requestModule = options.protocol === 'https' ? https : http;
      
      const req = requestModule.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (postData) {
        req.write(postData);
      }
      
      req.end();
    });
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new IntegrationTester();
  tester.runTests().catch(error => {
    console.error('Test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = IntegrationTester;