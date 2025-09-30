// Simple LLM test - manually input credentials
// Run this in browser console

async function simpleLLMTest() {
  console.log('🧪 Simple LLM test with manual input...');
  
  // Manually input LLM endpoint and API key
  const endpoint = prompt('Enter your LLM endpoint URL:');
  const apiKey = prompt('Enter your API key:');
  const provider = prompt('Enter provider (openai/anthropic/custom):') || 'openai';
  
  if (!endpoint || !apiKey) {
    console.error('❌ Endpoint and API key are required');
    return;
  }
  
  console.log(`✅ Testing with endpoint: ${endpoint}`);
  console.log(`✅ Provider: ${provider}`);
  
  try {
    const testMessage = "Hello, please respond with a simple greeting.";
    
    let requestBody;
    let headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    
    // Format request based on provider
    if (provider === 'openai') {
      requestBody = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant.' },
          { role: 'user', content: testMessage }
        ],
        max_tokens: 100,
        temperature: 0.7
      };
    } else if (provider === 'anthropic') {
      requestBody = {
        model: 'claude-3-haiku-20240307',
        max_tokens: 100,
        messages: [
          { role: 'user', content: testMessage }
        ]
      };
      headers['anthropic-version'] = '2023-06-01';
    } else {
      // Custom - assume OpenAI-compatible format
      requestBody = {
        model: 'custom-model',
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant.' },
          { role: 'user', content: testMessage }
        ],
        max_tokens: 100,
        temperature: 0.7
      };
    }
    
    console.log('📤 Sending request...', {
      endpoint,
      requestBody: JSON.stringify(requestBody, null, 2)
    });
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    console.log(`📥 Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ LLM API Error:', errorText);
      console.log('\n🔧 Troubleshooting:');
      console.log('- Check if the endpoint URL is correct');
      console.log('- Verify the API key is valid');
      console.log('- Ensure the provider format matches your LLM service');
      return;
    }
    
    const result = await response.json();
    console.log('✅ Raw LLM Response:', result);
    
    // Extract response content
    let responseContent = '';
    if (provider === 'openai' && result.choices?.[0]?.message?.content) {
      responseContent = result.choices[0].message.content;
    } else if (provider === 'anthropic' && result.content?.[0]?.text) {
      responseContent = result.content[0].text;
    } else {
      responseContent = JSON.stringify(result);
    }
    
    console.log('✅ Extracted response:', responseContent);
    console.log('🎉 LLM test successful! The LLM endpoint is working.');
    
  } catch (error) {
    console.error('❌ LLM test failed:', error);
    console.log('\n🔧 Common issues:');
    console.log('- Network connectivity problems');
    console.log('- CORS issues (if calling from browser)');
    console.log('- Invalid endpoint URL format');
    console.log('- Authentication/API key issues');
  }
}

// Run the test
simpleLLMTest();