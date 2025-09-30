// Fix credential synchronization issue
// Run this in browser console

async function fixCredentialSync() {
  console.log('🔧 Fixing credential synchronization...');
  
  const tenantId = 'tenant-acme';
  
  // Get basic connections
  const connectionsKey = `connections_tenant_${tenantId}`;
  const basicConnections = JSON.parse(localStorage.getItem(connectionsKey) || '[]');
  console.log(`Found ${basicConnections.length} basic connections`);
  
  // Get existing encrypted credentials
  const encryptedKey = `grc_encrypted_credentials_${tenantId}`;
  const existingEncrypted = JSON.parse(localStorage.getItem(encryptedKey) || '[]');
  console.log(`Found ${existingEncrypted.length} existing encrypted credentials`);
  
  // Find connections that need to be converted to encrypted credentials
  const missingConnections = basicConnections.filter(basicConn => 
    !existingEncrypted.some(encConn => encConn.id === basicConn.id)
  );
  
  console.log(`Found ${missingConnections.length} connections missing encrypted credentials:`);
  missingConnections.forEach(conn => {
    console.log(`  - ${conn.name} (ID: ${conn.id})`);
  });
  
  if (missingConnections.length === 0) {
    console.log('✅ All connections already have encrypted credentials');
    return;
  }
  
  // Convert missing connections to encrypted credentials
  const newEncryptedCredentials = [...existingEncrypted];
  
  for (const conn of missingConnections) {
    if (conn.type === 'archer-grc') {
      // Create encrypted credential from basic connection
      const credential = {
        id: conn.id,
        name: conn.name,
        baseUrl: `https://${conn.host}:${conn.port || 443}`,
        username: conn.username || 'api_test', // You may need to adjust this
        password: conn.password || 'Password1!.', // You may need to adjust this  
        instanceId: conn.instanceName || '710100',
        instanceName: conn.instanceName || conn.name,
        userDomainId: '1',
        isDefault: newEncryptedCredentials.length === 0,
        created: conn.createdAt || new Date().toISOString(),
        status: 'disconnected',
      };
      
      newEncryptedCredentials.push(credential);
      console.log(`✅ Created encrypted credential for: ${conn.name}`);
      
      // Ask user for missing credentials if needed
      if (!conn.username || !conn.password) {
        console.log(`⚠️  Missing username/password for ${conn.name}`);
        console.log(`   You may need to manually update the credentials`);
      }
    }
  }
  
  // Save updated encrypted credentials
  localStorage.setItem(encryptedKey, JSON.stringify(newEncryptedCredentials));
  console.log(`✅ Saved ${newEncryptedCredentials.length} encrypted credentials`);
  
  // Verify the fix
  console.log('\n🔍 Verification:');
  console.log(`Basic connections: ${basicConnections.length}`);
  console.log(`Encrypted credentials: ${newEncryptedCredentials.length}`);
  
  if (basicConnections.length === newEncryptedCredentials.length) {
    console.log('✅ Credential sync fixed! All connections now have encrypted credentials');
  } else {
    console.log('⚠️  Counts still don\'t match - manual intervention may be needed');
  }
  
  console.log('\n🎉 Credential sync complete!');
  console.log('🔄 Please refresh the page to see the changes.');
  
  // Auto-refresh after 3 seconds
  setTimeout(() => {
    console.log('🔄 Auto-refreshing page...');
    window.location.reload();
  }, 3000);
}

fixCredentialSync();