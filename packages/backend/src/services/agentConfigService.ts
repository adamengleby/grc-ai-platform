import { McpServerDefinition, TenantMcpServerConfiguration } from '../types/mcp';
import { AIAgent } from '../types/agent';

/**
 * Agent Configuration Service
 * Handles loading agent configurations and their enabled MCP servers
 * Implements proper tenant isolation and security validation
 */
export class AgentConfigService {
  
  /**
   * Load agent configuration with tenant validation
   * @param tenantId - Tenant ID for isolation
   * @param agentId - Agent ID to load
   */
  async getAgentConfiguration(tenantId: string, agentId: string): Promise<AIAgent | null> {
    if (!tenantId || !agentId) {
      throw new Error('Tenant ID and Agent ID are required');
    }

    // Validate tenant access (in production, this would check against database/cache)
    if (!this.validateTenantAccess(tenantId, agentId)) {
      throw new Error(`Agent ${agentId} does not belong to tenant ${tenantId}`);
    }

    // For now, return a mock configuration based on the agent ID pattern
    // In production, this would query Cosmos DB with tenant partitioning
    return this.getMockAgentConfiguration(tenantId, agentId);
  }

  /**
   * Get enabled MCP servers for a specific agent
   * @param tenantId - Tenant ID for isolation
   * @param agentId - Agent ID
   */
  async getEnabledMcpServers(tenantId: string, agentId: string): Promise<TenantMcpServerConfiguration[]> {
    if (!tenantId || !agentId) {
      throw new Error('Tenant ID and Agent ID are required');
    }

    const agent = await this.getAgentConfiguration(tenantId, agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found for tenant ${tenantId}`);
    }

    // Get MCP server configurations for the agent's enabled servers
    const enabledServers: TenantMcpServerConfiguration[] = [];

    for (const serverId of agent.enabledMcpServers) {
      const serverConfig = await this.getTenantMcpServerConfig(tenantId, serverId);
      if (serverConfig && serverConfig.enabled) {
        enabledServers.push(serverConfig);
      }
    }

    return enabledServers;
  }

  /**
   * Get tenant-specific MCP server configuration
   * @param tenantId - Tenant ID for isolation  
   * @param serverId - MCP Server ID
   */
  async getTenantMcpServerConfig(tenantId: string, serverId: string): Promise<TenantMcpServerConfiguration | null> {
    // In production, this would query Cosmos DB with tenant partitioning
    // For now, return mock configurations
    return this.getMockTenantMcpServerConfig(tenantId, serverId);
  }

  /**
   * Get global MCP server definition
   * @param serverId - MCP Server ID
   */
  async getMcpServerDefinition(serverId: string): Promise<McpServerDefinition | null> {
    // In production, this would query the global MCP registry in Cosmos DB
    return this.getMockMcpServerDefinition(serverId);
  }

  /**
   * Validate that an agent belongs to a specific tenant
   * @param tenantId - Tenant ID
   * @param agentId - Agent ID  
   */
  private validateTenantAccess(tenantId: string, agentId: string): boolean {
    // In production, this would query the database:
    // SELECT tenant_id FROM agents WHERE id = @agentId
    // For now, check against mock data with tenant association
    
    const mockAgentTenantMappings = new Map([
      // Legacy format support (for backward compatibility)
      ['agent-grc-analyst-tenant-acme', 'tenant-acme'],
      ['agent-risk-specialist-tenant-acme', 'tenant-acme'],
      ['agent-compliance-auditor-tenant-acme', 'tenant-acme'],
      ['agent-executive-advisor-tenant-acme', 'tenant-acme'],
      
      // Current UUID-based agents (temporary - would be stored in database in production)
      ['agent-29078b07-3e92-4c64-9f4c-6e4bc4fdce1e', 'tenant-acme'],
    ]);

    // Check explicit mapping first
    const mappedTenant = mockAgentTenantMappings.get(agentId);
    if (mappedTenant) {
      return mappedTenant === tenantId;
    }

    // Fallback: Try to extract tenant from legacy ID pattern for backward compatibility
    const legacyMatch = agentId.match(/tenant-([^-]+)/);
    if (legacyMatch) {
      const extractedTenant = legacyMatch[1];
      return extractedTenant === tenantId.replace('tenant-', '');
    }

    // For new UUID agents, always require explicit tenant validation
    // In production, this would be a database lookup
    console.warn(`[Agent Config] Agent ${agentId} not found in tenant mappings - would query database in production`);
    return false;
  }

  /**
   * Mock agent configuration (replace with database query in production)
   */
  private getMockAgentConfiguration(tenantId: string, agentId: string): AIAgent {
    const agentType = this.extractAgentType(agentId);
    
    const baseConfig = {
      id: agentId,
      name: this.getAgentDisplayName(agentType),
      description: this.getAgentDescription(agentType),
      persona: 'Professional GRC expert with deep regulatory knowledge',
      systemPrompt: 'You are a GRC analyst...',
      llmConfigId: 'default-llm-config',
      enabledMcpServers: this.getDefaultMcpServers(agentType),
      capabilities: this.getAgentCapabilities(agentType),
      useCase: 'comprehensive-grc-analysis',
      isEnabled: true,
      createdAt: '2025-01-01T00:00:00Z',
      usageCount: 0,
      avatar: this.getAgentAvatar(agentType),
      color: this.getAgentColor(agentType)
    };

    return baseConfig;
  }

  /**
   * Mock tenant MCP server configuration
   */
  private getMockTenantMcpServerConfig(tenantId: string, serverId: string): TenantMcpServerConfiguration {
    return {
      id: `${tenantId}-${serverId}`,
      tenantId: tenantId,
      serverId: serverId,
      enabled: true,
      enabledAt: '2025-01-01T00:00:00Z',
      connectionMapping: {
        connectionId: 'default-archer-connection',
        connectionType: 'archer',
        fallbackConnectionIds: []
      },
      serverConfig: {
        rateLimits: {
          requestsPerMinute: 100,
          tokensPerDay: 10000
        },
        timeout: 30000,
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 1000
        }
      },
      allowedUsers: [],
      restrictedRoles: [],
      createdBy: 'system',
      createdAt: '2025-01-01T00:00:00Z',
      lastModifiedBy: 'system', 
      lastModifiedAt: '2025-01-01T00:00:00Z',
      usage: {
        totalRequests: 0,
        totalTokens: 0,
        errorCount: 0,
        averageResponseTime: 0
      },
      healthStatus: 'healthy',
      lastHealthCheck: new Date().toISOString()
    };
  }

  /**
   * Mock MCP server definition
   */
  private getMockMcpServerDefinition(serverId: string): McpServerDefinition {
    const serverConfigs = {
      'archer-mcp-server': {
        name: 'Archer GRC MCP Server',
        description: 'RSA Archer GRC Platform integration server',
        endpoint: 'http://localhost:3002',
        capabilities: ['archer_applications', 'archer_records', 'archer_stats']
      },
      'compliance-mcp-server': {
        name: 'Compliance Analysis MCP Server', 
        description: 'Regulatory compliance analysis and monitoring',
        endpoint: 'http://localhost:3003',
        capabilities: ['compliance_check', 'regulatory_mapping', 'audit_trail']
      },
      'risk-analytics-mcp-server': {
        name: 'Risk Analytics MCP Server',
        description: 'Advanced risk modeling and analytics',
        endpoint: 'http://localhost:3004', 
        capabilities: ['risk_modeling', 'scenario_analysis', 'threat_intelligence']
      }
    };

    const config = serverConfigs[serverId as keyof typeof serverConfigs] || serverConfigs['archer-mcp-server'];

    return {
      id: serverId,
      name: config.name,
      description: config.description,
      version: '1.0.0',
      vendor: 'GRC Platform',
      endpoint: config.endpoint,
      capabilities: config.capabilities,
      supportedConnections: ['archer'],
      globallyApproved: true,
      costTier: 'standard',
      minimumTier: 'professional',
      documentation: {
        description: config.description,
        capabilities: config.capabilities.map(cap => ({
          name: cap,
          description: `${cap} capability`,
          examples: [`Example usage of ${cap}`]
        })),
        apiReference: `${config.endpoint}/docs`
      },
      tags: ['GRC', 'Security', 'Compliance'],
      lastUpdated: '2025-01-01T00:00:00Z',
      healthEndpoint: `${config.endpoint}/health`
    };
  }

  private extractAgentType(agentId: string): string {
    const match = agentId.match(/agent-([^-]+)-/);
    return match ? match[1] : 'grc-analyst';
  }

  private getAgentDisplayName(agentType: string): string {
    const names = {
      'grc-analyst': 'GRC Analyst',
      'risk-specialist': 'Risk Specialist', 
      'compliance-auditor': 'Compliance Auditor',
      'executive-advisor': 'Executive Advisor'
    };
    return names[agentType as keyof typeof names] || 'GRC Analyst';
  }

  private getAgentDescription(agentType: string): string {
    const descriptions = {
      'grc-analyst': 'Comprehensive governance, risk, and compliance analysis specialist',
      'risk-specialist': 'Focused on risk identification, assessment, and mitigation strategies',
      'compliance-auditor': 'Regulatory compliance expert specializing in audit and assessment', 
      'executive-advisor': 'Strategic GRC advisor providing executive-level insights'
    };
    return descriptions[agentType as keyof typeof descriptions] || 'GRC analysis specialist';
  }

  private getDefaultMcpServers(agentType: string): string[] {
    const serverMappings = {
      'grc-analyst': ['archer-mcp-server', 'compliance-mcp-server'],
      'risk-specialist': ['archer-mcp-server', 'risk-analytics-mcp-server'], 
      'compliance-auditor': ['archer-mcp-server', 'compliance-mcp-server'],
      'executive-advisor': ['archer-mcp-server', 'risk-analytics-mcp-server', 'compliance-mcp-server']
    };
    return serverMappings[agentType as keyof typeof serverMappings] || ['archer-mcp-server'];
  }

  private getAgentCapabilities(agentType: string): string[] {
    const capabilities = {
      'grc-analyst': ['risk-analysis', 'compliance-audit', 'control-assessment'],
      'risk-specialist': ['risk-analysis', 'anomaly-detection', 'trend-analysis'],
      'compliance-auditor': ['compliance-audit', 'control-assessment'], 
      'executive-advisor': ['executive-reporting', 'trend-analysis', 'risk-analysis']
    };
    return capabilities[agentType as keyof typeof capabilities] || ['risk-analysis'];
  }

  private getAgentAvatar(agentType: string): string {
    const avatars = {
      'grc-analyst': '🛡️',
      'risk-specialist': '⚠️', 
      'compliance-auditor': '📋',
      'executive-advisor': '👔'
    };
    return avatars[agentType as keyof typeof avatars] || '🛡️';
  }

  private getAgentColor(agentType: string): string {
    const colors = {
      'grc-analyst': '#2563eb',
      'risk-specialist': '#dc2626',
      'compliance-auditor': '#059669', 
      'executive-advisor': '#7c3aed'
    };
    return colors[agentType as keyof typeof colors] || '#2563eb';
  }
}

// Singleton instance
export const agentConfigService = new AgentConfigService();