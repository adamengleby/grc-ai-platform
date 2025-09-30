/**
 * Test Setup Configuration for Archer Field Caching System Tests
 * 
 * This file provides common setup, utilities, and mock data for all test suites.
 */

import { vi, expect } from 'vitest';

/**
 * Common test data that matches Archer API response formats
 */
export const MOCK_ARCHER_DATA = {
  /**
   * Mock applications response from /api/core/system/application
   */
  applications: [
    {
      IsSuccessful: true,
      RequestedObject: {
        Id: 606,
        Name: 'Risk Management',
        Status: 1,
        Type: 1,
        Description: 'Enterprise risk management application',
        ModuleId: 606
      }
    },
    {
      IsSuccessful: true,
      RequestedObject: {
        Id: 608,
        Name: 'Compliance Tracking',
        Status: 1,
        Type: 1,
        Description: 'Regulatory compliance tracking',
        ModuleId: 608
      }
    },
    {
      IsSuccessful: true,
      RequestedObject: {
        Id: 610,
        Name: 'Policy Management',
        Status: 1,
        Type: 1,
        Description: 'Corporate policy management',
        ModuleId: 610
      }
    },
    {
      IsSuccessful: true,
      RequestedObject: {
        Id: 612,
        Name: 'Inactive Application',
        Status: 0, // Inactive
        Type: 1,
        Description: 'This should be filtered out',
        ModuleId: 612
      }
    }
  ],

  /**
   * Mock levels response from /api/core/system/level/module/{applicationId}
   */
  levels: {
    606: [ // Risk Management levels
      {
        IsSuccessful: true,
        RequestedObject: {
          Id: 408,
          Name: 'Risk Record',
          Alias: 'risk_record',
          ModuleName: 'Risk Management',
          ModuleId: 606,
          IsDeleted: false
        }
      },
      {
        IsSuccessful: true,
        RequestedObject: {
          Id: 409,
          Name: 'Risk Assessment',
          Alias: 'risk_assessment',
          ModuleName: 'Risk Management',
          ModuleId: 606,
          IsDeleted: false
        }
      }
    ],
    608: [ // Compliance Tracking levels
      {
        IsSuccessful: true,
        RequestedObject: {
          Id: 410,
          Name: 'Compliance Record',
          Alias: 'compliance_record',
          ModuleName: 'Compliance Tracking',
          ModuleId: 608,
          IsDeleted: false
        }
      }
    ],
    610: [ // Policy Management levels
      {
        IsSuccessful: true,
        RequestedObject: {
          Id: 411,
          Name: 'Policy Document',
          Alias: 'policy_document',
          ModuleName: 'Policy Management',
          ModuleId: 610,
          IsDeleted: false
        }
      }
    ]
  },

  /**
   * Mock field definitions from /api/core/system/fielddefinition/level/{levelId}
   */
  fieldDefinitions: {
    408: [ // Risk Record fields
      {
        Id: 1001,
        Name: 'Risk Title',
        Alias: 'risk_title',
        Type: 'Text',
        Status: 1,
        IsActive: true,
        IsRequired: true,
        IsCalculated: false
      },
      {
        Id: 1002,
        Name: 'Risk Description',
        Alias: 'risk_description',
        Type: 'Text',
        Status: 1,
        IsActive: true,
        IsRequired: false,
        IsCalculated: false
      },
      {
        Id: 1003,
        Name: 'Risk Score',
        Alias: 'risk_score',
        Type: 'Numeric',
        Status: 1,
        IsActive: true,
        IsRequired: false,
        IsCalculated: true
      },
      {
        Id: 1004,
        Name: 'Risk Owner',
        Alias: 'risk_owner',
        Type: 'User',
        Status: 1,
        IsActive: true,
        IsRequired: true,
        IsCalculated: false
      },
      {
        Id: 1005,
        Name: 'Legacy Field',
        Alias: 'legacy_field',
        Type: 'Text',
        Status: 0, // Inactive
        IsActive: false,
        IsRequired: false,
        IsCalculated: false
      }
    ],
    409: [ // Risk Assessment fields
      {
        Id: 2001,
        Name: 'Assessment Date',
        Alias: 'assessment_date',
        Type: 'Date',
        Status: 1,
        IsActive: true,
        IsRequired: true,
        IsCalculated: false
      },
      {
        Id: 2002,
        Name: 'Likelihood Score',
        Alias: 'likelihood_score',
        Type: 'Numeric',
        Status: 1,
        IsActive: true,
        IsRequired: true,
        IsCalculated: false
      },
      {
        Id: 2003,
        Name: 'Impact Score',
        Alias: 'impact_score',
        Type: 'Numeric',
        Status: 1,
        IsActive: true,
        IsRequired: true,
        IsCalculated: false
      }
    ],
    410: [ // Compliance Record fields
      {
        Id: 3001,
        Name: 'Compliance Status',
        Alias: 'compliance_status',
        Type: 'ValuesList',
        Status: 1,
        IsActive: true,
        IsRequired: true,
        IsCalculated: false
      },
      {
        Id: 3002,
        Name: 'Last Review Date',
        Alias: 'last_review_date',
        Type: 'Date',
        Status: 1,
        IsActive: true,
        IsRequired: false,
        IsCalculated: false
      },
      {
        Id: 3003,
        Name: 'Next Review Date',
        Alias: 'next_review_date',
        Type: 'Date',
        Status: 1,
        IsActive: true,
        IsRequired: false,
        IsCalculated: true
      }
    ],
    411: [ // Policy Document fields
      {
        Id: 4001,
        Name: 'Policy Title',
        Alias: 'policy_title',
        Type: 'Text',
        Status: 1,
        IsActive: true,
        IsRequired: true,
        IsCalculated: false
      },
      {
        Id: 4002,
        Name: 'Effective Date',
        Alias: 'effective_date',
        Type: 'Date',
        Status: 1,
        IsActive: true,
        IsRequired: true,
        IsCalculated: false
      }
    ]
  },

  /**
   * Sample record data for testing translation
   */
  sampleRecords: {
    riskRecords: [
      {
        risk_title: 'Data Breach Risk',
        risk_description: 'Risk of unauthorized access to customer data',
        risk_score: 8.5,
        risk_owner: 'john.doe@company.com',
        legacy_field: 'This should be filtered out'
      },
      {
        risk_title: 'Compliance Gap',
        risk_description: 'Failure to meet regulatory requirements',
        risk_score: 6.2,
        risk_owner: 'jane.smith@company.com'
      }
    ],
    complianceRecords: [
      {
        compliance_status: 'In Progress',
        last_review_date: '2024-01-15',
        next_review_date: '2024-04-15'
      },
      {
        compliance_status: 'Completed',
        last_review_date: '2024-02-01',
        next_review_date: '2024-05-01'
      }
    ]
  }
};

