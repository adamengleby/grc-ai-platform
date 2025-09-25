/**
 * Centralized Tools Registry
 * 
 * Single source of truth for all MCP tool definitions.
 * Used by both the MCP server and HTTP wrapper to eliminate duplication.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Extended tool interface for HTTP wrapper with server metadata
 */
export interface ExtendedTool extends Tool {
  serverId?: string;
}

/**
 * All available tools for the Archer GRC MCP server
 */
const tools: Tool[] = [
  {
    name: 'get_archer_applications',
    description: 'List ALL active Archer applications and questionnaires available for analysis. IMPORTANT: This tool returns complete listings - never truncate or show partial results. Always display every application and questionnaire returned by this tool.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'search_archer_records',
    description: 'Search and retrieve records from a specific Archer application with privacy protection and field transformation. Returns structured JSON by default for better data analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        applicationName: {
          type: 'string',
          description: 'Name or alias of the Archer application'
        },
        pageSize: {
          type: 'number',
          description: 'Number of records to return (1-10000, default: 100)',
          minimum: 1,
          maximum: 10000
        },
        pageNumber: {
          type: 'number',
          description: 'Page number for pagination (1-based, default: 1)',
          minimum: 1
        },
        includeFullData: {
          type: 'boolean',
          description: 'Whether to retrieve all records for comprehensive analysis (default: false for pagination)',
          default: false
        },
        responseFormat: {
          type: 'string',
          enum: ['json', 'text'],
          description: 'Response format - json for structured data (default), text for formatted output',
          default: 'json'
        }
      },
      required: ['applicationName']
    }
  },
  {
    name: 'get_archer_stats',
    description: 'Get statistical analysis and counts for Archer applications and records',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        }
      },
      required: []
    }
  },
  {
    name: 'test_archer_connection',
    description: 'Test connectivity and authentication with Archer GRC platform',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        }
      },
      required: []
    }
  },
  {
    name: 'debug_archer_api',
    description: 'Debug Archer API calls and troubleshoot connection issues',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        debugLevel: {
          type: 'string',
          description: 'Debug level (basic, detailed, verbose)'
        }
      },
      required: []
    }
  },
  {
    name: 'get_application_fields',
    description: 'Get detailed field definitions and metadata for an Archer application',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        applicationName: {
          type: 'string',
          description: 'Name or alias of the Archer application'
        }
      },
      required: ['applicationName']
    }
  },
  {
    name: 'get_top_records',
    description: 'Get top records from an application based on specified criteria',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        applicationName: {
          type: 'string',
          description: 'Name or alias of the Archer application'
        },
        sortBy: {
          type: 'string',
          description: 'Field to sort by'
        },
        limit: {
          type: 'number',
          description: 'Number of top records to return'
        }
      },
      required: ['applicationName']
    }
  },
  {
    name: 'find_record_by_id',
    description: 'Find and retrieve a specific record by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        applicationName: {
          type: 'string',
          description: 'Name or alias of the Archer application'
        },
        recordId: {
          type: 'string',
          description: 'ID of the record to retrieve'
        }
      },
      required: ['applicationName', 'recordId']
    }
  },
  {
    name: 'get_datafeeds',
    description: 'Get comprehensive information about all Archer datafeeds including schedules, status, and configuration. Returns structured JSON by default for better data analysis. Use this first to identify datafeeds, then analyze patterns for schedule anomalies, inactive feeds, or configuration issues. After getting the list, automatically investigate failed or problematic datafeeds using get_datafeed_history.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        responseFormat: {
          type: 'string',
          enum: ['json', 'text'],
          description: 'Response format - json for structured data (default), text for formatted output',
          default: 'json'
        }
      },
      required: []
    }
  },
  {
    name: 'get_datafeed_history',
    description: 'Get detailed execution history for a specific datafeed to analyze run patterns, success rates, and timing anomalies. Use this to investigate scheduling irregularities, identify failure patterns, determine if runs are happening on expected schedules, and spot performance degradation trends. For failed runs, follow up with get_datafeed_history_messages for error details.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        datafeedGuid: {
          type: 'string',
          description: 'GUID of the data feed (obtained from get_datafeeds results)'
        }
      },
      required: ['datafeedGuid']
    }
  },
  {
    name: 'get_datafeed_history_messages',
    description: 'Get detailed error messages, warnings, and logs from specific datafeed execution runs. Use this to diagnose root causes of failures, understand processing issues, identify data quality problems, and provide specific remediation recommendations. Essential for troubleshooting failed or problematic datafeed runs.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        historyId: {
          type: 'string',
          description: 'History ID from get_datafeed_history results (e.g., "657614")'
        }
      },
      required: ['historyId']
    }
  },
  {
    name: 'check_datafeed_health',
    description: 'Get comprehensive health status overview of all Archer datafeeds including current state, last run results, and basic error information. Use this for an initial health assessment, then perform deeper analysis using get_datafeed_history and get_datafeed_history_messages to investigate patterns, anomalies, and root causes.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        }
      },
      required: []
    }
  },
  {
    name: 'get_security_events',
    description: 'Get security events and audit information from Archer',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        eventType: {
          type: 'string',
          description: 'Type of security events to retrieve'
        },
        timeRange: {
          type: 'string',
          description: 'Time range for events (e.g., 24h, 7d, 30d)'
        }
      },
      required: []
    }
  },
  {
    name: 'generate_security_events_report',
    description: 'Generate a comprehensive report of all security events for analysis',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        instanceName: {
          type: 'string',
          description: 'Archer instance name'
        },
        eventType: {
          type: 'string',
          description: 'Type of security events',
          default: 'all events'
        },
        timeRange: {
          type: 'string',
          description: 'Time range like "5d", "30d", "last 7 days"'
        },
        maxEvents: {
          type: 'number',
          description: 'Maximum events to include',
          default: 100
        }
      },
      required: []
    }
  },
  {
    name: 'manage_record_workflow',
    description: 'Advanced record lifecycle management with workflow orchestration. Supports multi-step record operations, conditional workflow logic, batch processing, state management, and rollback capabilities. Use this for complex record workflows that require multiple operations, validation steps, or coordinated updates across multiple records.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        workflowType: {
          type: 'string',
          enum: ['create_chain', 'update_chain', 'validation_workflow', 'batch_process'],
          description: 'Type of workflow to execute: create_chain (create record with dependent updates), update_chain (sequential field updates), validation_workflow (validate and correct records), batch_process (process multiple records)'
        },
        applicationId: {
          type: 'string',
          description: 'Archer application ID or name where workflow will be executed'
        },
        workflowSteps: {
          type: 'array',
          description: 'Ordered array of workflow steps to execute',
          items: {
            type: 'object',
            properties: {
              stepType: {
                type: 'string',
                enum: ['create', 'update', 'validate', 'delete', 'field_update', 'relationship_update'],
                description: 'Type of operation for this workflow step'
              },
              recordIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Record IDs to process in this step (for update/delete operations)'
              },
              fieldData: {
                type: 'object',
                description: 'Field data for create/update operations'
              },
              validationRules: {
                type: 'array',
                items: { type: 'object' },
                description: 'Validation rules for this step'
              },
              onFailure: {
                type: 'string',
                enum: ['continue', 'stop', 'rollback'],
                description: 'Action to take if this step fails'
              }
            },
            required: ['stepType']
          }
        },
        conditions: {
          type: 'array',
          description: 'Optional conditional rules for workflow execution',
          items: {
            type: 'object',
            properties: {
              condition: {
                type: 'string',
                description: 'Condition expression (e.g., "field_123 == \'High\'")'
              },
              thenSteps: {
                type: 'array',
                items: { type: 'number' },
                description: 'Workflow step indices to execute if condition is true'
              },
              elseSteps: {
                type: 'array',
                items: { type: 'number' },
                description: 'Workflow step indices to execute if condition is false'
              }
            },
            required: ['condition', 'thenSteps']
          }
        },
        rollbackOnFailure: {
          type: 'boolean',
          description: 'Whether to rollback all changes if any step fails',
          default: true
        },
        batchSize: {
          type: 'number',
          description: 'Number of records to process in each batch (for batch_process type)',
          default: 10
        },
        trackProgress: {
          type: 'boolean',
          description: 'Whether to provide detailed progress tracking',
          default: true
        }
      },
      required: ['workflowType', 'applicationId', 'workflowSteps']
    }
  },
  {
    name: 'populate_record_fields',
    description: 'Intelligent field population engine with AI-driven mapping and business rules. Supports cross-reference auto-population from related records, template-based field population for common record types, calculated field updates based on multiple field sources, validation-driven population to meet requirements, and bulk field operations across multiple records. Use this to reduce manual data entry and ensure field consistency across records.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        populationType: {
          type: 'string',
          enum: ['cross_reference', 'template', 'calculated', 'validation_fix', 'bulk_update', 'smart_defaults'],
          description: 'Type of field population: cross_reference (populate from related records), template (apply field templates), calculated (compute values from multiple sources), validation_fix (populate to meet validation), bulk_update (update multiple records), smart_defaults (intelligent default values)'
        },
        applicationId: {
          type: 'string',
          description: 'Archer application ID or name where field population will occur'
        },
        targetRecordIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Record IDs to populate fields for'
        },
        sourceRecordIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Source record IDs for cross-reference population (optional)'
        },
        fieldMappingRules: {
          type: 'array',
          description: 'Rules for mapping and populating fields',
          items: {
            type: 'object',
            properties: {
              targetFieldId: {
                type: 'string',
                description: 'Field ID to populate'
              },
              sourceFieldId: {
                type: 'string',
                description: 'Source field ID for data (for cross_reference type)'
              },
              populationRule: {
                type: 'string',
                enum: ['copy_value', 'calculate_sum', 'calculate_average', 'calculate_max', 'calculate_min', 'concatenate', 'lookup_value', 'conditional_value', 'default_value'],
                description: 'Rule for how to populate the field'
              },
              calculationExpression: {
                type: 'string',
                description: 'Mathematical or logical expression for calculated fields (e.g., "field_123 + field_456")'
              },
              conditionalLogic: {
                type: 'object',
                properties: {
                  condition: { type: 'string' },
                  trueValue: { type: 'string' },
                  falseValue: { type: 'string' }
                },
                description: 'Conditional logic for field population'
              },
              defaultValue: {
                type: 'string',
                description: 'Default value to use'
              },
              validationCriteria: {
                type: 'array',
                items: { type: 'object' },
                description: 'Validation rules the populated field must meet'
              }
            },
            required: ['targetFieldId', 'populationRule']
          }
        },
        templateId: {
          type: 'string',
          description: 'Template ID for template-based population (optional)'
        },
        templateConfiguration: {
          type: 'object',
          description: 'Template configuration for field population',
          properties: {
            recordType: {
              type: 'string',
              description: 'Type of record (e.g., "incident", "risk", "control")'
            },
            severity: {
              type: 'string',
              description: 'Severity level for template selection'
            },
            category: {
              type: 'string',
              description: 'Category for template selection'
            }
          }
        },
        batchSize: {
          type: 'number',
          description: 'Number of records to process in each batch for bulk operations',
          default: 25
        },
        validateAfterPopulation: {
          type: 'boolean',
          description: 'Whether to validate fields after population',
          default: true
        },
        overwriteExisting: {
          type: 'boolean',
          description: 'Whether to overwrite existing field values',
          default: false
        },
        trackChanges: {
          type: 'boolean',
          description: 'Whether to track and report all field changes made',
          default: true
        }
      },
      required: ['populationType', 'applicationId', 'targetRecordIds', 'fieldMappingRules']
    }
  },
  {
    name: 'manage_field_cache',
    description: 'Manage the Archer field caching system - view cache statistics, refresh cache, or clear cache entries for debugging and performance optimization',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        action: {
          type: 'string',
          enum: ['stats', 'refresh', 'clear', 'invalidate'],
          description: 'Action to perform: stats (show cache statistics), refresh (refresh specific application cache), clear (clear all caches), invalidate (invalidate specific application cache)'
        },
        applicationId: {
          type: 'number',
          description: 'Application ID for refresh/invalidate actions (optional for stats/clear)'
        },
        applicationName: {
          type: 'string',  
          description: 'Application name for refresh/invalidate actions (optional if applicationId provided)'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'test_schema_discovery',
    description: 'Test tool for discovering ContentAPI schemas and endpoints. Tests metadata endpoint, endpoints list, or sample-based schema discovery.',
    inputSchema: {
      type: 'object',
      properties: {
        test_type: {
          type: 'string',
          description: 'Type of test to run: metadata, endpoints, or sample',
          enum: ['metadata', 'endpoints', 'sample']
        },
        application_id: {
          type: 'number',
          description: 'Application ID to test (required for sample test)'
        },
        application_name: {
          type: 'string', 
          description: 'Application name (required for sample test)'
        },
        content_api_path: {
          type: 'string',
          description: 'ContentAPI path (required for sample test)'
        },
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        }
      },
      required: ['test_type']
    }
  },
  {
    name: 'get_archer_users',
    description: 'List and search Archer GRC users with filtering capabilities. Returns comprehensive user information including account status, roles, contact details, and login history. Use this to identify users for account management, security audits, role assignments, or compliance reviews. Supports search by name, username, email, and filtering by account status.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        searchTerm: {
          type: 'string',
          description: 'Search term to filter users by name, username, or email'
        },
        statusFilter: {
          type: 'string',
          enum: ['active', 'inactive', 'locked', 'deleted'],
          description: 'Filter users by account status'
        },
        roleFilter: {
          type: 'string',
          description: 'Filter users by role name or ID'
        },
        pageSize: {
          type: 'number',
          description: 'Number of users to return per page (default: 50 for balanced AI processing, use 0 or >100 for all users, e.g., pageSize: 1000)'
        },
        pageNumber: {
          type: 'number',
          description: 'Page number for pagination (starts at 1)'
        },
        responseFormat: {
          type: 'string',
          enum: ['json'],
          default: 'json',
          description: 'Response format - standardized JSON format for all MCP responses'
        }
      },
      required: []
    }
  },
  {
    name: 'get_archer_user_details',
    description: 'Get comprehensive details for a specific Archer GRC user including personal information, contact details, roles, groups, and security settings. Use this for detailed user profile reviews, security investigations, role audits, or when preparing user account reports. Essential for compliance reviews and access management.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        userId: {
          oneOf: [
            { type: 'string' },
            { type: 'number' }
          ],
          description: 'User ID or username to retrieve details for'
        },
        responseFormat: {
          type: 'string',
          enum: ['json'],
          default: 'json',
          description: 'Response format - standardized JSON format for all MCP responses'
        }
      },
      required: ['userId']
    }
  },

  // Phase 1 - Core User Management Tools
  {
    name: 'update_user_status',
    description: 'Update user account status in Archer GRC (activate, deactivate, or lock accounts). Essential for security management, user lifecycle operations, compliance enforcement, and access control. Use this to immediately change user access status for security incidents, employee changes, or compliance requirements.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        userId: {
          oneOf: [
            { type: 'string' },
            { type: 'number' }
          ],
          description: 'User ID or username to update status for'
        },
        newStatus: {
          type: 'string',
          enum: ['active', 'inactive', 'locked'],
          description: 'New status for the user account (active: enable access, inactive: disable access, locked: security lockout)'
        },
        reason: {
          type: 'string',
          description: 'Optional reason for the status change (for audit trail and compliance)'
        },
        responseFormat: {
          type: 'string',
          enum: ['json'],
          default: 'json',
          description: 'Response format - standardized JSON format for all MCP responses'
        }
      },
      required: ['userId', 'newStatus']
    }
  },
  {
    name: 'get_user_roles',
    description: 'List all available user roles in the Archer GRC system. Returns comprehensive role information including permissions, descriptions, and active status. Use this to understand role structure, plan role assignments, audit role configurations, or support compliance reviews. Essential for access management and role-based security analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        responseFormat: {
          type: 'string',
          enum: ['json'],
          default: 'json',
          description: 'Response format - standardized JSON format for all MCP responses'
        }
      },
      required: []
    }
  },
  {
    name: 'assign_user_roles',
    description: 'Assign roles to a user in Archer GRC system. Supports both additive role assignment (adding to existing roles) and replacement mode (replacing all current roles). Critical for access management, permission changes, role-based compliance, and user onboarding/offboarding processes.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        userId: {
          oneOf: [
            { type: 'string' },
            { type: 'number' }
          ],
          description: 'User ID or username to assign roles to'
        },
        roleIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of role IDs to assign to the user (get role IDs from get_user_roles tool)'
        },
        replaceExisting: {
          type: 'boolean',
          default: false,
          description: 'Whether to replace all existing roles (true) or add to existing roles (false, default)'
        },
        responseFormat: {
          type: 'string',
          enum: ['json'],
          default: 'json',
          description: 'Response format - standardized JSON format for all MCP responses'
        }
      },
      required: ['userId', 'roleIds']
    }
  },
  {
    name: 'get_user_groups',
    description: 'List all available user groups in the Archer GRC system. Returns comprehensive group information including member counts, descriptions, and active status. Use this to understand group structure, plan group assignments, audit group configurations, or support compliance reviews. Essential for access management and group-based security analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        responseFormat: {
          type: 'string',
          enum: ['json'],
          default: 'json',
          description: 'Response format - standardized JSON format for all MCP responses'
        }
      },
      required: []
    }
  },
  {
    name: 'assign_user_groups',
    description: 'Assign groups to a user in Archer GRC system. Supports both additive group assignment (adding to existing groups) and replacement mode (replacing all current groups). Critical for access management, team assignments, organizational structure management, and user onboarding/offboarding processes.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant_id: {
          type: 'string',
          description: 'Tenant identifier for data scoping'
        },
        userId: {
          oneOf: [
            { type: 'string' },
            { type: 'number' }
          ],
          description: 'User ID or username to assign groups to'
        },
        groupIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of group IDs to assign to the user (get group IDs from get_user_groups tool)'
        },
        replaceExisting: {
          type: 'boolean',
          default: false,
          description: 'Whether to replace all existing groups (true) or add to existing groups (false, default)'
        },
        responseFormat: {
          type: 'string',
          enum: ['json'],
          default: 'json',
          description: 'Response format - standardized JSON format for all MCP responses'
        }
      },
      required: ['userId', 'groupIds']
    }
  }
];

