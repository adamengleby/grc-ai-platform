#!/usr/bin/env node

const axios = require('axios');
const https = require('https');

async function testSecurityEventsEndpoint() {
  console.log('🔍 TESTING ARCHER SECURITY EVENTS ENDPOINT');
  console.log('='.repeat(80));

  const baseUrl = 'https://hostplus-dev.archerirm.com.au';
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
    
    console.log('Login Response Status:', loginResponse.status);
    console.log('Login Response Data:', JSON.stringify(loginResponse.data, null, 2));
    
    if (!loginResponse.data || !loginResponse.data.RequestedObject || !loginResponse.data.RequestedObject.SessionToken) {
      throw new Error('No session token received from authentication');
    }
    
    const sessionToken = loginResponse.data.RequestedObject.SessionToken;
    console.log('✅ Authenticated');
    console.log('Session Token:', sessionToken.substring(0, 20) + '...');
    
    const authHeader = { 'Authorization': `Archer session-id=${sessionToken}` };

    // Test different security events endpoints
    const endpointsToTest = [
      {
        name: 'Security Events (Original)',
        url: '/api/core/system/AccessControlReports/SecurityEvents',
        method: 'POST',
        headers: { ...authHeader, 'X-HTTP-Method-Override': 'GET' },
        body: {
          InstanceName: '710100',
          EventType: 'all events',
          EventsForDate: new Date().toISOString().split('T')[0] // Today's date
        }
      },
      {
        name: 'Security Events (GET)',
        url: '/api/core/system/AccessControlReports/SecurityEvents',
        method: 'GET',
        headers: authHeader,
        params: {
          InstanceName: '710100',
          EventType: 'all events',
          EventsForDate: new Date().toISOString().split('T')[0]
        }
      },
      {
        name: 'AccessControlReports Base',
        url: '/api/core/system/AccessControlReports',
        method: 'GET',
        headers: authHeader
      },
      {
        name: 'System Reports',
        url: '/api/core/system',
        method: 'GET',
        headers: authHeader
      },
      {
        name: 'Audit Trail',
        url: '/api/core/system/audittrail',
        method: 'GET',
        headers: authHeader
      }
    ];

    for (const endpoint of endpointsToTest) {
      console.log(`\n📋 Testing: ${endpoint.name}`);
      console.log(`URL: ${endpoint.url}`);
      console.log(`Method: ${endpoint.method}`);
      
      try {
        let response;
        if (endpoint.method === 'GET') {
          response = await client.get(endpoint.url, { 
            headers: endpoint.headers,
            params: endpoint.params 
          });
        } else {
          response = await client.post(endpoint.url, endpoint.body, { 
            headers: endpoint.headers 
          });
        }
        
        console.log(`✅ Status: ${response.status}`);
        console.log('Response Headers:', JSON.stringify({
          'content-type': response.headers['content-type'],
          'content-length': response.headers['content-length'],
          'x-powered-by': response.headers['x-powered-by']
        }, null, 2));
        
        console.log('Response Data:');
        if (typeof response.data === 'string') {
          console.log('(String response, first 500 chars)');
          console.log(response.data.substring(0, 500));
        } else {
          console.log(JSON.stringify(response.data, null, 2));
        }
        
      } catch (error) {
        console.log(`❌ Error: ${error.response?.status || 'Network Error'}`);
        if (error.response?.data) {
          console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
        }
        console.log('Error Message:', error.message);
      }
      
      console.log('-'.repeat(60));
    }

  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testSecurityEventsEndpoint().catch(console.error);