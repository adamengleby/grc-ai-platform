#!/usr/bin/env node

/**
 * Data Masking Verification Tool
 * Tests privacy protection with sample data patterns
 */

const { PrivacyProtector } = require('./dist/privacy-protector.js');

console.log('🔍 DATA MASKING VERIFICATION TOOL');
console.log('=' .repeat(50));

// Create protector with current environment settings
const protector = new PrivacyProtector({
  enableMasking: process.env.ENABLE_PRIVACY_MASKING !== 'false',
  maskingLevel: process.env.MASKING_LEVEL || 'moderate',
  enableTokenization: process.env.ENABLE_TOKENIZATION === 'true',
  customSensitiveFields: process.env.CUSTOM_SENSITIVE_FIELDS?.split(',') || []
});

console.log('\n📊 Current Configuration:');
console.log('-'.repeat(30));
const stats = protector.getProtectionStats();
console.log(`Masking Enabled: ${stats.maskingEnabled}`);
console.log(`Masking Level: ${stats.maskingLevel}`);
console.log(`Tokenization Enabled: ${stats.tokenizationEnabled}`);

if (!stats.maskingEnabled) {
  console.log('\n⚠️  WARNING: Privacy masking is DISABLED!');
  console.log('Set ENABLE_PRIVACY_MASKING=true to enable protection');
  process.exit(1);
}

console.log('\n✅ Privacy protection is ACTIVE');

// Test sample data that might appear in Archer records
const sampleArcherData = {
  "Employee Name": "John Smith",
  "Email Address": "john.smith@company.com", 
  "Phone": "555-123-4567",
  "SSN": "123-45-6789",
  "Manager Email": "manager@company.com",
  "Incident Description": "User reported phishing email from suspicious@malware.com",
  "Account ID": "ACC-789456123",
  "API Key": "sk-1234567890abcdef",
  "Server IP": "192.168.1.100",
  "Database Connection": "postgresql://user:password@db.company.com/hr",
  "Comments": "Contact alice.johnson@external.com for follow-up"
};

console.log('\n🧪 MASKING TEST - Sample Archer Record:');
console.log('-'.repeat(50));
console.log('ORIGINAL DATA:');
Object.entries(sampleArcherData).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('\nPROTECTED DATA (what gets sent to LLM):');
const protectedData = protector.protectData(sampleArcherData, 'archer_record_test');
Object.entries(protectedData).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

// Show specific pattern detection
console.log('\n🎯 PATTERN DETECTION TEST:');
console.log('-'.repeat(30));

const testPatterns = {
  "Email": "test@example.com",
  "Phone": "(555) 123-4567", 
  "SSN": "123-45-6789",
  "Credit Card": "4532-1234-5678-9012",
  "IP Address": "10.0.0.1",
  "GUID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
};

testPatterns.forEach = Object.entries(testPatterns).forEach;
Object.entries(testPatterns).forEach(([type, value]) => {
  const protected = protector.protectData({ testField: value }, 'pattern_test');
  const isChanged = protected.testField !== value;
  console.log(`  ${type}: ${value} -> ${protected.testField} ${isChanged ? '✅ MASKED' : '❌ NOT MASKED'}`);
});

console.log('\n📋 Field Name Detection Test:');
console.log('-'.repeat(30));

const sensitiveFields = {
  "password": "MySecret123",
  "api_key": "sk-abcdef123456", 
  "ssn": "123-45-6789",
  "email": "user@company.com",
  "credit_card": "4532123456789012",
  "phone_number": "555-123-4567",
  "birth_date": "1990-01-01",
  "salary": "75000",
  "account_number": "1234567890"
};

Object.entries(sensitiveFields).forEach(([fieldName, value]) => {
  const testObj = {};
  testObj[fieldName] = value;
  const protected = protector.protectData(testObj, 'field_name_test');
  const isChanged = protected[fieldName] !== value;
  console.log(`  ${fieldName}: ${value} -> ${protected[fieldName]} ${isChanged ? '✅ MASKED' : '❌ NOT MASKED'}`);
});

console.log('\n🔄 Integration Test (Simulated MCP Response):');
console.log('-'.repeat(50));

const mockMcpResponse = {
  applicationName: "Employee Records",
  totalRecords: 1500,
  records: [
    {
      "Employee_ID": "EMP-12345", 
      "Full_Name": "Sarah Johnson",
      "Email_Address": "sarah.johnson@company.com",
      "Phone_Number": "555-987-6543",
      "Department": "IT Security",
      "Salary": "$85,000",
      "Manager_Email": "manager@company.com",
      "Emergency_Contact": "Contact: spouse@email.com, Phone: 555-111-2222"
    }
  ],
  transformationSummary: "Data includes 150 employees with email addresses, phone numbers, and salary information."
};

const protectedResponse = protector.protectData(mockMcpResponse, 'mcp_response_simulation');

console.log('Simulated MCP Server Response (Protected):');
console.log(JSON.stringify(protectedResponse, null, 2));

console.log('\n✅ VERIFICATION COMPLETE');
console.log('\nHow to verify in Claude Desktop:');
console.log('1. Look for "🔒 PRIVACY PROTECTION" messages in responses');
console.log('2. Check that sensitive data appears masked (e.g., emails show as jo***@co***)'); 
console.log('3. Verify that field values are protected but structure is preserved');
console.log('4. Test with your actual Archer applications to see real masking');

console.log(`\n📖 Current masking level: ${stats.maskingLevel}`);
console.log('   • light: Shows more characters (good for debugging)');
console.log('   • moderate: Balanced protection (recommended)'); 
console.log('   • strict: Maximum security with type hints');