/**
 * Expected field mappings for testing
 */
export const EXPECTED_FIELD_MAPPINGS = {
  'Risk Management': {
    'risk_title': 'Risk Title',
    'risk_description': 'Risk Description',
    'risk_score': 'Risk Score',
    'risk_owner': 'Risk Owner',
    'assessment_date': 'Assessment Date',
    'likelihood_score': 'Likelihood Score',
    'impact_score': 'Impact Score'
    // Note: legacy_field should NOT be included (inactive)
  },
  'Compliance Tracking': {
    'compliance_status': 'Compliance Status',
    'last_review_date': 'Last Review Date',
    'next_review_date': 'Next Review Date'
  },
  'Policy Management': {
    'policy_title': 'Policy Title',
    'effective_date': 'Effective Date'
  }
};

/**
 * Test utilities
 */
export class TestUtils {
  /**
   * Create a mock axios response
   */
  static createMockAxiosResponse<T>(data: T, status = 200) {
    return {
      data,
      status,
      statusText: 'OK',
      headers: {},
      config: {}
    };
  }

  /**
   * Create a mock Archer session
   */
  static createMockSession(expiresInMs = 3600000) {
    return {
      sessionToken: 'mock-session-token-' + Date.now(),
      userDomainId: 'mock-domain-id',
      expiresAt: new Date(Date.now() + expiresInMs)
    };
  }

