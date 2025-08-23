#!/usr/bin/env node

/**
 * LLM Integration Test Script
 * Tests real AI insights generation with different providers
 */

import { LLMClient } from './lib/llmClient.js';
import { detectAvailableProvider, createGRCConfig } from './lib/llmConfig.js';
import { EnhancedDataService } from './lib/enhancedDataService.js';

class LLMTester {
  constructor() {
    this.dataService = new EnhancedDataService();
  }

  async initialize() {
    console.log('🔧 Initializing data service...');
    await this.dataService.initialize();
    console.log('✅ Data service initialized\n');
  }

  async runTests() {
    console.log('🧪 LLM Integration Test Suite\n');
    
    // 0. Initialize data service
    await this.initialize();
    
    // 1. Detect available providers
    await this.testProviderDetection();
    
    // 2. Test each available provider
    await this.testProviders();
    
    // 3. Test GRC insights generation
    await this.testGRCInsights();
    
    console.log('\n✅ LLM Integration test completed!');
  }

  async testProviderDetection() {
    console.log('🔍 Testing provider detection...');
    
    try {
      const providers = await detectAvailableProvider();
      
      if (providers.length === 0) {
        console.log('⚠️  No LLM providers detected. Install Ollama or configure API keys.');
        console.log('   Azure: Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT');
        console.log('   Claude: Set ANTHROPIC_API_KEY'); 
        console.log('   OpenAI: Set OPENAI_API_KEY');
        console.log('   Ollama: Install and run locally');
        return false;
      }

      console.log(`✅ Found ${providers.length} available provider(s):`);
      providers.forEach((provider, index) => {
        console.log(`   ${index + 1}. ${provider.provider} (priority: ${provider.priority})`);
        if (provider.availableModels) {
          console.log(`      Available models: ${provider.availableModels.slice(0, 3).join(', ')}${provider.availableModels.length > 3 ? '...' : ''}`);
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Provider detection failed:', error.message);
      return false;
    }
  }

  async testProviders() {
    console.log('\n🚀 Testing individual providers...');
    
    const testProviders = ['azure', 'claude', 'openai', 'ollama'];
    
    for (const provider of testProviders) {
      await this.testProvider(provider);
    }
  }

  async testProvider(providerName) {
    console.log(`\n🧪 Testing ${providerName.toUpperCase()} provider...`);
    
    try {
      const config = createGRCConfig(providerName, {
        timeout: 10000, // Shorter timeout for testing
        fallbackToMock: false // Don't fallback for provider-specific tests
      });

      const client = new LLMClient(config);
      
      // Simple test prompt
      const testPrompt = "Generate a brief risk assessment summary for a financial services company in 2-3 sentences.";
      
      console.log(`   Making test request to ${providerName}...`);
      const startTime = Date.now();
      
      // Direct API test instead of full GRC insights
      const response = await client.makeRequest(testPrompt);
      
      const duration = Date.now() - startTime;
      console.log(`   ✅ ${providerName} responded in ${duration}ms`);
      console.log(`   Response preview: "${response.substring(0, 100)}..."`);
      
      return true;

    } catch (error) {
      if (error.message.includes('not configured') || error.message.includes('API key')) {
        console.log(`   ⚠️  ${providerName} not configured (${error.message})`);
      } else if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
        console.log(`   ⚠️  ${providerName} not available (${error.message})`);
      } else {
        console.log(`   ❌ ${providerName} failed: ${error.message}`);
      }
      return false;
    }
  }

  async testGRCInsights() {
    console.log('\n📊 Testing GRC insights generation...');
    
    try {
      // Get available providers and use the best one
      const providers = await detectAvailableProvider();
      
      if (providers.length === 0) {
        console.log('⚠️  No providers available for GRC insights test');
        return;
      }

      const bestProvider = providers[0];
      console.log(`   Using ${bestProvider.provider} for GRC insights test...`);
      
      const config = createGRCConfig(bestProvider.provider);
      const client = new LLMClient(config);
      
      // Get sample tenant data (use correct tenant ID)
      const tenantData = this.dataService.getTenantData('tenant-fintech-001', {
        includeRiskHistory: true,
        includeControlHistory: true,
        includeIncidents: true
      });

      console.log(`   Generating insights for ${tenantData.tenant.name}...`);
      const startTime = Date.now();
      
      const insights = await client.generateInsights({
        tenantData,
        focusArea: 'overall',
        insightType: 'summary',
        executiveSummary: false
      });

      const duration = Date.now() - startTime;
      console.log(`   ✅ Generated insights in ${duration}ms`);
      console.log(`   Insights length: ${insights.length} characters`);
      
      // Show preview of insights
      const lines = insights.split('\n');
      console.log('   Insights preview:');
      lines.slice(0, 5).forEach(line => {
        if (line.trim()) console.log(`     ${line}`);
      });
      
      if (lines.length > 5) {
        console.log(`     ... (${lines.length - 5} more lines)`);
      }

      // Test executive summary
      console.log('\n   Testing executive summary generation...');
      const execStartTime = Date.now();
      
      const execInsights = await client.generateInsights({
        tenantData,
        focusArea: 'overall',
        insightType: 'summary',
        executiveSummary: true
      });

      const execDuration = Date.now() - execStartTime;
      console.log(`   ✅ Generated executive summary in ${execDuration}ms`);
      console.log(`   Executive summary length: ${execInsights.length} characters`);

    } catch (error) {
      console.error('   ❌ GRC insights test failed:', error.message);
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new LLMTester();
  tester.runTests().catch(console.error);
}