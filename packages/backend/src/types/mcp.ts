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
  serverId?: string; // Server that provides this tool
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

export interface McpToolExecutionRequest {
  toolName: string;
  arguments: Record<string, any>;
  tenantId: string;
  agentId?: string;
  connectionId: string;
  credentials?: any;
  enabledMcpServers?: string[];
}

export interface McpToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  toolName: string;
  serverId: string;
  agentId?: string;
  processingTime: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    executionTimeMs: number;
  };
}

export interface McpServerHealth {
  serverId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime: number;
  lastCheck: string;
  error?: string;
  endpoint: string;
}