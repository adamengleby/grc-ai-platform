import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

// Mock data structures that match the actual Archer API responses
const MOCK_API_RESPONSES = {
  applications: [
    {
      IsSuccessful: true,
      RequestedObject: {
        Id: 606,
        Name: 'Risk Management',
        Status: 1,
        Type: 1,
        Description: 'Risk management application',
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
        Description: 'Compliance tracking application',
        ModuleId: 608
      }
    }
  ],
  levels: [
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
        Name: 'Compliance Record',
        Alias: 'compliance_record',
        ModuleName: 'Compliance Tracking',
        ModuleId: 608,
        IsDeleted: false
      }
    }
  ],
  fieldDefinitions: {
    level408: [
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
        Name: 'Risk Score',
        Alias: 'risk_score',
        Type: 'Numeric',
        Status: 1,
        IsActive: true,
        IsRequired: false,
        IsCalculated: true
      },
      {
        Id: 1003,
        Name: 'Risk Owner',
        Alias: 'risk_owner',
        Type: 'User',
        Status: 1,
        IsActive: true,
        IsRequired: true,
        IsCalculated: false
      },
      {
        Id: 1004,
        Name: 'Deprecated Field',
        Alias: 'deprecated_field',
        Type: 'Text',
        Status: 0, // Inactive
        IsActive: false,
        IsRequired: false,
        IsCalculated: false
      }
    ],
    level409: [
      {
        Id: 2001,
        Name: 'Compliance Status',
        Alias: 'compliance_status',
        Type: 'ValuesList',
        Status: 1,
        IsActive: true,
        IsRequired: true,
        IsCalculated: false
      },
      {
        Id: 2002,
        Name: 'Last Review Date',
        Alias: 'last_review_date',
        Type: 'Date',
        Status: 1,
        IsActive: true,
        IsRequired: false,
        IsCalculated: false
      }
    ]
  },
  records: {
    risk: [
      {
        risk_title: 'Data Breach Risk',
        risk_score: 8.5,
        risk_owner: 'john.doe@company.com',
        deprecated_field: 'should be filtered'
      },
      {
        risk_title: 'Compliance Gap Risk',
        risk_score: 6.2,
        risk_owner: 'jane.smith@company.com'
      }
    ],
    compliance: [
      {
        compliance_status: 'In Progress',
        last_review_date: '2024-01-15'
      }
    ]
  }
};

/**
 * Enhanced mock client that simulates the complete workflow:
 * Applications → Levels → Field Definitions → Translation mappings
 */
class MockArcherWorkflowClient {
  private applicationCache: any[] = [];
  private levelMappingCache: any[] = [];
  private fieldMappingCache = new Map<string, Record<string, string>>();
  private fieldDefinitionsCache = new Map<number, any[]>();

  constructor(private mockApiResponses = MOCK_API_RESPONSES) {}

  /**
   * Step 1: Get applications from /api/core/system/application
   */
  async getApplications(): Promise<any[]> {
    if (this.applicationCache.length > 0) {
      console.log(`Using cached applications (${this.applicationCache.length} entries)`);
      return this.applicationCache;
    }

    // Simulate API call
    const response = this.mockApiResponses.applications;
    
    // Process response like the real implementation
    const applications = response
      .filter(item => item.IsSuccessful && item.RequestedObject)
      .map(item => item.RequestedObject)
      .filter(app => app.Status === 1); // Only active applications

    this.applicationCache = applications;
    console.log(`Fetched and cached ${applications.length} applications`);
    return applications;
  }

  /**
   * Step 2: Get levels from /api/core/system/level/module/{applicationId}
   */
  async getLevelsForApplication(applicationId: number): Promise<any[]> {
    // Filter levels for this specific application
    const levels = this.mockApiResponses.levels
      .filter(level => level.RequestedObject.ModuleId === applicationId)
      .map(level => level.RequestedObject);

    console.log(`Found ${levels.length} levels for application ${applicationId}`);
    return levels;
  }

