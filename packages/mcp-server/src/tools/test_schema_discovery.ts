/**
 * Test tool for schema discovery functionality
 * Tests ContentAPI $metadata and endpoints discovery
 */

import { dynamicSchemaManager } from '../services/dynamicSchemaManager.js';

export class TestSchemaDiscoveryTool {
  name = 'test_schema_discovery';
  description = 'Test tool for discovering ContentAPI schemas and endpoints';

  inputSchema = {
    type: 'object',
    properties: {
      test_type: {
        type: 'string',
        description: 'Type of test to run: metadata, endpoints, sample, or validate',
        enum: ['metadata', 'endpoints', 'sample', 'validate']
      },
      application_id: {
        type: 'number',
        description: 'Application ID to test (required for sample test)',
        optional: true
      },
      application_name: {
        type: 'string', 
        description: 'Application name (required for sample test)',
        optional: true
      },
      content_api_path: {
        type: 'string',
        description: 'ContentAPI path (required for sample test)',
        optional: true
      }
    },
    required: ['test_type']
  };

  async execute(args: any): Promise<any> {
    const { test_type, application_id, application_name, content_api_path } = args;
    
    console.log(`[Test Schema] Running ${test_type} test`);

    try {
      // Get connection from args (since we don't extend BaseArcherTool)
      const connection = {
        baseUrl: args.archer_connection?.baseUrl || 'https://hostplus-dev.archerirm.com.au',
        sessionToken: args.archer_connection?.sessionToken,
        instanceId: args.archer_connection?.instanceId || '710101'
      };
      
      const tenantId = args.tenant_id || 'default-tenant';

      switch (test_type) {
        case 'metadata':
          return await this.testMetadataDiscovery(connection, tenantId);
          
        case 'endpoints':
          return await this.testEndpointsDiscovery(connection, tenantId);
          
        case 'sample':
          if (!application_id || !application_name || !content_api_path) {
            throw new Error('sample test requires application_id, application_name, and content_api_path');
          }
          return await this.testSampleDiscovery(
            application_id, 
            application_name, 
            content_api_path, 
            connection, 
            tenantId
          );
          
        case 'validate':
          if (!application_id || !application_name || !content_api_path) {
            throw new Error('validate test requires application_id, application_name, and content_api_path');
          }
          return await this.testSchemaValidation(
            application_id, 
            application_name, 
            content_api_path, 
            connection, 
            tenantId
          );
          
        default:
          throw new Error(`Unknown test type: ${test_type}`);
      }

    } catch (error) {
      console.error(`[Test Schema] ${test_type} test failed:`, error);
      return {
        success: false,
        test_type,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test metadata endpoint discovery
   */
  private async testMetadataDiscovery(connection: any, tenantId: string) {
    console.log('[Test Schema] Testing /contentapi/$metadata endpoint');

    // First test if endpoint is accessible
    const metadataUrl = `${connection.baseUrl}/contentapi/$metadata`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Archer session-id="${connection.sessionToken}"`,
        'Accept': '*/*'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const responseText = await response.text();
    const isXml = responseText.trim().startsWith('<');
    const isJson = responseText.trim().startsWith('{') || responseText.trim().startsWith('[');

    return {
      success: response.ok,
      test_type: 'metadata',
      status_code: response.status,
      status_text: response.statusText,
      content_type: response.headers.get('content-type'),
      response_format: isXml ? 'xml' : isJson ? 'json' : 'unknown',
      response_size: responseText.length,
      response_preview: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test endpoints discovery
   */
  private async testEndpointsDiscovery(connection: any, tenantId: string) {
    console.log('[Test Schema] Testing /contentapi endpoint for available applications');

    const endpointsUrl = `${connection.baseUrl}/contentapi`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(endpointsUrl, {
      headers: {
        'Authorization': `Archer session-id="${connection.sessionToken}"`,
        'Accept': '*/*'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const responseText = await response.text();
    const isXml = responseText.trim().startsWith('<');
    const isJson = responseText.trim().startsWith('{') || responseText.trim().startsWith('[');

    return {
      success: response.ok,
      test_type: 'endpoints',
      status_code: response.status,
      status_text: response.statusText,
      content_type: response.headers.get('content-type'),
      response_format: isXml ? 'xml' : isJson ? 'json' : 'unknown',
      response_size: responseText.length,
      response_preview: responseText.substring(0, 1000) + (responseText.length > 1000 ? '...' : ''),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test sample-based schema discovery
   */
  private async testSampleDiscovery(
    applicationId: number,
    applicationName: string,
    contentApiPath: string,
    connection: any,
    tenantId: string
  ) {
    console.log(`[Test Schema] Testing sample-based schema discovery for ${applicationName}`);

    const schema = await dynamicSchemaManager.getApplicationSchema(
      applicationId,
      applicationName,
      contentApiPath,
      connection,
      tenantId
    );

    return {
      success: true,
      test_type: 'sample',
      application_id: applicationId,
      application_name: applicationName,
      content_api_path: contentApiPath,
      schema: {
        fields_count: schema.fields.length,
        active_fields: schema.fields.filter(f => f.isActive).length,
        field_types: schema.fields.reduce((acc, field) => {
          acc[field.type] = (acc[field.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        sample_fields: schema.fields.slice(0, 10).map(f => ({
          name: f.name,
          type: f.type,
          nullable: f.nullable,
          isActive: f.isActive
        })),
        schema_source: schema.schemaSource,
        last_updated: schema.lastUpdated
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test schema validation against multiple actual records
   */
  private async testSchemaValidation(
    applicationId: number,
    applicationName: string,
    contentApiPath: string,
    connection: any,
    tenantId: string
  ) {
    console.log(`[Test Schema] Validating schema against actual data for ${applicationName}`);

    // Get schema from discovery
    const schema = await dynamicSchemaManager.getApplicationSchema(
      applicationId,
      applicationName,
      contentApiPath,
      connection,
      tenantId
    );

    // Get multiple sample records to validate against
    const sampleUrl = `${connection.baseUrl}${contentApiPath}?$top=10`;
    
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
      throw new Error(`Sample validation request failed: ${response.status} ${response.statusText}`);
    }

    const sampleData: any = await response.json();
    
    if (!sampleData.value || !Array.isArray(sampleData.value) || sampleData.value.length === 0) {
      throw new Error(`No sample data available for validation of ${applicationName}`);
    }

    // Validate schema against actual data
    const validationResults = this.validateSchemaAgainstRecords(schema.fields, sampleData.value);

    return {
      success: true,
      test_type: 'validate',
      application_id: applicationId,
      application_name: applicationName,
      content_api_path: contentApiPath,
      schema_summary: {
        fields_count: schema.fields.length,
        schema_source: schema.schemaSource,
        last_updated: schema.lastUpdated
      },
      validation_results: validationResults,
      sample_records_tested: sampleData.value.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate schema fields against actual record data
   */
  private validateSchemaAgainstRecords(schemaFields: any[], records: any[]) {
    const validationResults = {
      field_coverage: {} as Record<string, any>,
      data_type_mismatches: [] as any[],
      missing_schema_fields: [] as string[],
      extra_data_fields: [] as string[],
      value_analysis: {} as Record<string, any>
    };

    // Get all fields that appear in actual data
    const actualDataFields = new Set<string>();
    records.forEach(record => {
      Object.keys(record).forEach(key => actualDataFields.add(key));
    });

    // Check schema coverage
    const schemaFieldNames = schemaFields.map(f => f.name);
    const schemaFieldSet = new Set(schemaFieldNames);

    // Find missing schema fields (in data but not in schema)
    actualDataFields.forEach(fieldName => {
      if (!schemaFieldSet.has(fieldName) && !fieldName.startsWith('@') && !fieldName.startsWith('__')) {
        validationResults.missing_schema_fields.push(fieldName);
      }
    });

    // Find extra schema fields (in schema but not in data)
    schemaFieldNames.forEach(fieldName => {
      if (!actualDataFields.has(fieldName)) {
        validationResults.extra_data_fields.push(fieldName);
      }
    });

    // Validate each schema field against actual data
    schemaFields.forEach(schemaField => {
      if (actualDataFields.has(schemaField.name)) {
        const fieldAnalysis = this.analyzeFieldValues(schemaField, records);
        validationResults.field_coverage[schemaField.name] = fieldAnalysis;

        // Check for type mismatches
        if (fieldAnalysis.type_mismatches.length > 0) {
          validationResults.data_type_mismatches.push({
            field_name: schemaField.name,
            expected_type: schemaField.type,
            actual_types_found: fieldAnalysis.actual_types,
            sample_mismatches: fieldAnalysis.type_mismatches.slice(0, 3) // First 3 examples
          });
        }
      }
    });

    return validationResults;
  }

  /**
   * Analyze actual field values against schema expectations
   */
  private analyzeFieldValues(schemaField: any, records: any[]) {
    const analysis = {
      field_name: schemaField.name,
      expected_type: schemaField.type,
      actual_types: {} as Record<string, number>,
      type_mismatches: [] as any[],
      value_samples: [] as any[],
      null_count: 0,
      empty_count: 0,
      unique_values: new Set()
    };

    records.forEach((record, index) => {
      const value = record[schemaField.name];
      
      if (value === null || value === undefined) {
        analysis.null_count++;
        return;
      }
      
      if (value === '') {
        analysis.empty_count++;
        return;
      }

      // Track actual type
      const actualType = this.getActualValueType(value);
      analysis.actual_types[actualType] = (analysis.actual_types[actualType] || 0) + 1;

      // Check for type mismatch
      if (!this.doesValueMatchSchemaType(value, schemaField.type)) {
        analysis.type_mismatches.push({
          record_index: index,
          expected: schemaField.type,
          actual: actualType,
          value: this.truncateValue(value)
        });
      }

      // Collect samples (first 10 unique values)
      if (analysis.value_samples.length < 10 && !analysis.unique_values.has(value)) {
        analysis.unique_values.add(value);
        analysis.value_samples.push(this.truncateValue(value));
      }
    });

    // Convert Set to count for response
    const uniqueCount = analysis.unique_values.size;
    delete (analysis as any).unique_values;
    (analysis as any).unique_value_count = uniqueCount;

    return analysis;
  }

  private getActualValueType(value: any): string {
    if (typeof value === 'string') {
      if (this.isDateString(value)) return 'date';
      if (!isNaN(Number(value)) && value.trim() !== '') return 'numeric_string';
      if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') return 'boolean_string';
      return 'string';
    }
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'object' && value !== null) {
      if ('Id' in value || 'Name' in value) return 'reference_object';
      return 'object';
    }
    return 'unknown';
  }

  private doesValueMatchSchemaType(value: any, schemaType: string): boolean {
    const actualType = this.getActualValueType(value);
    
    switch (schemaType) {
      case 'string':
        return ['string', 'numeric_string', 'boolean_string'].includes(actualType);
      case 'number':
        return ['number', 'numeric_string'].includes(actualType);
      case 'date':
        return actualType === 'date';
      case 'boolean':
        return ['boolean', 'boolean_string'].includes(actualType);
      case 'reference':
        return actualType === 'reference_object';
      default:
        return true; // Unknown schema types pass validation
    }
  }

  private isDateString(value: string): boolean {
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO 8601
      /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /^\d{1,2}\/\d{1,2}\/\d{4}/, // MM/DD/YYYY or M/D/YYYY
      /^\d{1,2}-\d{1,2}-\d{4}/, // MM-DD-YYYY or M-D-YYYY
    ];
    return datePatterns.some(pattern => pattern.test(value)) && !isNaN(Date.parse(value));
  }

  private truncateValue(value: any): any {
    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    return value;
  }
}