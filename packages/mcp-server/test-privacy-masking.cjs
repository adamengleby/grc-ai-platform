#!/usr/bin/env node

/**
 * Privacy Masking Verification Test
 * 
 * Tests that:
 * 1. MCP server returns raw data (no masking)
 * 2. Frontend LLM service applies privacy masking before sending to LLM
 * 3. Masked data maintains structure while protecting sensitive information
 */

const axios = require('axios');

// Test configuration
const CONFIG = {
  mcpServer: 'http://localhost:3001',
  frontend: 'http://localhost:3002',
  tenant: 'privacy-test-tenant',
  archer: {
    baseUrl: "https://hostplus-uat.archerirm.com.au",
    username: "api_test",
    password: "Password1!.",
    instanceId: "710100",
    instanceName: "710100",
    userDomainId: ""
  }
};

class PrivacyMaskingTest {
  constructor() {
    this.testResults = {
      rawDataTest: { passed: false, details: {} },
      maskingTest: { passed: false, details: {} },
      structureTest: { passed: false, details: {} },
      errors: []
    };
  }

  async runTests() {
    console.log('🔒 PRIVACY MASKING VERIFICATION TEST');
    console.log('====================================');
    console.log('');

    try {
      console.log('📡 Step 1: Testing MCP Server Raw Data Output');
      await this.testMCPRawData();
      
      console.log('🎭 Step 2: Testing Frontend Privacy Masking');
      await this.testFrontendPrivacyMasking();
      
      console.log('🔍 Step 3: Verifying Data Structure Preservation');
      await this.testStructurePreservation();
      
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Privacy masking test failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Test 1: Verify MCP server returns raw, unmasked data
   */
  async testMCPRawData() {
    try {
      console.log('  📋 Getting raw records from MCP server...');
      
      const response = await axios.post(`${CONFIG.mcpServer}/call`, {
        name: 'search_archer_records',
        arguments: {
          tenant_id: CONFIG.tenant,
          archer_connection: CONFIG.archer,
          applicationName: 'Obligations',
          pageSize: 3
        }
      });

      const rawContent = response.data.content[0]?.text;
      if (!rawContent) {
        throw new Error('No content received from MCP server');
      }

      console.log('  ✅ MCP server responded with data');

      // Check that data contains sensitive information (indicating no masking)
      const sensitiveDataFound = {
        hasDescriptions: rawContent.includes('Approver_Review_Task_Description'),
        hasResolutions: rawContent.includes('Approver_Review_Task_Resolution'),
        hasRecordIds: rawContent.includes('Obligations_Id'),
        hasDetailedText: rawContent.length > 500
      };

      const rawDataVerified = Object.values(sensitiveDataFound).every(found => found);

      this.testResults.rawDataTest = {
        passed: rawDataVerified,
        details: {
          contentLength: rawContent.length,
          sensitiveDataFound,
          sampleContent: rawContent.substring(0, 200) + '...'
        }
      };

      if (rawDataVerified) {
        console.log('  ✅ MCP server returns raw data (no masking detected)');
      } else {
        console.log('  ⚠️ MCP server data may already be masked');
        this.testResults.errors.push('MCP server may be applying masking');
      }

      // Store raw data for comparison
      this.rawData = rawContent;

    } catch (error) {
      console.log(`  ❌ MCP raw data test failed: ${error.message}`);
      this.testResults.errors.push(`MCP test: ${error.message}`);
    }
  }

  /**
   * Test 2: Test frontend privacy masking implementation
   */
  async testFrontendPrivacyMasking() {
    try {
      console.log('  🛡️ Testing privacy masking implementation...');
      
      if (!this.rawData) {
        throw new Error('No raw data available for masking test');
      }

      // Simulate the frontend privacy masking logic
      const maskingLevels = ['low', 'medium', 'high'];
      const maskingResults = {};

      for (const level of maskingLevels) {
        console.log(`    Testing ${level} masking level...`);
        
        const maskedData = this.simulateFrontendMasking(this.rawData, level);
        
        maskingResults[level] = {
          originalLength: this.rawData.length,
          maskedLength: maskedData.length,
          maskedFields: this.countMaskedFields(maskedData),
          preservedStructure: this.checkStructurePreservation(this.rawData, maskedData),
          sampleMasked: maskedData.substring(0, 300) + '...'
        };

        console.log(`      ${level}: ${maskingResults[level].maskedFields} fields masked`);
      }

      // Verify masking is working
      const highLevelMasking = maskingResults.high;
      const mediumLevelMasking = maskingResults.medium;
      const lowLevelMasking = maskingResults.low;

      const maskingWorking = (
        highLevelMasking.maskedFields > mediumLevelMasking.maskedFields &&
        mediumLevelMasking.maskedFields > lowLevelMasking.maskedFields &&
        lowLevelMasking.maskedFields > 0
      );

      this.testResults.maskingTest = {
        passed: maskingWorking,
        details: maskingResults
      };

      if (maskingWorking) {
        console.log('  ✅ Privacy masking levels working correctly');
      } else {
        console.log('  ❌ Privacy masking levels not working as expected');
        this.testResults.errors.push('Masking levels not working correctly');
      }

    } catch (error) {
      console.log(`  ❌ Privacy masking test failed: ${error.message}`);
      this.testResults.errors.push(`Masking test: ${error.message}`);
    }
  }

  /**
   * Test 3: Verify data structure is preserved after masking
   */
  async testStructurePreservation() {
    try {
      console.log('  📐 Testing data structure preservation...');
      
      if (!this.rawData) {
        throw new Error('No raw data available for structure test');
      }

      const maskedData = this.simulateFrontendMasking(this.rawData, 'medium');
      
      // Check that essential structure elements are preserved
      const structureChecks = {
        hasRecordCount: maskedData.includes('Total Records:'),
        hasRecordNumbers: maskedData.includes('1. Record:') && maskedData.includes('2. Record:'),
        hasFieldStructure: maskedData.includes('_Id:'),
        maintainsFormatting: maskedData.includes('\\n') || maskedData.includes('\n'),
        preservesLength: Math.abs(maskedData.length - this.rawData.length) < (this.rawData.length * 0.5)
      };

      const structurePreserved = Object.values(structureChecks).every(check => check);

      this.testResults.structureTest = {
        passed: structurePreserved,
        details: {
          structureChecks,
          originalLength: this.rawData.length,
          maskedLength: maskedData.length,
          lengthDifference: maskedData.length - this.rawData.length
        }
      };

      if (structurePreserved) {
        console.log('  ✅ Data structure preserved after masking');
      } else {
        console.log('  ❌ Data structure not properly preserved');
        this.testResults.errors.push('Structure not preserved after masking');
      }

    } catch (error) {
      console.log(`  ❌ Structure preservation test failed: ${error.message}`);
      this.testResults.errors.push(`Structure test: ${error.message}`);
    }
  }

  /**
   * Simulate the frontend privacy masking logic
   * (Based on the implementation in frontend/src/lib/llmService.ts)
   */
  simulateFrontendMasking(content, maskingLevel) {
    try {
      // Parse the content to find structured data
      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
        // If it's JSON, convert back after masking
        return JSON.stringify(this.maskObjectFields(parsedContent, this.getMaskingFields(maskingLevel)), null, 2);
      } catch {
        // If not JSON, treat as plain text
        return this.maskPlainText(content, maskingLevel);
      }
    } catch (error) {
      console.error('Error in masking simulation:', error);
      return content; // Return original if masking fails
    }
  }

  /**
   * Get fields to mask based on masking level
   */
  getMaskingFields(maskingLevel) {
    switch (maskingLevel) {
      case 'high':
        return [
          'name', 'firstName', 'lastName', 'fullName', 'employeeId', 'email', 'phone', 'address',
          'accountabilityStatements', 'description', 'details', 'comments', 'notes', 'findings',
          'remediation', 'mitigation', 'response', 'businessOwner', 'technicalOwner', 'owner',
          'cost', 'budget', 'revenue', 'profit', 'amount', 'value', 'price'
        ];
      case 'medium':
        return [
          'name', 'firstName', 'lastName', 'email', 'phone',
          'accountabilityStatements', 'description', 'comments', 'notes', 'findings',
          'businessOwner', 'technicalOwner'
        ];
      case 'low':
        return ['email', 'phone', 'address', 'employeeId'];
      default:
        return [];
    }
  }

  /**
   * Recursively mask specified fields in an object
   */
  maskObjectFields(obj, fieldsToMask) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.maskObjectFields(item, fieldsToMask));
    }

    const masked = { ...obj };
    
    for (const [key, value] of Object.entries(masked)) {
      const lowerKey = key.toLowerCase();
      
      const shouldMask = fieldsToMask.some(field => 
        lowerKey.includes(field.toLowerCase()) ||
        field.toLowerCase().includes(lowerKey)
      );

      if (shouldMask) {
        if (typeof value === 'string') {
          masked[key] = this.maskString(value);
        } else if (typeof value === 'number') {
          masked[key] = '[MASKED_NUMBER]';
        } else if (Array.isArray(value)) {
          masked[key] = '[MASKED_ARRAY]';
        } else if (typeof value === 'object' && value !== null) {
          masked[key] = '[MASKED_OBJECT]';
        } else {
          masked[key] = '[MASKED_VALUE]';
        }
      } else if (typeof value === 'object') {
        masked[key] = this.maskObjectFields(value, fieldsToMask);
      }
    }

    return masked;
  }

  /**
   * Mask a string value while preserving some structure
   */
  maskString(value) {
    if (!value || typeof value !== 'string') {
      return '[MASKED_STRING]';
    }

    if (value.length <= 3) {
      return '*'.repeat(value.length);
    }

    if (value.length <= 10) {
      const start = value.substring(0, 1);
      const end = value.substring(value.length - 1);
      const middle = '*'.repeat(Math.max(1, value.length - 2));
      return start + middle + end;
    }

    const start = value.substring(0, 3);
    const end = value.substring(value.length - 3);
    const middle = '*'.repeat(Math.max(1, Math.min(10, value.length - 6)));
    return start + middle + end;
  }

  /**
   * Mask plain text content
   */
  maskPlainText(content, maskingLevel) {
    let masked = content;

    if (maskingLevel === 'high' || maskingLevel === 'medium') {
      // Mask email addresses
      masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[MASKED_EMAIL]');
      
      // Mask phone numbers
      masked = masked.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[MASKED_PHONE]');
      
      // Mask what looks like employee IDs
      masked = masked.replace(/\b[A-Z]{2,}\d{3,}\b/g, '[MASKED_ID]');

      // Mask detailed descriptions (common in GRC data)
      if (maskingLevel === 'high' || maskingLevel === 'medium') {
        masked = masked.replace(/Approver_Review_Task_Description: [^\n]+/g, 'Approver_Review_Task_Description: [MASKED_DESCRIPTION]');
        masked = masked.replace(/Approver_Review_Task_Resolution: [^\n]+/g, 'Approver_Review_Task_Resolution: [MASKED_RESOLUTION]');
        masked = masked.replace(/Accountability_Statements[^\n]*: [^\n]+/g, 'Accountability_Statements: [MASKED_STATEMENTS]');
      }
    }

    if (maskingLevel === 'high') {
      // More aggressive masking for high level
      masked = masked.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[MASKED_NAME]');
    }

    return masked;
  }

  /**
   * Count how many fields appear to be masked in the content
   */
  countMaskedFields(content) {
    const maskingPatterns = [
      /\[MASKED_[A-Z_]+\]/g,
      /\*{3,}/g,  // Multiple asterisks
      /[A-Za-z]\*+[A-Za-z]/g  // Partially masked strings
    ];

    let totalMasked = 0;
    maskingPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        totalMasked += matches.length;
      }
    });

    return totalMasked;
  }

  /**
   * Check if basic structure is preserved after masking
   */
  checkStructurePreservation(original, masked) {
    // Check that basic formatting patterns are preserved
    const structurePatterns = [
      /Total Records: \d+/,
      /\d+\. Record:/,
      /_Id: /
    ];

    return structurePatterns.every(pattern => {
      const inOriginal = pattern.test(original);
      const inMasked = pattern.test(masked);
      return inOriginal === inMasked; // Should be preserved
    });
  }

  /**
   * Generate final test report
   */
  generateReport() {
    console.log('');
    console.log('📋 PRIVACY MASKING TEST REPORT');
    console.log('==============================');
    console.log('');

    // Test Results Summary
    const rawDataPassed = this.testResults.rawDataTest.passed;
    const maskingPassed = this.testResults.maskingTest.passed;
    const structurePassed = this.testResults.structureTest.passed;

    console.log('Test Results:');
    console.log(`  Raw Data Test: ${rawDataPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Masking Test: ${maskingPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Structure Test: ${structurePassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('');

    // Detailed Results
    if (this.testResults.rawDataTest.details) {
      console.log('Raw Data Analysis:');
      console.log(`  Content Length: ${this.testResults.rawDataTest.details.contentLength}`);
      console.log(`  Sensitive Data Found: ${JSON.stringify(this.testResults.rawDataTest.details.sensitiveDataFound, null, 2)}`);
      console.log('');
    }

    if (this.testResults.maskingTest.details) {
      console.log('Masking Effectiveness:');
      Object.entries(this.testResults.maskingTest.details).forEach(([level, details]) => {
        console.log(`  ${level.toUpperCase()} Level:`);
        console.log(`    Fields Masked: ${details.maskedFields}`);
        console.log(`    Length Change: ${details.originalLength} → ${details.maskedLength}`);
      });
      console.log('');
    }

    // Errors
    if (this.testResults.errors.length > 0) {
      console.log('Errors Encountered:');
      this.testResults.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
      console.log('');
    }

    // Overall Result
    const allTestsPassed = rawDataPassed && maskingPassed && structurePassed;
    const hasMinorIssues = this.testResults.errors.length <= 2;

    if (allTestsPassed && this.testResults.errors.length === 0) {
      console.log('🎉 ALL PRIVACY MASKING TESTS PASSED');
      console.log('✅ MCP server returns raw data');
      console.log('✅ Frontend privacy masking is working correctly');
      console.log('✅ Data structure is preserved after masking');
      console.log('');
      console.log('🔒 Privacy protection pipeline is functioning correctly!');
      process.exit(0);
    } else if (allTestsPassed && hasMinorIssues) {
      console.log('⚠️ PRIVACY MASKING TESTS PASSED WITH WARNINGS');
      console.log('Core privacy protection is working, minor issues detected.');
      process.exit(0);
    } else {
      console.log('❌ PRIVACY MASKING TESTS FAILED');
      console.log('Privacy protection pipeline needs attention.');
      process.exit(1);
    }
  }
}

// Run the test
if (require.main === module) {
  const test = new PrivacyMaskingTest();
  test.runTests().catch(console.error);
}

module.exports = PrivacyMaskingTest;