  /**
   * Step 3: Get field definitions from /api/core/system/fielddefinition/level/{levelId}
   */
  async getFieldDefinitionsForLevel(levelId: number): Promise<any[]> {
    if (this.fieldDefinitionsCache.has(levelId)) {
      console.log(`Using cached field definitions for level ${levelId}`);
      return this.fieldDefinitionsCache.get(levelId)!;
    }

    // Get field definitions based on level
    let fields: any[] = [];
    if (levelId === 408) {
      fields = this.mockApiResponses.fieldDefinitions.level408;
    } else if (levelId === 409) {
      fields = this.mockApiResponses.fieldDefinitions.level409;
    }

    this.fieldDefinitionsCache.set(levelId, fields);
    console.log(`Fetched and cached ${fields.length} field definitions for level ${levelId}`);
    return fields;
  }

  /**
   * Complete workflow: Applications → Levels → Fields → Mappings
   */
  async buildFieldMappingForApplication(applicationName: string): Promise<Record<string, string>> {
    const cacheKey = applicationName;
    if (this.fieldMappingCache.has(cacheKey)) {
      console.log(`Using cached field mapping for ${applicationName}`);
      return this.fieldMappingCache.get(cacheKey)!;
    }

    // Step 1: Find application
    const applications = await this.getApplications();
    const application = applications.find(app => app.Name === applicationName);
    
    if (!application) {
      throw new Error(`Application "${applicationName}" not found`);
    }

    // Step 2: Get levels for this application
    const levels = await this.getLevelsForApplication(application.Id);
    
    // Step 3: Get field definitions for all levels
    const allFields: any[] = [];
    for (const level of levels) {
      const levelFields = await this.getFieldDefinitionsForLevel(level.Id);
      allFields.push(...levelFields);
    }

    // Step 4: Filter active fields and build mapping
    const activeFields = allFields.filter(field => 
      field.Status === 1 || field.IsActive === true
    );

    const mapping: Record<string, string> = {};
    activeFields.forEach(field => {
      if (field.Alias && field.Name) {
        mapping[field.Alias] = field.Name;
      }
    });

    console.log(`Built field mapping with ${Object.keys(mapping).length} active fields for ${applicationName}`);
    this.fieldMappingCache.set(cacheKey, mapping);
    return mapping;
  }

  /**
   * Transform records using the field mapping (alias → display name)
   */
  async translateRecords(records: any[], applicationName: string): Promise<any[]> {
    if (!records || records.length === 0) return [];

    const fieldMapping = await this.buildFieldMappingForApplication(applicationName);
    
    return records.map(record => {
      const translatedRecord: any = {};
      
      for (const [alias, value] of Object.entries(record)) {
        const displayName = fieldMapping[alias] || alias;
        
        // Only include fields that map to active fields
        if (fieldMapping[alias] || !this.isKnownInactiveField(alias)) {
          translatedRecord[displayName] = value;
        }
      }
      
      return translatedRecord;
    });
  }

  /**
   * Reverse translation: display name → alias (for record updates)
   */
  async reverseTranslateRecord(record: any, applicationName: string): Promise<any> {
    const fieldMapping = await this.buildFieldMappingForApplication(applicationName);
    
    // Create reverse mapping (display name → alias)
    const reverseMapping: Record<string, string> = {};
    for (const [alias, displayName] of Object.entries(fieldMapping)) {
      reverseMapping[displayName] = alias;
    }

    const aliasRecord: any = {};
    for (const [displayName, value] of Object.entries(record)) {
      const alias = reverseMapping[displayName] || displayName;
      aliasRecord[alias] = value;
    }

    return aliasRecord;
  }

  private isKnownInactiveField(alias: string): boolean {
    // Known inactive fields that should be filtered out
    const inactiveFields = ['deprecated_field'];
    return inactiveFields.includes(alias);
  }

  // Utility methods for testing
  clearAllCaches(): void {
    this.applicationCache = [];
    this.levelMappingCache = [];
    this.fieldMappingCache.clear();
    this.fieldDefinitionsCache.clear();
  }

  getCacheStats(): any {
    return {
      applications: this.applicationCache.length,
      fieldMappings: this.fieldMappingCache.size,
      fieldDefinitions: this.fieldDefinitionsCache.size
    };
  }
}

