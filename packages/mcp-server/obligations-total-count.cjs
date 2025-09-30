#!/usr/bin/env node

const axios = require('axios');
const https = require('https');

async function getObligationsTotalCount() {
  console.log('🎯 GETTING TOTAL OBLIGATIONS COUNT');
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

    console.log('\n📊 Testing different limits for Obligations...');
    
    const limits = [1000, 2000, 5000, 10000];
    
    for (const limit of limits) {
      try {
        console.log(`\n🔍 Testing $top=${limit}...`);
        const response = await client.get(`/contentapi/Obligations?$top=${limit}`, { headers: authHeader });
        const count = response.data.value ? response.data.value.length : 0;
        
        console.log(`📊 Retrieved: ${count.toLocaleString()} records`);
        
        if (count < limit) {
          console.log(`✅ TOTAL COUNT: ${count.toLocaleString()} records (hit actual limit)`);
          break;
        } else {
          console.log(`⚠️ May have more records (hit query limit of ${limit})`);
        }
        
      } catch (error) {
        console.log(`❌ $top=${limit} failed: ${error.response?.status} - ${error.response?.statusText || error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

getObligationsTotalCount().catch(console.error);