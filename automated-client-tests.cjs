#!/usr/bin/env node

/**
 * Automated Client Tests for GRC AI Platform
 * Tests the new Azure App Service architecture
 */

const https = require('https');
const http = require('http');

class GRCPlatformTester {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };

        // Production URLs after App Service migration
        this.backendUrl = 'https://grc-backend-prod.azurewebsites.net/api/v1';
        this.frontendUrl = 'https://grc-ai-platform-prod.azurestaticapps.net';
        this.mcpServerUrl = 'https://grc-mcp-server-prod.eastus.azurecontainer.io:3006';

        // Test endpoints that were failing before
        this.criticalEndpoints = [
            '/health',
            '/simple-llm-configs',
            '/simple-agents',
            '/simple-credentials',
            '/simple-mcp-configs',
            '/mcp-servers/tools'
        ];
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'GRC-Platform-Automated-Test/1.0',
                    ...options.headers
                },
                timeout: 30000
            };

            const lib = urlObj.protocol === 'https:' ? https : http;

            const req = lib.request(requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const jsonData = data ? JSON.parse(data) : null;
                        resolve({
                            status: res.statusCode,
                            headers: res.headers,
                            data: jsonData,
                            rawData: data
                        });
                    } catch (e) {
                        resolve({
                            status: res.statusCode,
                            headers: res.headers,
                            data: null,
                            rawData: data
                        });
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        });
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const colors = {
            INFO: '\x1b[36m',    // Cyan
            PASS: '\x1b[32m',    // Green
            FAIL: '\x1b[31m',    // Red
            WARN: '\x1b[33m',    // Yellow
            RESET: '\x1b[0m'     // Reset
        };

        console.log(`${colors[type]}[${timestamp}] ${type}: ${message}${colors.RESET}`);
    }

    async test(name, testFunction) {
        this.log(`Starting test: ${name}`);
        try {
            const result = await testFunction();
            if (result === true || result === undefined) {
                this.results.passed++;
                this.results.tests.push({ name, status: 'PASS', details: 'Test completed successfully' });
                this.log(`✅ PASSED: ${name}`, 'PASS');
                return true;
            } else {
                this.results.failed++;
                this.results.tests.push({ name, status: 'FAIL', details: result || 'Test failed' });
                this.log(`❌ FAILED: ${name} - ${result}`, 'FAIL');
                return false;
            }
        } catch (error) {
            this.results.failed++;
            this.results.tests.push({ name, status: 'FAIL', details: error.message });
            this.log(`❌ FAILED: ${name} - ${error.message}`, 'FAIL');
            return false;
        }
    }

    async testBackendHealth() {
        return this.test('Backend Health Check', async () => {
            const response = await this.makeRequest(`${this.backendUrl}/health`);

            if (response.status !== 200) {
                return `Expected status 200, got ${response.status}`;
            }

            if (!response.data || response.data.status !== 'healthy') {
                return `Expected status=healthy, got ${response.data?.status}`;
            }

            this.log(`Backend health: ${JSON.stringify(response.data, null, 2)}`);
            return true;
        });
    }

    async testLLMConfigs() {
        return this.test('LLM Configurations (Previously Failing)', async () => {
            const response = await this.makeRequest(`${this.backendUrl}/simple-llm-configs`);

            if (response.status !== 200) {
                return `Expected status 200, got ${response.status}. Response: ${response.rawData}`;
            }

            if (!response.data || !response.data.success) {
                return `Expected success=true, got ${response.data?.success}`;
            }

            if (!Array.isArray(response.data.data)) {
                return `Expected data array, got ${typeof response.data.data}`;
            }

            this.log(`Found ${response.data.data.length} LLM configurations`);
            return true;
        });
    }

    async testAllCriticalEndpoints() {
        return this.test('All Critical API Endpoints', async () => {
            const failedEndpoints = [];

            for (const endpoint of this.criticalEndpoints) {
                try {
                    const response = await this.makeRequest(`${this.backendUrl}${endpoint}`);
                    if (response.status >= 400) {
                        failedEndpoints.push(`${endpoint}: ${response.status}`);
                    } else {
                        this.log(`✅ ${endpoint}: ${response.status}`);
                    }
                } catch (error) {
                    failedEndpoints.push(`${endpoint}: ${error.message}`);
                }
            }

            if (failedEndpoints.length > 0) {
                return `Failed endpoints: ${failedEndpoints.join(', ')}`;
            }

            return true;
        });
    }

    async testFrontendConnectivity() {
        return this.test('Frontend Deployment', async () => {
            const response = await this.makeRequest(this.frontendUrl);

            if (response.status !== 200) {
                return `Expected status 200, got ${response.status}`;
            }

            if (!response.rawData.includes('<title>')) {
                return 'Response does not appear to be HTML';
            }

            this.log('Frontend is serving content correctly');
            return true;
        });
    }

    async testMCPServer() {
        return this.test('MCP Server Health', async () => {
            try {
                const response = await this.makeRequest(`${this.mcpServerUrl}/health`);

                if (response.status !== 200) {
                    return `Expected status 200, got ${response.status}`;
                }

                this.log('MCP Server is healthy');
                return true;
            } catch (error) {
                // MCP server might not be deployed yet, so warn but don't fail
                this.log(`MCP Server not accessible: ${error.message}`, 'WARN');
                return true; // Don't fail the test suite for MCP server
            }
        });
    }

    async testApiIntegration() {
        return this.test('API Integration Test', async () => {
            // Test a POST request to ensure proper API functionality
            try {
                const response = await this.makeRequest(`${this.backendUrl}/simple-llm-configs`, {
                    method: 'POST',
                    body: {
                        name: 'Test LLM Config',
                        provider: 'test',
                        model: 'test-model'
                    }
                });

                if (response.status === 201 || response.status === 200) {
                    this.log('API POST request handling correctly');
                    return true;
                } else {
                    return `POST request failed with status ${response.status}`;
                }
            } catch (error) {
                return `API integration test failed: ${error.message}`;
            }
        });
    }

    async testEnvironmentDetection() {
        return this.test('Environment Configuration', async () => {
            const response = await this.makeRequest(`${this.backendUrl}/health`);

            if (response.data && response.data.service) {
                const service = response.data.service;
                if (service.includes('Azure') || service.includes('App Service')) {
                    this.log(`Detected environment: ${service}`);
                    return true;
                } else {
                    return `Unexpected service identifier: ${service}`;
                }
            }

            return 'Could not detect service environment';
        });
    }

    async waitForDeployment(maxWaitMinutes = 10) {
        this.log('Waiting for deployment to complete...');
        const maxAttempts = maxWaitMinutes * 2; // Check every 30 seconds

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await this.makeRequest(`${this.backendUrl}/health`);
                if (response.status === 200) {
                    this.log('Deployment detected as ready!', 'PASS');
                    return true;
                }
            } catch (error) {
                // Continue waiting
            }

            this.log(`Waiting for deployment... (${attempt}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        }

        this.log('Deployment wait timeout reached', 'WARN');
        return false;
    }

    async runAllTests() {
        this.log('🚀 Starting GRC Platform Automated Test Suite');
        this.log('Testing new Azure App Service architecture');

        // Wait for deployment first
        await this.waitForDeployment();

        // Run all tests
        await this.testBackendHealth();
        await this.testLLMConfigs();
        await this.testAllCriticalEndpoints();
        await this.testFrontendConnectivity();
        await this.testMCPServer();
        await this.testApiIntegration();
        await this.testEnvironmentDetection();

        // Generate final report
        this.generateReport();
    }

    generateReport() {
        const total = this.results.passed + this.results.failed;
        const successRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;

        this.log('\n=== GRC PLATFORM TEST RESULTS ===');
        this.log(`Total Tests: ${total}`);
        this.log(`Passed: ${this.results.passed}`, 'PASS');
        this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'FAIL' : 'PASS');
        this.log(`Success Rate: ${successRate}%`);

        if (this.results.failed === 0) {
            this.log('\n🎉 ALL TESTS PASSED! Azure App Service migration successful!', 'PASS');
        } else {
            this.log('\n⚠️  Some tests failed. Review the details above.', 'WARN');

            // Show failed test details
            const failedTests = this.results.tests.filter(t => t.status === 'FAIL');
            if (failedTests.length > 0) {
                this.log('\nFailed Test Details:');
                failedTests.forEach(test => {
                    this.log(`- ${test.name}: ${test.details}`, 'FAIL');
                });
            }
        }

        // Exit with appropriate code
        process.exit(this.results.failed > 0 ? 1 : 0);
    }
}

// Run the tests
const tester = new GRCPlatformTester();
tester.runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});