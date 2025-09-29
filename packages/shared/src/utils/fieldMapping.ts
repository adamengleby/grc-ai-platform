/**
 * Standardized Field Mapping Utility
 *
 * This utility provides consistent transformation between database schema (snake_case)
 * and frontend interface (camelCase) for all configuration types.
 *
 * Critical for production stability - ensures no configuration data is lost
 * during API transformations.
 */

export interface FieldMappingConfig {
  dbField: string;
  frontendField: string;
  transform?: {
    toFrontend?: (value: any) => any;
    toDatabase?: (value: any) => any;
  };
}

/**
 * LLM Configuration Field Mappings
 */
export const LLM_CONFIG_FIELD_MAPPINGS: FieldMappingConfig[] = [
  { dbField: 'config_id', frontendField: 'id' },
  { dbField: 'tenant_id', frontendField: 'tenantId' },
  { dbField: 'name', frontendField: 'name' },
  { dbField: 'description', frontendField: 'description' },
  { dbField: 'provider', frontendField: 'provider' },
  { dbField: 'model', frontendField: 'model' },
  { dbField: 'endpoint_vault_secret', frontendField: 'endpoint' },
  {
    dbField: 'api_key_vault_secret',
    frontendField: 'apiKey',
    transform: {
      toFrontend: (value) => value || '',
      toDatabase: (value) => value || null
    }
  },
  { dbField: 'max_tokens', frontendField: 'maxTokens' },
  { dbField: 'temperature', frontendField: 'temperature' },
  { dbField: 'rate_limit', frontendField: 'rateLimit' },
  {
    dbField: 'is_enabled',
    frontendField: 'isEnabled',
    transform: {
      toFrontend: (value) => Boolean(value),
      toDatabase: (value) => value ? 1 : 0
    }
  },
  {
    dbField: 'is_default',
    frontendField: 'isDefault',
    transform: {
      toFrontend: (value) => Boolean(value),
      toDatabase: (value) => value ? 1 : 0
    }
  },
  { dbField: 'created_at', frontendField: 'createdAt' },
  { dbField: 'updated_at', frontendField: 'updatedAt' },
  { dbField: 'last_tested_at', frontendField: 'lastTested' },
  { dbField: 'last_test_status', frontendField: 'lastTestStatus' },
  { dbField: 'usage_count', frontendField: 'usageCount' },
  { dbField: 'total_tokens_used', frontendField: 'totalTokensUsed' },
  {
    dbField: 'custom_headers',
    frontendField: 'customHeaders',
    transform: {
      toFrontend: (value) => {
        if (!value) return undefined;
        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
          return undefined;
        }
      },
      toDatabase: (value) => {
        if (!value || Object.keys(value).length === 0) return null;
        return JSON.stringify(value);
      }
    }
  }
];

/**
 * Agent Configuration Field Mappings
 */
export const AGENT_CONFIG_FIELD_MAPPINGS: FieldMappingConfig[] = [
  { dbField: 'agent_id', frontendField: 'id' },
  { dbField: 'tenant_id', frontendField: 'tenantId' },
  { dbField: 'name', frontendField: 'name' },
  { dbField: 'description', frontendField: 'description' },
  { dbField: 'persona', frontendField: 'persona' },
  { dbField: 'system_prompt', frontendField: 'systemPrompt' },
  { dbField: 'llm_config_id', frontendField: 'llmConfigId' },
  {
    dbField: 'enabled_mcp_servers',
    frontendField: 'enabledMcpServers',
    transform: {
      toFrontend: (value) => {
        if (!value) return [];
        try {
          return typeof value === 'string' ? JSON.parse(value) : (Array.isArray(value) ? value : []);
        } catch {
          return [];
        }
      },
      toDatabase: (value) => {
        if (!Array.isArray(value)) return '[]';
        return JSON.stringify(value);
      }
    }
  },
  {
    dbField: 'capabilities',
    frontendField: 'capabilities',
    transform: {
      toFrontend: (value) => {
        if (!value) return [];
        try {
          return typeof value === 'string' ? JSON.parse(value) : (Array.isArray(value) ? value : []);
        } catch {
          return [];
        }
      },
      toDatabase: (value) => {
        if (!Array.isArray(value)) return '[]';
        return JSON.stringify(value);
      }
    }
  },
  { dbField: 'use_case', frontendField: 'useCase' },
  { dbField: 'avatar', frontendField: 'avatar' },
  { dbField: 'color', frontendField: 'color' },
  {
    dbField: 'is_enabled',
    frontendField: 'isEnabled',
    transform: {
      toFrontend: (value) => Boolean(value),
      toDatabase: (value) => value ? 1 : 0
    }
  },
  { dbField: 'usage_count', frontendField: 'usageCount' },
  { dbField: 'created_at', frontendField: 'createdAt' },
  { dbField: 'updated_at', frontendField: 'updatedAt' },
  { dbField: 'created_by_user_id', frontendField: 'createdBy' },
  { dbField: 'last_modified_by', frontendField: 'lastModifiedBy' },
  { dbField: 'last_used_at', frontendField: 'lastUsedAt' }
];

