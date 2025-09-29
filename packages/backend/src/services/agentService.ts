/**
 * AI Agent Service
 * Replaces localStorage-based agent management with database persistence and tenant isolation
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from './databaseService';
import { AuditService } from './auditService';
import { LlmConfigService } from './llmConfigService';
import { McpServerService } from './mcpServerService';
import { TenantService } from './tenantService';

export interface AIAgent {
  agent_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  persona?: string;
  system_prompt?: string;
  llm_config_id?: string;
  enabled_mcp_servers: string[]; // JSON array of server IDs
  avatar?: string;
  color?: string;
  is_enabled: boolean;
  usage_count: number;
  last_used_at?: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface AgentPreset {
  preset_id: string;
  name: string;
  description: string;
  persona: string;
  system_prompt: string;
  recommended_tools: string[];
  avatar?: string;
  color?: string;
  category: string;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  persona?: string;
  system_prompt?: string;
  llm_config_id?: string;
  enabled_mcp_servers?: string[];
  avatar?: string;
  color?: string;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  persona?: string;
  system_prompt?: string;
  llm_config_id?: string;
  enabled_mcp_servers?: string[];
  avatar?: string;
  color?: string;
  is_enabled?: boolean;
}

export interface AgentWithContext {
  agent: AIAgent;
  llm_config?: any;
  mcp_servers: any[];
  validation: {
    is_valid: boolean;
    issues: string[];
  };
}

export interface AgentUsageMetrics {
  agent_id: string;
  period: {
    start: string;
    end: string;
    type: string;
  };
  metrics: {
    total_requests: number;
    total_tokens_consumed: number;
    average_response_time_ms: number;
    error_count: number;
    error_rate: number;
    estimated_cost: number;
    currency: string;
    most_used_tools: { tool: string; usage_count: number }[];
    daily_usage: { date: string; requests: number; tokens: number }[];
  };
}

export class AgentService {
  private db: DatabaseService;
  private auditService: AuditService;
  private llmConfigService: LlmConfigService;
  private mcpServerService: McpServerService;
  private tenantService: TenantService;

  // Default agent presets
  private static readonly AGENT_PRESETS: AgentPreset[] = [
    {
      preset_id: 'grc-risk-analyst',
      name: 'GRC Risk Analyst',
      description: 'Specialized in risk assessment and compliance analysis',
      persona: 'professional_risk_analyst',
      system_prompt: `You are a GRC (Governance, Risk, and Compliance) Risk Analyst with expertise in enterprise risk management, regulatory compliance, and control frameworks. Your role is to:

## Core Responsibilities:
- Analyze and assess organizational risks across all business functions
- Evaluate control effectiveness and identify compliance gaps
- Provide actionable recommendations for risk mitigation
- Monitor regulatory changes and their impact on the organization
- Support audit activities and compliance reporting

## Analysis Approach:
1. **Risk Identification**: Systematically identify risks using established frameworks (ISO 31000, COSO)
2. **Risk Assessment**: Evaluate likelihood and impact using quantitative and qualitative methods
3. **Control Evaluation**: Assess control design and operating effectiveness
4. **Reporting**: Provide clear, executive-level risk summaries and detailed technical analysis

## Communication Style:
- Professional and analytical
- Use risk management terminology appropriately
- Provide evidence-based recommendations
- Present both high-level summaries and detailed findings
- Focus on business impact and actionable insights

## Compliance Frameworks Expertise:
- ISO 27001 (Information Security Management)
- SOC 2 (System and Organization Controls)
- CPS 230 (Operational Resilience - APRA)
- GDPR (General Data Protection Regulation)
- PCI DSS (Payment Card Industry Data Security Standard)

When analyzing data, always consider regulatory requirements, industry best practices, and business context to provide comprehensive risk assessments.`,
      recommended_tools: ['archer-connector', 'risk-calculator', 'compliance-checker'],
      avatar: 'https://cdn.example.com/avatars/risk-analyst.png',
      color: '#DC2626',
      category: 'risk_management'
    },
    {
      preset_id: 'compliance-monitor',
      name: 'Compliance Monitor',
      description: 'Continuous monitoring of compliance requirements and controls',
      persona: 'compliance_specialist',
      system_prompt: `You are a Compliance Monitoring Specialist responsible for ensuring ongoing adherence to regulatory requirements and internal policies. Your expertise covers:

## Primary Functions:
- Monitor compliance status across multiple regulatory frameworks
- Track control testing and remediation activities
- Identify compliance trends and emerging risks
- Provide compliance reporting and dashboards
- Support regulatory examinations and audits

## Monitoring Approach:
1. **Continuous Assessment**: Regular evaluation of compliance posture
2. **Exception Management**: Identify and track compliance exceptions
3. **Trend Analysis**: Monitor compliance metrics over time
4. **Proactive Alerting**: Flag potential compliance issues before they become violations

## Key Focus Areas:
- Regulatory change management
- Control testing schedules and results
- Policy compliance monitoring
- Training and awareness programs
- Incident response compliance

## Reporting Standards:
- Provide timely compliance status updates
- Use standardized compliance metrics
- Highlight critical compliance gaps
- Recommend corrective actions with timelines
- Maintain audit-ready documentation

Your communication should be precise, regulatory-focused, and action-oriented, helping stakeholders understand compliance obligations and status.`,
      recommended_tools: ['archer-connector', 'compliance-checker', 'audit-trail'],
      avatar: 'https://cdn.example.com/avatars/compliance-monitor.png',
      color: '#059669',
      category: 'compliance'
    },
    {
      preset_id: 'security-analyst',
      name: 'Security Analyst',
      description: 'Information security analysis and threat assessment',
      persona: 'security_specialist',
      system_prompt: `You are an Information Security Analyst specializing in cybersecurity risk assessment, threat analysis, and security control evaluation. Your expertise includes:

## Security Domains:
- Information Security Management Systems (ISMS)
- Threat and vulnerability assessment
- Security control design and implementation
- Incident response and forensics
- Security awareness and training

## Analysis Framework:
1. **Threat Modeling**: Identify potential security threats and attack vectors
2. **Vulnerability Assessment**: Evaluate system and process vulnerabilities
3. **Control Analysis**: Assess security control effectiveness
4. **Risk Quantification**: Calculate security risk impact and likelihood

## Security Standards:
- NIST Cybersecurity Framework
- ISO 27001/27002
- OWASP Top 10
- SANS Critical Security Controls
- MITRE ATT&CK Framework

## Communication Style:
- Clear, technical explanations for IT audiences
- Executive summaries for business stakeholders
- Risk-based prioritization of security issues
- Actionable remediation recommendations

Focus on practical security improvements that reduce organizational risk while maintaining business functionality.`,
      recommended_tools: ['archer-connector', 'security-scanner', 'threat-intelligence'],
      avatar: 'https://cdn.example.com/avatars/security-analyst.png',
      color: '#7C3AED',
      category: 'security'
    }
  ];

  constructor() {
    this.db = DatabaseService.getInstance();
    this.auditService = new AuditService();
    this.llmConfigService = new LlmConfigService();
    this.mcpServerService = new McpServerService();
    this.tenantService = new TenantService();
  }

  /**
   * Get all AI agents for a tenant
   */
  async getAgents(
    tenantId: string,
    options: {
      enabled?: boolean;
      limit?: number;
      offset?: number;
      sort?: 'name' | 'created_at' | 'usage_count';
      order?: 'asc' | 'desc';
    } = {}
  ): Promise<{ agents: AIAgent[]; total: number }> {
    const {
      enabled,
      limit = 50,
      offset = 0,
      sort = 'created_at',
      order = 'desc'
    } = options;

    // Build query with filters
    let query = `
      SELECT 
        agent_id,
        tenant_id,
        name,
        description,
        persona,
        system_prompt,
        llm_config_id,
        enabled_mcp_servers,
        avatar,
        color,
        is_enabled,
        usage_count,
        last_used_at,
        created_by_user_id,
        created_at,
        updated_at
      FROM ai_agents
      WHERE tenant_id = ? AND deleted_at IS NULL
    `;

    const params: any[] = [tenantId];

    if (enabled !== undefined) {
      query += ` AND is_enabled = ?`;
      params.push(enabled);
    }

    // Add sorting
    const validSorts = ['name', 'created_at', 'usage_count'];
    const validOrders = ['asc', 'desc'];
    
    if (validSorts.includes(sort) && validOrders.includes(order)) {
      query += ` ORDER BY ${sort} ${order.toUpperCase()}`;
    }

    // Add pagination
    query += ` OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
    params.push(offset, limit);

    // Execute query
    const agents = await this.db.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM ai_agents
      WHERE tenant_id = ? AND deleted_at IS NULL
    `;
    const countParams = [tenantId];

    if (enabled !== undefined) {
      countQuery += ` AND is_enabled = ?`;
      countParams.push(enabled);
    }

    const countResult = await this.db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    // Parse JSON fields
    const parsedAgents = agents.map(agent => ({
      ...agent,
      enabled_mcp_servers: JSON.parse(agent.enabled_mcp_servers || '[]')
    }));

    return {
      agents: parsedAgents,
      total
    };
  }

  /**
   * Get a specific AI agent by ID
   */
  async getAgent(tenantId: string, agentId: string): Promise<AIAgent | null> {
    const query = `
      SELECT 
        agent_id,
        tenant_id,
        name,
        description,
        persona,
        system_prompt,
        llm_config_id,
        enabled_mcp_servers,
        avatar,
        color,
        is_enabled,
        usage_count,
        last_used_at,
        created_by_user_id,
        created_at,
        updated_at
      FROM ai_agents
      WHERE tenant_id = ? AND agent_id = ? AND deleted_at IS NULL
    `;

    const results = await this.db.query(query, [tenantId, agentId]);

    if (results.length === 0) {
      return null;
    }

    const agent = results[0];
    return {
      ...agent,
      enabled_mcp_servers: JSON.parse(agent.enabled_mcp_servers || '[]')
    };
  }

  /**
   * Get agent with full configuration context
   */
  async getAgentWithContext(tenantId: string, agentId: string): Promise<AgentWithContext | null> {
    const agent = await this.getAgent(tenantId, agentId);
    if (!agent) {
      return null;
    }

    // Load LLM configuration
    let llmConfig = null;
    if (agent.llm_config_id) {
      llmConfig = await this.llmConfigService.getConfig(tenantId, agent.llm_config_id);
    }

    // Load MCP servers
    const mcpServers = await this.mcpServerService.getTenantEnabledServers(
      tenantId,
      agent.enabled_mcp_servers
    );

    // Validate agent configuration
    const validation = await this.validateAgent(agent, llmConfig, mcpServers);

    return {
      agent,
      llm_config: llmConfig,
      mcp_servers: mcpServers,
      validation
    };
  }

  /**
   * Create a new AI agent
   */
  async createAgent(
    tenantId: string,
    userId: string,
    request: CreateAgentRequest
  ): Promise<AIAgent> {
    // Generate UUID for agent
    const agentId = uuidv4();
    
    // Validate LLM config exists if provided
    if (request.llm_config_id) {
      const llmConfig = await this.llmConfigService.getConfig(tenantId, request.llm_config_id);
      if (!llmConfig) {
        throw new Error('LLM configuration not found');
      }
    }

    // Validate MCP servers if provided
    if (request.enabled_mcp_servers && request.enabled_mcp_servers.length > 0) {
      const availableServers = await this.mcpServerService.getTenantEnabledServers(tenantId);
      const invalidServers = request.enabled_mcp_servers.filter(
        serverId => !availableServers.some(server => server.server_id === serverId)
      );
      
      if (invalidServers.length > 0) {
        throw new Error(`Invalid MCP servers: ${invalidServers.join(', ')}`);
      }
    }

    const now = new Date().toISOString();
    
    const query = `
      INSERT INTO ai_agents (
        agent_id,
        tenant_id,
        name,
        description,
        persona,
        system_prompt,
        llm_config_id,
        enabled_mcp_servers,
        avatar,
        color,
        is_enabled,
        usage_count,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      agentId,
      tenantId,
      request.name,
      request.description || null,
      request.persona || null,
      request.system_prompt || null,
      request.llm_config_id || null,
      JSON.stringify(request.enabled_mcp_servers || []),
      request.avatar || null,
      request.color || null,
      true, // is_enabled
      0, // usage_count
      userId,
      now,
      now
    ];

    await this.db.execute(query, params);

    // Log audit event
    await this.auditService.logEvent({
      eventType: 'agent_created',
      eventCategory: 'configuration',
      severity: 'info',
      userId,
      tenantId,
      resourceType: 'agent',
      resourceId: agentId,
      eventSummary: `AI agent '${request.name}' created`,
      eventDetails: {
        agentName: request.name,
        llmConfigId: request.llm_config_id,
        enabledMcpServers: request.enabled_mcp_servers
      }
    });

    // Return the created agent
    const createdAgent = await this.getAgent(tenantId, agentId);
    if (!createdAgent) {
      throw new Error('Failed to retrieve created agent');
    }

    return createdAgent;
  }

  /**
   * Create agent from preset
   */
  async createAgentFromPreset(
    tenantId: string,
    userId: string,
    presetId: string,
    llmConfigId: string,
    mcpServerIds: string[],
    customizations?: { name?: string; description?: string }
  ): Promise<AIAgent> {
    const preset = AgentService.AGENT_PRESETS.find(p => p.preset_id === presetId);
    if (!preset) {
      throw new Error('Agent preset not found');
    }

    const request: CreateAgentRequest = {
      name: customizations?.name || preset.name,
      description: customizations?.description || preset.description,
      persona: preset.persona,
      system_prompt: preset.system_prompt,
      llm_config_id: llmConfigId,
      enabled_mcp_servers: mcpServerIds,
      avatar: preset.avatar,
      color: preset.color
    };

    return await this.createAgent(tenantId, userId, request);
  }

  /**
   * Update an existing agent
   */
  async updateAgent(
    tenantId: string,
    userId: string,
    agentId: string,
    request: UpdateAgentRequest
  ): Promise<AIAgent | null> {
    // Get current agent for audit log
    const currentAgent = await this.getAgent(tenantId, agentId);
    if (!currentAgent) {
      return null;
    }

    // Validate LLM config if being updated
    if (request.llm_config_id) {
      const llmConfig = await this.llmConfigService.getConfig(tenantId, request.llm_config_id);
      if (!llmConfig) {
        throw new Error('LLM configuration not found');
      }
    }

    // Validate MCP servers if being updated
    if (request.enabled_mcp_servers && request.enabled_mcp_servers.length > 0) {
      const availableServers = await this.mcpServerService.getTenantEnabledServers(tenantId);
      const invalidServers = request.enabled_mcp_servers.filter(
        serverId => !availableServers.some(server => server.server_id === serverId)
      );
      
      if (invalidServers.length > 0) {
        throw new Error(`Invalid MCP servers: ${invalidServers.join(', ')}`);
      }
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const params: any[] = [];

    if (request.name !== undefined) {
      updateFields.push('name = ?');
      params.push(request.name);
    }
    if (request.description !== undefined) {
      updateFields.push('description = ?');
      params.push(request.description);
    }
    if (request.persona !== undefined) {
      updateFields.push('persona = ?');
      params.push(request.persona);
    }
    if (request.system_prompt !== undefined) {
      updateFields.push('system_prompt = ?');
      params.push(request.system_prompt);
    }
    if (request.llm_config_id !== undefined) {
      updateFields.push('llm_config_id = ?');
      params.push(request.llm_config_id);
    }
    if (request.enabled_mcp_servers !== undefined) {
      updateFields.push('enabled_mcp_servers = ?');
      params.push(JSON.stringify(request.enabled_mcp_servers));
    }
    if (request.avatar !== undefined) {
      updateFields.push('avatar = ?');
      params.push(request.avatar);
    }
    if (request.color !== undefined) {
      updateFields.push('color = ?');
      params.push(request.color);
    }
    if (request.is_enabled !== undefined) {
      updateFields.push('is_enabled = ?');
      params.push(request.is_enabled);
    }

    if (updateFields.length === 0) {
      return currentAgent; // No updates to make
    }

    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(tenantId, agentId);

    const query = `
      UPDATE ai_agents 
      SET ${updateFields.join(', ')}
      WHERE tenant_id = ? AND agent_id = ? AND deleted_at IS NULL
    `;

    await this.db.execute(query, params);

    // Log audit event
    await this.auditService.logEvent({
      eventType: 'agent_updated',
      eventCategory: 'configuration',
      severity: 'info',
      userId,
      tenantId,
      resourceType: 'agent',
      resourceId: agentId,
      eventSummary: `AI agent '${currentAgent.name}' updated`,
      eventDetails: {
        changes: Object.keys(request),
        agentName: request.name || currentAgent.name
      },
      beforeState: currentAgent,
      afterState: request
    });

    // Return updated agent
    return await this.getAgent(tenantId, agentId);
  }

  /**
   * Delete (soft delete) an agent
   */
  async deleteAgent(tenantId: string, userId: string, agentId: string): Promise<boolean> {
    const agent = await this.getAgent(tenantId, agentId);
    if (!agent) {
      return false;
    }

    const query = `
      UPDATE ai_agents 
      SET deleted_at = ?, updated_at = ?
      WHERE tenant_id = ? AND agent_id = ? AND deleted_at IS NULL
    `;

    const now = new Date().toISOString();
    await this.db.execute(query, [now, now, tenantId, agentId]);

    // Log audit event
    await this.auditService.logEvent({
      eventType: 'agent_deleted',
      eventCategory: 'configuration',
      severity: 'warning',
      userId,
      tenantId,
      resourceType: 'agent',
      resourceId: agentId,
      eventSummary: `AI agent '${agent.name}' deleted`,
      eventDetails: {
        agentName: agent.name,
        deletionType: 'soft_delete'
      }
    });

    return true;
  }

  /**
   * Record agent usage
   */
  async recordUsage(tenantId: string, agentId: string, metrics: {
    sessionId?: string;
    tokensUsed?: number;
    responseTimeMs?: number;
    toolsUsed?: string[];
    success?: boolean;
  } = {}): Promise<void> {
    // Update agent usage count and last used time
    const query = `
      UPDATE ai_agents 
      SET usage_count = usage_count + 1, 
          last_used_at = ?
      WHERE tenant_id = ? AND agent_id = ? AND deleted_at IS NULL
    `;

    await this.db.execute(query, [new Date().toISOString(), tenantId, agentId]);

    // Record detailed metrics if provided
    if (metrics.tokensUsed || metrics.responseTimeMs || metrics.toolsUsed) {
      await this.recordDetailedUsage(tenantId, agentId, metrics);
    }
  }

  /**
   * Get agent usage metrics
   */
  async getAgentMetrics(
    tenantId: string,
    agentId: string,
    options: {
      period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<AgentUsageMetrics | null> {
    const agent = await this.getAgent(tenantId, agentId);
    if (!agent) {
      return null;
    }

    // Determine date range
    const { startDate, endDate, periodType } = this.calculateDateRange(options);

    // Get usage metrics from database
    const metricsQuery = `
      SELECT 
        COUNT(*) as total_requests,
        COALESCE(SUM(tokens_used), 0) as total_tokens_consumed,
        COALESCE(AVG(processing_time_ms), 0) as average_response_time_ms,
        COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) as error_count,
        COALESCE(SUM(estimated_cost), 0) as estimated_cost
      FROM agent_usage_metrics
      WHERE tenant_id = ? AND agent_id = ? 
        AND period_start >= ? AND period_end <= ?
    `;

    const metricsResult = await this.db.query(metricsQuery, [
      tenantId, agentId, startDate, endDate
    ]);

    const metrics = metricsResult[0] || {
      total_requests: 0,
      total_tokens_consumed: 0,
      average_response_time_ms: 0,
      error_count: 0,
      estimated_cost: 0
    };

    // Calculate error rate
    const errorRate = metrics.total_requests > 0 ? 
      metrics.error_count / metrics.total_requests : 0;

    // Get daily breakdown
    const dailyQuery = `
      SELECT 
        CAST(period_start as DATE) as date,
        SUM(total_requests) as requests,
        SUM(total_tokens_consumed) as tokens
      FROM agent_usage_metrics
      WHERE tenant_id = ? AND agent_id = ? 
        AND period_start >= ? AND period_end <= ?
        AND period_type = 'day'
      GROUP BY CAST(period_start as DATE)
      ORDER BY date DESC
    `;

    const dailyUsage = await this.db.query(dailyQuery, [
      tenantId, agentId, startDate, endDate
    ]);

    // Get tool usage statistics
    const toolsQuery = `
      SELECT 
        JSON_VALUE(tools_used, '$') as tool_data
      FROM agent_usage_metrics
      WHERE tenant_id = ? AND agent_id = ? 
        AND period_start >= ? AND period_end <= ?
        AND tools_used IS NOT NULL
    `;

    const toolsResult = await this.db.query(toolsQuery, [
      tenantId, agentId, startDate, endDate
    ]);

    // Process tool usage (simplified aggregation)
    const mostUsedTools = this.aggregateToolUsage(toolsResult);

    return {
      agent_id: agentId,
      period: {
        start: startDate,
        end: endDate,
        type: periodType
      },
      metrics: {
        total_requests: metrics.total_requests,
        total_tokens_consumed: metrics.total_tokens_consumed,
        average_response_time_ms: Math.round(metrics.average_response_time_ms),
        error_count: metrics.error_count,
        error_rate: Math.round(errorRate * 1000) / 1000,
        estimated_cost: Math.round(metrics.estimated_cost * 100) / 100,
        currency: 'USD',
        most_used_tools: mostUsedTools,
        daily_usage: dailyUsage.map(day => ({
          date: day.date,
          requests: day.requests,
          tokens: day.tokens
        }))
      }
    };
  }

  /**
   * Get available agent presets
   */
  static getAgentPresets(): AgentPreset[] {
    return AgentService.AGENT_PRESETS;
  }

  /**
   * Validate agent configuration
   */
  private async validateAgent(
    agent: AIAgent,
    llmConfig: any,
    mcpServers: any[]
  ): Promise<{ is_valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check LLM configuration
    if (!agent.llm_config_id) {
      issues.push('No LLM configuration assigned');
    } else if (!llmConfig) {
      issues.push('LLM configuration not found');
    } else if (!llmConfig.is_enabled) {
      issues.push('LLM configuration is disabled');
    }

    // Check MCP servers
    if (agent.enabled_mcp_servers.length === 0) {
      issues.push('No MCP servers configured');
    } else {
      const enabledServers = mcpServers.filter(server => server.is_enabled);
      if (enabledServers.length === 0) {
        issues.push('No enabled MCP servers');
      }

      // Check if all configured servers are available
      const missingServers = agent.enabled_mcp_servers.filter(
        serverId => !mcpServers.some(server => server.server_id === serverId)
      );
      if (missingServers.length > 0) {
        issues.push(`Missing MCP servers: ${missingServers.join(', ')}`);
      }
    }

    // Check system prompt
    if (!agent.system_prompt || agent.system_prompt.trim().length < 50) {
      issues.push('System prompt is too short or missing');
    }

    return {
      is_valid: issues.length === 0,
      issues
    };
  }

  /**
   * Record detailed usage metrics
   */
  private async recordDetailedUsage(
    tenantId: string,
    agentId: string,
    metrics: {
      sessionId?: string;
      tokensUsed?: number;
      responseTimeMs?: number;
      toolsUsed?: string[];
      success?: boolean;
    }
  ): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 1);

    // Check if daily metrics record exists
    const existingQuery = `
      SELECT metric_id FROM agent_usage_metrics
      WHERE tenant_id = ? AND agent_id = ? 
        AND period_start = ? AND period_type = 'day'
    `;

    const existing = await this.db.query(existingQuery, [
      tenantId, agentId, periodStart.toISOString()
    ]);

    const toolsUsedJson = metrics.toolsUsed ? JSON.stringify(
      metrics.toolsUsed.reduce((acc, tool) => {
        acc[tool] = (acc[tool] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ) : null;

    if (existing.length > 0) {
      // Update existing record
      const updateQuery = `
        UPDATE agent_usage_metrics 
        SET 
          total_requests = total_requests + 1,
          total_tokens_consumed = total_tokens_consumed + ?,
          average_response_time_ms = (average_response_time_ms + ?) / 2,
          error_count = error_count + ?,
          estimated_cost = estimated_cost + ?,
          tools_used = ?,
          updated_at = ?
        WHERE metric_id = ?
      `;

      const errorIncrement = metrics.success === false ? 1 : 0;
      const estimatedCost = (metrics.tokensUsed || 0) * 0.00002; // Rough estimate

      await this.db.execute(updateQuery, [
        metrics.tokensUsed || 0,
        metrics.responseTimeMs || 0,
        errorIncrement,
        estimatedCost,
        toolsUsedJson,
        now.toISOString(),
        existing[0].metric_id
      ]);
    } else {
      // Create new record
      const insertQuery = `
        INSERT INTO agent_usage_metrics (
          metric_id,
          tenant_id,
          agent_id,
          period_start,
          period_end,
          period_type,
          total_requests,
          total_tokens_consumed,
          average_response_time_ms,
          error_count,
          estimated_cost,
          tools_used,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const errorCount = metrics.success === false ? 1 : 0;
      const estimatedCost = (metrics.tokensUsed || 0) * 0.00002; // Rough estimate

      await this.db.execute(insertQuery, [
        uuidv4(),
        tenantId,
        agentId,
        periodStart.toISOString(),
        periodEnd.toISOString(),
        'day',
        1, // total_requests
        metrics.tokensUsed || 0,
        metrics.responseTimeMs || 0,
        errorCount,
        estimatedCost,
        toolsUsedJson,
        now.toISOString(),
        now.toISOString()
      ]);
    }
  }

  /**
   * Calculate date range for metrics
   */
  private calculateDateRange(options: {
    period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    startDate?: string;
    endDate?: string;
  }): { startDate: string; endDate: string; periodType: string } {
    if (options.startDate && options.endDate) {
      return {
        startDate: options.startDate,
        endDate: options.endDate,
        periodType: 'custom'
      };
    }

    const now = new Date();
    let startDate: Date;
    let periodType = options.period || 'month';

    switch (periodType) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        periodType = 'month';
    }

    return {
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      periodType
    };
  }

  /**
   * Aggregate tool usage from metrics
   */
  private aggregateToolUsage(toolsResult: any[]): { tool: string; usage_count: number }[] {
    const toolCounts: Record<string, number> = {};

    toolsResult.forEach(row => {
      if (row.tool_data) {
        try {
          const tools = JSON.parse(row.tool_data);
          Object.entries(tools).forEach(([tool, count]) => {
            toolCounts[tool] = (toolCounts[tool] || 0) + (count as number);
          });
        } catch (error) {
          // Ignore invalid JSON
        }
      }
    });

    return Object.entries(toolCounts)
      .map(([tool, count]) => ({ tool, usage_count: count }))
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 10); // Top 10 tools
  }
}