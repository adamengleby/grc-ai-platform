/**
 * Dynamic Schema Manager for Archer GRC ContentAPI
 * Discovers and caches application schemas using ContentAPI metadata
 */

import { LRUCache } from 'lru-cache';

export interface ArcherFieldSchema {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'reference' | 'valuelist';
  nullable: boolean;
  maxLength?: number;
  isActive: boolean;
  fieldId?: number;
}

export interface ApplicationSchema {
  applicationId: number;
  applicationName: string;
  contentApiPath: string;
  fields: ArcherFieldSchema[];
  lastUpdated: number;
  schemaSource: 'metadata' | 'sample' | 'cache';
}

export interface ArcherConnection {
  baseUrl: string;
  sessionToken: string;
  instanceId: string;
}

export class DynamicSchemaManager {
  private schemaCache = new LRUCache<string, ApplicationSchema>({ 
    max: 500,
    ttl: 24 * 60 * 60 * 1000 // 24 hours TTL
  });
  
  private availableEndpoints = new LRUCache<string, string[]>({
    max: 10,
    ttl: 24 * 60 * 60 * 1000 // 24 hours TTL
  });

  /**
   * Get schema for an application, using cached version if available
   */
  async getApplicationSchema(
    applicationId: number,
    applicationName: string,
    contentApiPath: string,
    connection: ArcherConnection,
    tenantId: string
  ): Promise<ApplicationSchema> {
    const cacheKey = `${tenantId}:${applicationId}`;
    
    // Check cache first
    const cachedSchema = this.schemaCache.get(cacheKey);
    if (cachedSchema) {
      console.log(`[Schema] Using cached schema for ${applicationName} (${applicationId})`);
      return cachedSchema;
    }

    console.log(`[Schema] Discovering schema for ${applicationName} (${applicationId})`);

    try {
      // Try metadata endpoint first
      const metadataSchema = await this.discoverFromMetadata(connection, tenantId);
      if (metadataSchema) {
        const appSchema = metadataSchema.find(s => s.applicationId === applicationId);
        if (appSchema) {
          this.schemaCache.set(cacheKey, appSchema);
          return appSchema;
        }
      }

      // Fallback: discover from sample record
      const sampleSchema = await this.discoverFromSample(
        applicationId,
        applicationName,
        contentApiPath,
        connection,
        tenantId
      );
      
      this.schemaCache.set(cacheKey, sampleSchema);
      return sampleSchema;

    } catch (error) {
      console.error(`[Schema] Failed to discover schema for ${applicationName}:`, error);
      throw new Error(`Schema discovery failed for ${applicationName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Discover schemas from ContentAPI $metadata endpoint
   */
  private async discoverFromMetadata(
    connection: ArcherConnection,
    tenantId: string
  ): Promise<ApplicationSchema[] | null> {
    console.log('[Schema] Attempting metadata discovery from /contentapi/$metadata');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${connection.baseUrl}/contentapi/$metadata`, {
        headers: {
          'Authorization': `Archer session-id="${connection.sessionToken}"`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Schema] Metadata endpoint returned ${response.status}: ${response.statusText}`);
        return null;
      }

      const metadataText = await response.text();
      console.log('[Schema] Metadata response received, parsing...');
      
      // Parse the metadata (could be XML or JSON)
      const schemas = this.parseMetadataResponse(metadataText);
      
      console.log(`[Schema] Discovered ${schemas.length} application schemas from metadata`);
      return schemas;

    } catch (error) {
      console.warn('[Schema] Metadata discovery failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Discover schema by sampling one record from the application
   */
  private async discoverFromSample(
    applicationId: number,
    applicationName: string,
    contentApiPath: string,
    connection: ArcherConnection,
    tenantId: string
  ): Promise<ApplicationSchema> {
    console.log(`[Schema] Sampling record from ${contentApiPath} for schema discovery`);

    const sampleUrl = `${connection.baseUrl}${contentApiPath}?$top=1`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(sampleUrl, {
      headers: {
        'Authorization': `Archer session-id="${connection.sessionToken}"`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Sample request failed: ${response.status} ${response.statusText}`);
    }

    const sampleData: any = await response.json();
    
    if (!sampleData.value || !Array.isArray(sampleData.value) || sampleData.value.length === 0) {
      throw new Error(`No sample data available for ${applicationName}`);
    }

    const sampleRecord = sampleData.value[0];
    const fields = this.inferFieldsFromRecord(sampleRecord);
    
    // Filter out inactive/empty fields
    const activeFields = fields.filter(field => 
      field.isActive && field.name && field.name.trim() !== ''
    );

    const schema: ApplicationSchema = {
      applicationId,
      applicationName,
      contentApiPath,
      fields: activeFields,
      lastUpdated: Date.now(),
      schemaSource: 'sample'
    };

    console.log(`[Schema] Discovered ${activeFields.length} active fields for ${applicationName}`);
    return schema;
  }

  /**
   * Get list of available ContentAPI endpoints
   */
  async getAvailableEndpoints(connection: ArcherConnection, tenantId: string): Promise<string[]> {
    const cacheKey = `endpoints:${tenantId}`;
    
    // Check cache first
    const cached = this.availableEndpoints.get(cacheKey);
    if (cached) {
      return cached;
    }

    console.log('[Schema] Discovering available ContentAPI endpoints');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${connection.baseUrl}/contentapi`, {
        headers: {
          'Authorization': `Archer session-id="${connection.sessionToken}"`,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Endpoints discovery failed: ${response.status} ${response.statusText}`);
      }

