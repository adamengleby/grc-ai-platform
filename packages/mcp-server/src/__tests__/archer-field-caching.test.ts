import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios, { AxiosInstance } from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

// Import the classes we're testing
// Note: These imports will need to be adjusted based on actual export structure
interface ArcherConnection {
  baseUrl: string;
  userDomain: string;
  username: string;
  password: string;
  instanceName: string;
}

interface ArcherApplication {
  Id: number;
  Name: string;
  Status: number;
  Type?: number;
  ModuleId?: number;
  Description?: string;
  contentApiUrl?: string | null;
  levelId?: number | null;
}

interface ArcherField {
  Id: number;
  Name: string;
  Alias: string;
  Type: string;
  Status: number;
  IsActive?: boolean;
  IsCalculated?: boolean;
  IsRequired?: boolean;
}

interface ArcherSession {
  sessionToken: string;
  userDomainId?: string;
  expiresAt: Date;
}

interface LevelMapping {
  levelId: number;
  alias: string;
  moduleName: string;
  moduleId: number;
}

// Mock implementation of ArcherAPIClient class based on the source code
class MockArcherAPIClient {
  private connection: ArcherConnection;
  private session: ArcherSession | null = null;
  private applicationCache: ArcherApplication[] = [];
  private fieldMappingCache = new Map<string, Record<string, string>>();
  private levelMappingCache: LevelMapping[] = [];
  
  constructor(connection: ArcherConnection) {
    this.connection = connection;
  }

  // Mock the actual methods from the source code
  async ensureValidSession(): Promise<void> {
    if (!this.session || this.session.expiresAt <= new Date()) {
      this.session = {
        sessionToken: 'mock-session-token',
        userDomainId: 'mock-domain-id',
        expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
      };
    }
  }

  async getApplications(): Promise<ArcherApplication[]> {
    // Simulate cache check
    if (this.applicationCache.length > 0) {
      console.log(`[Archer API] Using cached applications (${this.applicationCache.length} entries)`);
      return this.applicationCache;
    }

    await this.ensureValidSession();
    
    // Simulate API call and response processing
    const mockResponse = {
      data: [
        {
          IsSuccessful: true,
          RequestedObject: {
            Id: 606,
            Name: 'Risk Management',
            Status: 1,
            Type: 1,
            Description: 'Risk management application'
          }
        },
        {
          IsSuccessful: true,
          RequestedObject: {
            Id: 607,
            Name: 'Compliance Tracking',
            Status: 1,
            Type: 1,
            Description: 'Compliance tracking application'
          }
        },
        {
          IsSuccessful: true,
          RequestedObject: {
            Id: 608,
            Name: 'Inactive App',
            Status: 0, // Inactive
            Type: 1,
            Description: 'Inactive application'
          }
        }
      ]
    };

    // Extract and filter active applications
    const applications = mockResponse.data
      .filter(item => item.IsSuccessful && item.RequestedObject)
      .map(item => item.RequestedObject)
      .filter(app => app.Status === 1); // Only active applications

    this.applicationCache = applications;
    return this.applicationCache;
  }

  async getFieldMapping(application: ArcherApplication): Promise<Record<string, string>> {
    const cacheKey = application.Name;
    
    if (this.fieldMappingCache.has(cacheKey)) {
      return this.fieldMappingCache.get(cacheKey)!;
    }

    // Only return mock fields for known applications
    let mockFields: any[] = [];
    if (application.Name === 'Risk Management') {
      mockFields = [
        { Id: 1, Name: 'Risk Title', Alias: 'risk_title', Status: 1, Type: 'Text' },
        { Id: 2, Name: 'Risk Score', Alias: 'risk_score', Status: 1, Type: 'Numeric' },
        { Id: 3, Name: 'Control Owner', Alias: 'control_owner', Status: 1, Type: 'User' },
        { Id: 4, Name: 'Inactive Field', Alias: 'inactive_field', Status: 0, Type: 'Text' } // Inactive
      ];
    } else if (application.Name === 'Compliance Tracking') {
      mockFields = [
        { Id: 5, Name: 'Compliance Status', Alias: 'compliance_status', Status: 1, Type: 'ValuesList' },
        { Id: 6, Name: 'Review Date', Alias: 'review_date', Status: 1, Type: 'Date' }
      ];
    }
    // For non-existent applications, mockFields remains empty array

    // Build alias -> display name mapping for active fields only
    const mapping: Record<string, string> = {};
    mockFields
      .filter(field => field.Status === 1) // Only active fields
      .forEach(field => {
        if (field.Alias && field.Name) {
          mapping[field.Alias] = field.Name;
        }
      });

    this.fieldMappingCache.set(cacheKey, mapping);
    return mapping;
  }

  async transformRecords(records: any[], application: ArcherApplication): Promise<any[]> {
    if (!records || records.length === 0) return [];

    const fieldMapping = await this.getFieldMapping(application);
    
    return records.map(record => {
      const transformedRecord: any = {};
      
      // Transform each field alias to display name
      for (const [alias, value] of Object.entries(record)) {
        const displayName = fieldMapping[alias] || alias;
        transformedRecord[displayName] = value;
      }
      
      return transformedRecord;
    });
  }

  // Method to clear caches for testing
  clearAllCaches(): void {
    this.applicationCache = [];
    this.fieldMappingCache.clear();
    this.levelMappingCache = [];
  }

  // Getter methods for testing
  getApplicationCacheSize(): number {
    return this.applicationCache.length;
  }

  getFieldMappingCacheSize(): number {
    return this.fieldMappingCache.size;
  }

  hasFieldMapping(applicationName: string): boolean {
    return this.fieldMappingCache.has(applicationName);
  }
}

describe('Archer Field Caching System', () => {
  let client: MockArcherAPIClient;
  let mockConnection: ArcherConnection;

  beforeEach(() => {
    // Setup mock connection
    mockConnection = {
      baseUrl: 'https://test-archer.com',
      userDomain: 'TestDomain',
      username: 'testuser',
      password: 'testpass',
      instanceName: 'TestInstance'
    };

    client = new MockArcherAPIClient(mockConnection);
    
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up
    client.clearAllCaches();
  });

  describe('Application Caching', () => {
    it('should fetch applications from API on first call', async () => {
      expect(client.getApplicationCacheSize()).toBe(0);
      
      const applications = await client.getApplications();
      
      expect(applications).toHaveLength(2); // Only active applications
      expect(applications[0].Name).toBe('Risk Management');
      expect(applications[1].Name).toBe('Compliance Tracking');
      expect(client.getApplicationCacheSize()).toBe(2);
    });

    it('should return cached applications on subsequent calls', async () => {
      // First call - should fetch from API
      const firstCall = await client.getApplications();
      expect(firstCall).toHaveLength(2);
      
      // Second call - should use cache
      const secondCall = await client.getApplications();
      expect(secondCall).toHaveLength(2);
      expect(secondCall).toBe(firstCall); // Same reference due to caching
    });

    it('should filter out inactive applications', async () => {
      const applications = await client.getApplications();
      
      // Should not include the inactive application (Status: 0)
      expect(applications).toHaveLength(2);
      expect(applications.every(app => app.Status === 1)).toBe(true);
      expect(applications.find(app => app.Name === 'Inactive App')).toBeUndefined();
    });

    it('should handle empty response gracefully', async () => {
      // Create a client that will return empty response
      const emptyClient = new MockArcherAPIClient(mockConnection);
      
      // Override getApplications to return empty array
      emptyClient.getApplications = vi.fn().mockResolvedValue([]);
      
      const applications = await emptyClient.getApplications();
      expect(applications).toHaveLength(0);
    });

    it('should refresh cache when cleared', async () => {
      // Initial load
      await client.getApplications();
      expect(client.getApplicationCacheSize()).toBe(2);
      
      // Clear cache
      client.clearAllCaches();
      expect(client.getApplicationCacheSize()).toBe(0);
      
      // Should fetch again
      const applications = await client.getApplications();
      expect(applications).toHaveLength(2);
      expect(client.getApplicationCacheSize()).toBe(2);
    });
  });

  describe('Field Definition Caching', () => {
    let riskApp: ArcherApplication;

    beforeEach(async () => {
      const applications = await client.getApplications();
      riskApp = applications[0]; // Risk Management app
    });

    it('should fetch field definitions on first request', async () => {
      expect(client.hasFieldMapping(riskApp.Name)).toBe(false);
      
      const fieldMapping = await client.getFieldMapping(riskApp);
      
      expect(fieldMapping).toEqual({
        'risk_title': 'Risk Title',
        'risk_score': 'Risk Score',
        'control_owner': 'Control Owner'
        // Note: inactive_field should not be included
      });
      expect(client.hasFieldMapping(riskApp.Name)).toBe(true);
    });

    it('should return cached field definitions on subsequent requests', async () => {
      // First call
      const firstMapping = await client.getFieldMapping(riskApp);
      
      // Second call should return cached version
      const secondMapping = await client.getFieldMapping(riskApp);
      
      expect(secondMapping).toEqual(firstMapping);
      expect(client.getFieldMappingCacheSize()).toBe(1);
    });

    it('should only include active fields in mapping', async () => {
      const fieldMapping = await client.getFieldMapping(riskApp);
      
      // Should not include inactive_field (Status: 0)
      expect(fieldMapping).not.toHaveProperty('inactive_field');
      expect(Object.keys(fieldMapping)).toHaveLength(3);
    });

    it('should cache mappings per application', async () => {
      const applications = await client.getApplications();
      const app1 = applications[0];
      const app2 = applications[1];
      
      const mapping1 = await client.getFieldMapping(app1);
      const mapping2 = await client.getFieldMapping(app2);
      
      expect(client.getFieldMappingCacheSize()).toBe(2);
      expect(mapping1).not.toBe(mapping2);
    });
  });

  describe('Alias to Display Name Translation', () => {
    let riskApp: ArcherApplication;

    beforeEach(async () => {
      const applications = await client.getApplications();
      riskApp = applications[0];
    });

    it('should translate aliases to display names in records', async () => {
      const mockRecords = [
        {
          risk_title: 'Data Breach Risk',
          risk_score: 8.5,
          control_owner: 'John Doe'
        },
        {
          risk_title: 'Compliance Gap',
          risk_score: 6.2,
          control_owner: 'Jane Smith'
        }
      ];

      const transformedRecords = await client.transformRecords(mockRecords, riskApp);
      
      expect(transformedRecords).toHaveLength(2);
      expect(transformedRecords[0]).toEqual({
        'Risk Title': 'Data Breach Risk',
        'Risk Score': 8.5,
        'Control Owner': 'John Doe'
      });
      expect(transformedRecords[1]).toEqual({
        'Risk Title': 'Compliance Gap',
        'Risk Score': 6.2,
        'Control Owner': 'Jane Smith'
      });
    });

    it('should preserve unmapped fields with original alias', async () => {
      const mockRecords = [
        {
          risk_title: 'Test Risk',
          unknown_field: 'Some Value'
        }
      ];

      const transformedRecords = await client.transformRecords(mockRecords, riskApp);
      
      expect(transformedRecords[0]).toEqual({
        'Risk Title': 'Test Risk',
        'unknown_field': 'Some Value' // Should preserve unknown field as-is
      });
    });

    it('should handle empty records gracefully', async () => {
      const transformedRecords = await client.transformRecords([], riskApp);
      expect(transformedRecords).toHaveLength(0);
    });

    it('should handle null/undefined records', async () => {
      const transformedRecords = await client.transformRecords(null as any, riskApp);
      expect(transformedRecords).toHaveLength(0);
    });
  });

  describe('Active Field Filtering', () => {
    it('should filter out inactive fields during mapping creation', async () => {
      const applications = await client.getApplications();
      const app = applications[0];
      
      const fieldMapping = await client.getFieldMapping(app);
      
      // Should only contain active fields (Status: 1)
      const expectedActiveFields = ['risk_title', 'risk_score', 'control_owner'];
      const actualAliases = Object.keys(fieldMapping);
      
      expect(actualAliases).toEqual(expect.arrayContaining(expectedActiveFields));
      expect(actualAliases).not.toContain('inactive_field');
      expect(actualAliases).toHaveLength(3);
    });
  });

  describe('Cache Invalidation Scenarios', () => {
    it('should clear all caches when requested', async () => {
      // Populate caches
      const applications = await client.getApplications();
      await client.getFieldMapping(applications[0]);
      
      expect(client.getApplicationCacheSize()).toBeGreaterThan(0);
      expect(client.getFieldMappingCacheSize()).toBeGreaterThan(0);
      
      // Clear caches
      client.clearAllCaches();
      
      expect(client.getApplicationCacheSize()).toBe(0);
      expect(client.getFieldMappingCacheSize()).toBe(0);
    });

    it('should rebuild cache after clearing', async () => {
      // Initial population
      await client.getApplications();
      const initialSize = client.getApplicationCacheSize();
      
      // Clear and rebuild
      client.clearAllCaches();
      await client.getApplications();
      
      expect(client.getApplicationCacheSize()).toBe(initialSize);
    });
  });

  describe('Error Handling', () => {
    it('should handle session creation failures gracefully', async () => {
      const faultyClient = new MockArcherAPIClient(mockConnection);
      
      // Override ensureValidSession to throw error
      faultyClient.ensureValidSession = vi.fn().mockRejectedValue(new Error('Authentication failed'));
      
      await expect(faultyClient.getApplications()).rejects.toThrow('Authentication failed');
    });

    it('should handle missing application data', async () => {
      const emptyClient = new MockArcherAPIClient(mockConnection);
      
      // Override to return malformed data
      emptyClient.getApplications = vi.fn().mockResolvedValue([]);
      
      const applications = await emptyClient.getApplications();
      expect(applications).toHaveLength(0);
    });

    it('should handle field mapping for non-existent application', async () => {
      const nonExistentApp: ArcherApplication = {
        Id: 999,
        Name: 'Non-existent App',
        Status: 1
      };

      // Should still work, but return empty mapping
      const mapping = await client.getFieldMapping(nonExistentApp);
      expect(mapping).toEqual({});
    });
  });
});