/**
 * MCP Configuration Field Mappings
 */
export const MCP_CONFIG_FIELD_MAPPINGS: FieldMappingConfig[] = [
  { dbField: 'id', frontendField: 'tenantServerId' },
  { dbField: 'tenant_id', frontendField: 'tenantId' },
  { dbField: 'server_id', frontendField: 'serverId' },
  {
    dbField: 'is_enabled',
    frontendField: 'isEnabled',
    transform: {
      toFrontend: (value) => Boolean(value),
      toDatabase: (value) => value ? 1 : 0
    }
  },
  { dbField: 'custom_name', frontendField: 'customName' },
  {
    dbField: 'configuration_values',
    frontendField: 'configurationValues',
    transform: {
      toFrontend: (value) => {
        if (!value) return {};
        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
          return {};
        }
      },
      toDatabase: (value) => {
        if (!value || Object.keys(value).length === 0) return '{}';
        return JSON.stringify(value);
      }
    }
  },
  {
    dbField: 'allowed_tools',
    frontendField: 'allowedTools',
    transform: {
      toFrontend: (value) => {
        if (!value) return [];
        try {
          return typeof value === 'string' ? JSON.parse(value) : (Array.isArray(value) ? value : []);
        } catch {
          return [];
        }
      },
      toDatabase: (value) => {
        if (!Array.isArray(value)) return '[]';
        return JSON.stringify(value);
      }
    }
  },
  { dbField: 'usage_count', frontendField: 'usageCount' },
  { dbField: 'health_status', frontendField: 'healthStatus' },
  { dbField: 'last_health_check', frontendField: 'lastHealthCheck' },
  { dbField: 'enabled_at', frontendField: 'enabledAt' },
  { dbField: 'enabled_by_user_id', frontendField: 'enabledBy' },
  { dbField: 'created_at', frontendField: 'createdAt' },
  { dbField: 'updated_at', frontendField: 'updatedAt' },
  // Registry fields (when joined)
  { dbField: 'name', frontendField: 'serverName' },
  { dbField: 'display_name', frontendField: 'displayName' },
  { dbField: 'description', frontendField: 'description' },
  { dbField: 'category', frontendField: 'category' },
  { dbField: 'server_type', frontendField: 'serverType' },
  {
    dbField: 'available_tools',
    frontendField: 'availableTools',
    transform: {
      toFrontend: (value) => {
        if (!value) return [];
        try {
          return typeof value === 'string' ? JSON.parse(value) : (Array.isArray(value) ? value : []);
        } catch {
          return [];
        }
      },
      toDatabase: (value) => {
        if (!Array.isArray(value)) return '[]';
        return JSON.stringify(value);
      }
    }
  },
  {
    dbField: 'is_approved',
    frontendField: 'isApproved',
    transform: {
      toFrontend: (value) => Boolean(value),
      toDatabase: (value) => value ? 1 : 0
    }
  },
  { dbField: 'security_review_status', frontendField: 'securityReviewStatus' }
];

/**
 * Core Field Mapping Functions
 */
