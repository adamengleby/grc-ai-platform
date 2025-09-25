#!/usr/bin/env node

/**
 * Direct test script for schema validation
 * Bypasses HTTP wrapper issues and tests directly
 */

const { TestSchemaDiscoveryTool } = require('./dist/tools/test_schema_discovery.js');

async function runValidationTest() {
  console.log('🔍 Running direct schema validation test...\n');
  
  const testTool = new TestSchemaDiscoveryTool();
  
  // Test arguments with placeholder credentials
  const testArgs = {
    test_type: 'validate',
    application_id: 75,
    application_name: 'Actions',
    content_api_path: '/contentapi/core/content/actions',
    archer_connection: {
      baseUrl: 'https://hostplus-dev.archerirm.com.au',
      sessionToken: 'ZGVmYXVsdDphcGlfdGVzdDpkZWZhdWx0', // Real session token
      instanceId: '710101'
    },
    tenant_id: 'test-tenant'
  };

  try {
    console.log('📋 Test Configuration:');
    console.log(`   Application: ${testArgs.application_name} (ID: ${testArgs.application_id})`);
    console.log(`   Path: ${testArgs.content_api_path}`);
    console.log(`   Base URL: ${testArgs.archer_connection.baseUrl}`);
    console.log(`   Test Type: ${testArgs.test_type}\n`);

    const result = await testTool.execute(testArgs);
    
    console.log('✅ Test Results:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.log('❌ Expected Error (need real credentials):');
    console.log(`   Error: ${error.message}`);
    console.log(`   Type: ${error.constructor.name}\n`);
    
    console.log('🔑 To run with real credentials, update the sessionToken in test-validation.js');
    console.log('   Get your session token from:');
    console.log('   1. Login to Archer web interface');
    console.log('   2. Open browser developer tools > Network tab');
    console.log('   3. Look for session-id in Authorization headers');
    console.log('   4. Replace "test-session-token" with the real value\n');
    
    // Test the metadata endpoint structure anyway
    console.log('🌐 Testing endpoint accessibility...');
    await testEndpointAccess(testArgs.archer_connection);
  }
}

async function testEndpointAccess(connection) {
  const endpoints = [
    '/contentapi/$metadata',
    '/contentapi',
    '/contentapi/core/content/actions?$top=1'
  ];

  for (const endpoint of endpoints) {
    const url = `${connection.baseUrl}${endpoint}`;
    console.log(`   Testing: ${endpoint}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Archer session-id="${connection.sessionToken}"`,
          'Accept': '*/*'
        },
        signal: AbortSignal.timeout(10000)
      });
      
      console.log(`   ✓ ${endpoint}: ${response.status} ${response.statusText}`);
      
      if (response.status === 401) {
        console.log('     (401 = Authentication required - endpoint exists)');
      }
      
    } catch (error) {
      if (error.name === 'TimeoutError') {
        console.log(`   ⏱️  ${endpoint}: Timeout (10s)`);
      } else {
        console.log(`   ❌ ${endpoint}: ${error.message}`);
      }
    }
  }
}

// Run the test
runValidationTest().catch(console.error);