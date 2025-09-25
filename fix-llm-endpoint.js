// Fix LLM endpoint URL
// Run this in browser console on the GRC AI Platform page

function fixLLMEndpoint() {
  console.log('🔧 Fixing LLM endpoint URL...');
  
  // Find all localStorage keys that contain LLM configs
  const allKeys = Object.keys(localStorage);
  const llmConfigKeys = allKeys.filter(key => key.startsWith('user_llm_configs_'));
  
  console.log('Found LLM config keys:', llmConfigKeys);
  
  llmConfigKeys.forEach(configKey => {
    const tenantId = configKey.replace('user_llm_configs_', '');
    console.log(`\n📂 Processing tenant: ${tenantId}`);
    
    try {
      const configs = JSON.parse(localStorage.getItem(configKey) || '[]');
      let updated = false;
      
      configs.forEach((config, index) => {
        console.log(`  📋 Config ${index + 1}: ${config.name}`);
        console.log(`    Current endpoint: ${config.endpoint}`);
        
        // Check if endpoint contains the problematic URL pattern
        if (config.endpoint && config.endpoint.includes('adam-engleby-8010')) {
          console.log(`    🔧 Fixing endpoint...`);
          
          // Ask user for the correct endpoint
          const newEndpoint = prompt(`Current endpoint: ${config.endpoint}\n\nEnter the correct LLM endpoint URL:`);
          
          if (newEndpoint && newEndpoint.trim()) {
            config.endpoint = newEndpoint.trim();
            console.log(`    ✅ Updated to: ${config.endpoint}`);
            updated = true;
          } else {
            console.log(`    ❌ No new endpoint provided, skipping...`);
          }
        } else {
          console.log(`    ✅ Endpoint looks OK`);
        }
      });
      
      if (updated) {
        localStorage.setItem(configKey, JSON.stringify(configs));
        console.log(`  ✅ Saved updated configs for tenant ${tenantId}`);
      } else {
        console.log(`  ℹ️ No updates needed for tenant ${tenantId}`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error processing tenant ${tenantId}:`, error);
    }
  });
  
  console.log('\n🎉 LLM endpoint fix complete!');
  console.log('🔄 Please refresh the page to see the changes.');
  
  // Auto-refresh after 2 seconds
  setTimeout(() => {
    console.log('🔄 Auto-refreshing page...');
    window.location.reload();
  }, 2000);
}

// Also show current LLM configurations
function showCurrentLLMConfigs() {
  console.log('\n🔍 Current LLM configurations:');
  const allKeys = Object.keys(localStorage);
  const llmConfigKeys = allKeys.filter(key => key.startsWith('user_llm_configs_'));
  
  llmConfigKeys.forEach(configKey => {
    try {
      const configs = JSON.parse(localStorage.getItem(configKey) || '[]');
      console.log(`\n${configKey}:`, configs);
    } catch (e) {
      console.log(`${configKey}: Error parsing`, localStorage.getItem(configKey));
    }
  });
}

console.log('🚀 Starting LLM endpoint fix...');
showCurrentLLMConfigs();
fixLLMEndpoint();