export class FieldMapper {
  /**
   * Transform database record to frontend format
   */
  static transformToFrontend<T = any>(
    record: Record<string, any>,
    mappings: FieldMappingConfig[]
  ): T {
    const transformed: Record<string, any> = {};

    for (const mapping of mappings) {
      const dbValue = record[mapping.dbField];

      if (dbValue !== undefined && dbValue !== null) {
        let frontendValue = dbValue;

        // Apply transformation if defined
        if (mapping.transform?.toFrontend) {
          frontendValue = mapping.transform.toFrontend(dbValue);
        }

        transformed[mapping.frontendField] = frontendValue;
      } else if (mapping.frontendField === 'isEnabled' || mapping.frontendField === 'isDefault' || mapping.frontendField === 'isApproved') {
        // Ensure boolean fields always have a value
        transformed[mapping.frontendField] = false;
      } else if (mapping.frontendField === 'enabledMcpServers' || mapping.frontendField === 'capabilities' || mapping.frontendField === 'allowedTools' || mapping.frontendField === 'availableTools') {
        // Ensure array fields always have a value
        transformed[mapping.frontendField] = [];
      } else if (mapping.frontendField === 'configurationValues' || mapping.frontendField === 'customHeaders') {
        // Ensure object fields always have a value
        transformed[mapping.frontendField] = {};
      }
    }

    return transformed as T;
  }

  /**
   * Transform frontend data to database format
   */
  static transformToDatabase(
    data: Record<string, any>,
    mappings: FieldMappingConfig[]
  ): Record<string, any> {
    const transformed: Record<string, any> = {};

    for (const mapping of mappings) {
      const frontendValue = data[mapping.frontendField];

      if (frontendValue !== undefined) {
        let dbValue = frontendValue;

        // Apply transformation if defined
        if (mapping.transform?.toDatabase) {
          dbValue = mapping.transform.toDatabase(frontendValue);
        }

        transformed[mapping.dbField] = dbValue;
      }
    }

    return transformed;
  }

  /**
   * Create partial update object for database (only includes changed fields)
   */
  static createPartialUpdate(
    updates: Record<string, any>,
    mappings: FieldMappingConfig[]
  ): Record<string, any> {
    const dbUpdates: Record<string, any> = {};

    for (const [frontendField, value] of Object.entries(updates)) {
      const mapping = mappings.find(m => m.frontendField === frontendField);

      if (mapping) {
        let dbValue = value;

        if (mapping.transform?.toDatabase) {
          dbValue = mapping.transform.toDatabase(value);
        }

        dbUpdates[mapping.dbField] = dbValue;
      }
    }

    return dbUpdates;
  }

  /**
   * Validate that all required fields are present
   */
  static validateRequiredFields(
    data: Record<string, any>,
    requiredFields: string[]
  ): { isValid: boolean; missingFields: string[] } {
    const missingFields = requiredFields.filter(field =>
      data[field] === undefined || data[field] === null || data[field] === ''
    );

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Get field mapping by frontend field name
   */
  static getMappingByFrontendField(
    frontendField: string,
    mappings: FieldMappingConfig[]
  ): FieldMappingConfig | undefined {
    return mappings.find(m => m.frontendField === frontendField);
  }

  /**
   * Get field mapping by database field name
   */
  static getMappingByDbField(
    dbField: string,
    mappings: FieldMappingConfig[]
  ): FieldMappingConfig | undefined {
    return mappings.find(m => m.dbField === dbField);
  }
}

/**
 * Configuration-specific transformers
 */
export class LLMConfigMapper {
  static toFrontend<T = any>(record: Record<string, any>): T {
    return FieldMapper.transformToFrontend<T>(record, LLM_CONFIG_FIELD_MAPPINGS);
  }

  static toDatabase(data: Record<string, any>): Record<string, any> {
    return FieldMapper.transformToDatabase(data, LLM_CONFIG_FIELD_MAPPINGS);
  }

  static createPartialUpdate(updates: Record<string, any>): Record<string, any> {
    return FieldMapper.createPartialUpdate(updates, LLM_CONFIG_FIELD_MAPPINGS);
  }

