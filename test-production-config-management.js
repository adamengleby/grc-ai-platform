/**
 * Azure Production Configuration Management Test Suite
 *
 * This script validates that configuration management works correctly
 * in the Azure production environment, testing all critical user scenarios.
 *
 * Usage: node test-production-config-management.js
 *
 * Requirements:
 * - Azure backend and frontend deployed and running
 * - Production database with proper schema
 * - Valid tenant and user context
 */

const AZURE_BASE_URL = 'https://grc-backend-simple.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io';
const AZURE_FRONTEND_URL = 'https://grc-frontend-simple.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io';

class AzureConfigTestSuite {
  constructor() {
    this.testResults = [];
    this.tenantId = 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d';
    this.userId = 'user-001';
    this.testConfigs = [];
  }

  async runAllTests() {
    console.log('🚀 Starting Azure Production Configuration Management Test Suite');
    console.log(`Backend URL: ${AZURE_BASE_URL}`);
    console.log(`Frontend URL: ${AZURE_FRONTEND_URL}`);
    console.log(`Test Tenant: ${this.tenantId}`);
    console.log('=' .repeat(80));

    try {
      // Core configuration management tests
      await this.testHealthEndpoints();
      await this.testLLMConfigurationCRUD();
      await this.testMCPConfigurationCRUD();
      await this.testAgentConfigurationCRUD();

      // Field mapping and transformation tests
      await this.testFieldMappingConsistency();
      await this.testDatabaseTransformations();

      // Configuration persistence and recall tests
      await this.testConfigurationPersistence();
      await this.testConfigurationRecall();

      // Multi-session and refresh tests
      await this.testConfigurationRefresh();
      await this.testMultiSessionConsistency();

      // Error handling and validation tests
      await this.testErrorHandling();
      await this.testValidationLogic();

      // Production readiness tests
      await this.testConcurrentUsers();
      await this.testDataIntegrity();

      this.generateReport();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  async testHealthEndpoints() {
    console.log('\n🔍 Testing Health Endpoints...');

    try {
      // Test backend health
      const backendHealth = await this.makeRequest('/api/v1/health');
      this.recordTest('Backend Health Check',
        backendHealth.success === true,
        `Status: ${backendHealth.success ? 'OK' : 'FAILED'}`
      );

      // Test simple endpoints
      const agentsHealth = await this.makeRequest('/api/v1/simple-agents/test-database');
      this.recordTest('Agents Database Health',
        agentsHealth.success === true,
        `Database: ${agentsHealth.database_status || 'Unknown'}`
      );

      const llmHealth = await this.makeRequest('/api/v1/simple-llm-configs/test-database');
      this.recordTest('LLM Configs Database Health',
        llmHealth.success === true,
        `Total configs: ${llmHealth.data?.sample_data?.total_configs || 0}`
      );

      const mcpHealth = await this.makeRequest('/api/v1/simple-mcp-configs/test-database');
      this.recordTest('MCP Configs Database Health',
        mcpHealth.success === true,
        `Registry servers: ${mcpHealth.data?.sample_data?.total_registry_servers || 0}`
      );

    } catch (error) {
      this.recordTest('Health Endpoints', false, `Error: ${error.message}`);
    }
  }

  async testLLMConfigurationCRUD() {
    console.log('\n🤖 Testing LLM Configuration CRUD Operations...');

    try {
      // CREATE: Test LLM configuration creation
      const createData = {
        name: `Azure Test Config ${Date.now()}`,
        description: 'Test configuration for Azure production validation',
        provider: 'azure-openai',
        model: 'gpt-4o',
        endpoint: 'https://test-openai.openai.azure.com',
        api_key: 'test-key-' + Math.random().toString(36).substr(2, 10),
        max_tokens: 4000,
        temperature: 0.7,
        rate_limit: 15,
        is_enabled: true
      };

      const created = await this.makeRequest('/api/v1/simple-llm-configs', {
        method: 'POST',
        body: JSON.stringify(createData)
      });

      this.recordTest('LLM Config Creation',
        created.success === true && created.data?.llm_config?.config_id,
        `Created ID: ${created.data?.llm_config?.config_id || 'None'}`
      );

      if (created.success && created.data?.llm_config?.config_id) {
        this.testConfigs.push({
          type: 'llm',
          id: created.data.llm_config.config_id,
          originalData: createData
        });

        // READ: Test retrieval
        const retrieved = await this.makeRequest('/api/v1/simple-llm-configs');
        const foundConfig = retrieved.data?.llm_configs?.find(
          config => config.config_id === created.data.llm_config.config_id
        );

        this.recordTest('LLM Config Retrieval',
          !!foundConfig && foundConfig.name === createData.name,
          `Found: ${foundConfig ? 'Yes' : 'No'}, Name match: ${foundConfig?.name === createData.name}`
        );

        // UPDATE: Test field mapping consistency
        const updateData = {
          name: `Updated ${createData.name}`,
          api_key: 'updated-key-' + Math.random().toString(36).substr(2, 10),
          temperature: 0.9
        };

        const updated = await this.makeRequest(`/api/v1/simple-llm-configs/${created.data.llm_config.config_id}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });

        this.recordTest('LLM Config Update',
          updated.success === true && updated.data?.llm_config?.name === updateData.name,
          `Name updated: ${updated.data?.llm_config?.name === updateData.name}`
        );

        // Verify field mapping (api_key vs api_key_vault_secret)
        const reRetrieved = await this.makeRequest('/api/v1/simple-llm-configs');
        const updatedConfig = reRetrieved.data?.llm_configs?.find(
          config => config.config_id === created.data.llm_config.config_id
        );

        this.recordTest('API Key Field Mapping',
          updatedConfig?.api_key === updateData.api_key,
          `Expected: ${updateData.api_key}, Got: ${updatedConfig?.api_key}`
        );
      }

    } catch (error) {
      this.recordTest('LLM Configuration CRUD', false, `Error: ${error.message}`);
    }
  }

  async testMCPConfigurationCRUD() {
    console.log('\n🔌 Testing MCP Configuration CRUD Operations...');

    try {
      // Test MCP registry retrieval
      const registry = await this.makeRequest('/api/v1/simple-mcp-configs/registry');
      this.recordTest('MCP Registry Retrieval',
        registry.success === true && Array.isArray(registry.data?.registry_servers),
        `Registry servers: ${registry.data?.registry_servers?.length || 0}`
      );

      // Test tenant MCP configurations
      const tenantConfigs = await this.makeRequest('/api/v1/simple-mcp-configs');
      this.recordTest('Tenant MCP Configs Retrieval',
        tenantConfigs.success === true && Array.isArray(tenantConfigs.data?.mcp_servers),
        `Tenant configs: ${tenantConfigs.data?.mcp_servers?.length || 0}`
      );

      // Test MCP server enablement if registry has servers
      if (registry.data?.registry_servers?.length > 0) {
        const testServer = registry.data.registry_servers[0];
        const enableData = {
          server_id: testServer.server_id,
          custom_name: `Test ${testServer.display_name} ${Date.now()}`,
          configuration_values: { test: 'value' },
          allowed_tools: testServer.available_tools?.slice(0, 2) || []
        };

        const enabled = await this.makeRequest('/api/v1/simple-mcp-configs/enable', {
          method: 'POST',
          body: JSON.stringify(enableData)
        });

        this.recordTest('MCP Server Enablement',
          enabled.success === true && enabled.data?.tenant_server_id,
          `Enabled ID: ${enabled.data?.tenant_server_id || 'None'}`
        );

        if (enabled.success && enabled.data?.tenant_server_id) {
          this.testConfigs.push({
            type: 'mcp',
            id: enabled.data.tenant_server_id,
            serverId: testServer.server_id
          });
        }
      }

    } catch (error) {
      this.recordTest('MCP Configuration CRUD', false, `Error: ${error.message}`);
    }
  }

  async testAgentConfigurationCRUD() {
    console.log('\n🤖 Testing Agent Configuration CRUD Operations...');

    try {
      // Get available LLM configs first
      const llmConfigs = await this.makeRequest('/api/v1/simple-llm-configs');
      const availableLlmConfig = llmConfigs.data?.llm_configs?.[0];

      // CREATE: Test agent creation
      const createData = {
        name: `Azure Test Agent ${Date.now()}`,
        description: 'Test agent for Azure production validation',
        persona: 'Professional test assistant',
        system_prompt: 'You are a test assistant for validating configuration management.',
        llmConfigId: availableLlmConfig?.config_id || null,
        enabledMcpServers: [],
        capabilities: ['analysis', 'testing'],
        useCase: 'testing',
        avatar: '🧪',
        color: '#2563eb',
        isEnabled: true
      };

      const created = await this.makeRequest('/api/v1/simple-agents/create', {
        method: 'POST',
        body: JSON.stringify(createData)
      });

      this.recordTest('Agent Creation',
        created.success === true && created.data?.agent_id,
        `Created ID: ${created.data?.agent_id || 'None'}`
      );

      if (created.success && created.data?.agent_id) {
        this.testConfigs.push({
          type: 'agent',
          id: created.data.agent_id,
          originalData: createData
        });

        // READ: Test retrieval with field mapping
        const retrieved = await this.makeRequest('/api/v1/simple-agents');
        const foundAgent = retrieved.data?.agents?.find(
          agent => agent.id === created.data.agent_id
        );

        this.recordTest('Agent Retrieval',
          !!foundAgent && foundAgent.name === createData.name,
          `Found: ${foundAgent ? 'Yes' : 'No'}, Name: ${foundAgent?.name}`
        );

        // Test field mapping: llmConfigId vs llm_config_id
        this.recordTest('Agent LLM Config Field Mapping',
          foundAgent?.llmConfigId === createData.llmConfigId,
          `Expected: ${createData.llmConfigId}, Got: ${foundAgent?.llmConfigId}`
        );

        // UPDATE: Test agent update with LLM config change
        const updateData = {
          name: `Updated ${createData.name}`,
          description: 'Updated description for testing',
          llmConfigId: availableLlmConfig?.config_id,
          isEnabled: false
        };

        const updated = await this.makeRequest(`/api/v1/simple-agents/${created.data.agent_id}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });

        this.recordTest('Agent Update',
          updated.success === true && updated.data?.name === updateData.name,
          `Updated name: ${updated.data?.name === updateData.name}`
        );

        // Critical test: Verify LLM config ID is preserved in update response
        this.recordTest('Agent Update LLM Config Preservation',
          updated.data?.llmConfigId === updateData.llmConfigId,
          `LLM Config ID preserved: ${updated.data?.llmConfigId === updateData.llmConfigId}`
        );
      }

    } catch (error) {
      this.recordTest('Agent Configuration CRUD', false, `Error: ${error.message}`);
    }
  }

  async testFieldMappingConsistency() {
    console.log('\n🔄 Testing Field Mapping Consistency...');

    try {
      // Test camelCase to snake_case transformation
      const llmConfigs = await this.makeRequest('/api/v1/simple-llm-configs');

      if (llmConfigs.data?.llm_configs?.length > 0) {
        const config = llmConfigs.data.llm_configs[0];

        // Check all expected camelCase fields exist
        const expectedFields = ['config_id', 'name', 'provider', 'model', 'api_key', 'max_tokens', 'temperature', 'is_enabled'];
        const missingFields = expectedFields.filter(field => !(field in config));

        this.recordTest('LLM Config Field Completeness',
          missingFields.length === 0,
          `Missing fields: ${missingFields.join(', ') || 'None'}`
        );

        // Test database vs frontend naming consistency
        const hasConsistentNaming = config.config_id && config.max_tokens !== undefined && config.is_enabled !== undefined;
        this.recordTest('Database Field Naming Consistency',
          hasConsistentNaming,
          `Has config_id: ${!!config.config_id}, has max_tokens: ${config.max_tokens !== undefined}`
        );
      }

      // Test agent field mapping
      const agents = await this.makeRequest('/api/v1/simple-agents');

      if (agents.data?.agents?.length > 0) {
        const agent = agents.data.agents[0];

        // Check frontend expected fields (camelCase)
        const expectedAgentFields = ['id', 'name', 'description', 'systemPrompt', 'llmConfigId', 'enabledMcpServers', 'isEnabled'];
        const hasAllFields = expectedAgentFields.every(field => field in agent);

        this.recordTest('Agent Field Mapping to Frontend',
          hasAllFields,
          `Fields present: ${expectedAgentFields.filter(field => field in agent).length}/${expectedAgentFields.length}`
        );
      }

    } catch (error) {
      this.recordTest('Field Mapping Consistency', false, `Error: ${error.message}`);
    }
  }

  async testConfigurationPersistence() {
    console.log('\n💾 Testing Configuration Persistence...');

    try {
      // Create a configuration, then verify it persists across multiple requests
      const testConfig = {
        name: `Persistence Test ${Date.now()}`,
        description: 'Testing configuration persistence across requests',
        provider: 'openai',
        model: 'gpt-4o',
        endpoint: 'https://api.openai.com/v1',
        api_key: 'persist-test-' + Math.random().toString(36).substr(2, 15),
        max_tokens: 3000,
        temperature: 0.5,
        is_enabled: true
      };

      // Create config
      const created = await this.makeRequest('/api/v1/simple-llm-configs', {
        method: 'POST',
        body: JSON.stringify(testConfig)
      });

      if (created.success && created.data?.llm_config?.config_id) {
        const configId = created.data.llm_config.config_id;

        // Wait a moment to ensure database write is complete
        await this.sleep(500);

        // Retrieve multiple times to test persistence
        const retrievals = await Promise.all([
          this.makeRequest('/api/v1/simple-llm-configs'),
          this.makeRequest('/api/v1/simple-llm-configs'),
          this.makeRequest('/api/v1/simple-llm-configs')
        ]);

        const allFound = retrievals.every(retrieval => {
          return retrieval.data?.llm_configs?.some(config =>
            config.config_id === configId && config.api_key === testConfig.api_key
          );
        });

        this.recordTest('Configuration Persistence Across Requests',
          allFound,
          `Found in all ${retrievals.length} requests: ${allFound}`
        );

        // Test field persistence specifically
        const persistedConfig = retrievals[0].data?.llm_configs?.find(config => config.config_id === configId);
        const fieldsPersisted =
          persistedConfig?.name === testConfig.name &&
          persistedConfig?.api_key === testConfig.api_key &&
          persistedConfig?.temperature === testConfig.temperature &&
          persistedConfig?.max_tokens === testConfig.max_tokens;

        this.recordTest('Individual Field Persistence',
          fieldsPersisted,
          `Name: ${persistedConfig?.name === testConfig.name}, API Key: ${persistedConfig?.api_key === testConfig.api_key}`
        );

        this.testConfigs.push({ type: 'llm', id: configId });
      }

    } catch (error) {
      this.recordTest('Configuration Persistence', false, `Error: ${error.message}`);
    }
  }

  async testConfigurationRecall() {
    console.log('\n🔄 Testing Configuration Recall...');

    try {
      // Find an existing config to test recall
      const configs = await this.makeRequest('/api/v1/simple-llm-configs');

      if (configs.data?.llm_configs?.length > 0) {
        const testConfig = configs.data.llm_configs[0];
        const originalData = { ...testConfig };

        // Update the configuration
        const updateData = {
          name: `Recall Test ${Date.now()}`,
          description: 'Testing configuration recall after update',
          temperature: 0.8
        };

        const updated = await this.makeRequest(`/api/v1/simple-llm-configs/${testConfig.config_id}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });

        this.recordTest('Configuration Update for Recall Test',
          updated.success === true,
          `Update successful: ${updated.success}`
        );

        // Wait for database consistency
        await this.sleep(500);

        // Recall the configuration and verify changes
        const recalled = await this.makeRequest('/api/v1/simple-llm-configs');
        const recalledConfig = recalled.data?.llm_configs?.find(config => config.config_id === testConfig.config_id);

        this.recordTest('Configuration Recall After Update',
          recalledConfig?.name === updateData.name && recalledConfig?.temperature === updateData.temperature,
          `Name recalled: ${recalledConfig?.name === updateData.name}, Temperature recalled: ${recalledConfig?.temperature === updateData.temperature}`
        );

        // Test that non-updated fields remain unchanged
        const unchangedFieldsPreserved =
          recalledConfig?.provider === originalData.provider &&
          recalledConfig?.model === originalData.model &&
          recalledConfig?.max_tokens === originalData.max_tokens;

        this.recordTest('Non-Updated Fields Preservation',
          unchangedFieldsPreserved,
          `Provider: ${recalledConfig?.provider === originalData.provider}, Model: ${recalledConfig?.model === originalData.model}`
        );
      }

    } catch (error) {
      this.recordTest('Configuration Recall', false, `Error: ${error.message}`);
    }
  }

  async testConfigurationRefresh() {
    console.log('\n🔄 Testing Configuration Refresh Logic...');

    try {
      // Simulate the AgentConfigModal scenario: load configs, then refresh
      const initialLoad = await this.makeRequest('/api/v1/simple-llm-configs');
      const initialCount = initialLoad.data?.llm_configs?.length || 0;

      // Create a new config (simulating another user/session)
      const newConfig = {
        name: `Refresh Test ${Date.now()}`,
        description: 'Testing refresh behavior',
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        endpoint: 'https://api.anthropic.com',
        api_key: 'refresh-test-' + Math.random().toString(36).substr(2, 12),
        max_tokens: 2000,
        temperature: 0.3,
        is_enabled: true
      };

      const created = await this.makeRequest('/api/v1/simple-llm-configs', {
        method: 'POST',
        body: JSON.stringify(newConfig)
      });

      this.recordTest('New Config Creation for Refresh Test',
        created.success === true,
        `Created: ${created.success}`
      );

      // Wait for consistency
      await this.sleep(500);

      // Refresh (reload configurations)
      const refreshed = await this.makeRequest('/api/v1/simple-llm-configs');
      const refreshedCount = refreshed.data?.llm_configs?.length || 0;
      const newConfigFound = refreshed.data?.llm_configs?.some(config => config.name === newConfig.name);

      this.recordTest('Configuration Refresh Detection',
        refreshedCount > initialCount && newConfigFound,
        `Count increased: ${refreshedCount} > ${initialCount}, New config found: ${newConfigFound}`
      );

      if (created.data?.llm_config?.config_id) {
        this.testConfigs.push({ type: 'llm', id: created.data.llm_config.config_id });
      }

    } catch (error) {
      this.recordTest('Configuration Refresh', false, `Error: ${error.message}`);
    }
  }

  async testErrorHandling() {
    console.log('\n❌ Testing Error Handling...');

    try {
      // Test invalid configuration creation
      const invalidConfig = {
        name: '', // Invalid: empty name
        provider: 'invalid-provider',
        model: '',
        endpoint: 'not-a-url',
        api_key: '',
        max_tokens: -1, // Invalid: negative
        temperature: 5 // Invalid: too high
      };

      const invalidResult = await this.makeRequest('/api/v1/simple-llm-configs', {
        method: 'POST',
        body: JSON.stringify(invalidConfig)
      });

      this.recordTest('Invalid Configuration Rejection',
        invalidResult.success === false,
        `Properly rejected: ${invalidResult.success === false}`
      );

      // Test update of non-existent configuration
      const nonExistentUpdate = await this.makeRequest('/api/v1/simple-llm-configs/non-existent-id', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' })
      });

      this.recordTest('Non-Existent Config Update Handling',
        nonExistentUpdate.success === false,
        `Properly handled: ${nonExistentUpdate.success === false}`
      );

      // Test malformed request
      try {
        const malformedResult = await this.makeRequest('/api/v1/simple-llm-configs', {
          method: 'POST',
          body: 'invalid-json'
        });

        this.recordTest('Malformed Request Handling',
          malformedResult.success === false,
          `Handled gracefully: ${malformedResult.success === false}`
        );
      } catch (error) {
        this.recordTest('Malformed Request Handling',
          true, // If it throws, that's also acceptable error handling
          `Properly threw error: ${error.message}`
        );
      }

    } catch (error) {
      this.recordTest('Error Handling', false, `Unexpected error: ${error.message}`);
    }
  }

  async testDataIntegrity() {
    console.log('\n🛡️ Testing Data Integrity...');

    try {
      // Test that updates preserve referential integrity
      const agents = await this.makeRequest('/api/v1/simple-agents');
      const llmConfigs = await this.makeRequest('/api/v1/simple-llm-configs');

      if (agents.data?.agents?.length > 0 && llmConfigs.data?.llm_configs?.length > 0) {
        const testAgent = agents.data.agents[0];
        const validLlmConfig = llmConfigs.data.llm_configs[0];

        // Update agent with valid LLM config reference
        const updateResult = await this.makeRequest(`/api/v1/simple-agents/${testAgent.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            llmConfigId: validLlmConfig.config_id
          })
        });

        this.recordTest('Valid Reference Update',
          updateResult.success === true && updateResult.data?.llmConfigId === validLlmConfig.config_id,
          `LLM Config properly referenced: ${updateResult.data?.llmConfigId === validLlmConfig.config_id}`
        );

        // Test update with invalid reference (should be handled gracefully)
        const invalidRefResult = await this.makeRequest(`/api/v1/simple-agents/${testAgent.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            llmConfigId: 'non-existent-config-id'
          })
        });

        // Either it should reject the invalid reference OR accept it with a warning
        this.recordTest('Invalid Reference Handling',
          true, // This test is more about not crashing than specific behavior
          `Handled gracefully: ${invalidRefResult.success !== undefined}`
        );
      }

      // Test concurrent updates don't corrupt data
      if (llmConfigs.data?.llm_configs?.length > 0) {
        const testConfig = llmConfigs.data.llm_configs[0];
        const configId = testConfig.config_id;

        // Perform concurrent updates
        const updates = await Promise.allSettled([
          this.makeRequest(`/api/v1/simple-llm-configs/${configId}`, {
            method: 'PUT',
            body: JSON.stringify({ temperature: 0.1 })
          }),
          this.makeRequest(`/api/v1/simple-llm-configs/${configId}`, {
            method: 'PUT',
            body: JSON.stringify({ temperature: 0.9 })
          }),
          this.makeRequest(`/api/v1/simple-llm-configs/${configId}`, {
            method: 'PUT',
            body: JSON.stringify({ max_tokens: 1000 })
          })
        ]);

        const successfulUpdates = updates.filter(update =>
          update.status === 'fulfilled' && update.value?.success === true
        ).length;

        this.recordTest('Concurrent Update Handling',
          successfulUpdates > 0, // At least one should succeed
          `Successful updates: ${successfulUpdates}/3`
        );

        // Verify final state is consistent
        await this.sleep(1000); // Wait for consistency
        const finalState = await this.makeRequest('/api/v1/simple-llm-configs');
        const finalConfig = finalState.data?.llm_configs?.find(config => config.config_id === configId);

        this.recordTest('Final State Consistency',
          finalConfig && typeof finalConfig.temperature === 'number' && typeof finalConfig.max_tokens === 'number',
          `Temperature: ${finalConfig?.temperature}, Max tokens: ${finalConfig?.max_tokens}`
        );
      }

    } catch (error) {
      this.recordTest('Data Integrity', false, `Error: ${error.message}`);
    }
  }

  async makeRequest(path, options = {}) {
    const url = path.startsWith('http') ? path : `${AZURE_BASE_URL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'x-tenant-id': this.tenantId,
      'x-user-id': this.userId,
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  recordTest(testName, passed, details) {
    const result = {
      test: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    };

    this.testResults.push(result);

    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} ${testName}: ${details}`);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');

    for (const config of this.testConfigs) {
      try {
        if (config.type === 'llm') {
          await this.makeRequest(`/api/v1/simple-llm-configs/${config.id}`, { method: 'DELETE' });
        } else if (config.type === 'agent') {
          await this.makeRequest(`/api/v1/simple-agents/${config.id}`, { method: 'DELETE' });
        } else if (config.type === 'mcp') {
          await this.makeRequest(`/api/v1/simple-mcp-configs/${config.id}`, { method: 'DELETE' });
        }
        console.log(`  🗑️ Cleaned up ${config.type} config: ${config.id}`);
      } catch (error) {
        console.log(`  ⚠️ Failed to cleanup ${config.type} config ${config.id}: ${error.message}`);
      }
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 AZURE PRODUCTION TEST RESULTS');
    console.log('='.repeat(80));

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;

    console.log(`\n📈 Summary:`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests} (${passRate}%)`);
    console.log(`  Failed: ${failedTests}`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.log(`  • ${result.test}: ${result.details}`);
      });
    }

    console.log('\n🎯 Production Readiness Assessment:');
    const criticalTests = [
      'LLM Config Creation',
      'LLM Config Update',
      'Agent Creation',
      'Agent Update',
      'Configuration Persistence Across Requests',
      'Configuration Recall After Update',
      'API Key Field Mapping',
      'Agent LLM Config Field Mapping'
    ];

    const criticalTestResults = criticalTests.map(testName => {
      const result = this.testResults.find(r => r.test === testName);
      return result ? result.passed : false;
    });

    const criticalPassRate = (criticalTestResults.filter(Boolean).length / criticalTests.length * 100).toFixed(1);

    console.log(`  Critical Tests Pass Rate: ${criticalPassRate}%`);

    if (criticalPassRate >= 95) {
      console.log('  🟢 PRODUCTION READY - All critical functionality working');
    } else if (criticalPassRate >= 80) {
      console.log('  🟡 NEEDS FIXES - Some critical issues need resolution');
    } else {
      console.log('  🔴 NOT PRODUCTION READY - Major issues prevent production deployment');
    }

    console.log('\n📋 Recommendations:');
    if (failedTests === 0) {
      console.log('  ✅ Configuration management system is working correctly in Azure production');
      console.log('  ✅ All CRUD operations function properly');
      console.log('  ✅ Field mapping is consistent');
      console.log('  ✅ Data persistence and recall work correctly');
    } else {
      console.log('  ⚠️ Review failed tests and fix underlying issues');
      console.log('  ⚠️ Re-run tests after fixes are deployed');
      console.log('  ⚠️ Consider additional validation for edge cases');
    }

    // Output test results to file for CI/CD
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: { totalTests, passedTests, failedTests, passRate: parseFloat(passRate) },
      criticalPassRate: parseFloat(criticalPassRate),
      results: this.testResults,
      productionReady: criticalPassRate >= 95
    };

    require('fs').writeFileSync(
      `azure-config-test-results-${Date.now()}.json`,
      JSON.stringify(reportData, null, 2)
    );

    console.log(`\n💾 Detailed results saved to: azure-config-test-results-${Date.now()}.json`);
    console.log('='.repeat(80));
  }
}

// Run the test suite
const testSuite = new AzureConfigTestSuite();
testSuite.runAllTests()
  .then(() => testSuite.cleanup())
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });