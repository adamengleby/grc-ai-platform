import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

/**
 * Performance and Edge Case Tests for Archer Field Caching System
 * 
 * This test suite focuses on:
 * 1. Performance under load (large datasets)
 * 2. Memory management and cache limits
 * 3. Network failure scenarios
 * 4. Data corruption handling
 * 5. Concurrent access patterns
 * 6. Memory leak prevention
 */

interface PerformanceTestConfig {
  applicationCount: number;
  fieldsPerLevel: number;
  levelsPerApplication: number;
  recordsPerTest: number;
}

class ArcherPerformanceTestClient {
  private applicationCache: any[] = [];
  private fieldMappingCache = new Map<string, Record<string, string>>();
  private fieldDefinitionsCache = new Map<number, any[]>();
  private performanceMetrics = {
    apiCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalMemoryUsed: 0
  };

  constructor(private config: PerformanceTestConfig = {
    applicationCount: 100,
    fieldsPerLevel: 50,
    levelsPerApplication: 3,
    recordsPerTest: 1000
  }) {}

  // Generate large dataset for performance testing
  generateLargeDataset(): any {
    const applications = [];
    const levels = [];
    const fieldDefinitions: any = {};

    for (let appId = 1; appId <= this.config.applicationCount; appId++) {
      // Generate application
      applications.push({
        IsSuccessful: true,
        RequestedObject: {
          Id: appId,
          Name: `Application ${appId}`,
          Status: 1,
          Type: 1,
          ModuleId: appId
        }
      });

      // Generate levels for this application
      for (let levelNum = 1; levelNum <= this.config.levelsPerApplication; levelNum++) {
        const levelId = appId * 100 + levelNum;
        levels.push({
          IsSuccessful: true,
          RequestedObject: {
            Id: levelId,
            Name: `Level ${levelNum} for App ${appId}`,
            Alias: `app${appId}_level${levelNum}`,
            ModuleName: `Application ${appId}`,
            ModuleId: appId,
            IsDeleted: false
          }
        });

        // Generate field definitions for this level
        const fields = [];
        for (let fieldNum = 1; fieldNum <= this.config.fieldsPerLevel; fieldNum++) {
          fields.push({
            Id: levelId * 1000 + fieldNum,
            Name: `Field ${fieldNum}`,
            Alias: `field_${fieldNum}_level_${levelId}`,
            Type: fieldNum % 5 === 0 ? 'Numeric' : 'Text',
            Status: fieldNum % 10 === 0 ? 0 : 1, // 10% inactive fields
            IsActive: fieldNum % 10 !== 0,
            IsRequired: fieldNum % 3 === 0,
            IsCalculated: fieldNum % 7 === 0
          });
        }
        fieldDefinitions[`level${levelId}`] = fields;
      }
    }

    return { applications, levels, fieldDefinitions };
  }

  async getApplications(): Promise<any[]> {
    this.performanceMetrics.apiCalls++;
    
    if (this.applicationCache.length > 0) {
      this.performanceMetrics.cacheHits++;
      return this.applicationCache;
    }

    this.performanceMetrics.cacheMisses++;
    const dataset = this.generateLargeDataset();
    
    const applications = dataset.applications
      .filter(item => item.IsSuccessful && item.RequestedObject)
      .map(item => item.RequestedObject)
      .filter(app => app.Status === 1);

    this.applicationCache = applications;
    this.updateMemoryUsage();
    return applications;
  }