  static validateCreate(data: Record<string, any>): { isValid: boolean; missingFields: string[] } {
    return FieldMapper.validateRequiredFields(data, ['name', 'provider', 'model', 'endpoint']);
  }
}

export class AgentConfigMapper {
  static toFrontend<T = any>(record: Record<string, any>): T {
    return FieldMapper.transformToFrontend<T>(record, AGENT_CONFIG_FIELD_MAPPINGS);
  }

  static toDatabase(data: Record<string, any>): Record<string, any> {
    return FieldMapper.transformToDatabase(data, AGENT_CONFIG_FIELD_MAPPINGS);
  }

  static createPartialUpdate(updates: Record<string, any>): Record<string, any> {
    return FieldMapper.createPartialUpdate(updates, AGENT_CONFIG_FIELD_MAPPINGS);
  }

  static validateCreate(data: Record<string, any>): { isValid: boolean; missingFields: string[] } {
    return FieldMapper.validateRequiredFields(data, ['name', 'systemPrompt']);
  }
}

export class MCPConfigMapper {
  static toFrontend<T = any>(record: Record<string, any>): T {
    return FieldMapper.transformToFrontend<T>(record, MCP_CONFIG_FIELD_MAPPINGS);
  }

  static toDatabase(data: Record<string, any>): Record<string, any> {
    return FieldMapper.transformToDatabase(data, MCP_CONFIG_FIELD_MAPPINGS);
  }

  static createPartialUpdate(updates: Record<string, any>): Record<string, any> {
    return FieldMapper.createPartialUpdate(updates, MCP_CONFIG_FIELD_MAPPINGS);
  }

  static validateEnable(data: Record<string, any>): { isValid: boolean; missingFields: string[] } {
    return FieldMapper.validateRequiredFields(data, ['serverId']);
  }
}

/**
 * Utility functions for testing field mapping consistency
 */
export class FieldMappingValidator {
  /**
   * Test round-trip transformation (database -> frontend -> database)
   */
  static testRoundTrip(
    originalDbRecord: Record<string, any>,
    mappings: FieldMappingConfig[]
  ): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Transform to frontend
      const frontendData = FieldMapper.transformToFrontend(originalDbRecord, mappings);

      // Transform back to database
      const backToDb = FieldMapper.transformToDatabase(frontendData, mappings);

      // Compare critical fields
      for (const mapping of mappings) {
        const originalValue = originalDbRecord[mapping.dbField];
        const roundTripValue = backToDb[mapping.dbField];

        // Skip undefined/null comparisons for optional fields
        if (originalValue === undefined || originalValue === null) {
          continue;
        }

        // Special handling for different data types
        if (mapping.transform) {
          // For transformed fields, we mainly care that they don't crash
          if (roundTripValue === undefined && originalValue !== undefined) {
            errors.push(`Field ${mapping.dbField} lost during round-trip transformation`);
          }
        } else if (originalValue !== roundTripValue) {
          errors.push(`Field ${mapping.dbField} value changed: ${originalValue} → ${roundTripValue}`);
        }
      }

    } catch (error) {
      errors.push(`Round-trip transformation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      success: errors.length === 0,
      errors
    };
  }

  /**
   * Validate that all required mappings exist
   */
  static validateMappings(mappings: FieldMappingConfig[]): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    const dbFields = new Set<string>();
    const frontendFields = new Set<string>();

    for (const mapping of mappings) {
      // Check for duplicate database fields
      if (dbFields.has(mapping.dbField)) {
        errors.push(`Duplicate database field mapping: ${mapping.dbField}`);
      }
      dbFields.add(mapping.dbField);

      // Check for duplicate frontend fields
      if (frontendFields.has(mapping.frontendField)) {
        errors.push(`Duplicate frontend field mapping: ${mapping.frontendField}`);
      }
      frontendFields.add(mapping.frontendField);

      // Validate transformation functions
      if (mapping.transform) {
        if (mapping.transform.toFrontend && typeof mapping.transform.toFrontend !== 'function') {
          errors.push(`Invalid toFrontend transform for ${mapping.dbField}`);
        }
        if (mapping.transform.toDatabase && typeof mapping.transform.toDatabase !== 'function') {
          errors.push(`Invalid toDatabase transform for ${mapping.dbField}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      errors
    };
  }
}

export default FieldMapper;