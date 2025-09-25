/**
 * Response formatting utilities for JSON-first MCP responses
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { 
  ArcherJsonResponse, 
  createArcherJsonResponse, 
  createArcherErrorResponse,
  extractSchemaFromRecords,
  ResponseFormat 
} from '../types/responses.js';

/**
 * Format response based on requested format
 */
export function formatResponse(
  data: any,
  responseFormat: ResponseFormat = 'json',
  metadata: Partial<ArcherJsonResponse['metadata']> = {},
  schema?: ArcherJsonResponse['schema'],
  error?: ArcherJsonResponse['error']
): CallToolResult {
  
  // Always return JSON response - text formatting removed for standardization
  return formatAsJsonResponse(data, metadata, schema, error);
}

/**
 * Format as structured JSON response
 */
function formatAsJsonResponse(
  data: any,
  metadata: Partial<ArcherJsonResponse['metadata']> = {},
  schema?: ArcherJsonResponse['schema'],
  error?: ArcherJsonResponse['error']
): CallToolResult {
  
  const response = createArcherJsonResponse(data, metadata, schema, error);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(response, null, 2)
    }]
  };
}

// Text formatting functions removed - standardized on JSON-only responses

// All text formatting functions removed - using JSON-only responses

// formatFieldValue function removed - no longer needed for JSON-only responses

/**
 * Create error response in requested format
 */
export function formatErrorResponse(
  code: string,
  message: string,
  details?: any,
  responseFormat: ResponseFormat = 'json',
  metadata: Partial<ArcherJsonResponse['metadata']> = {}
): CallToolResult {
  
  // Always return JSON error response - text formatting removed for standardization
  const response = createArcherErrorResponse(code, message, details, metadata);
  
  return {
    content: [{
      type: 'text', 
      text: JSON.stringify(response, null, 2)
    }]
  };
}

/**
 * Enhanced schema extraction with better type detection
 */
export function enhancedSchemaExtraction(
  records: any[],
  metadata: Partial<ArcherJsonResponse['metadata']> = {}
): ArcherJsonResponse['schema'] {
  
  const fields = extractSchemaFromRecords(records);
  
  // Basic relationship detection
  const relationships = fields
    .filter(field => field.isKey && field.alias !== 'Id')
    .map(field => ({
      field: field.alias,
      relationshipType: 'one-to-many' as const
    }));
  
  // Data type mapping
  const dataTypes: Record<string, string> = {};
  fields.forEach(field => {
    dataTypes[field.alias] = field.type;
  });
  
  return {
    fields,
    relationships,
    dataTypes
  };
}