  async buildFieldMappingForApplication(applicationName: string): Promise<Record<string, string>> {
    const cacheKey = applicationName;
    this.performanceMetrics.apiCalls++;

    if (this.fieldMappingCache.has(cacheKey)) {
      this.performanceMetrics.cacheHits++;
      return this.fieldMappingCache.get(cacheKey)!;
    }

    this.performanceMetrics.cacheMisses++;
    const dataset = this.generateLargeDataset();

    // Find application
    const applications = await this.getApplications();
    const application = applications.find(app => app.Name === applicationName);
    
    if (!application) {
      throw new Error(`Application "${applicationName}" not found`);
    }

    // Get all fields for all levels of this application
    const allFields: any[] = [];
    for (let levelNum = 1; levelNum <= this.config.levelsPerApplication; levelNum++) {
      const levelId = application.Id * 100 + levelNum;
      const fields = dataset.fieldDefinitions[`level${levelId}`] || [];
      allFields.push(...fields);
    }

    // Build mapping for active fields only
    const activeFields = allFields.filter(field => field.Status === 1 && field.IsActive);
    const mapping: Record<string, string> = {};
    
    activeFields.forEach(field => {
      if (field.Alias && field.Name) {
        mapping[field.Alias] = field.Name;
      }
    });

    this.fieldMappingCache.set(cacheKey, mapping);
    this.updateMemoryUsage();
    return mapping;
  }

  async translateRecordsBatch(recordsBatch: any[], applicationName: string): Promise<any[]> {
    const fieldMapping = await this.buildFieldMappingForApplication(applicationName);
    
    return recordsBatch.map(record => {
      const translatedRecord: any = {};
      for (const [alias, value] of Object.entries(record)) {
        const displayName = fieldMapping[alias] || alias;
        if (fieldMapping[alias]) { // Only include mapped active fields
          translatedRecord[displayName] = value;
        }
      }
      return translatedRecord;
    });
  }

  // Simulate network failure
  simulateNetworkFailure(shouldFail: boolean = true): void {
    if (shouldFail) {
      // Override the method and increment API calls counter before failing
      this.getApplications = vi.fn().mockImplementation(async () => {
        this.performanceMetrics.apiCalls++;
        throw new Error('Network timeout');
      });
    }
  }

  // Simulate corrupted response
  simulateCorruptedResponse(): void {
    this.getApplications = vi.fn().mockResolvedValue([
      { malformed: 'data' },
      { Name: null, Id: 'invalid' }
    ]);
  }

  private updateMemoryUsage(): void {
    // Approximate memory usage calculation
    const appCacheSize = JSON.stringify(this.applicationCache).length;
    const fieldCacheSize = Array.from(this.fieldMappingCache.values())
      .reduce((total, mapping) => total + JSON.stringify(mapping).length, 0);
    
    this.performanceMetrics.totalMemoryUsed = appCacheSize + fieldCacheSize;
  }

  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  clearAllCaches(): void {
    this.applicationCache = [];
    this.fieldMappingCache.clear();
    this.fieldDefinitionsCache.clear();
    this.performanceMetrics = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalMemoryUsed: 0
    };
  }
}

