#!/usr/bin/env node

const axios = require('axios');
const https = require('https');

async function directArcherTest() {
  console.log('🔍 DIRECT ARCHER API TEST');
  console.log('='.repeat(80));
  console.log('This bypasses MCP and tests Archer API directly');
  console.log('');

  const baseUrl = 'https://hostplus-uat.archerirm.com.au';
  const credentials = {
    InstanceName: '710100',
    Username: 'api_test', 
    UserDomain: '',
    Password: 'Password1!.'
  };

  // Create axios instance with SSL bypass
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
    console.log('🔐 Step 1: Authenticating with Archer...');
    console.log(`URL: ${baseUrl}/api/core/security/login`);
    console.log('Credentials:', {
      InstanceName: credentials.InstanceName,
      Username: credentials.Username,
      UserDomain: credentials.UserDomain,
      Password: '***masked***'
    });

    const loginResponse = await client.post('/api/core/security/login', credentials);
    
    console.log('✅ Login Response Status:', loginResponse.status);
    console.log('Login Response Keys:', Object.keys(loginResponse.data || {}));
    
    if (loginResponse.data.IsSuccessful && loginResponse.data.RequestedObject?.SessionToken) {
      const sessionToken = loginResponse.data.RequestedObject.SessionToken;
      console.log('✅ Session Token obtained:', sessionToken.substring(0, 20) + '...');
      
      console.log('\n🎯 Step 2: Testing Risk Register ContentAPI...');
      const riskUrl = '/contentapi/Risk_Register?$count=true&$top=0';
      console.log(`URL: ${baseUrl}${riskUrl}`);
      
      const riskResponse = await client.get(riskUrl, {
        headers: {
          'Authorization': `Archer session-id=${sessionToken}`
        }
      });
      
      console.log('✅ Risk Register Response Status:', riskResponse.status);
      console.log('Response Headers:', riskResponse.headers);
      console.log('Response Data Keys:', Object.keys(riskResponse.data || {}));
      
      if (riskResponse.data['@odata.count'] !== undefined) {
        console.log(`🎯 RISK REGISTER RECORD COUNT: ${riskResponse.data['@odata.count']}`);
        
        if (riskResponse.data['@odata.count'] > 0) {
          console.log('\n🚨 CONFIRMED: Risk Register HAS data!');
          console.log('Your MCP server has a bug in record retrieval.');
        } else {
          console.log('\n📋 Risk Register is actually empty (0 records)');
        }
      } else {
        console.log('⚠️ No @odata.count in response');
        console.log('Full response:', JSON.stringify(riskResponse.data, null, 2));
      }

      console.log('\n🎯 Step 3: Testing other applications...');
      const apps = ['Controls', 'Issues', 'Task_Management'];
      
      for (const app of apps) {
        try {
          const appUrl = `/contentapi/${app}?$count=true&$top=0`;
          const appResponse = await client.get(appUrl, {
            headers: {
              'Authorization': `Archer session-id=${sessionToken}`
            }
          });
          
          const count = appResponse.data['@odata.count'] || 0;
          console.log(`📋 ${app}: ${count} records`);
        } catch (appError) {
          console.log(`❌ ${app}: Error - ${appError.response?.status || appError.message}`);
        }
      }
      
    } else {
      console.error('❌ Authentication failed');
      console.error('Response:', JSON.stringify(loginResponse.data, null, 2));
    }

  } catch (error) {
    console.error('❌ Direct Archer test failed:', error.message);
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Response:', error.response.data);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 DIRECT ARCHER TEST COMPLETE');
}

directArcherTest().catch(console.error);