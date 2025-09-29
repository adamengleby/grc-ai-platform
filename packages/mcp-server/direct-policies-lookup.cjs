#!/usr/bin/env node

const axios = require('axios');
const https = require('https');

async function directPoliciesLookup() {
  console.log('🎯 DIRECT POLICIES LOOKUP');
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

    // Get the Policies application (ID: 65 from previous search)
    console.log('\\n📋 Getting Policies application details (ID: 65)...');
    const policyAppResponse = await client.get('/platformapi/core/system/application/65', { headers: authHeader });
    const policyApp = policyAppResponse.data.RequestedObject;
    
    console.log(`✅ Application: "${policyApp.Name}"`);
    console.log(`   Status: ${policyApp.Status === 1 ? 'Active' : 'Inactive'}`);

    // Check if it's a questionnaire instead of application
    console.log('\\n📋 Checking questionnaires...');
    const questionnairesResponse = await client.get('/platformapi/core/system/questionnaire', { headers: authHeader });
    const questionnaires = questionnairesResponse.data;
    
    const policyQuestionnaires = questionnaires.filter(q => 
      q.RequestedObject && q.RequestedObject.Name && 
      q.RequestedObject.Name.toLowerCase().includes('polic')
    );

    if (policyQuestionnaires.length > 0) {
      console.log(`\\n✅ Found ${policyQuestionnaires.length} Policy questionnaire(s):`);
      
      for (const quest of policyQuestionnaires) {
        const questInfo = quest.RequestedObject;
        console.log(`\\n📋 Questionnaire: "${questInfo.Name}"`);
        console.log(`   ID: ${questInfo.Id}`);
        console.log(`   Application ID: ${questInfo.ApplicationId}`);
        console.log(`   Status: ${questInfo.IsActive ? 'Active' : 'Inactive'}`);
        
        // Try to find levels for this questionnaire
        console.log('\\n🔍 Looking for levels for this questionnaire...');
        const levelsResponse = await client.get('/platformapi/core/system/level', { headers: authHeader });
        const levels = levelsResponse.data;
        
        const questionnaireLevels = levels.filter(level => 
          level.RequestedObject && level.RequestedObject.ApplicationId === questInfo.ApplicationId
        );
        
        if (questionnaireLevels.length > 0) {
          console.log(`   Found ${questionnaireLevels.length} level(s):`);
          
          for (const level of questionnaireLevels) {
            const levelInfo = level.RequestedObject;
            console.log(`\\n   📱 Level: "${levelInfo.Name}"`);
            console.log(`      ID: ${levelInfo.Id}`);
            console.log(`      Alias: ${levelInfo.Alias}`);
            
            if (levelInfo.Alias) {
              const contentApiEndpoint = `/contentapi/${levelInfo.Alias}`;
              console.log(`      ContentAPI: ${contentApiEndpoint}`);
              
              // Test this endpoint
              try {
                console.log(`\\n🔍 Testing ${contentApiEndpoint}...`);
                const testResponse = await client.get(`${contentApiEndpoint}?$top=5`, { headers: authHeader });
                const count = testResponse.data.value ? testResponse.data.value.length : 0;
                
                if (count > 0) {
                  // Get full count
                  const fullResponse = await client.get(`${contentApiEndpoint}?$top=1000`, { headers: authHeader });
                  const totalCount = fullResponse.data.value ? fullResponse.data.value.length : 0;
                  
                  console.log(`      ✅ SUCCESS: ${totalCount} policy records!`);
                  
                  // Show sample record
                  if (testResponse.data.value.length > 0) {
                    const sample = testResponse.data.value[0];
                    console.log('\\n      📄 Sample Policy Record:');
                    Object.entries(sample).slice(0, 8).forEach(([key, value]) => {
                      const displayValue = typeof value === 'string' && value.length > 60 
                        ? value.substring(0, 60) + '...' 
                        : value;
                      console.log(`         ${key}: ${displayValue}`);
                    });
                  }
                  
                  return {
                    endpoint: contentApiEndpoint,
                    count: totalCount,
                    appName: questInfo.Name
                  };
                } else {
                  console.log(`      📭 Empty: No records`);
                }
                
              } catch (error) {
                const status = error.response?.status || 'ERROR';
                console.log(`      ❌ Failed: ${status} - ${error.response?.statusText || error.message}`);
              }
            }
          }
        } else {
          console.log('   ⚠️ No levels found for this questionnaire');
        }
      }
    } else {
      console.log('❌ No policy questionnaires found');
    }

    // Also check if policies might be in the modules structure
    console.log('\\n📋 Checking all levels for policy-related aliases...');
    const levelsResponse = await client.get('/platformapi/core/system/level', { headers: authHeader });
    const levels = levelsResponse.data;
    
    const policyLevels = levels.filter(level => 
      level.RequestedObject && level.RequestedObject.Alias && 
      level.RequestedObject.Alias.toLowerCase().includes('polic')
    );

    if (policyLevels.length > 0) {
      console.log(`\\n✅ Found ${policyLevels.length} policy-related level(s):`);
      
      for (const level of policyLevels) {
        const levelInfo = level.RequestedObject;
        const contentApiEndpoint = `/contentapi/${levelInfo.Alias}`;
        
        console.log(`\\n📱 Level: "${levelInfo.Name}"`);
        console.log(`   Alias: ${levelInfo.Alias}`);
        console.log(`   ContentAPI: ${contentApiEndpoint}`);
        
        try {
          const testResponse = await client.get(`${contentApiEndpoint}?$top=5`, { headers: authHeader });
          const count = testResponse.data.value ? testResponse.data.value.length : 0;
          
          if (count > 0) {
            const fullResponse = await client.get(`${contentApiEndpoint}?$top=1000`, { headers: authHeader });
            const totalCount = fullResponse.data.value ? fullResponse.data.value.length : 0;
            
            console.log(`   ✅ SUCCESS: ${totalCount} records!`);
            
            if (testResponse.data.value.length > 0) {
              const sample = testResponse.data.value[0];
              console.log('\\n   📄 Sample Record:');
              Object.entries(sample).slice(0, 6).forEach(([key, value]) => {
                const displayValue = typeof value === 'string' && value.length > 50 
                  ? value.substring(0, 50) + '...' 
                  : value;
                console.log(`      ${key}: ${displayValue}`);
              });
            }
          } else {
            console.log(`   📭 Empty`);
          }
          
        } catch (error) {
          const status = error.response?.status || 'ERROR';
          console.log(`   ❌ Failed: ${status}`);
        }
      }
    } else {
      console.log('❌ No policy-related levels found');
    }

  } catch (error) {
    console.error('❌ Direct lookup failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

directPoliciesLookup().catch(console.error);