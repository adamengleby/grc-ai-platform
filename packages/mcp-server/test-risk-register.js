#!/usr/bin/env node

const axios = require('axios');

// Test script to debug Risk Register field retrieval
async function testRiskRegisterAPIs() {
    console.log('=== Risk Register API Testing ===\n');
    
    // NOTE: These are the exact API calls that should be made
    // Based on the logs, we know:
    // - Risk Register Application ID: 152
    // - Risk Register Level ID: 98
    // - Level Alias: Risk_Register
    
    const baseUrl = 'https://hostplus-dev.archerirm.com.au';
    const sessionToken = 'NEED_VALID_SESSION_TOKEN'; // This would need to be fresh
    
    console.log('Expected API Call Sequence:');
    console.log('1. GET /api/core/system/application');
    console.log('   → Should find Risk Register with ID: 152');
    console.log('');
    console.log('2. GET /api/core/system/level/module/152');  
    console.log('   → Should find Level 98 for Risk Register');
    console.log('');
    console.log('3. GET /api/core/system/fielddefinition/level/98');
    console.log('   → Should return field definitions (currently returns 0)');
    console.log('');
    
    // Alternative field definition endpoints to test:
    console.log('Alternative endpoints to test:');
    console.log('- GET /api/core/system/fielddefinition/application/152');
    console.log('- GET /platformapi/core/system/fielddefinition/level/98');
    console.log('- GET /platformapi/core/system/fielddefinition/application/152');
    console.log('');
    
    console.log('Expected Response Structure:');
    console.log('Fields should have structure like:');
    console.log(`{
  "RequestedObject": [
    {
      "Id": 1234,
      "Name": "Risk Title", 
      "Alias": "risk_title",
      "Type": 1,
      "IsActive": true,
      "IsCalculated": false,
      "IsRequired": true
    }
  ]
}`);
    
    console.log('\nTo debug this issue, we need to:');
    console.log('1. Check if Level 98 actually has field definitions');  
    console.log('2. Verify the correct API endpoint for field definitions');
    console.log('3. Check if there are permission issues accessing fields');
    console.log('4. Test alternative field definition endpoints');
    
    // If we had a valid session token, we could test:
    if (sessionToken !== 'NEED_VALID_SESSION_TOKEN') {
        try {
            const headers = {
                'Authorization': `Archer session-id=${sessionToken}`,
                'Content-Type': 'application/json'
            };
            
            console.log('\nTesting actual API calls...');
            
            // Test field definition endpoint
            const fieldsUrl = `${baseUrl}/api/core/system/fielddefinition/level/98`;
            console.log(`\nTesting: ${fieldsUrl}`);
            
            const response = await axios.get(fieldsUrl, { headers });
            console.log('Response:', response.status);
            console.log('Data:', JSON.stringify(response.data, null, 2));
            
        } catch (error) {
            console.error('API Error:', error.response?.status, error.response?.data);
        }
    }
}

testRiskRegisterAPIs();