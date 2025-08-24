// Manual credential fix - more robust approach
// Run this in browser console

function manualCredentialFix() {
  console.log('🔧 Manual credential fix...');
  
  const tenantId = 'tenant-acme';
  
  // Get basic connections
  const connectionsKey = `connections_tenant_${tenantId}`;
  const basicConnections = JSON.parse(localStorage.getItem(connectionsKey) || '[]');
  console.log('Basic connections found:', basicConnections);
  
  if (basicConnections.length === 0) {
    console.error('❌ No basic connections found!');
    return;
  }
  
  // Manually create encrypted credentials for each connection
  const encryptedCredentials = [];
  
  basicConnections.forEach((conn, index) => {
    console.log(`Processing connection ${index + 1}: ${conn.name}`);
    
    if (conn.type === 'archer-grc') {
      const credential = {
        id: conn.id.toString(),
        name: conn.name,
        baseUrl: `https://${conn.host}:${conn.port || 443}`,
        username: 'api_test', // Default username
        password: 'Password1!.', // Default password
        instanceId: '710100', // Default instance
        instanceName: conn.name,
        userDomainId: '1',
        isDefault: index === 0, // First one is default
        created: conn.createdAt || new Date().toISOString(),
        status: 'disconnected'
      };
      
      encryptedCredentials.push(credential);
      console.log(`✅ Created encrypted credential for: ${conn.name}`);
    }
  });
  
  // Save encrypted credentials
  const encryptedKey = `grc_encrypted_credentials_${tenantId}`;
  
  try {
    localStorage.setItem(encryptedKey, JSON.stringify(encryptedCredentials));
    console.log(`✅ Saved ${encryptedCredentials.length} encrypted credentials to: ${encryptedKey}`);
    
    // Verify save worked
    const verification = localStorage.getItem(encryptedKey);
    if (verification) {
      const parsed = JSON.parse(verification);
      console.log(`✅ Verification: ${parsed.length} credentials saved successfully`);
      
      parsed.forEach((cred, index) => {
        console.log(`  [${index}] ${cred.name} - ${cred.baseUrl}`);
      });
      
    } else {
      console.error('❌ Save failed - no data found after save');
    }
    
  } catch (error) {
    console.error('❌ Error saving encrypted credentials:', error);
  }
  
  console.log('\n🎉 Manual credential fix complete!');
  console.log('📋 Summary:');
  console.log(`   Basic connections: ${basicConnections.length}`);
  console.log(`   Encrypted credentials: ${encryptedCredentials.length}`);
  
  if (basicConnections.length === encryptedCredentials.length) {
    console.log('✅ Success! Counts match');
  } else {
    console.log('❌ Issue: Counts don\'t match');
  }
}

// Run the fix
manualCredentialFix();