/**
 * Tenant-Scoped MCP Service with Enhanced Security
 * Handles MCP tool management with strict tenant isolation and comprehensive security
 */

import { 
  McpServerDefinition,
  TenantMcpServerConfiguration,
  McpToolDefinition, 
  TenantMcpToolConfiguration, 
  McpToolCatalogFilter,
  McpToolExecutionRequest,
  McpToolExecutionResult,
  McpToolUsage
} from '@/types/mcp';
import { ArcherCredentials } from '@/lib/credentialsApi';
import { tenantValidator, TenantValidationContext } from '@/lib/security/tenantValidator';
import { requestSigner, SignedRequest } from '@/lib/security/requestSigner';
import { securityAuditLogger } from '@/lib/security/auditLogger';
// Enhanced session validator available for future use
// import { enhancedSessionValidator } from '@/lib/security/sessionValidator';

// Global MCP Server Registry - Platform admin managed
const GLOBAL_MCP_SERVERS: McpServerDefinition[] = [
  {
    id: 'archer-mcp-server',
    name: 'Archer GRC MCP Server',
    description: 'Comprehensive MCP server for Archer GRC platform with AI-powered analysis capabilities',
    version: '2.1.0',
    vendor: 'Platform',
    endpoint: 'http://localhost:3001',
    capabilities: [
      'risk_analysis',
      'compliance_assessment', 
      'control_monitoring',
      'executive_reporting',
      'anomaly_detection',
      'trend_analysis'
    ],
    supportedConnections: ['archer'],
    globallyApproved: true,
    costTier: 'standard',
    minimumTier: 'starter',
    documentation: {
      description: 'The Archer MCP Server provides AI agents with comprehensive access to GRC data through a unified interface. AI agents can request risk assessments, compliance checks, and executive insights without needing to manage individual tools.',
      capabilities: [
        {
          name: 'Risk Analysis',
          description: 'Generate comprehensive risk assessments based on current Archer data',
          examples: [
            'Generate quarterly risk assessment for IT department',
            'Analyze emerging risks in supply chain operations',
            'Compare risk profiles across business units'
          ]
        },
        {
          name: 'Compliance Assessment',
          description: 'Evaluate compliance posture against various frameworks',
          examples: [
            'Assess ISO27001 compliance status',
            'Generate CPS230 compliance report',
            'Identify compliance gaps and remediation priorities'
          ]
        },
        {
          name: 'Control Monitoring',
          description: 'Monitor and report on control effectiveness',
          examples: [
            'Evaluate control effectiveness trends',
            'Identify failing or degraded controls',
            'Generate control testing recommendations'
          ]
        },
        {
          name: 'Executive Reporting',
          description: 'Create executive-level insights and dashboards',
          examples: [
            'Generate board-ready risk summary',
            'Create executive compliance dashboard',
            'Produce quarterly GRC metrics report'
          ]
        }
      ],
      apiReference: 'https://docs.platform.com/mcp/archer-server'
    },
    tags: ['grc', 'archer', 'risk', 'compliance', 'ai'],
    lastUpdated: '2025-08-20T00:00:00Z',
    healthEndpoint: '/health'
  }
];