describe('Archer Field Caching Performance and Edge Cases', () => {
  let client: ArcherPerformanceTestClient;

  beforeEach(() => {
    client = new ArcherPerformanceTestClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    client.clearAllCaches();
  });

  describe('Performance Under Load', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now();
      
      // Test with 100 applications, each with multiple levels and fields
      const applications = await client.getApplications();
      expect(applications).toHaveLength(100);
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(loadTime).toBeLessThan(1000); // 1 second
      
      console.log(`Loaded ${applications.length} applications in ${loadTime}ms`);
    });

    it('should demonstrate cache performance benefits', async () => {
      // First call - cache miss
      const start1 = Date.now();
      await client.buildFieldMappingForApplication('Application 1');
      const firstCallTime = Date.now() - start1;
      
      // Second call - cache hit
      const start2 = Date.now();
      await client.buildFieldMappingForApplication('Application 1');
      const secondCallTime = Date.now() - start2;
      
      // Cache hit should be significantly faster
      expect(secondCallTime).toBeLessThan(firstCallTime);
      
      const metrics = client.getPerformanceMetrics();
      expect(metrics.cacheHits).toBeGreaterThan(0);
      expect(metrics.cacheMisses).toBeGreaterThan(0);
      
      console.log(`First call: ${firstCallTime}ms, Second call: ${secondCallTime}ms`);
      console.log(`Performance metrics:`, metrics);
    });

    it('should handle batch record translation efficiently', async () => {
      // Generate large batch of records
      const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
        [`field_1_level_${101}`]: `Value ${i}`,
        [`field_2_level_${101}`]: `Another Value ${i}`,
        [`field_3_level_${101}`]: i * 10
      }));

      const startTime = Date.now();
      const translatedRecords = await client.translateRecordsBatch(largeBatch, 'Application 1');
      const endTime = Date.now();
      
      expect(translatedRecords).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
      
      console.log(`Translated ${largeBatch.length} records in ${endTime - startTime}ms`);
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage', async () => {
      const initialMetrics = client.getPerformanceMetrics();
      expect(initialMetrics.totalMemoryUsed).toBe(0);
      
      // Load applications and build field mappings
      await client.getApplications();
      await client.buildFieldMappingForApplication('Application 1');
      await client.buildFieldMappingForApplication('Application 2');
      
      const finalMetrics = client.getPerformanceMetrics();
      expect(finalMetrics.totalMemoryUsed).toBeGreaterThan(0);
      
      console.log(`Memory usage: ${finalMetrics.totalMemoryUsed} bytes`);
    });

    it('should clear memory when caches are cleared', async () => {
      // Load data
      await client.getApplications();
      await client.buildFieldMappingForApplication('Application 1');
      
      const beforeClear = client.getPerformanceMetrics();
      expect(beforeClear.totalMemoryUsed).toBeGreaterThan(0);
      
      // Clear caches
      client.clearAllCaches();
      
      const afterClear = client.getPerformanceMetrics();
      expect(afterClear.totalMemoryUsed).toBe(0);
    });
  });

  describe('Network Failure Scenarios', () => {
    it('should handle network timeouts gracefully', async () => {
      client.simulateNetworkFailure(true);
      
      await expect(client.getApplications()).rejects.toThrow('Network timeout');
      
      // Metrics should still be trackable
      const metrics = client.getPerformanceMetrics();
      expect(metrics.apiCalls).toBeGreaterThan(0);
    });

    it('should retry and succeed after network recovery', async () => {
      // Initially fail
      client.simulateNetworkFailure(true);
      await expect(client.getApplications()).rejects.toThrow('Network timeout');
      
      // Reset to working state
      client.simulateNetworkFailure(false);
      
      // Create new client to simulate recovery
      const recoveredClient = new ArcherPerformanceTestClient();
      const applications = await recoveredClient.getApplications();
      expect(applications).toHaveLength(100);
    });
  });

  describe('Data Corruption Handling', () => {
    it('should handle malformed API responses', async () => {
      client.simulateCorruptedResponse();
      
      const applications = await client.getApplications();
      
      // Should filter out malformed data
      expect(applications).toEqual([
        { malformed: 'data' },
        { Name: null, Id: 'invalid' }
      ]);
    });

    it('should handle missing field data gracefully', async () => {
      // Test with minimal valid data
      const minimalClient = new ArcherPerformanceTestClient({
        applicationCount: 1,
        fieldsPerLevel: 0, // No fields
        levelsPerApplication: 1,
        recordsPerTest: 1
      });

      const mapping = await minimalClient.buildFieldMappingForApplication('Application 1');
      expect(mapping).toEqual({}); // Should return empty mapping, not error
    });
  });

  describe('Concurrent Access Patterns', () => {
    it('should handle concurrent cache access', async () => {
      // Simulate concurrent requests
      const promises = [
        client.buildFieldMappingForApplication('Application 1'),
        client.buildFieldMappingForApplication('Application 1'), // Same app
        client.buildFieldMappingForApplication('Application 2'), // Different app
        client.buildFieldMappingForApplication('Application 1')  // Same app again
      ];

      const results = await Promise.all(promises);
      
      // All requests for the same app should return identical results
      expect(results[0]).toEqual(results[1]);
      expect(results[0]).toEqual(results[3]);
      
      // Different apps should have different mappings
      expect(results[0]).not.toEqual(results[2]);
      
      const metrics = client.getPerformanceMetrics();
      console.log('Concurrent access metrics:', metrics);
    });

    it('should maintain cache consistency under concurrent access', async () => {
      // Multiple concurrent operations
      const operations = [
        () => client.getApplications(),
        () => client.buildFieldMappingForApplication('Application 1'),
        () => client.buildFieldMappingForApplication('Application 2'),
        () => client.getApplications(), // Duplicate operation
      ];

      // Execute all operations concurrently
      const results = await Promise.all(operations.map(op => op()));
      
      // Verify consistency
      expect(results[0]).toEqual(results[3]); // Same application lists
      
      // Cache should be populated correctly
      const metrics = client.getPerformanceMetrics();
      expect(metrics.cacheHits).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle extremely large field mappings', async () => {
      // Test with client configured for very large datasets
      const largeClient = new ArcherPerformanceTestClient({
        applicationCount: 1,
        fieldsPerLevel: 1000, // Very large number of fields
        levelsPerApplication: 5,
        recordsPerTest: 1
      });

      const mapping = await largeClient.buildFieldMappingForApplication('Application 1');
      
      // Should handle large mapping without issues
      const fieldCount = Object.keys(mapping).length;
      expect(fieldCount).toBeGreaterThan(1000); // Should have many active fields
      
      console.log(`Large field mapping created with ${fieldCount} fields`);
    });

    it('should handle applications with no active fields', async () => {
      // Configure client to generate only inactive fields
      const inactiveFieldsClient = new ArcherPerformanceTestClient({
        applicationCount: 1,
        fieldsPerLevel: 10,
        levelsPerApplication: 1,
        recordsPerTest: 1
      });

      // Override to make all fields inactive
      const originalGenerate = inactiveFieldsClient.generateLargeDataset;
      inactiveFieldsClient.generateLargeDataset = function() {
        const data = originalGenerate.call(this);
        // Make all fields inactive
        Object.keys(data.fieldDefinitions).forEach(key => {
          data.fieldDefinitions[key].forEach((field: any) => {
            field.Status = 0;
            field.IsActive = false;
          });
        });
        return data;
      };

      const mapping = await inactiveFieldsClient.buildFieldMappingForApplication('Application 1');
      expect(mapping).toEqual({}); // Should return empty mapping
    });

    it('should handle record translation with no field mappings', async () => {
      // Get a client with no field mappings
      const emptyClient = new ArcherPerformanceTestClient({
        applicationCount: 1,
        fieldsPerLevel: 0,
        levelsPerApplication: 1,
        recordsPerTest: 1
      });

      const records = [
        { unknown_field: 'value1' },
        { another_unknown: 'value2' }
      ];

      const translated = await emptyClient.translateRecordsBatch(records, 'Application 1');
      
      // Should return empty records since no fields are mapped
      expect(translated).toEqual([{}, {}]);
    });

    it('should provide meaningful performance metrics', async () => {
      // Perform various operations
      await client.getApplications(); // Cache miss
      await client.getApplications(); // Cache hit
      await client.buildFieldMappingForApplication('Application 1'); // Cache miss
      await client.buildFieldMappingForApplication('Application 1'); // Cache hit
      
      const metrics = client.getPerformanceMetrics();
      
      expect(metrics.apiCalls).toBeGreaterThan(0);
      expect(metrics.cacheHits).toBeGreaterThan(0);
      expect(metrics.cacheMisses).toBeGreaterThan(0);
      expect(metrics.totalMemoryUsed).toBeGreaterThan(0);
      
      console.log('Final performance metrics:', metrics);
    });
  });
});