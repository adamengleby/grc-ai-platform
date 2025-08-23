#!/usr/bin/env node

/**
 * Test Privacy Protection Module
 * This script tests the data masking and tokenization functionality
 */

// Import the built privacy protector
const { PrivacyProtector } = require('./dist/privacy-protector.js');

// Test data with various sensitive patterns
const testData = {
  user_profile: {
    first_name: "John",
    last_name: "Smith", 
    email: "john.smith@company.com",
    phone: "555-123-4567",
    ssn: "123-45-6789",
    credit_card: "4532-1234-5678-9012",
    salary: 75000,
    address: "123 Main Street, Anytown",
    employee_id: "EMP-789456",
    birth_date: "1985-03-15",
    password: "MySecretPassword123",
    api_key: "sk-1234567890abcdef",
    ip_address: "192.168.1.100"
  },
  records: [
    {
      name: "Alice Johnson",
      email: "alice.j@example.com", 
      account_number: "1234567890123456",
      notes: "Customer called about account access issues"
    },
    {
      name: "Bob Wilson",
      email: "bob.wilson@test.com",
      phone: "(555) 987-6543",
      comments: "Reported security incident on 2024-01-15"
    }
  ],
  system_info: {
    database_url: "postgresql://user:password@db.company.com:5432/production",
    session_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    admin_password: "SuperSecret2024!",
    encryption_key: "AES256-ABC123DEF456"
  }
};

console.log('🔒 PRIVACY PROTECTION TEST\n');
console.log('=' .repeat(50));

// Test different masking levels
const maskingLevels = ['light', 'moderate', 'strict'];

for (const level of maskingLevels) {
  console.log(`\n📊 Testing ${level.toUpperCase()} masking level:`);
  console.log('-'.repeat(30));
  
  const protector = new PrivacyProtector({
    enableMasking: true,
    maskingLevel: level,
    preserveStructure: true,
    enableTokenization: false
  });
  
  const protectedData = protector.protectData(testData, 'test_context');
  
  console.log('User Profile (protected):');
  console.log(`  Name: ${protectedData.user_profile.first_name} ${protectedData.user_profile.last_name}`);
  console.log(`  Email: ${protectedData.user_profile.email}`);
  console.log(`  Phone: ${protectedData.user_profile.phone}`);
  console.log(`  SSN: ${protectedData.user_profile.ssn}`);
  console.log(`  Credit Card: ${protectedData.user_profile.credit_card}`);
  console.log(`  Password: ${protectedData.user_profile.password}`);
  console.log(`  API Key: ${protectedData.user_profile.api_key}`);
  console.log(`  IP Address: ${protectedData.user_profile.ip_address}`);
  
  console.log('\nSystem Info (protected):');
  console.log(`  Database URL: ${protectedData.system_info.database_url}`);
  console.log(`  Session Token: ${protectedData.system_info.session_token}`);
  console.log(`  Admin Password: ${protectedData.system_info.admin_password}`);
}

// Test tokenization
console.log('\n🎫 Testing TOKENIZATION:');
console.log('-'.repeat(30));

const tokenizerProtector = new PrivacyProtector({
  enableMasking: true,
  enableTokenization: true,
  maskingLevel: 'moderate'
});

const tokenizedData = tokenizerProtector.protectData(testData.user_profile, 'tokenization_test');
console.log('Tokenized data:');
console.log(JSON.stringify(tokenizedData, null, 2));

// Test protection stats
console.log('\n📈 Protection Statistics:');
console.log('-'.repeat(30));
const stats = tokenizerProtector.getProtectionStats();
console.log(`Active tokens: ${stats.activeTokens}`);
console.log(`Masking enabled: ${stats.maskingEnabled}`);
console.log(`Masking level: ${stats.maskingLevel}`);
console.log(`Tokenization enabled: ${stats.tokenizationEnabled}`);

// Test error protection
console.log('\n⚠️  Testing ERROR PROTECTION:');
console.log('-'.repeat(30));

const errorProtector = new PrivacyProtector({
  enableMasking: true,
  maskingLevel: 'strict'
});

const mockError = {
  message: "Database connection failed for user john.doe@company.com",
  response: {
    data: {
      error: "Authentication failed for password 'MyPassword123'",
      user_details: {
        email: "admin@company.com",
        api_key: "sk-abcdef123456"
      }
    }
  },
  config: {
    headers: {
      Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
};

const protectedError = errorProtector.protectErrorData(mockError);
console.log('Protected error message:');
console.log(JSON.stringify(protectedError, null, 2));

console.log('\n✅ Privacy protection test completed!');
console.log('\nKey Features Tested:');
console.log('• Email masking');
console.log('• Phone number masking'); 
console.log('• SSN masking');
console.log('• Credit card masking');
console.log('• Password masking');
console.log('• API key masking');
console.log('• IP address masking');
console.log('• Tokenization');
console.log('• Error message protection');
console.log('• Multiple masking levels');