// Configuration template system for MCP servers
export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  connectionType: ConnectionType;
  fields: ConfigField[];
  validation?: ValidationRule[];
  testEndpoint?: string;
  defaultValues?: Record<string, any>;
}

export type ConnectionType = 
  | 'rest-api'
  | 'database'
  | 'file-system' 
  | 'archer-grc'
  | 'servicenow'
  | 'jira'
  | 'custom';

export interface ConfigField {
  id: string;
  name: string;
  label: string;
  description?: string;
  type: FieldType;
  required: boolean;
  sensitive?: boolean; // For credentials, API keys
  placeholder?: string;
  defaultValue?: any;
  options?: SelectOption[];
  validation?: FieldValidation[];
  dependsOn?: string; // Field ID that this field depends on
  showWhen?: ShowCondition;
  group?: string; // For grouping related fields
}

export type FieldType = 
  | 'text'
  | 'password'
  | 'url'
  | 'email'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi-select'
  | 'textarea'
  | 'json'
  | 'key-value';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface FieldValidation {
  type: 'required' | 'min' | 'max' | 'pattern' | 'url' | 'email' | 'json' | 'custom';
  value?: any;
  message: string;
}

export interface ShowCondition {
  fieldId: string;
  operator: '=' | '!=' | 'in' | 'not-in';
  value: any;
}

export interface ValidationRule {
  id: string;
  type: 'field' | 'cross-field' | 'async';
  message: string;
  validate: (values: Record<string, any>) => boolean | Promise<boolean>;
}

export interface ServerConfiguration {
  id: string;
  serverId: string;
  tenantId: string;
  templateId: string;
  name: string;
  values: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastTested?: string;
  testStatus?: 'success' | 'failed' | 'pending';
  testError?: string;
}

export interface ConfigurationTest {
  templateId: string;
  values: Record<string, any>;
  testType: 'connection' | 'authentication' | 'full';
}

export interface TestResult {
  success: boolean;
  message: string;
  details?: any;
  responseTime?: number;
  timestamp: string;
}