describe('Archer Field Caching Workflow Integration Tests', () => {
  let client: MockArcherWorkflowClient;

  beforeEach(() => {
    client = new MockArcherWorkflowClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    client.clearAllCaches();
  });

  describe('Complete Field Resolution Workflow', () => {
    it('should execute the complete workflow: Applications → Levels → Fields → Mappings', async () => {
      // Step 1: Get applications
      const applications = await client.getApplications();
      expect(applications).toHaveLength(2);
      expect(applications[0].Name).toBe('Risk Management');

      // Step 2: Build field mapping for Risk Management
      const mapping = await client.buildFieldMappingForApplication('Risk Management');
      expect(mapping).toEqual({
        'risk_title': 'Risk Title',
        'risk_score': 'Risk Score', 
        'risk_owner': 'Risk Owner'
        // deprecated_field should NOT be included
      });

      // Verify caching is working
      const cacheStats = client.getCacheStats();
      expect(cacheStats.applications).toBe(2);
      expect(cacheStats.fieldMappings).toBe(1);
      expect(cacheStats.fieldDefinitions).toBe(1);
    });

    it('should handle multiple applications with different field schemas', async () => {
      // Build mappings for both applications
      const riskMapping = await client.buildFieldMappingForApplication('Risk Management');
      const complianceMapping = await client.buildFieldMappingForApplication('Compliance Tracking');

      expect(riskMapping).toEqual({
        'risk_title': 'Risk Title',
        'risk_score': 'Risk Score',
        'risk_owner': 'Risk Owner'
      });

      expect(complianceMapping).toEqual({
        'compliance_status': 'Compliance Status',
        'last_review_date': 'Last Review Date'
      });

      // Should have cached both applications' mappings
      expect(client.getCacheStats().fieldMappings).toBe(2);
    });
  });

  describe('Alias to Display Name Translation', () => {
    it('should translate record aliases to display names', async () => {
      const mockRecords = MOCK_API_RESPONSES.records.risk;
      
      const translatedRecords = await client.translateRecords(mockRecords, 'Risk Management');
      
      expect(translatedRecords).toHaveLength(2);
      expect(translatedRecords[0]).toEqual({
        'Risk Title': 'Data Breach Risk',
        'Risk Score': 8.5,
        'Risk Owner': 'john.doe@company.com'
        // deprecated_field should be filtered out
      });

      expect(translatedRecords[1]).toEqual({
        'Risk Title': 'Compliance Gap Risk',
        'Risk Score': 6.2,
        'Risk Owner': 'jane.smith@company.com'
      });
    });

    it('should perform reverse translation for record updates', async () => {
      const displayNameRecord = {
        'Risk Title': 'New Risk Title',
        'Risk Score': 9.1,
        'Risk Owner': 'new.owner@company.com'
      };

      const aliasRecord = await client.reverseTranslateRecord(displayNameRecord, 'Risk Management');
      
      expect(aliasRecord).toEqual({
        'risk_title': 'New Risk Title',
        'risk_score': 9.1,
        'risk_owner': 'new.owner@company.com'
      });
    });

    it('should preserve unknown fields during translation', async () => {
      const recordWithUnknownField = {
        risk_title: 'Test Risk',
        unknown_custom_field: 'Custom Value'
      };

      const translatedRecords = await client.translateRecords([recordWithUnknownField], 'Risk Management');
      
      expect(translatedRecords[0]).toEqual({
        'Risk Title': 'Test Risk',
        'unknown_custom_field': 'Custom Value' // Unknown field preserved as-is
      });
    });
  });

  describe('Active Field Filtering', () => {
    it('should only process active fields and discard inactive ones', async () => {
      const fieldMapping = await client.buildFieldMappingForApplication('Risk Management');
      
      // Should not include deprecated_field (Status: 0, IsActive: false)
      expect(fieldMapping).not.toHaveProperty('deprecated_field');
      expect(Object.keys(fieldMapping)).toHaveLength(3);
      
      // All included fields should be active
      const expectedActiveFields = ['risk_title', 'risk_score', 'risk_owner'];
      expect(Object.keys(fieldMapping)).toEqual(expect.arrayContaining(expectedActiveFields));
    });

    it('should filter out inactive field data during record translation', async () => {
      const recordWithInactiveField = {
        risk_title: 'Test Risk',
        deprecated_field: 'This should be filtered out'
      };

      const translatedRecords = await client.translateRecords([recordWithInactiveField], 'Risk Management');
      
      expect(translatedRecords[0]).toEqual({
        'Risk Title': 'Test Risk'
        // deprecated_field should be filtered out
      });
      expect(translatedRecords[0]).not.toHaveProperty('deprecated_field');
    });
  });

  describe('Cache Performance and Validation', () => {
    it('should cache data at each step of the workflow', async () => {
      // Initial state - no cache
      expect(client.getCacheStats()).toEqual({
        applications: 0,
        fieldMappings: 0,
        fieldDefinitions: 0
      });

      // Execute workflow
      await client.buildFieldMappingForApplication('Risk Management');
      
      // Should have cached each step
      const stats = client.getCacheStats();
      expect(stats.applications).toBe(2); // Cached applications
      expect(stats.fieldMappings).toBe(1); // Cached field mapping
      expect(stats.fieldDefinitions).toBe(1); // Cached field definitions
    });

    it('should use cached data on subsequent requests', async () => {
      // First request - builds cache
      const firstMapping = await client.buildFieldMappingForApplication('Risk Management');
      const firstStats = client.getCacheStats();
      
      // Second request - uses cache
      const secondMapping = await client.buildFieldMappingForApplication('Risk Management');
      const secondStats = client.getCacheStats();
      
      // Results should be identical
      expect(secondMapping).toEqual(firstMapping);
      
      // Cache stats should be the same (no additional API calls)
      expect(secondStats).toEqual(firstStats);
    });

    it('should rebuild cache after invalidation', async () => {
      // Build initial cache
      await client.buildFieldMappingForApplication('Risk Management');
      const initialStats = client.getCacheStats();
      expect(initialStats.applications).toBeGreaterThan(0);
      
      // Clear cache
      client.clearAllCaches();
      expect(client.getCacheStats()).toEqual({
        applications: 0,
        fieldMappings: 0,
        fieldDefinitions: 0
      });
      
      // Rebuild cache
      await client.buildFieldMappingForApplication('Risk Management');
      const rebuiltStats = client.getCacheStats();
      expect(rebuiltStats).toEqual(initialStats);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent application gracefully', async () => {
      await expect(
        client.buildFieldMappingForApplication('Non-Existent App')
      ).rejects.toThrow('Application "Non-Existent App" not found');
    });

    it('should handle empty field definitions', async () => {
      // Create client with empty field definitions
      const emptyFieldsClient = new MockArcherWorkflowClient({
        ...MOCK_API_RESPONSES,
        fieldDefinitions: { level408: [], level409: [] }
      });

      const mapping = await emptyFieldsClient.buildFieldMappingForApplication('Risk Management');
      expect(mapping).toEqual({});
    });

    it('should handle malformed field data', async () => {
      const malformedFieldsClient = new MockArcherWorkflowClient({
        ...MOCK_API_RESPONSES,
        fieldDefinitions: {
          level408: [
            { Id: 1, Name: null, Alias: null, Status: 1 }, // Missing required fields
            { Id: 2, Name: 'Valid Field', Alias: 'valid_field', Status: 1 }
          ],
          level409: []
        }
      });

      const mapping = await malformedFieldsClient.buildFieldMappingForApplication('Risk Management');
      
      // Should only include valid field
      expect(mapping).toEqual({
        'valid_field': 'Valid Field'
      });
    });

    it('should handle empty record sets', async () => {
      const translatedRecords = await client.translateRecords([], 'Risk Management');
      expect(translatedRecords).toHaveLength(0);
    });

    it('should handle null/undefined record data', async () => {
      const translatedRecords = await client.translateRecords(null as any, 'Risk Management');
      expect(translatedRecords).toHaveLength(0);
    });
  });
});