// Individual tools exposed by MCP servers (for reference only)
const MCP_SERVER_TOOLS: McpToolDefinition[] = [
  {
    id: 'archer-risk-assessment',
    name: 'Risk Assessment Generator',
    description: 'Generate comprehensive risk assessments based on Archer data and compliance frameworks',
    category: 'risk',
    version: '1.2.0',
    vendor: 'Platform',
    globallyApproved: true,
    approvedScopes: ['risk:read', 'risk:write', 'archer:read'],
    requiredConnections: [
      {
        type: 'archer',
        name: 'primary_archer',
        description: 'Primary Archer GRC connection for risk data',
        required: true
      }
    ],
    costTier: 'standard',
    inputSchema: {
      type: 'object',
      properties: {
        assessmentType: { type: 'string', enum: ['operational', 'compliance', 'strategic'] },
        businessUnit: { type: 'string' },
        timeFrame: { type: 'string', enum: ['quarterly', 'annual'] }
      },
      required: ['assessmentType']
    },
    outputSchema: {
      type: 'object',
      properties: {
        riskProfile: { type: 'object' },
        recommendations: { type: 'array' },
        complianceGaps: { type: 'array' }
      }
    },
    rateLimits: {
      defaultCallsPerMinute: 10,
      defaultTokensPerDay: 10000
    },
    documentation: {
      description: 'This tool analyzes Archer data to generate comprehensive risk assessments',
      examples: [
        {
          name: 'Operational Risk Assessment',
          input: { assessmentType: 'operational', businessUnit: 'IT', timeFrame: 'quarterly' },
          output: { riskProfile: {}, recommendations: [], complianceGaps: [] }
        }
      ],
      parameters: [
        {
          name: 'assessmentType',
          type: 'string',
          required: true,
          description: 'Type of risk assessment to perform'
        }
      ]
    },
    tags: ['risk', 'assessment', 'compliance'],
    lastUpdated: '2025-08-20T00:00:00Z',
    minimumTier: 'professional'
  },
  {
    id: 'compliance-gap-analysis',
    name: 'Compliance Gap Analysis',
    description: 'Analyze compliance posture and identify gaps across frameworks',
    category: 'compliance',
    version: '1.0.0',
    vendor: 'Platform',
    globallyApproved: true,
    approvedScopes: ['compliance:read', 'archer:read'],
    requiredConnections: [
      {
        type: 'archer',
        name: 'primary_archer',
        description: 'Archer connection for compliance data',
        required: true
      }
    ],
    costTier: 'free',
    inputSchema: {
      type: 'object',
      properties: {
        framework: { type: 'string', enum: ['ISO27001', 'CPS230', 'SOC2', 'GDPR'] },
        scope: { type: 'string' }
      },
      required: ['framework']
    },
    outputSchema: {
      type: 'object',
      properties: {
        gapAnalysis: { type: 'object' },
        priority: { type: 'string' },
        timeline: { type: 'string' }
      }
    },
    rateLimits: {
      defaultCallsPerMinute: 5,
      defaultTokensPerDay: 5000
    },
    documentation: {
      description: 'Analyzes current compliance state against selected framework',
      examples: [
        {
          name: 'ISO27001 Gap Analysis',
          input: { framework: 'ISO27001', scope: 'full' },
          output: { gapAnalysis: {}, priority: 'high', timeline: '6 months' }
        }
      ],
      parameters: [
        {
          name: 'framework',
          type: 'string',
          required: true,
          description: 'Compliance framework to analyze against'
        }
      ]
    },
    tags: ['compliance', 'analysis', 'gap'],
    lastUpdated: '2025-08-20T00:00:00Z',
    minimumTier: 'starter'
  },
  {
    id: 'control-effectiveness',
    name: 'Control Effectiveness Monitor',
    description: 'Monitor and report on control effectiveness across the organization',
    category: 'control',
    version: '2.1.0',
    vendor: 'Platform',
    globallyApproved: true,
    approvedScopes: ['control:read', 'monitoring:read', 'archer:read'],
    requiredConnections: [
      {
        type: 'archer',
        name: 'primary_archer',
        description: 'Archer connection for control data',
        required: true
      }
    ],
    costTier: 'premium',
    inputSchema: {
      type: 'object',
      properties: {
        controlDomain: { type: 'string' },
        period: { type: 'string', enum: ['month', 'quarter', 'year'] },
        includeMetrics: { type: 'boolean' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        effectivenessScore: { type: 'number' },
        trends: { type: 'array' },
        issues: { type: 'array' }
      }
    },
    rateLimits: {
      defaultCallsPerMinute: 5,
      defaultTokensPerDay: 15000
    },
    documentation: {
      description: 'Evaluates control effectiveness and provides trend analysis',
      examples: [
        {
          name: 'IT Controls Effectiveness',
          input: { controlDomain: 'IT', period: 'quarter', includeMetrics: true },
          output: { effectivenessScore: 85, trends: [], issues: [] }
        }
      ],
      parameters: [
        {
          name: 'controlDomain',
          type: 'string',
          required: false,
          description: 'Specific control domain to analyze'
        }
      ]
    },
    tags: ['control', 'monitoring', 'effectiveness'],
    lastUpdated: '2025-08-20T00:00:00Z',
    minimumTier: 'enterprise'
  },
  {
    id: 'executive-insights',
    name: 'Executive Insights Generator',
    description: 'Generate executive-level insights and dashboards from GRC data',
    category: 'insight',
    version: '1.1.0',
    vendor: 'Platform',
    globallyApproved: true,
    approvedScopes: ['insights:read', 'archer:read', 'reporting:read'],
    requiredConnections: [
      {
        type: 'archer',
        name: 'primary_archer',
        description: 'Archer connection for comprehensive data access',
        required: true
      }
    ],
    costTier: 'standard',
    inputSchema: {
      type: 'object',
      properties: {
        reportType: { type: 'string', enum: ['summary', 'detailed', 'trends'] },
        stakeholder: { type: 'string', enum: ['board', 'executive', 'management'] },
        focus: { type: 'array', items: { type: 'string' } }
      },
      required: ['reportType', 'stakeholder']
    },
    outputSchema: {
      type: 'object',
      properties: {
        insights: { type: 'array' },
        metrics: { type: 'object' },
        recommendations: { type: 'array' }
      }
    },
    rateLimits: {
      defaultCallsPerMinute: 3,
      defaultTokensPerDay: 20000
    },
    documentation: {
      description: 'Creates executive-ready insights and recommendations',
      examples: [
        {
          name: 'Board Summary Report',
          input: { reportType: 'summary', stakeholder: 'board', focus: ['risk', 'compliance'] },
          output: { insights: [], metrics: {}, recommendations: [] }
        }
      ],
      parameters: [
        {
          name: 'reportType',
          type: 'string',
          required: true,
          description: 'Type of executive report to generate'
        }
      ]
    },
    tags: ['insights', 'executive', 'reporting'],
    lastUpdated: '2025-08-20T00:00:00Z',
    minimumTier: 'professional'
  }
];

export class TenantScopedMcpService {
  constructor(
    private readonly tenantId: string,
    private readonly userId: string,
    private readonly userRoles: string[]
  ) {
    // Initialize security context on service creation
    this.initializeSecurityContext();
  }

  /**
   * Initialize security context and validate tenant access
   */
  private async initializeSecurityContext(): Promise<void> {
    try {
      await this.validateTenantAccess();
      
      await securityAuditLogger.logEvent(
        'TENANT_ACCESS',
        'INFO',
        this.tenantId,
        this.userId,
        'MCP_SERVICE_INIT',
        'SUCCESS',
        {
          userRoles: this.userRoles,
          serviceType: 'TenantScopedMcpService'
        }
      );
    } catch (error) {
      await securityAuditLogger.logSecurityViolation(
        this.tenantId,
        this.userId,
        'SERVICE_INIT_FAILED',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          serviceType: 'TenantScopedMcpService'
        }
      );
      throw error;
    }
  }

  /**
   * Validate tenant access using security middleware
   */
  private async validateTenantAccess(): Promise<void> {
    const sessionToken = this.getCurrentSessionToken();
    
    const validationContext: TenantValidationContext = {
      userId: this.userId,
      tenantId: this.tenantId,
      userRoles: this.userRoles,
      sessionToken,
      requestTimestamp: Date.now()
    };

    try {
      await tenantValidator.validateTenantAccess(validationContext);
    } catch (error) {
      throw new Error(`Tenant access validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current session token from storage
   */
  private getCurrentSessionToken(): string {
    const storedToken = localStorage.getItem('auth_token');
    if (!storedToken) {
      throw new Error('No valid session token found');
    }
    
    try {
      const parsed = JSON.parse(storedToken);
      return `${parsed.tenantId}.${parsed.userId}.${parsed.exp}`; // Simple token format
    } catch {
      throw new Error('Invalid session token format');
    }
  }

  /**
   * Get globally available MCP servers filtered by tenant subscription tier
   */
  async getAvailableServers(tier: 'starter' | 'professional' | 'enterprise'): Promise<McpServerDefinition[]> {
    // Filter servers by tenant's subscription tier and global approval status
    return GLOBAL_MCP_SERVERS.filter(server => 
      server.globallyApproved && 
      this.isTierAllowed(server.minimumTier, tier)
    );
  }

  /**
   * Get tenant-specific MCP server configurations
   */
  async getEnabledServers(): Promise<TenantMcpServerConfiguration[]> {
    // In production, this would query Cosmos DB with tenant partition
    const stored = localStorage.getItem(`mcp_servers_${this.tenantId}`);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  /**
   * Get globally available tools filtered by tenant subscription tier (legacy support)
   */
  async getAvailableToolsByTier(tier: 'starter' | 'professional' | 'enterprise'): Promise<McpToolDefinition[]> {
    // Legacy method - tools are now managed by servers
    // This is kept for backward compatibility but should be deprecated
    return MCP_SERVER_TOOLS.filter(tool => 
      tool.globallyApproved && 
      this.isTierAllowed(tool.minimumTier, tier)
    );
  }

  /**
   * Get tenant-specific tool configurations
   */
  async getEnabledTools(): Promise<TenantMcpToolConfiguration[]> {
    // In production, this would query Cosmos DB with tenant partition
    const stored = localStorage.getItem(`mcp_tools_${this.tenantId}`);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  /**
   * Enable an MCP server for the tenant
   */
  async enableServer(
    serverId: string,
    connectionId: string,
    config?: Partial<TenantMcpServerConfiguration>
  ): Promise<TenantMcpServerConfiguration> {
    // 1. Verify server is in global registry
    const server = GLOBAL_MCP_SERVERS.find(s => s.id === serverId);
    if (!server || !server.globallyApproved) {
      throw new Error('MCP server not approved for platform use');
    }

    // 2. Check user permissions
    if (!this.hasRole(['TenantOwner'])) {
      throw new Error('Insufficient permissions to enable MCP servers');
    }

    // 3. Validate connection ownership and compatibility
    const connections = await this.getTenantConnections();
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) {
      throw new Error('Connection not found or not accessible');
    }

    // Check if connection type is supported by server
    const connectionType = 'archer'; // Determine from connection
    if (!server.supportedConnections.includes(connectionType)) {
      throw new Error(`Server ${server.name} does not support ${connectionType} connections`);
    }

    // 4. Create tenant-specific server configuration
    const configuration: TenantMcpServerConfiguration = {
      id: `${this.tenantId}_${serverId}_${Date.now()}`,
      tenantId: this.tenantId,
      serverId,
      enabled: true,
      enabledAt: new Date().toISOString(),
      connectionMapping: {
        connectionId,
        connectionType,
        fallbackConnectionIds: config?.connectionMapping?.fallbackConnectionIds || []
      },
      serverConfig: {
        rateLimits: {
          requestsPerMinute: config?.serverConfig?.rateLimits?.requestsPerMinute || 60,
          tokensPerDay: config?.serverConfig?.rateLimits?.tokensPerDay || 100000
        },
        timeout: config?.serverConfig?.timeout || 30000,
        retryPolicy: {
          maxRetries: config?.serverConfig?.retryPolicy?.maxRetries || 3,
          backoffMs: config?.serverConfig?.retryPolicy?.backoffMs || 1000
        }
      },
      allowedUsers: config?.allowedUsers || [],
      restrictedRoles: config?.restrictedRoles || ['AgentUser', 'TenantOwner'],
      createdBy: this.userId,
      createdAt: new Date().toISOString(),
      lastModifiedBy: this.userId,
      lastModifiedAt: new Date().toISOString(),
      usage: {
        totalRequests: 0,
        totalTokens: 0,
        errorCount: 0,
        averageResponseTime: 0
      },
      healthStatus: 'unknown'
    };

    // 5. Store with tenant isolation
    const existingServers = await this.getEnabledServers();
    const updatedServers = existingServers.filter(s => s.serverId !== serverId); // Remove existing
    updatedServers.push(configuration);
    
    localStorage.setItem(`mcp_servers_${this.tenantId}`, JSON.stringify(updatedServers));

    // 6. Audit log
    console.log(`MCP Server ${serverId} enabled for tenant ${this.tenantId} by user ${this.userId}`);

    return configuration;
  }

  /**
   * Disable an MCP server for the tenant
   */
  async disableServer(serverId: string): Promise<void> {
    if (!this.hasRole(['TenantOwner'])) {
      throw new Error('Insufficient permissions to disable MCP servers');
    }

    const existingServers = await this.getEnabledServers();
    const updatedServers = existingServers.filter(s => s.serverId !== serverId);
    
    localStorage.setItem(`mcp_servers_${this.tenantId}`, JSON.stringify(updatedServers));
    
    console.log(`MCP Server ${serverId} disabled for tenant ${this.tenantId} by user ${this.userId}`);
  }

  /**
   * Enable a tool for the tenant (legacy method)
   */
  async enableTool(
    toolId: string, 
    config: Partial<TenantMcpToolConfiguration>
  ): Promise<TenantMcpToolConfiguration> {
    // 1. Verify tool is in global registry
    const tool = MCP_SERVER_TOOLS.find(t => t.id === toolId);
    if (!tool || !tool.globallyApproved) {
      throw new Error('Tool not approved for platform use');
    }

    // 2. Check user permissions
    if (!this.hasRole(['TenantOwner'])) {
      throw new Error('Insufficient permissions to enable tools');
    }

    // 3. Validate connection ownership (would be implemented in production)
    for (const mapping of config.connectionMappings || []) {
      // In production: verify connection belongs to tenant
      console.log(`Validating connection ${mapping.connectionId} for tenant ${this.tenantId}`);
    }

    // 4. Create tenant-specific configuration
    const configuration: TenantMcpToolConfiguration = {
      id: `${this.tenantId}_${toolId}_${Date.now()}`,
      tenantId: this.tenantId,
      toolId,
      enabled: true,
      enabledAt: new Date().toISOString(),
      customParameters: config.customParameters || {},
      connectionMappings: config.connectionMappings || [],
      rateLimits: config.rateLimits || {
        callsPerMinute: tool.rateLimits.defaultCallsPerMinute,
        tokensPerDay: tool.rateLimits.defaultTokensPerDay
      },
      allowedUsers: config.allowedUsers || [],
      restrictedRoles: config.restrictedRoles || [],
      createdBy: this.userId,
      createdAt: new Date().toISOString(),
      lastModifiedBy: this.userId,
      lastModifiedAt: new Date().toISOString(),
      usage: {
        totalCalls: 0,
        totalTokens: 0,
        errorCount: 0
      }
    };

    // 5. Store with tenant isolation
    const existingTools = await this.getEnabledTools();
    const updatedTools = existingTools.filter(t => t.toolId !== toolId); // Remove existing
    updatedTools.push(configuration);
    
    localStorage.setItem(`mcp_tools_${this.tenantId}`, JSON.stringify(updatedTools));

    // 6. Audit log (would be implemented in production)
    console.log(`Tool ${toolId} enabled for tenant ${this.tenantId} by user ${this.userId}`);

    return configuration;
  }

  /**
   * Disable a tool for the tenant
   */
  async disableTool(toolId: string): Promise<void> {
    if (!this.hasRole(['TenantOwner'])) {
      throw new Error('Insufficient permissions to disable tools');
    }

    const existingTools = await this.getEnabledTools();
    const updatedTools = existingTools.filter(t => t.toolId !== toolId);
    
    localStorage.setItem(`mcp_tools_${this.tenantId}`, JSON.stringify(updatedTools));
    
    console.log(`Tool ${toolId} disabled for tenant ${this.tenantId} by user ${this.userId}`);
  }

  /**
   * Update tool configuration
   */
  async updateToolConfiguration(
    toolId: string, 
    updates: Partial<TenantMcpToolConfiguration>
  ): Promise<TenantMcpToolConfiguration> {
    if (!this.hasRole(['TenantOwner'])) {
      throw new Error('Insufficient permissions to update tool configuration');
    }

    const existingTools = await this.getEnabledTools();
    const toolIndex = existingTools.findIndex(t => t.toolId === toolId);
    
    if (toolIndex === -1) {
      throw new Error('Tool not enabled for tenant');
    }

    const updatedTool = {
      ...existingTools[toolIndex],
      ...updates,
      lastModifiedBy: this.userId,
      lastModifiedAt: new Date().toISOString()
    };

    existingTools[toolIndex] = updatedTool;
    localStorage.setItem(`mcp_tools_${this.tenantId}`, JSON.stringify(existingTools));

    return updatedTool;
  }

  /**
   * Get available connections for the tenant
   */
  async getTenantConnections(): Promise<ArcherCredentials[]> {
    try {
      // Import and configure credentials manager with tenant context
      const { credentialsManager } = await import('./credentialsApi');
      
      // Set tenant context for secure partitioning
      credentialsManager.setTenantContext(this.tenantId);
      
      // Initialize if needed
      try {
        await credentialsManager.initialize();
      } catch (error) {
        console.warn('Credentials manager initialization failed:', error);
        return [];
      }
      
      // Load tenant-specific credentials
      return await credentialsManager.loadCredentials();
    } catch (error) {
      console.error('Failed to load tenant connections:', error);
      return [];
    }
  }

  /**
   * Load secure credentials for a specific connection
   */
  async loadConnectionCredentials(connectionId: string): Promise<any> {
    try {
      // Import and configure credentials manager with tenant context
      const { credentialsManager } = await import('./credentialsApi');
      credentialsManager.setTenantContext(this.tenantId);
      
      // Load all tenant connections and find the specific one
      const connections = await credentialsManager.loadCredentials();
      const connection = connections.find((c: any) => c.id === connectionId);
      
      if (connection) {
        // Return the full connection object which includes credentials
        return {
          username: connection.username,
          password: connection.password,
          instanceId: connection.instanceId || '1',
          userDomainId: connection.userDomainId || '1'
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to load connection credentials:', error);
      return null;
    }
  }

  /**
   * Get available tools from MCP server using standard MCP protocol
   */
  async getAvailableTools(): Promise<any[]> {
    const mcpServerUrl = 'http://localhost:3001';
    
    try {
      const response = await fetch(`${mcpServerUrl}/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get tools: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[MCP Service] Retrieved available tools:', result.tools?.length || 0);
      
      return result.tools || [];
    } catch (error) {
      console.error('[MCP Service] Failed to connect to MCP server:', error);
      // Return error indicator instead of empty array
      throw new Error('MCP server not accessible at localhost:3001. Please ensure the Archer GRC MCP server is running.');
    }
  }

  /**
   * Execute a tool with enhanced security and tenant-specific connection context
   */
  async executeTool(request: McpToolExecutionRequest): Promise<McpToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      // 1. Security validation
      await this.validateTenantAccess();
      
      // 2. Sign critical operations
      const signedRequest = await this.signCriticalOperation(request);
      
      // 3. Audit log operation start
      await securityAuditLogger.logMcpOperation(
        this.tenantId,
        this.userId,
        request.toolId,
        'EXECUTE',
        'SUCCESS', // Will be updated on completion
        {
          requestId: signedRequest.nonce,
          inputs: Object.keys(request.inputs)
        }
      );

      // 4. Get tenant's enabled MCP servers
      const enabledServers = await this.getEnabledServers();
      
      if (enabledServers.length === 0) {
        throw new Error('No MCP servers enabled for tenant');
      }

      // 5. Use the first enabled server (in future could be more intelligent)
      const serverConfig = enabledServers[0];
      
      if (!serverConfig.enabled) {
        throw new Error('MCP server not enabled for tenant');
      }

      // 6. Check user permissions (enhanced role-based check)
      if (!this.hasRole(['TenantOwner', 'AgentUser'])) {
        await securityAuditLogger.logSecurityViolation(
          this.tenantId,
          this.userId,
          'UNAUTHORIZED_MCP_EXECUTION',
          { toolId: request.toolId, userRoles: this.userRoles }
        );
        throw new Error('User not authorized to use MCP servers');
      }

      // 7. Prepare connection context with real Archer credentials
      const connections = await this.getTenantConnections();
      const connectionContext: Record<string, any> = {};
      
      // Map the server's configured connection with credentials
      const connection = connections.find(c => c.id === serverConfig.connectionMapping.connectionId);
      if (connection) {
        // Load real credentials from secure storage
        const credentials = await this.loadConnectionCredentials(connection.id);
        
        connectionContext['archer'] = {
          id: connection.id,
          name: connection.name,
          type: 'archer',
          baseUrl: connection.baseUrl,
          status: connection.status,
          isDefault: connection.isDefault,
          lastTested: connection.lastTested,
          // Add secure credentials for MCP server
          credentials: credentials ? {
            username: credentials.username,
            password: credentials.password,
            instanceId: credentials.instanceId || '1',
            userDomainId: credentials.userDomainId || '1'
          } : null
        };
      }

      // 8. Execute tool via MCP server with connection context
      const mcpResponse = await this.callMcpServer(request.toolId, {
        ...request.inputs,
        tenant_id: this.tenantId
      }, connectionContext);
      
      const executionTime = Date.now() - startTime;

      const result: McpToolExecutionResult = {
        success: mcpResponse.success,
        result: mcpResponse.result,
        error: mcpResponse.error,
        usage: {
          inputTokens: mcpResponse.processing_time ? Math.floor(mcpResponse.processing_time / 10) : 100,
          outputTokens: mcpResponse.result ? Math.floor(mcpResponse.result.length / 4) : 200,
          executionTimeMs: executionTime
        },
        metadata: {
          toolId: request.toolId,
          tenantId: this.tenantId,
          userId: this.userId,
          timestamp: new Date().toISOString()
        }
      };

      // 9. Update usage statistics with security audit
      await this.recordUsage({
        tenantId: this.tenantId,
        toolId: request.toolId,
        userId: this.userId,
        timestamp: new Date().toISOString(),
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        executionTimeMs: result.usage.executionTimeMs,
        success: result.success
      });

      // 10. Update audit log with success
      await securityAuditLogger.logMcpOperation(
        this.tenantId,
        this.userId,
        request.toolId,
        'EXECUTE',
        'SUCCESS',
        {
          requestId: signedRequest.nonce,
          executionTime: executionTime,
          outputSize: JSON.stringify(result).length
        }
      );

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Record failed execution
      await this.recordUsage({
        tenantId: this.tenantId,
        toolId: request.toolId,
        userId: this.userId,
        timestamp: new Date().toISOString(),
        inputTokens: 50,
        outputTokens: 0,
        executionTimeMs: executionTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Audit log failure
      await securityAuditLogger.logMcpOperation(
        this.tenantId,
        this.userId,
        request.toolId,
        'EXECUTE',
        'FAILURE',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: executionTime
        }
      );

      throw error;
    }
  }

  /**
   * Call MCP server with tenant-specific connection context
   * Connects to real MCP server with Archer credentials
   */
  private async callMcpServer(toolId: string, inputs: any, connectionContext: Record<string, any>): Promise<any> {
    const mcpServerUrl = 'http://localhost:3001';
    
    console.log(`[MCP Service] Calling tool: ${toolId} with connection context:`, 
      { hasArcher: !!connectionContext.archer, tenantId: inputs.tenant_id });
    
    try {
      const response = await fetch(`${mcpServerUrl}/tools/${toolId}/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          arguments: {
            ...inputs,
            // Pass connection context including Archer credentials
            archer_connection: connectionContext.archer
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MCP server error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log(`[MCP Service] Tool ${toolId} executed successfully`);
      return result;
    } catch (error) {
      console.error(`[MCP Service] Failed to call tool ${toolId}:`, error);
      
      // Return clear error when MCP server is not available
      if (error instanceof Error && error.message.includes('fetch')) {
        console.warn('MCP server not available - connection required for real data');
        return this.generateConnectionErrorResponse(toolId, inputs, connectionContext);
      }
      
      throw error;
    }
  }

  /**
   * Handle case when MCP server connection is not available
   */
  private generateConnectionErrorResponse(toolId: string, inputs: any, connectionContext: Record<string, any>): any {
    const query = inputs.query || '';
    
    console.log('[MCP Error] No active MCP server connection for tool:', toolId);
    
    return {
      success: false,
      error: "MCP Server Connection Required",
      result: `Unable to process request "${query}" - No active MCP server connection found. The system requires a configured Archer GRC MCP server to retrieve real data. Please configure MCP server connection in Settings.`,
      metadata: {
        tool_requested: toolId,
        tenant_id: inputs.tenant_id,
        error_type: 'connection_unavailable'
      }
    };
  }

  /**
   * Record tool usage for analytics and billing (MCP server-based)
   */
  private async recordUsage(usage: McpToolUsage): Promise<void> {
    // Update MCP server usage stats
    const servers = await this.getEnabledServers();
    const serverIndex = servers.findIndex(s => s.enabled);
    
    if (serverIndex >= 0) {
      servers[serverIndex].usage.totalRequests++;
      servers[serverIndex].usage.totalTokens += usage.inputTokens + usage.outputTokens;
      servers[serverIndex].usage.lastUsed = usage.timestamp;
      if (!usage.success) {
        servers[serverIndex].usage.errorCount++;
      }
      
      // Update average response time
      const currentAvg = servers[serverIndex].usage.averageResponseTime;
      const currentCount = servers[serverIndex].usage.totalRequests;
      servers[serverIndex].usage.averageResponseTime = 
        Math.round((currentAvg * (currentCount - 1) + usage.executionTimeMs) / currentCount);
      
      localStorage.setItem(`mcp_servers_${this.tenantId}`, JSON.stringify(servers));
    }

    // In production, also store detailed usage records for analytics
    console.log('MCP Server usage recorded:', usage);
  }

  /**
   * Filter tools by search criteria
   */
  filterTools(tools: McpToolDefinition[], filter: McpToolCatalogFilter): McpToolDefinition[] {
    let filtered = [...tools];

    if (filter.category) {
      filtered = filtered.filter(tool => tool.category === filter.category);
    }

    if (filter.costTier) {
      filtered = filtered.filter(tool => tool.costTier === filter.costTier);
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered = filtered.filter(tool => 
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        tool.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter(tool =>
        filter.tags!.some(tag => tool.tags.includes(tag))
      );
    }

    return filtered;
  }

  /**
   * Check if user has required role
   */
  private hasRole(roles: string[]): boolean {
    return roles.some(role => this.userRoles.includes(role));
  }

  /**
   * Check if tenant tier allows access to tool
   */
  private isTierAllowed(
    toolMinimumTier: 'starter' | 'professional' | 'enterprise',
    tenantTier: 'starter' | 'professional' | 'enterprise'
  ): boolean {
    const tierOrder = { starter: 0, professional: 1, enterprise: 2 };
    return tierOrder[tenantTier] >= tierOrder[toolMinimumTier];
  }

  /**
   * Sign critical MCP operations for tamper protection
   */
  private async signCriticalOperation(request: McpToolExecutionRequest): Promise<SignedRequest> {
    return requestSigner.signMcpOperation(
      'EXECUTE_TOOL',
      request.toolId,
      request.inputs,
      this.tenantId,
      this.userId
    );
  }


}

// Export singleton factory
export const createMcpService = (tenantId: string, userId: string, userRoles: string[]) => {
  return new TenantScopedMcpService(tenantId, userId, userRoles);
};