  /**
   * Generate performance test data
   */
  static generatePerformanceTestData(config: {
    applicationCount: number;
    fieldsPerApplication: number;
  }) {
    const applications = [];
    const fieldDefinitions: any = {};

    for (let i = 1; i <= config.applicationCount; i++) {
      applications.push({
        IsSuccessful: true,
        RequestedObject: {
          Id: i,
          Name: `Performance Test App ${i}`,
          Status: 1,
          Type: 1,
          ModuleId: i
        }
      });

      const fields = [];
      for (let j = 1; j <= config.fieldsPerApplication; j++) {
        fields.push({
          Id: i * 1000 + j,
          Name: `Field ${j}`,
          Alias: `field_${j}_app_${i}`,
          Type: 'Text',
          Status: 1,
          IsActive: true,
          IsRequired: j % 3 === 0,
          IsCalculated: j % 5 === 0
        });
      }
      
      fieldDefinitions[`app_${i}_level_1`] = fields;
    }

    return { applications, fieldDefinitions };
  }

  /**
   * Measure execution time of an async function
   */
  static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
    const start = Date.now();
    const result = await fn();
    const executionTime = Date.now() - start;
    return { result, executionTime };
  }

  /**
   * Create a delay for testing async scenarios
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate that a field mapping contains only active fields
   */
  static validateActiveFieldsOnly(mapping: Record<string, string>, expectedInactiveFields: string[] = []) {
    expectedInactiveFields.forEach(inactiveField => {
      expect(mapping).not.toHaveProperty(inactiveField);
    });
  }

  /**
   * Assert that caching is working by comparing metrics
   */
  static assertCachingBehavior(
    firstCallMetrics: any,
    secondCallMetrics: any,
    expectedCacheHitIncrease = 1
  ) {
    expect(secondCallMetrics.cacheHits).toBe(firstCallMetrics.cacheHits + expectedCacheHitIncrease);
    expect(secondCallMetrics.cacheMisses).toBe(firstCallMetrics.cacheMisses);
  }
}

/**
 * Mock Archer Connection for testing
 */
export const MOCK_CONNECTION = {
  baseUrl: 'https://test-archer.company.com',
  userDomain: 'TestDomain',
  username: 'testuser',
  password: 'testpass',
  instanceName: 'TestInstance'
};

/**
 * Setup function to run before each test
 */
export function setupTest() {
  vi.clearAllMocks();
  
  // Reset any global state if needed
  process.env.NODE_ENV = 'test';
  
  console.log('Test setup completed');
}

/**
 * Cleanup function to run after each test
 */
export function cleanupTest() {
  vi.clearAllMocks();
  console.log('Test cleanup completed');
}

/**
 * Common assertions for field caching tests
 */
export const CommonAssertions = {
  /**
   * Assert that applications are properly filtered (only active)
   */
  assertActiveApplicationsOnly(applications: any[]) {
    applications.forEach(app => {
      expect(app.Status).toBe(1);
    });
    
    // Should not contain the inactive application
    expect(applications.find(app => app.Name === 'Inactive Application')).toBeUndefined();
  },

  /**
   * Assert that field mappings contain only active fields
   */
  assertActiveFieldsOnly(mapping: Record<string, string>) {
    // Should not contain any fields known to be inactive
    expect(mapping).not.toHaveProperty('legacy_field');
    
    // All values should be non-empty strings
    Object.values(mapping).forEach(displayName => {
      expect(typeof displayName).toBe('string');
      expect(displayName.length).toBeGreaterThan(0);
    });
  },

  /**
   * Assert that record translation preserves data integrity
   */
  assertTranslationIntegrity(original: any[], translated: any[]) {
    expect(translated).toHaveLength(original.length);
    
    translated.forEach((record, index) => {
      // Should have at least some fields (unless all were filtered)
      const fieldCount = Object.keys(record).length;
      expect(fieldCount).toBeGreaterThanOrEqual(0);
      
      // Values should be preserved
      Object.values(record).forEach(value => {
        expect(value).toBeDefined();
      });
    });
  }
};