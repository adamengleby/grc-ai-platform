#!/usr/bin/env node

/**
 * Test Enhanced Name Masking
 */

const { PrivacyProtector } = require('./dist/privacy-protector.js');

console.log('👤 ENHANCED NAME MASKING TEST');
console.log('=' .repeat(50));

// Test different masking levels for names
const maskingLevels = ['light', 'moderate', 'strict'];

// Test data with various name formats from your Archer data
const testNames = {
  // Direct name fields (should be caught by field name detection)
  "Control_Owner": "Wood, Helen",
  "Risk_Manager": "Unsal, Aysel", 
  "Inherited_Division_Lead": "Mecchi, Umberto",
  "Contact_Person": "Roberts, Anthony",
  
  // Names in arrays (like your data)
  "Control_Owner_Array": ["Wood, Helen"],
  "Risk_Managers": ["Unsal, Aysel", "Singh, Archana"],
  
  // Different name formats
  "Manager": "John Smith",
  "Lead": "Smith, John",
  "Coordinator": "John M. Smith", 
  "Representative": "J. Smith",
  "Employee": "Mary-Jane O'Connor",
  
  // Should NOT be masked (not names)
  "Application": "Controls",
  "Status": "Active", 
  "Department": "Risk Management",
  "System": "Archer",
  "ID": "CT-755",
  "URL": "https://example.com",
  "Email": "user@company.com" // Should be masked as email, not name
};

for (const level of maskingLevels) {
  console.log(`\n📊 Testing ${level.toUpperCase()} name masking:`);
  console.log('-'.repeat(40));
  
  const protector = new PrivacyProtector({
    enableMasking: true,
    maskingLevel: level,
    preserveStructure: true,
    enableTokenization: false
  });
  
  const protectedData = protector.protectData(testNames, 'name_test');
  
  Object.entries(protectedData).forEach(([field, value]) => {
    const original = testNames[field];
    const isArray = Array.isArray(value);
    const changed = JSON.stringify(original) !== JSON.stringify(value);
    const status = changed ? '✅ MASKED' : '➖ unchanged';
    
    if (isArray) {
      console.log(`  ${field}: [${original.join(', ')}] -> [${value.join(', ')}] ${status}`);
    } else {
      console.log(`  ${field}: "${original}" -> "${value}" ${status}`);
    }
  });
}

// Test the specific names from your Archer data
console.log('\n🎯 Testing Names from Your Archer Data:');
console.log('-'.repeat(40));

const archerNames = [
  "Wood, Helen",
  "Unsal, Aysel", 
  "Mecchi, Umberto",
  "Roberts, Anthony",
  "Singh, Archana",
  "Mutter, Matt",
  "Lioubachevskii, Ian",
  "Walton, James",
  "Dutton, Jo",
  "Hill, Sean",
  "Black, Nicholas",
  "Lord, Alexander",
  "Muir, Jason"
];

const moderateProtector = new PrivacyProtector({
  maskingLevel: 'moderate'
});

archerNames.forEach(name => {
  const testData = { name_field: name };
  const protected = moderateProtector.protectData(testData, 'archer_names');
  const masked = protected.name_field !== name;
  console.log(`  "${name}" -> "${protected.name_field}" ${masked ? '✅ MASKED' : '❌ NOT MASKED'}`);
});

console.log('\n🧪 Pattern Detection Test:');
console.log('-'.repeat(30));

const patterns = [
  "Smith, John",      // Last, First
  "John Smith",       // First Last  
  "John M. Smith",    // First Middle Last
  "Mary-Jane Wilson", // Hyphenated first name
  "O'Connor, Sean",   // Apostrophe in name
  "Controls",         // Should NOT be masked
  "Active",           // Should NOT be masked
  "user@test.com",    // Should be masked as email
  "123-45-6789",      // Should be masked as SSN
  "Risk Management"   // Should NOT be masked
];

patterns.forEach(pattern => {
  const result = moderateProtector.protectData({ test: pattern }, 'pattern_test');
  const changed = result.test !== pattern;
  console.log(`  "${pattern}" -> "${result.test}" ${changed ? '✅ DETECTED' : '➖ ignored'}`);
});

console.log('\n✅ Enhanced name masking test completed!');
console.log('\nThis should now mask the names in your Archer Controls application.');
console.log('Names like "Wood, Helen" and "Mecchi, Umberto" will be protected.');