#!/usr/bin/env node

const axios = require('axios');
const https = require('https');

async function getAppCounts() {
  console.log('🎯 QUICK APPLICATION RECORD COUNTS');
  console.log('='.repeat(80));

  const targetApps = [
    'Risk_Register',
    'Risk_Review', 
    'Obligations',
    'Incidents',
    'Controls',  // Note: likely "Controls" not "Control"
    'Control_self_assessment',
    'Remediation_Plans'  // Note: likely "Remediation_Plans" not "remediation actions"
  ];

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
    console.log('✅ Authenticated\\n');
    
    const authHeader = { 'Authorization': `Archer session-id=${sessionToken}` };

    console.log('📊 APPLICATION RECORD COUNTS:');
    console.log('='.repeat(50));
    
    let totalRecords = 0;
    let appsWithData = 0;
    
    for (const app of targetApps) {
      try {
        const response = await client.get(`/contentapi/${app}?$top=1000`, { headers: authHeader });
        const count = response.data.value ? response.data.value.length : 0;
        
        const status = count > 0 ? '✅' : '📭';
        console.log(`${status} ${app.replace(/_/g, ' ')}: ${count.toLocaleString()} records`);
        
        totalRecords += count;
        if (count > 0) appsWithData++;
        
      } catch (error) {
        const status = error.response?.status || 'ERR';
        console.log(`❌ ${app.replace(/_/g, ' ')}: Error ${status} - ${error.response?.statusText || error.message}`);
      }
    }
    
    console.log('\\n' + '='.repeat(50));
    console.log(`📊 SUMMARY:`);
    console.log(`Total Applications: ${targetApps.length}`);
    console.log(`Applications with Data: ${appsWithData}`);
    console.log(`Total Records Found: ${totalRecords.toLocaleString()}`);
    
    if (appsWithData > 0) {
      console.log('\\n🎉 SUCCESS: MCP server can retrieve records from Archer!');
    }

  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

getAppCounts().catch(console.error);