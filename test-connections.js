// Test script to add some sample connections via the credentials API
// Run this in the browser console to test the new connection loading

async function testConnectionsAPI() {
  console.log('🧪 Testing Connections API Migration');
  
  // Import the credentials manager
  const { credentialsManager, saveCredentials } = await import('/src/lib/credentialsApi.ts');
  
  // Set tenant context (you may need to adjust this based on your current tenant)
  const tenantId = 'test-tenant-123';
  credentialsManager.setTenantContext(tenantId);
  
  // Create some test connections
  const testConnections = [
    {
      id: 'archer-dev-1',
      name: 'Archer Dev',
      baseUrl: 'https://archer-dev.example.com:443',
      username: 'dev_user',
      password: 'dev_password',
      instanceId: '710100',
      instanceName: '710100',
      userDomainId: '1',
      isDefault: true,
      created: new Date().toISOString(),
      status: 'disconnected'
    },
    {
      id: 'archer-uat-2',
      name: 'Archer UAT',
      baseUrl: 'https://archer-uat.example.com:443',
      username: 'uat_user',
      password: 'uat_password',
      instanceId: '710200',
      instanceName: '710200',
      userDomainId: '1',
      isDefault: false,
      created: new Date().toISOString(),
      status: 'disconnected'
    }
  ];
  
  try {
    // Save each test connection
    for (const connection of testConnections) {
      console.log(`💾 Saving connection: ${connection.name}`);
      await saveCredentials(connection);
    }
    
    console.log('✅ Test connections saved successfully!');
    console.log('🔄 Reload the Connections page to see them appear.');
    
    // Test loading the connections
    const { getAllCredentials } = await import('/src/lib/credentialsApi.ts');
    const savedConnections = await getAllCredentials();
    console.log(`📋 Loaded ${savedConnections.length} connections:`, savedConnections);
    
  } catch (error) {
    console.error('❌ Error testing connections API:', error);
  }
}

// Make the function available globally for testing
window.testConnectionsAPI = testConnectionsAPI;

console.log('🚀 Test script loaded. Run testConnectionsAPI() to create test data.');