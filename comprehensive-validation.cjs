#!/usr/bin/env node

/**
 * Comprehensive GRC Platform Validation Suite
 * Tests all critical endpoints that were failing in production
 */

const http = require('http');

class GRCPlatformValidator {
  constructor(baseUrl = 'http://localhost:3007') {
    this.baseUrl = baseUrl;
    this.results = [];
  }

  async makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GRC-Platform-Validator/1.0'
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(body);
            resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
          } catch (err) {
            resolve({ status: res.statusCode, data: body, headers: res.headers });
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  logResult(test, success, details) {
    const result = { test, success, details, timestamp: new Date().toISOString() };
    this.results.push(result);
    const status = success ? '✅' : '❌';
    console.log(`${status} ${test}: ${details}`);
  }

  async testEndpoint(path, expectedFields = [], testName = '') {
    try {
      const response = await this.makeRequest(path);
      const name = testName || `${path} endpoint`;

      if (response.status === 200) {
        if (expectedFields.length > 0) {
          const missingFields = expectedFields.filter(field => !(field in response.data));
          if (missingFields.length === 0) {
            this.logResult(name, true, `All expected fields present`);
            return response.data;
          } else {
            this.logResult(name, false, `Missing fields: ${missingFields.join(', ')}`);
            return null;
          }
        } else {
          this.logResult(name, true, `Status ${response.status}`);
          return response.data;
        }
      } else {
        this.logResult(name, false, `Status ${response.status}`);
        return null;
      }
    } catch (error) {
      this.logResult(testName || path, false, `Error: ${error.message}`);
      return null;
    }
  }

  async runComprehensiveValidation() {
    console.log('🚀 Starting Comprehensive GRC Platform Validation\n');

    // 1. Basic Health Check
    console.log('1️⃣ BASIC HEALTH CHECKS');
    const health = await this.testEndpoint('/api/v1/health', ['status', 'timestamp', 'service'], 'Health Check');

    if (health) {
      console.log(`   Service: ${health.service}`);
      console.log(`   Version: ${health.version}`);
      console.log(`   Uptime: ${health.uptime?.toFixed(2)}s`);
    }

    // 2. LLM Configurations (Previously Failing Endpoint)
    console.log('\n2️⃣ LLM CONFIGURATIONS (PREVIOUSLY FAILING)');
    const llmConfigs = await this.testEndpoint('/api/v1/simple-llm-configs', ['success', 'data', 'message'], 'LLM Configurations');

    if (llmConfigs && llmConfigs.success) {
      console.log(`   ✅ Found ${llmConfigs.data.length} LLM configurations`);
      llmConfigs.data.forEach(config => {
        console.log(`   - ${config.name} (${config.provider}): ${config.status}`);
      });

      // Test POST functionality
      try {
        const postResponse = await this.makeRequest('/api/v1/simple-llm-configs', 'POST', {
          name: 'Test Config',
          provider: 'test',
          model: 'test-model'
        });
        this.logResult('LLM Config Creation', postResponse.status === 201, `POST status: ${postResponse.status}`);
      } catch (error) {
        this.logResult('LLM Config Creation', false, `POST error: ${error.message}`);
      }
    }

    // 3. AI Agents
    console.log('\n3️⃣ AI AGENTS');
    const agents = await this.testEndpoint('/api/v1/simple-agents', ['success', 'data'], 'AI Agents');

    if (agents && agents.success) {
      console.log(`   ✅ Found ${agents.data.length} AI agents`);
      agents.data.forEach(agent => {
        console.log(`   - ${agent.name} (${agent.type}): ${agent.isActive ? 'Active' : 'Inactive'}`);
        if (agent.metrics) {
          console.log(`     Processed: ${agent.metrics.totalProcessed}, Accuracy: ${(agent.metrics.accuracyRate * 100).toFixed(1)}%`);
        }
      });
    }

    // 4. Credentials
    console.log('\n4️⃣ CREDENTIALS');
    const credentials = await this.testEndpoint('/api/v1/simple-credentials', ['success', 'data'], 'Credentials');

    if (credentials && credentials.success) {
      console.log(`   ✅ Found ${credentials.data.length} credential configurations`);
      credentials.data.forEach(cred => {
        console.log(`   - ${cred.name} (${cred.provider}): ${cred.isValid ? 'Valid' : 'Invalid'}`);
      });
    }

    // 5. MCP Server Tools
    console.log('\n5️⃣ MCP SERVER TOOLS');
    const mcpTools = await this.testEndpoint('/api/v1/mcp-servers/tools', ['success', 'data'], 'MCP Tools');

    if (mcpTools && mcpTools.success) {
      console.log(`   ✅ Found ${mcpTools.data.tools.length} available tools`);
      console.log(`   ✅ ${mcpTools.data.activeServers} active servers`);
      mcpTools.data.tools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
    }

    // 6. Service Health Endpoints
    console.log('\n6️⃣ SERVICE HEALTH ENDPOINTS');
    await this.testEndpoint('/api/v1/data-quality/health', ['status', 'service'], 'Data Quality Service');
    await this.testEndpoint('/api/v1/insights/health', ['status', 'service'], 'Risk Insights Service');

    // 7. Demo Endpoint
    console.log('\n7️⃣ DEMO ENDPOINT');
    const demo = await this.testEndpoint('/api/v1/demo', ['message', 'endpoints'], 'Demo Endpoint');
    if (demo) {
      console.log(`   ✅ Available endpoints: ${demo.endpoints.length}`);
    }

    // 8. Error Handling Test
    console.log('\n8️⃣ ERROR HANDLING');
    await this.testEndpoint('/api/v1/nonexistent-endpoint', [], 'Non-existent Endpoint (should return 404)');

    // Summary
    console.log('\n📊 VALIDATION SUMMARY');
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests === 0) {
      console.log('\n🎉 ALL TESTS PASSED! The GRC Platform backend is fully functional.');
    } else {
      console.log('\n⚠️  Some tests failed. See details above.');
    }

    console.log('\n🔗 ENDPOINT URLS:');
    console.log(`Health: ${this.baseUrl}/api/v1/health`);
    console.log(`LLM Configs: ${this.baseUrl}/api/v1/simple-llm-configs`);
    console.log(`Agents: ${this.baseUrl}/api/v1/simple-agents`);
    console.log(`Credentials: ${this.baseUrl}/api/v1/simple-credentials`);
    console.log(`MCP Tools: ${this.baseUrl}/api/v1/mcp-servers/tools`);

    return { totalTests, passedTests, failedTests, results: this.results };
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3007';
  console.log(`Testing GRC Platform at: ${baseUrl}\n`);

  const validator = new GRCPlatformValidator(baseUrl);
  validator.runComprehensiveValidation()
    .then(summary => {
      process.exit(summary.failedTests === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

module.exports = GRCPlatformValidator;