/**
 * Get all tools
 */
export function getAllTools(): Tool[] {
  return tools;
}

/**
 * Get all tools with server metadata for HTTP wrapper
 */
export function getAllToolsForHTTP(): ExtendedTool[] {
  return tools.map(tool => ({
    ...tool,
    serverId: 'archer-grc-server'
  }));
}

/**
 * Get a specific tool by name
 */
export function getToolByName(name: string): Tool | undefined {
  return tools.find(tool => tool.name === name);
}

/**
 * Get tool names
 */
export function getToolNames(): string[] {
  return tools.map(tool => tool.name);
}

/**
 * Check if a tool exists
 */
export function hasToolByName(name: string): boolean {
  return tools.some(tool => tool.name === name);
}

/**
 * Get tools count
 */
export function getToolsCount(): number {
  return tools.length;
}

/**
 * Get tools by category (for potential future organization)
 */
export function getToolsByCategory(): { [category: string]: Tool[] } {
  return {
    core: tools.filter(tool => 
      ['get_archer_applications', 'search_archer_records', 'get_archer_stats'].includes(tool.name)
    ),
    analysis: tools.filter(tool => 
      ['populate_record_fields', 'manage_record_workflow'].includes(tool.name)
    ),
    diagnostics: tools.filter(tool => 
      ['test_archer_connection', 'debug_archer_api', 'test_schema_discovery'].includes(tool.name)
    ),
    metadata: tools.filter(tool => 
      ['get_application_fields', 'get_top_records', 'find_record_by_id'].includes(tool.name)
    ),
    datafeeds: tools.filter(tool => 
      ['get_datafeeds', 'get_datafeed_history', 'get_datafeed_history_messages', 'check_datafeed_health'].includes(tool.name)
    ),
    security: tools.filter(tool => 
      ['get_security_events', 'generate_security_events_report'].includes(tool.name)
    ),
    workflow: tools.filter(tool => 
      ['manage_record_workflow', 'populate_record_fields'].includes(tool.name)
    ),
    users: tools.filter(tool => 
      ['get_archer_users', 'get_archer_user_details'].includes(tool.name)
    )
  };
}