#!/usr/bin/env node

const axios = require('axios');
const https = require('https');

async function testPolicies() {
  console.log('🎯 TESTING POLICIES RETRIEVAL');
  console.log('='.repeat(50));

  const baseUrl = 'https://hostplus-uat.archerirm.com.au';
  const credentials = {
    InstanceName: '710100',
    Username: 'api_test', 
    UserDomain: '',
    Password: 'Password1!.'
  };

  const client = axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    })
  });

  try {
    console.log('🔐 Authenticating...');
    const loginResponse = await client.post('/api/core/security/login', credentials);
    const sessionToken = loginResponse.data.RequestedObject.SessionToken;
    console.log('✅ Authenticated');
    
    const authHeader = { 'Authorization': `Archer session-id=${sessionToken}` };

    console.log('\n📋 Testing various Policy-related endpoints...');
    
    // Common policy-related names to test
    const policyEndpoints = [
      'Policies',
      'Policy',
      'Policy_Management', 
      'Policy_Library',
      'Policy_Register',
      'Governance_Policies',
      'Corporate_Policies',
      'IT_Policies',
      'Security_Policies',
      'Compliance_Policies',
      'Risk_Policies',
      'Data_Governance_Policies',
      'Information_Security_Policies'
    ];

    const results = {};
    
    for (const endpoint of policyEndpoints) {
      try {
        console.log(`\n🔍 Testing: /contentapi/${endpoint}`);
        const response = await client.get(`/contentapi/${endpoint}?$top=10`, { headers: authHeader });
        const count = response.data.value ? response.data.value.length : 0;
        
        if (count > 0) {
          // Get a larger sample to see total count
          const fullResponse = await client.get(`/contentapi/${endpoint}?$top=1000`, { headers: authHeader });
          const totalCount = fullResponse.data.value ? fullResponse.data.value.length : 0;
          
          results[endpoint] = {
            status: 'SUCCESS',
            count: totalCount,
            sample: response.data.value.slice(0, 2) // First 2 records for inspection
          };
          
          console.log(`✅ ${endpoint}: ${totalCount} records found`);
          
          // Show field names from first record
          if (response.data.value.length > 0) {
            const fields = Object.keys(response.data.value[0]);
            console.log(`   Fields (${fields.length}): ${fields.slice(0, 5).join(', ')}${fields.length > 5 ? '...' : ''}`);
          }
        } else {
          results[endpoint] = { status: 'EMPTY', count: 0 };
          console.log(`📭 ${endpoint}: No records`);
        }
        
      } catch (error) {
        const status = error.response?.status || 'ERROR';
        results[endpoint] = { 
          status: 'ERROR', 
          error: status,
          message: error.response?.statusText || error.message 
        };
        
        if (status === 404) {
          console.log(`❌ ${endpoint}: Not Found (404)`);
        } else {
          console.log(`❌ ${endpoint}: Error ${status} - ${error.response?.statusText || error.message}`);
        }
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 POLICIES TEST RESULTS');
    console.log('='.repeat(60));
    
    let foundPolicies = false;
    let totalPolicyRecords = 0;
    
    for (const [endpoint, result] of Object.entries(results)) {
      if (result.status === 'SUCCESS' && result.count > 0) {
        console.log(`✅ ${endpoint}: ${result.count} policies`);
        foundPolicies = true;
        totalPolicyRecords += result.count;
        
        // Show sample data for the first successful endpoint
        if (result.sample && result.sample.length > 0 && totalPolicyRecords === result.count) {
          console.log('\n📄 Sample Policy Record:');
          const sample = result.sample[0];
          Object.entries(sample).slice(0, 8).forEach(([key, value]) => {
            const displayValue = typeof value === 'string' && value.length > 50 
              ? value.substring(0, 50) + '...' 
              : value;
            console.log(`   ${key}: ${displayValue}`);
          });
        }
      }
    }
    
    if (!foundPolicies) {
      console.log('❌ No policy applications found');
      console.log('\n💡 Suggestions:');
      console.log('   - Policies might be stored in a different application');
      console.log('   - Check if policies are part of another module (e.g., Controls, Documents)');
      console.log('   - Verify application naming conventions in your Archer instance');
    } else {
      console.log(`\n🎉 SUCCESS: Found ${totalPolicyRecords} total policy records!`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testPolicies().catch(console.error);