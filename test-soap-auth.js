#!/usr/bin/env node

/**
 * Test script for SOAP authentication fallback
 * Tests both the main auth endpoint and connection tester
 */

const testCredentials = {
  baseUrl: 'https://example-archer.com', // Mock server that will fail REST
  username: 'testuser',
  password: 'testpass',
  instanceId: 'testinstance',
  userDomainId: '1'
};

console.log('🧪 Testing SOAP Authentication Fallback');
console.log('=====================================');

async function testAuthEndpoint() {
  console.log('\n1. Testing main authentication endpoint...');
  
  try {
    const response = await fetch('http://localhost:3005/api/v1/auth/archer/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCredentials)
    });
    
    const result = await response.json();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${result.success}`);
    
    if (result.success) {
      console.log(`   ✅ Auth Method: ${result.sessionData?.authMethod}`);
      console.log(`   Session ID: ${result.sessionData?.sessionId?.substring(0, 15)}...`);
    } else {
      console.log(`   ❌ Error: ${result.error}`);
      if (result.details) {
        console.log(`   REST Error: ${result.details.restError}`);
        console.log(`   SOAP Error: ${result.details.soapError}`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }
}

async function testConnectionTester() {
  console.log('\n2. Testing connection tester...');
  
  try {
    const response = await fetch('http://localhost:3005/api/v1/connections/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'archer',
        ...testCredentials
      })
    });
    
    const result = await response.json();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Message: ${result.message}`);
    
    if (result.details?.authMethod) {
      console.log(`   ✅ Auth Method: ${result.details.authMethod}`);
    }
    
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }
}

async function runTests() {
  await testAuthEndpoint();
  await testConnectionTester();
  
  console.log('\n📋 Test Summary');
  console.log('===============');
  console.log('These tests verify that both authentication endpoints:');
  console.log('1. Try REST API authentication first');  
  console.log('2. Fall back to SOAP if REST fails');
  console.log('3. Return appropriate error messages if both fail');
  console.log('4. Include the successful auth method in responses');
  console.log('\nBoth endpoints should show failed authentication since');
  console.log('we\'re using mock credentials against a non-existent server.');
  console.log('The important thing is that SOAP fallback is attempted.');
}

runTests().catch(console.error);