/**
 * Standardized response types for JSON-first MCP tool responses
 */

export interface ArcherJsonResponse {
  success: boolean;
  data: any;  // Raw Archer API response data
  metadata: {
    source: 'live_archer_api' | 'cached_data' | 'mock_data';
    timestamp: string;
    tenantId?: string;
    instanceUrl?: string;
    recordCount?: number;
    pagination?: {
      page: number;
      pageSize: number;
      totalRecords?: number;
      hasMore?: boolean;
    };
    application?: {
      id: number;
      name: string;
      contentApiUrl?: string;
    };
    fields?: {
      totalFields: number;
      mappedFields: number;
      extractedFromRecords: boolean;
    };
  };
  schema?: {
    fields: FieldSchema[];
    relationships: RelationshipSchema[];
    dataTypes: Record<string, string>;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface FieldSchema {
  alias: string;
  name: string;
  type: string;
  id?: number;
  isKey?: boolean;
  isRequired?: boolean;
  isCalculated?: boolean;
  description?: string;
}

export interface RelationshipSchema {
  field: string;
  relatedApplication?: string;
  relatedField?: string;
  relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface DatafeedJsonResponse extends ArcherJsonResponse {
  metadata: ArcherJsonResponse['metadata'] & {
    datafeed?: {
      guid: string;
      name: string;
      status: string;
      lastRun?: string;
      nextRun?: string;
    };
  };
}

export interface ApplicationJsonResponse extends ArcherJsonResponse {
  metadata: ArcherJsonResponse['metadata'] & {
    applications?: {
      total: number;
      active: number;
      inactive: number;
    };
  };
}

/**
 * Response format options for MCP tools
 */
export type ResponseFormat = 'json' | 'text';

/**
 * Base arguments interface that all MCP tools should extend
 */
export interface BaseToolArgs {
  tenant_id?: string;
  responseFormat?: ResponseFormat;
}

/**
 * Helper function to create standardized JSON responses
 */
export function createArcherJsonResponse(
  data: any,
  metadata: Partial<ArcherJsonResponse['metadata']> = {},
  schema?: ArcherJsonResponse['schema'],
  error?: ArcherJsonResponse['error']
): ArcherJsonResponse {
  return {
    success: !error,
    data,
    metadata: {
      source: 'live_archer_api',
      timestamp: new Date().toISOString(),
      ...metadata
    },
    ...(schema && { schema }),
    ...(error && { error })
  };
}

/**
 * Helper function to create error responses
 */
export function createArcherErrorResponse(
  code: string,
  message: string,
  details?: any,
  metadata: Partial<ArcherJsonResponse['metadata']> = {}
): ArcherJsonResponse {
  return createArcherJsonResponse(
    null,
    metadata,
    undefined,
    { code, message, details }
  );
}

/**
 * Helper function to extract schema from records
 */
export function extractSchemaFromRecords(records: any[]): FieldSchema[] {
  if (!records || records.length === 0) return [];

  const fieldMap = new Map<string, FieldSchema>();
  
  records.forEach(record => {
    if (record && typeof record === 'object') {
      Object.keys(record).forEach(fieldKey => {
        if (!fieldMap.has(fieldKey) && !fieldKey.startsWith('__')) {
          const value = record[fieldKey];
          let type = 'text';
          
          if (typeof value === 'number') {
            type = 'numeric';
          } else if (typeof value === 'boolean') {
            type = 'boolean';
          } else if (value && typeof value === 'string') {
            if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
              type = 'date';
            } else if (value.includes('@')) {
              type = 'email';
            } else if (value.length > 100) {
              type = 'text_long';
            }
          }
          
          fieldMap.set(fieldKey, {
            alias: fieldKey,
            name: fieldKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type,
            isKey: fieldKey.toLowerCase().includes('id'),
            isRequired: false,
            isCalculated: false
          });
        }
      });
    }
  });
  
  return Array.from(fieldMap.values());
}