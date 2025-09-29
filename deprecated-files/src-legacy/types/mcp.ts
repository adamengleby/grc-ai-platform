// MCP server and agent definitions based on platform architecture
export interface McpServer {
  id: string;
  name: string;
  description: string;
  version: string;
  provider: string;
  category: 'GRC' | 'Security' | 'Analytics' | 'Integration';
  status: 'active' | 'deprecated' | 'beta';
  tools: McpTool[];
  requirements: McpRequirement[];
  healthStatus: HealthStatus;
}

export interface McpTool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permissions: string[];
  riskLevel: 'low' | 'medium' | 'high';
  complianceImpact: string[];
}

export interface McpRequirement {
  type: 'credential' | 'endpoint' | 'permission';
  key: string;
  description: string;
  required: boolean;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  responseTime: number;
  errorCount: number;
  uptime: number;
}

export interface AgentConfiguration {
  tenantId: string;
  agentId: string;
  name: string;
  description: string;
  enabledTools: string[];
  llmConfig: LlmConfiguration;
  auditLevel: 'basic' | 'enhanced' | 'full';
  rateLimits: RateLimits;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LlmConfiguration {
  provider: 'azure-openai' | 'openai' | 'anthropic' | 'custom';
  model: string;
  temperature: number;
  maxTokens: number;
  endpoint?: string; // For BYO LLM
  apiKeyVaultRef?: string; // Key Vault reference
}

export interface RateLimits {
  requestsPerMinute: number;
  tokensPerHour: number;
  dailyBudget: number;
}

export interface McpQuery {
  id: string;
  tenantId: string;
  agentId: string;
  query: string;
  response?: McpResponse;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: string;
  userId: string;
}

export interface McpResponse {
  content: string;
  confidence: number;
  toolsUsed: string[];
  evidence: Evidence[];
  complianceFlags: ComplianceFlag[];
  tokenUsage: TokenUsage;
}

export interface Evidence {
  source: string;
  excerpt: string;
  relevanceScore: number;
  metadata: Record<string, unknown>;
}

export interface ComplianceFlag {
  framework: string;
  rule: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

// MCP Server types for proper architecture
export interface McpServerDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  vendor: string;
  endpoint: string;
  capabilities: string[];
  supportedConnections: string[];
  globallyApproved: boolean;
  costTier: 'free' | 'standard' | 'premium';
  minimumTier: 'starter' | 'professional' | 'enterprise';
  documentation: {
    description: string;
    capabilities: Array<{
      name: string;
      description: string;
      examples: string[];
    }>;
    apiReference: string;
  };
  tags: string[];
  lastUpdated: string;
  healthEndpoint: string;
}

export interface TenantMcpServerConfiguration {
  id: string;
  tenantId: string; // Partition key
  serverId: string;
  enabled: boolean;
  enabledAt?: string;
  connectionMapping: {
    connectionId: string; // Primary connection for this server
    connectionType: string;
    fallbackConnectionIds?: string[]; // Optional backup connections
  };
  serverConfig: {
    rateLimits: {
      requestsPerMinute: number;
      tokensPerDay: number;
    };
    timeout: number;
    retryPolicy: {
      maxRetries: number;
      backoffMs: number;
    };
  };
  allowedUsers: string[];
  restrictedRoles: string[];
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  usage: {
    totalRequests: number;
    totalTokens: number;
    lastUsed?: string;
    errorCount: number;
    averageResponseTime: number;
  };
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastHealthCheck?: string;
}

// Extended types for tenant-isolated tool catalog (legacy - tools are now managed by servers)
export interface McpToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'risk' | 'compliance' | 'control' | 'insight' | 'data' | 'reporting';
  version: string;
  vendor: string;
  globallyApproved: boolean;
  approvedScopes: string[];
  requiredConnections: ConnectionRequirement[];
  costTier: 'free' | 'standard' | 'premium';
  inputSchema: any; // JSON Schema
  outputSchema: any; // JSON Schema
  rateLimits: {
    defaultCallsPerMinute: number;
    defaultTokensPerDay: number;
  };
  documentation: {
    description: string;
    examples: Array<{
      name: string;
      input: any;
      output: any;
    }>;
    parameters: Array<{
      name: string;
      type: string;
      required: boolean;
      description: string;
    }>;
  };
  tags: string[];
  lastUpdated: string;
  minimumTier: 'starter' | 'professional' | 'enterprise';
}

export interface ConnectionRequirement {
  type: 'archer' | 'api' | 'database';
  name: string;
  description: string;
  required: boolean;
}

export interface TenantMcpToolConfiguration {
  id: string;
  tenantId: string; // Partition key
  toolId: string;
  enabled: boolean;
  enabledAt?: string;
  customParameters: Record<string, any>;
  connectionMappings: Array<{
    requirementName: string;
    connectionId: string; // Must belong to same tenant
    connectionType: string;
  }>;
  rateLimits: {
    callsPerMinute: number;
    tokensPerDay: number;
  };
  allowedUsers: string[]; // User IDs within tenant (empty = all users)
  restrictedRoles: string[]; // Roles that can use this tool
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  usage: {
    totalCalls: number;
    totalTokens: number;
    lastUsed?: string;
    errorCount: number;
  };
}

export interface McpToolUsage {
  tenantId: string;
  toolId: string;
  userId: string;
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  executionTimeMs: number;
  success: boolean;
  error?: string;
  connectionId?: string;
}

export interface McpToolCatalogFilter {
  category?: string;
  costTier?: string;
  enabledOnly?: boolean;
  searchQuery?: string;
  tags?: string[];
}

export interface McpToolExecutionRequest {
  toolId: string;
  inputs: Record<string, any>;
  connectionOverrides?: Record<string, string>;
}

export interface McpToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    executionTimeMs: number;
  };
  metadata: {
    toolId: string;
    tenantId: string;
    userId: string;
    timestamp: string;
  };
}

// Analytics and cost tracking types
export interface McpToolAnalytics {
  tenantId: string;
  toolId: string;
  period: {
    start: string;
    end: string;
  };
  metrics: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalTokens: number;
    totalCost: number;
    averageExecutionTime: number;
    uniqueUsers: number;
  };
  trends: {
    dailyExecutions: Array<{
      date: string;
      executions: number;
      tokens: number;
      cost: number;
    }>;
    errorRate: Array<{
      date: string;
      rate: number;
    }>;
  };
  topUsers: Array<{
    userId: string;
    userName: string;
    executions: number;
    tokens: number;
    cost: number;
  }>;
}

export interface CostCalculation {
  tool: McpToolDefinition;
  usage: McpToolUsage;
  costTiers: {
    free: { maxCalls: number; maxTokens: number; costPerToken: number };
    standard: { maxCalls: number; maxTokens: number; costPerToken: number };
    premium: { maxCalls: number; maxTokens: number; costPerToken: number };
  };
}

export interface TenantUsageSummary {
  tenantId: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalCost: number;
    totalTokens: number;
    totalExecutions: number;
    enabledTools: number;
    mostUsedTool: string;
    costByTier: {
      free: number;
      standard: number;
      premium: number;
    };
  };
  toolBreakdown: Array<{
    toolId: string;
    toolName: string;
    executions: number;
    tokens: number;
    cost: number;
    errorRate: number;
  }>;
  alerts: Array<{
    type: 'budget_exceeded' | 'rate_limit_approached' | 'high_error_rate';
    severity: 'low' | 'medium' | 'high';
    message: string;
    recommendation: string;
  }>;
}