// Predefined configuration templates for different connection types
export const CONFIG_TEMPLATES: Record<string, ConfigTemplate> = {
  'rest-api': {
    id: 'rest-api',
    name: 'REST API Connection',
    description: 'Generic REST API connection with authentication',
    version: '1.0.0',
    connectionType: 'rest-api',
    fields: [
      {
        id: 'baseUrl',
        name: 'baseUrl',
        label: 'Base URL',
        description: 'The base URL for the API endpoint',
        type: 'url',
        required: true,
        placeholder: 'https://api.example.com',
        validation: [
          { type: 'required', message: 'Base URL is required' },
          { type: 'url', message: 'Must be a valid URL' }
        ],
        group: 'connection'
      },
      {
        id: 'authType',
        name: 'authType',
        label: 'Authentication Type',
        description: 'How to authenticate with the API',
        type: 'select',
        required: true,
        options: [
          { value: 'none', label: 'None' },
          { value: 'api-key', label: 'API Key' },
          { value: 'bearer', label: 'Bearer Token' },
          { value: 'basic', label: 'Basic Auth' },
          { value: 'oauth2', label: 'OAuth 2.0' }
        ],
        defaultValue: 'api-key',
        group: 'authentication'
      },
      {
        id: 'apiKey',
        name: 'apiKey',
        label: 'API Key',
        description: 'Your API key for authentication',
        type: 'password',
        required: true,
        sensitive: true,
        placeholder: 'Enter your API key',
        showWhen: {
          fieldId: 'authType',
          operator: '=',
          value: 'api-key'
        },
        group: 'authentication'
      },
      {
        id: 'apiKeyHeader',
        name: 'apiKeyHeader',
        label: 'API Key Header',
        description: 'Header name for the API key',
        type: 'text',
        required: false,
        defaultValue: 'X-API-Key',
        showWhen: {
          fieldId: 'authType',
          operator: '=',
          value: 'api-key'
        },
        group: 'authentication'
      },
      {
        id: 'bearerToken',
        name: 'bearerToken',
        label: 'Bearer Token',
        description: 'Bearer token for authentication',
        type: 'password',
        required: true,
        sensitive: true,
        placeholder: 'Enter bearer token',
        showWhen: {
          fieldId: 'authType',
          operator: '=',
          value: 'bearer'
        },
        group: 'authentication'
      },
      {
        id: 'username',
        name: 'username',
        label: 'Username',
        description: 'Username for basic authentication',
        type: 'text',
        required: true,
        showWhen: {
          fieldId: 'authType',
          operator: '=',
          value: 'basic'
        },
        group: 'authentication'
      },
      {
        id: 'password',
        name: 'password',
        label: 'Password',
        description: 'Password for basic authentication',
        type: 'password',
        required: true,
        sensitive: true,
        showWhen: {
          fieldId: 'authType',
          operator: '=',
          value: 'basic'
        },
        group: 'authentication'
      },
      {
        id: 'timeout',
        name: 'timeout',
        label: 'Request Timeout (seconds)',
        description: 'Timeout for API requests in seconds',
        type: 'number',
        required: false,
        defaultValue: 30,
        validation: [
          { type: 'min', value: 1, message: 'Timeout must be at least 1 second' },
          { type: 'max', value: 300, message: 'Timeout cannot exceed 300 seconds' }
        ],
        group: 'advanced'
      },
      {
        id: 'rateLimit',
        name: 'rateLimit',
        label: 'Rate Limit (requests/minute)',
        description: 'Maximum requests per minute',
        type: 'number',
        required: false,
        defaultValue: 60,
        validation: [
          { type: 'min', value: 1, message: 'Rate limit must be at least 1' }
        ],
        group: 'advanced'
      },
      {
        id: 'customHeaders',
        name: 'customHeaders',
        label: 'Custom Headers',
        description: 'Additional headers to include with requests',
        type: 'key-value',
        required: false,
        group: 'advanced'
      }
    ],
    testEndpoint: '/health',
    defaultValues: {
      timeout: 30,
      rateLimit: 60,
      authType: 'api-key',
      apiKeyHeader: 'X-API-Key'
    }
  },

  'database': {
    id: 'database',
    name: 'Database Connection',
    description: 'Database connection for SQL and NoSQL databases',
    version: '1.0.0',
    connectionType: 'database',
    fields: [
      {
        id: 'dbType',
        name: 'dbType',
        label: 'Database Type',
        description: 'Type of database to connect to',
        type: 'select',
        required: true,
        options: [
          { value: 'postgresql', label: 'PostgreSQL' },
          { value: 'mysql', label: 'MySQL' },
          { value: 'mssql', label: 'SQL Server' },
          { value: 'oracle', label: 'Oracle' },
          { value: 'mongodb', label: 'MongoDB' },
          { value: 'redis', label: 'Redis' }
        ],
        group: 'connection'
      },
      {
        id: 'host',
        name: 'host',
        label: 'Host',
        description: 'Database server hostname or IP address',
        type: 'text',
        required: true,
        placeholder: 'localhost',
        validation: [
          { type: 'required', message: 'Host is required' }
        ],
        group: 'connection'
      },
      {
        id: 'port',
        name: 'port',
        label: 'Port',
        description: 'Database server port',
        type: 'number',
        required: true,
        defaultValue: 5432,
        validation: [
          { type: 'required', message: 'Port is required' },
          { type: 'min', value: 1, message: 'Port must be greater than 0' },
          { type: 'max', value: 65535, message: 'Port must be less than 65536' }
        ],
        group: 'connection'
      },
      {
        id: 'database',
        name: 'database',
        label: 'Database Name',
        description: 'Name of the database to connect to',
        type: 'text',
        required: true,
        validation: [
          { type: 'required', message: 'Database name is required' }
        ],
        group: 'connection'
      },
      {
        id: 'username',
        name: 'username',
        label: 'Username',
        description: 'Database username',
        type: 'text',
        required: true,
        validation: [
          { type: 'required', message: 'Username is required' }
        ],
        group: 'authentication'
      },
      {
        id: 'password',
        name: 'password',
        label: 'Password',
        description: 'Database password',
        type: 'password',
        required: true,
        sensitive: true,
        validation: [
          { type: 'required', message: 'Password is required' }
        ],
        group: 'authentication'
      },
      {
        id: 'ssl',
        name: 'ssl',
        label: 'Use SSL',
        description: 'Enable SSL/TLS encryption',
        type: 'boolean',
        required: false,
        defaultValue: true,
        group: 'security'
      },
      {
        id: 'connectionString',
        name: 'connectionString',
        label: 'Custom Connection String',
        description: 'Override with custom connection string (optional)',
        type: 'textarea',
        required: false,
        placeholder: 'postgresql://username:password@host:port/database',
        group: 'advanced'
      }
    ]
  },

  'archer-grc': {
    id: 'archer-grc',
    name: 'RSA Archer GRC',
    description: 'RSA Archer GRC Platform integration',
    version: '2.1.0',
    connectionType: 'archer-grc',
    fields: [
      {
        id: 'instanceUrl',
        name: 'instanceUrl',
        label: 'Archer Instance URL',
        description: 'Your Archer GRC instance URL',
        type: 'url',
        required: true,
        placeholder: 'https://your-company.archer.rsa.com',
        validation: [
          { type: 'required', message: 'Instance URL is required' },
          { type: 'url', message: 'Must be a valid URL' }
        ],
        group: 'connection'
      },
      {
        id: 'authMode',
        name: 'authMode',
        label: 'Authentication Mode',
        description: 'How to authenticate with Archer',
        type: 'select',
        required: true,
        options: [
          { value: 'windows', label: 'Windows Authentication' },
          { value: 'archer', label: 'Archer Authentication' },
          { value: 'saml', label: 'SAML SSO' }
        ],
        defaultValue: 'archer',
        group: 'authentication'
      },
      {
        id: 'username',
        name: 'username',
        label: 'Username',
        description: 'Your Archer username',
        type: 'text',
        required: true,
        showWhen: {
          fieldId: 'authMode',
          operator: 'in',
          value: ['windows', 'archer']
        },
        group: 'authentication'
      },
      {
        id: 'password',
        name: 'password',
        label: 'Password',
        description: 'Your Archer password',
        type: 'password',
        required: true,
        sensitive: true,
        showWhen: {
          fieldId: 'authMode',
          operator: 'in',
          value: ['windows', 'archer']
        },
        group: 'authentication'
      },
      {
        id: 'domain',
        name: 'domain',
        label: 'Domain',
        description: 'Windows domain (for Windows auth)',
        type: 'text',
        required: false,
        showWhen: {
          fieldId: 'authMode',
          operator: '=',
          value: 'windows'
        },
        group: 'authentication'
      },
      {
        id: 'instanceName',
        name: 'instanceName',
        label: 'Instance Name',
        description: 'Archer instance name for session management',
        type: 'text',
        required: true,
        defaultValue: 'Default',
        group: 'connection'
      },
      {
        id: 'apiVersion',
        name: 'apiVersion',
        label: 'API Version',
        description: 'Archer API version to use',
        type: 'select',
        required: true,
        options: [
          { value: '6.5', label: 'Version 6.5' },
          { value: '6.6', label: 'Version 6.6' },
          { value: '6.7', label: 'Version 6.7' },
          { value: '6.8', label: 'Version 6.8' },
          { value: '6.9', label: 'Version 6.9' }
        ],
        defaultValue: '6.9',
        group: 'advanced'
      },
      {
        id: 'enableAuditTrail',
        name: 'enableAuditTrail',
        label: 'Enable Audit Trail',
        description: 'Track all data access for compliance',
        type: 'boolean',
        required: false,
        defaultValue: true,
        group: 'compliance'
      }
    ],
    testEndpoint: '/api/core/system/info'
  },

  'servicenow': {
    id: 'servicenow',
    name: 'ServiceNow',
    description: 'ServiceNow platform integration',
    version: '1.8.0',
    connectionType: 'servicenow',
    fields: [
      {
        id: 'instanceName',
        name: 'instanceName',
        label: 'Instance Name',
        description: 'Your ServiceNow instance name',
        type: 'text',
        required: true,
        placeholder: 'your-company',
        validation: [
          { type: 'required', message: 'Instance name is required' }
        ],
        group: 'connection'
      },
      {
        id: 'username',
        name: 'username',
        label: 'Username',
        description: 'ServiceNow username',
        type: 'text',
        required: true,
        group: 'authentication'
      },
      {
        id: 'password',
        name: 'password',
        label: 'Password',
        description: 'ServiceNow password',
        type: 'password',
        required: true,
        sensitive: true,
        group: 'authentication'
      },
      {
        id: 'apiVersion',
        name: 'apiVersion',
        label: 'API Version',
        description: 'ServiceNow API version',
        type: 'select',
        required: true,
        options: [
          { value: 'v1', label: 'Version 1' },
          { value: 'v2', label: 'Version 2' }
        ],
        defaultValue: 'v2',
        group: 'advanced'
      }
    ]
  },

  'jira': {
    id: 'jira-integration',
    name: 'Jira Integration',
    description: 'Atlassian Jira integration',
    version: '1.3.0',
    connectionType: 'jira',
    fields: [
      {
        id: 'baseUrl',
        name: 'baseUrl',
        label: 'Jira Base URL',
        description: 'Your Jira instance URL',
        type: 'url',
        required: true,
        placeholder: 'https://your-company.atlassian.net',
        validation: [
          { type: 'required', message: 'Base URL is required' },
          { type: 'url', message: 'Must be a valid URL' }
        ],
        group: 'connection'
      },
      {
        id: 'authType',
        name: 'authType',
        label: 'Authentication Type',
        description: 'How to authenticate with Jira',
        type: 'select',
        required: true,
        options: [
          { value: 'basic', label: 'Basic Auth' },
          { value: 'token', label: 'API Token' },
          { value: 'oauth', label: 'OAuth 2.0' }
        ],
        defaultValue: 'token',
        group: 'authentication'
      },
      {
        id: 'email',
        name: 'email',
        label: 'Email',
        description: 'Your Jira account email',
        type: 'email',
        required: true,
        showWhen: {
          fieldId: 'authType',
          operator: 'in',
          value: ['basic', 'token']
        },
        group: 'authentication'
      },
      {
        id: 'apiToken',
        name: 'apiToken',
        label: 'API Token',
        description: 'Jira API token',
        type: 'password',
        required: true,
        sensitive: true,
        showWhen: {
          fieldId: 'authType',
          operator: '=',
          value: 'token'
        },
        group: 'authentication'
      }
    ]
  }
};