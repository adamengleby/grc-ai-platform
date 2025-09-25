#!/usr/bin/env node

const axios = require('axios');
const https = require('https');

async function findPoliciesApplication() {
  console.log('🎯 FINDING POLICIES APPLICATION');
  console.log('='.repeat(60));

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

    console.log('\n📋 Step 1: Getting all available applications...');
    const appsResponse = await client.get('/platformapi/core/system/application', { headers: authHeader });
    
    const applications = appsResponse.data;
    console.log(`✅ Found ${applications.length} total applications`);

    console.log('\n🔍 Step 2: Searching for Policy-related applications...');
    const policyApps = applications.filter(app => 
      app.RequestedObject && app.RequestedObject.Name && 
      app.RequestedObject.Name.toLowerCase().includes('polic')
    );

    if (policyApps.length > 0) {
      console.log(`\n✅ Found ${policyApps.length} Policy-related application(s):`);
      
      for (const app of policyApps) {
        const appInfo = app.RequestedObject;
        console.log(`\n📱 Application: "${appInfo.Name}"`);
        console.log(`   ID: ${appInfo.Id}`);
        console.log(`   Status: ${appInfo.Status === 1 ? 'Active' : 'Inactive'}`);
        console.log(`   Description: ${appInfo.Description || 'No description'}`);
      }

      console.log('\n📋 Step 3: Getting level mappings to find ContentAPI endpoints...');
      const levelsResponse = await client.get('/platformapi/core/system/level', { headers: authHeader });
      const levels = levelsResponse.data;
      
      console.log('\n🔍 Step 4: Finding ContentAPI endpoints for Policy applications...');
      
      for (const app of policyApps) {
        const appInfo = app.RequestedObject;
        const appLevels = levels.filter(level => 
          level.RequestedObject && level.RequestedObject.ApplicationId === appInfo.Id
        );
        
        if (appLevels.length > 0) {
          for (const level of appLevels) {
            const levelInfo = level.RequestedObject;
            const alias = levelInfo.Alias;
            const contentApiEndpoint = `/contentapi/${alias}`;
            
            console.log(`\n🎯 Testing endpoint: ${contentApiEndpoint}`);
            console.log(`   Level: ${levelInfo.Name} (ID: ${levelInfo.Id})`);
            
            try {
              const testResponse = await client.get(`${contentApiEndpoint}?$top=5`, { headers: authHeader });
              const count = testResponse.data.value ? testResponse.data.value.length : 0;
              
              if (count > 0) {
                // Get full count
                const fullResponse = await client.get(`${contentApiEndpoint}?$top=1000`, { headers: authHeader });
                const totalCount = fullResponse.data.value ? fullResponse.data.value.length : 0;
                
                console.log(`   ✅ SUCCESS: ${totalCount} policy records found!`);
                
                // Show sample record structure
                if (testResponse.data.value.length > 0) {
                  const sampleRecord = testResponse.data.value[0];
                  const fieldNames = Object.keys(sampleRecord);
                  console.log(`   📄 Record Fields (${fieldNames.length}): ${fieldNames.slice(0, 8).join(', ')}${fieldNames.length > 8 ? '...' : ''}`);
                  
                  // Show sample data
                  console.log('\n   📋 Sample Policy Record:');
                  Object.entries(sampleRecord).slice(0, 6).forEach(([key, value]) => {
                    const displayValue = typeof value === 'string' && value.length > 60 
                      ? value.substring(0, 60) + '...' 
                      : value;
                    console.log(`      ${key}: ${displayValue}`);
                  });
                }
                
                return { 
                  endpoint: contentApiEndpoint, 
                  appName: appInfo.Name,
                  count: totalCount,
                  records: testResponse.data.value 
                };
              } else {
                console.log(`   📭 Empty: No records in this endpoint`);
              }
              
            } catch (error) {
              const status = error.response?.status || 'ERROR';
              console.log(`   ❌ Failed: ${status} - ${error.response?.statusText || error.message}`);
            }
          }
        } else {
          console.log(`   ⚠️ No levels found for application: ${appInfo.Name}`);
        }
      }
    } else {
      console.log('\n❌ No applications found with "Policy" in the name');
      
      console.log('\n💡 Checking for related applications...');
      const relatedTerms = ['governance', 'compliance', 'document', 'procedure', 'standard'];
      
      for (const term of relatedTerms) {
        const relatedApps = applications.filter(app => 
          app.RequestedObject && app.RequestedObject.Name && 
          app.RequestedObject.Name.toLowerCase().includes(term)
        );
        
        if (relatedApps.length > 0) {
          console.log(`\n🔍 Found ${relatedApps.length} "${term}"-related application(s):`);
          relatedApps.forEach(app => {
            const appInfo = app.RequestedObject;
            console.log(`   - ${appInfo.Name} (ID: ${appInfo.Id})`);
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Failed to find policies application:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

findPoliciesApplication().catch(console.error);