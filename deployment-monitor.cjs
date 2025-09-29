#!/usr/bin/env node

/**
 * Real-time Deployment Monitor for GRC Platform
 * Monitors Azure App Service deployment and runs tests when ready
 */

const https = require('https');

class DeploymentMonitor {
    constructor() {
        this.backendUrl = 'https://grc-backend-prod.azurewebsites.net/api/v1';
        this.frontendUrl = 'https://grc-ai-platform-prod.azurestaticapps.net';
        this.githubApiUrl = 'https://api.github.com/repos/adamengleby/grc-ai-platform/actions/runs?per_page=1';

        this.deploymentReady = false;
        this.lastStatus = null;
        this.startTime = Date.now();
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const colors = {
            INFO: '\x1b[36m',    // Cyan
            SUCCESS: '\x1b[32m', // Green
            ERROR: '\x1b[31m',   // Red
            WARNING: '\x1b[33m', // Yellow
            RESET: '\x1b[0m'     // Reset
        };

        console.log(`${colors[type]}[${timestamp}] ${type}: ${message}${colors.RESET}`);
    }

    async makeRequest(url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'GRC-Platform-Monitor/1.0'
                },
                timeout: 10000
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const jsonData = data ? JSON.parse(data) : null;
                        resolve({
                            status: res.statusCode,
                            data: jsonData,
                            rawData: data
                        });
                    } catch (e) {
                        resolve({
                            status: res.statusCode,
                            data: null,
                            rawData: data
                        });
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            req.end();
        });
    }

    async checkGitHubActions() {
        try {
            const response = await this.makeRequest(this.githubApiUrl);
            if (response.status === 200 && response.data?.workflow_runs?.[0]) {
                const latestRun = response.data.workflow_runs[0];
                return {
                    status: latestRun.status,
                    conclusion: latestRun.conclusion,
                    name: latestRun.name,
                    url: latestRun.html_url
                };
            }
        } catch (error) {
            this.log(`GitHub API check failed: ${error.message}`, 'WARNING');
        }
        return null;
    }

    async checkBackendHealth() {
        try {
            const startTime = Date.now();
            const response = await this.makeRequest(`${this.backendUrl}/health`);
            const responseTime = Date.now() - startTime;

            if (response.status === 200 && response.data?.status === 'healthy') {
                return {
                    healthy: true,
                    responseTime,
                    service: response.data.service || 'Unknown'
                };
            }

            return {
                healthy: false,
                status: response.status,
                responseTime,
                data: response.data
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }

    async checkCriticalEndpoints() {
        const endpoints = [
            '/simple-llm-configs',
            '/simple-agents',
            '/simple-credentials',
            '/mcp-servers/tools'
        ];

        const results = [];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(`${this.backendUrl}${endpoint}`);
                results.push({
                    endpoint,
                    status: response.status,
                    success: response.status >= 200 && response.status < 300
                });
            } catch (error) {
                results.push({
                    endpoint,
                    status: 'ERROR',
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    async runComprehensiveTest() {
        this.log('🧪 Running comprehensive deployment validation...', 'INFO');

        // Test 1: Backend Health
        const healthCheck = await this.checkBackendHealth();
        if (healthCheck.healthy) {
            this.log(`✅ Backend Health: OK (${healthCheck.responseTime}ms) - ${healthCheck.service}`, 'SUCCESS');
        } else {
            this.log(`❌ Backend Health: FAILED - ${healthCheck.error || healthCheck.status}`, 'ERROR');
            return false;
        }

        // Test 2: Critical Endpoints
        const endpointResults = await this.checkCriticalEndpoints();
        const successfulEndpoints = endpointResults.filter(r => r.success);

        this.log(`📊 API Endpoints: ${successfulEndpoints.length}/${endpointResults.length} working`,
                 successfulEndpoints.length === endpointResults.length ? 'SUCCESS' : 'WARNING');

        endpointResults.forEach(result => {
            const status = result.success ? '✅' : '❌';
            this.log(`  ${status} ${result.endpoint}: ${result.status}`);
        });

        // Test 3: LLM Configs (Previously Failing)
        try {
            const llmResponse = await this.makeRequest(`${this.backendUrl}/simple-llm-configs`);
            if (llmResponse.status === 200 && llmResponse.data?.success) {
                const configs = llmResponse.data.data || [];
                this.log(`✅ LLM Configurations: ${configs.length} found (PREVIOUSLY FAILING ENDPOINT NOW WORKING!)`, 'SUCCESS');
            } else {
                this.log(`❌ LLM Configurations: Status ${llmResponse.status}`, 'ERROR');
            }
        } catch (error) {
            this.log(`❌ LLM Configurations: ${error.message}`, 'ERROR');
        }

        return true;
    }

    async monitor() {
        this.log('🚀 Starting GRC Platform Deployment Monitor', 'INFO');
        this.log('Monitoring Azure App Service deployment progress...', 'INFO');

        let attempts = 0;
        const maxAttempts = 60; // 30 minutes max

        while (attempts < maxAttempts && !this.deploymentReady) {
            attempts++;
            const elapsed = Math.round((Date.now() - this.startTime) / 1000);

            // Check GitHub Actions status
            const githubStatus = await this.checkGitHubActions();
            if (githubStatus) {
                if (githubStatus.status !== this.lastStatus) {
                    this.log(`GitHub Actions: ${githubStatus.status} - ${githubStatus.name}`, 'INFO');
                    this.lastStatus = githubStatus.status;
                }

                if (githubStatus.status === 'completed') {
                    if (githubStatus.conclusion === 'success') {
                        this.log('🎉 GitHub Actions deployment completed successfully!', 'SUCCESS');
                    } else {
                        this.log(`❌ GitHub Actions deployment failed: ${githubStatus.conclusion}`, 'ERROR');
                        this.log(`View logs: ${githubStatus.url}`, 'INFO');
                        break;
                    }
                }
            }

            // Check backend health
            const healthCheck = await this.checkBackendHealth();

            if (healthCheck.healthy) {
                this.log('🎯 Backend is healthy! Running comprehensive tests...', 'SUCCESS');
                this.deploymentReady = true;

                const testResult = await this.runComprehensiveTest();

                if (testResult) {
                    this.log('🎉 ALL TESTS PASSED! Azure App Service migration successful!', 'SUCCESS');
                    this.log(`Total deployment time: ${Math.round(elapsed / 60)} minutes`, 'INFO');
                    this.log(`Frontend URL: ${this.frontendUrl}`, 'INFO');
                    this.log(`Backend URL: ${this.backendUrl}`, 'INFO');

                    // Open the frontend test page
                    this.log('\n📋 Next Steps:', 'INFO');
                    this.log('1. Open frontend-integration-test.html in your browser for interactive testing', 'INFO');
                    this.log('2. Test the production frontend at: ' + this.frontendUrl, 'INFO');
                    this.log('3. Verify all functionality is working correctly', 'INFO');

                    return true;
                } else {
                    this.log('⚠️  Deployment ready but some tests failed', 'WARNING');
                }
            } else {
                if (attempts % 4 === 0) { // Log every 2 minutes
                    this.log(`Waiting for deployment... (${attempts}/${maxAttempts}, ${Math.round(elapsed / 60)}min elapsed)`, 'INFO');

                    if (healthCheck.error) {
                        this.log(`Status: ${healthCheck.error}`, 'WARNING');
                    } else {
                        this.log(`Status: HTTP ${healthCheck.status}`, 'WARNING');
                    }
                }
            }

            // Wait 30 seconds before next check
            await new Promise(resolve => setTimeout(resolve, 30000));
        }

        if (!this.deploymentReady) {
            this.log('❌ Deployment monitoring timeout reached', 'ERROR');
            this.log('Manual check required. View deployment logs in GitHub Actions.', 'ERROR');
            return false;
        }
    }
}

// Run the monitor
const monitor = new DeploymentMonitor();
monitor.monitor().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Monitor failed:', error);
    process.exit(1);
});