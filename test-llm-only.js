// Test LLM functionality without MCP
// Run this in browser console on the GRC AI Platform page

async function testLLMOnly() {
  console.log('🧪 Testing LLM functionality without MCP...');
  
  try {
    // Get current tenant
    const authState = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    const tenant = authState?.state?.tenant;
    
    if (!tenant) {
      console.error('❌ No tenant found');
      return;
    }
    
    console.log(`✅ Found tenant: ${tenant.id}`);
    
    // Get LLM configs
    const llmConfigKey = `user_llm_configs_${tenant.id}`;
    const llmConfigs = JSON.parse(localStorage.getItem(llmConfigKey) || '[]');
    
    if (llmConfigs.length === 0) {
      console.error('❌ No LLM configurations found');
      return;
    }
    
    console.log(`✅ Found ${llmConfigs.length} LLM configs`);
    
    // Get first enabled LLM config
    const llmConfig = llmConfigs.find(c => c.isEnabled) || llmConfigs[0];
    console.log(`✅ Using LLM config: ${llmConfig.name} (${llmConfig.provider})`);
    console.log(`   Endpoint: ${llmConfig.endpoint}`);
    
    // Create a simple test message
    const testMessage = "Hello, this is a test message. Please respond with a simple greeting.";
    
    // Make direct LLM call (bypassing MCP entirely)
    const requestBody = {
      model: llmConfig.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant. Respond concisely.'
        },
        {
          role: 'user',
          content: testMessage
        }
      ],
      max_tokens: llmConfig.maxTokens || 1000,
      temperature: llmConfig.temperature || 0.7
    };
    
    console.log('📤 Sending request to LLM...', {
      endpoint: llmConfig.endpoint,
      provider: llmConfig.provider,
      model: llmConfig.model
    });
    
    const response = await fetch(llmConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfig.apiKey}`,
        ...(llmConfig.customHeaders || {})
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ LLM API Error:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ LLM Response received:', result);
    
    // Extract response content based on provider
    let responseContent = '';
    if (llmConfig.provider === 'openai' && result.choices?.[0]?.message?.content) {
      responseContent = result.choices[0].message.content;
    } else if (llmConfig.provider === 'anthropic' && result.content?.[0]?.text) {
      responseContent = result.content[0].text;
    } else {
      responseContent = JSON.stringify(result);
    }
    
    console.log('✅ Extracted response:', responseContent);
    
    // Show success
    console.log('🎉 LLM test completed successfully!');
    console.log('The issue is likely in the integration layer, not the LLM itself.');
    
  } catch (error) {
    console.error('❌ LLM test failed:', error);
    console.log('This indicates there is a fundamental issue with the LLM configuration or network connectivity.');
  }
}

// Run the test
testLLMOnly();