      const endpointsData = await response.text();
      const endpoints = this.parseEndpointsResponse(endpointsData);
      
      this.availableEndpoints.set(cacheKey, endpoints);
      console.log(`[Schema] Discovered ${endpoints.length} available ContentAPI endpoints`);
      
      return endpoints;

    } catch (error) {
      console.error('[Schema] Failed to discover endpoints:', error);
      throw error;
    }
  }

  /**
   * Parse metadata response (handles both XML and JSON formats)
   */
  private parseMetadataResponse(metadataText: string): ApplicationSchema[] {
    // TODO: Implement based on actual metadata format
    // This needs to be implemented once we see the actual response format
    console.log('[Schema] Parsing metadata response (format TBD)');
    
    // Placeholder - will implement based on actual response structure
    return [];
  }

  /**
   * Parse endpoints list response
   */
  private parseEndpointsResponse(endpointsText: string): string[] {
    // TODO: Implement based on actual endpoints format
    // This needs to be implemented once we see the actual response format
    console.log('[Schema] Parsing endpoints response (format TBD)');
    
    // Placeholder - will implement based on actual response structure
    return [];
  }

  /**
   * Infer field schema from a sample record
   */
  private inferFieldsFromRecord(record: any): ArcherFieldSchema[] {
    const fields: ArcherFieldSchema[] = [];

    Object.entries(record).forEach(([fieldName, value]) => {
      // Skip metadata fields
      if (fieldName.startsWith('@') || fieldName.startsWith('__')) {
        return;
      }

      // Skip empty/null fields for now (they might be inactive)
      const hasValue = value !== null && value !== undefined && value !== '';
      
      const field: ArcherFieldSchema = {
        name: fieldName,
        type: this.inferFieldType(value),
        nullable: value === null || value === undefined,
        isActive: hasValue, // Consider fields with data as active
      };

      // Add max length for strings
      if (field.type === 'string' && typeof value === 'string') {
        field.maxLength = value.length;
      }

      fields.push(field);
    });

    return fields;
  }

  /**
   * Infer field type from sample value
   */
  private inferFieldType(value: any): ArcherFieldSchema['type'] {
    if (value === null || value === undefined) {
      return 'string'; // Default for null values
    }

    // Date detection
    if (typeof value === 'string' && this.isDateString(value)) {
      return 'date';
    }

    // Number detection
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '')) {
      return 'number';
    }

    // Boolean detection
    if (typeof value === 'boolean' || (typeof value === 'string' && (value.toLowerCase() === 'true' || value.toLowerCase() === 'false'))) {
      return 'boolean';
    }

    // Reference detection (objects with id/name patterns)
    if (typeof value === 'object' && value !== null && ('Id' in value || 'Name' in value)) {
      return 'reference';
    }

    // Default to string
    return 'string';
  }

  /**
   * Check if a string represents a date
   */
  private isDateString(value: string): boolean {
    // Check for common date patterns
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO 8601
      /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /^\d{1,2}\/\d{1,2}\/\d{4}/, // MM/DD/YYYY or M/D/YYYY
      /^\d{1,2}-\d{1,2}-\d{4}/, // MM-DD-YYYY or M-D-YYYY
    ];

    return datePatterns.some(pattern => pattern.test(value)) && !isNaN(Date.parse(value));
  }

  /**
   * Clear cache for testing/debugging
   */
  clearCache(): void {
    this.schemaCache.clear();
    this.availableEndpoints.clear();
    console.log('[Schema] Cache cleared');
  }
}

// Singleton instance
export const dynamicSchemaManager = new DynamicSchemaManager();