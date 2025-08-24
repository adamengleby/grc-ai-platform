// Debug the entire credential storage system
// Run this in browser console

function debugCredentialSystem() {
  console.log('🔍 Debugging credential storage system...');
  
  const tenantId = 'tenant-acme';
  
  // 1. Check all credential-related localStorage keys
  console.log('\n📋 All credential-related localStorage keys:');
  const allKeys = Object.keys(localStorage);
  const credentialKeys = allKeys.filter(key => 
    key.includes('credential') || 
    key.includes('connection') || 
    key.includes('grc_encrypted') ||
    key.includes('archer')
  );
  
  credentialKeys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      console.log(`\n📋 ${key}:`);
      console.log('   Raw value length:', value?.length || 0);
      
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            console.log(`   Array with ${parsed.length} items:`);
            parsed.forEach((item, index) => {
              console.log(`   [${index}] Name: ${item.name || item.title || 'unnamed'}, ID: ${item.id || 'no-id'}`);
            });
          } else {
            console.log('   Object keys:', Object.keys(parsed));
            if (parsed.name || parsed.title) {
              console.log('   Name:', parsed.name || parsed.title);
            }
            if (parsed.id) {
              console.log('   ID:', parsed.id);
            }
          }
        } catch (e) {
          console.log('   Raw value (not JSON):', value.substring(0, 100) + '...');
        }
      }
    } catch (e) {
      console.log(`   Error reading key: ${e.message}`);
    }
  });
  
  // 2. Test the credential API directly
  console.log('\n🧪 Testing credential API directly...');
  
  try {
    // Import and test the credentials API
    console.log('Testing credentialsManager...');
    
    // Check if there are any encrypted credentials
    const encryptedKey = `grc_encrypted_credentials_${tenantId}`;
    const encryptedData = localStorage.getItem(encryptedKey);
    console.log(`Encrypted credentials key (${encryptedKey}):`, encryptedData ? 'EXISTS' : 'NOT FOUND');
    
    if (encryptedData) {
      try {
        const parsed = JSON.parse(encryptedData);
        console.log(`   Found ${parsed.length} encrypted credentials`);
        parsed.forEach((cred, index) => {
          console.log(`   [${index}] Name: ${cred.name}, BaseUrl: ${cred.baseUrl}, Created: ${cred.created}`);
        });
      } catch (e) {
        console.log('   Error parsing encrypted data:', e.message);
      }
    }
    
    // Check basic connections
    const connectionsKey = `connections_tenant_${tenantId}`;
    const connectionsData = localStorage.getItem(connectionsKey);
    console.log(`Basic connections key (${connectionsKey}):`, connectionsData ? 'EXISTS' : 'NOT FOUND');
    
    if (connectionsData) {
      try {
        const parsed = JSON.parse(connectionsData);
        console.log(`   Found ${parsed.length} basic connections`);
        parsed.forEach((conn, index) => {
          console.log(`   [${index}] Name: ${conn.name}, Type: ${conn.type}, Host: ${conn.host || 'no-host'}`);
        });
      } catch (e) {
        console.log('   Error parsing connections data:', e.message);
      }
    }
    
  } catch (error) {
    console.error('Error testing credential API:', error);
  }
  
  // 3. Check what the MCP server endpoint would see
  console.log('\n🌐 Testing what MCP server would see...');
  
  fetch('http://localhost:3001/connections')
    .then(response => {
      console.log('MCP server /connections response status:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('MCP server sees connections:', data);
      if (data.connections) {
        console.log(`MCP server found ${data.connections.length} connections`);
      }
    })
    .catch(error => {
      console.log('MCP server connection test failed:', error.message);
    });
  
  console.log('\n🔍 Summary:');
  console.log('Compare the counts:');
  console.log('- Basic connections (from Connections page)');
  console.log('- Encrypted credentials (for MCP server)');
  console.log('- What MCP server actually sees');
  console.log('These should all match for proper operation!');
}

debugCredentialSystem();