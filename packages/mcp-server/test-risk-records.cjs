#!/usr/bin/env node

const axios = require('axios');
const https = require('https');

async function testRiskRecords() {
  console.log('🔍 TESTING RISK REGISTER RECORDS - DIFFERENT APPROACHES');
  console.log('='.repeat(80));

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

    console.log('\n📋 Test 1: Standard request (no count)');
    let response1 = await client.get('/contentapi/Risk_Register', { headers: authHeader });
    console.log('Response keys:', Object.keys(response1.data));
    console.log('Value length:', Array.isArray(response1.data.value) ? response1.data.value.length : 'not array');
    
    console.log('\n📋 Test 2: Request with $top=5');
    let response2 = await client.get('/contentapi/Risk_Register?$top=5', { headers: authHeader });
    console.log('Response keys:', Object.keys(response2.data));
    console.log('Value length:', Array.isArray(response2.data.value) ? response2.data.value.length : 'not array');
    
    console.log('\n📋 Test 3: Request with $top=100');  
    let response3 = await client.get('/contentapi/Risk_Register?$top=100', { headers: authHeader });
    console.log('Response keys:', Object.keys(response3.data));
    console.log('Value length:', Array.isArray(response3.data.value) ? response3.data.value.length : 'not array');
    
    console.log('\n📋 Test 4: Just $count parameter');
    try {
      let response4 = await client.get('/contentapi/Risk_Register?$count=true', { headers: authHeader });
      console.log('Response keys:', Object.keys(response4.data));
      console.log('OData count:', response4.data['@odata.count']);
      console.log('Value length:', Array.isArray(response4.data.value) ? response4.data.value.length : 'not array');
    } catch (e) {
      console.log('❌ $count test failed:', e.response?.status, e.message);
    }
    
    console.log('\n📋 Test 5: Check if records exist with different filter');
    try {
      let response5 = await client.get('/contentapi/Risk_Register?$top=1000', { headers: authHeader });
      console.log('Response keys:', Object.keys(response5.data));
      console.log('Value length:', Array.isArray(response5.data.value) ? response5.data.value.length : 'not array');
      
      if (response5.data.value && response5.data.value.length > 0) {
        console.log('✅ FOUND RECORDS!');
        console.log('First record keys:', Object.keys(response5.data.value[0]));
      } else {
        console.log('❌ Still no records found');
      }
    } catch (e) {
      console.log('❌ Large fetch failed:', e.response?.status, e.message);
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎯 CONCLUSION:');
    console.log('If all tests show empty value arrays, Risk Register is genuinely empty.');
    console.log('The user\'s assumption that it contains records may be incorrect.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testRiskRecords().catch(console.error);