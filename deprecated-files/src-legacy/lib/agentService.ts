import { AIAgent, AGENT_PRESETS } from '@/types/agent';

export class AgentService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Get all AI agents configured for the tenant
   */
  async getAgents(): Promise<AIAgent[]> {
    try {
      const storageKey = `ai_agents_${this.tenantId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Initialize with default agents if none exist
      return await this.initializeDefaultAgents();
    } catch (error) {
      console.error('Error loading AI agents:', error);
      return [];
    }
  }

  /**
   * Get enabled AI agents
   */
  async getEnabledAgents(): Promise<AIAgent[]> {
    const agents = await this.getAgents();
    return agents.filter(agent => agent.isEnabled);
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(agentId: string): Promise<AIAgent | null> {
    const agents = await this.getAgents();
    return agents.find(agent => agent.id === agentId) || null;
  }

  /**
   * Create a new AI agent
   */
  async createAgent(agentData: Omit<AIAgent, 'id' | 'createdAt' | 'usageCount' | 'isEnabled'>): Promise<AIAgent> {
    const newAgent: AIAgent = {
      ...agentData,
      id: `agent-${Date.now()}`,
      createdAt: new Date().toISOString(),
      usageCount: 0,
      isEnabled: true
    };

    const agents = await this.getAgents();
    agents.push(newAgent);
    await this.saveAgents(agents);

    return newAgent;
  }

  /**
   * Update an existing agent
   */
  async updateAgent(agentId: string, updates: Partial<AIAgent>): Promise<AIAgent | null> {
    const agents = await this.getAgents();
    const agentIndex = agents.findIndex(agent => agent.id === agentId);
    
    if (agentIndex === -1) {
      return null;
    }

    agents[agentIndex] = { ...agents[agentIndex], ...updates };
    await this.saveAgents(agents);

    return agents[agentIndex];
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<boolean> {
    const agents = await this.getAgents();
    const filteredAgents = agents.filter(agent => agent.id !== agentId);
    
    if (filteredAgents.length === agents.length) {
      return false; // Agent not found
    }

    await this.saveAgents(filteredAgents);
    return true;
  }

  /**
   * Create agent from preset
   */
  async createAgentFromPreset(
    presetId: string, 
    llmConfigId: string, 
    mcpServerIds: string[],
    customizations?: {
      name?: string;
      description?: string;
    }
  ): Promise<AIAgent> {
    const preset = AGENT_PRESETS.find(p => p.id === presetId);
    if (!preset) {
      throw new Error('Agent preset not found');
    }

    return await this.createAgent({
      name: customizations?.name || preset.name,
      description: customizations?.description || preset.description,
      persona: preset.persona,
      systemPrompt: preset.systemPrompt,
      llmConfigId,
      enabledMcpServers: mcpServerIds,
      capabilities: preset.capabilities,
      useCase: preset.useCase,
      avatar: preset.avatar,
      color: preset.color
    });
  }

  /**
   * Record agent usage
   */
  async recordUsage(agentId: string): Promise<void> {
    const agents = await this.getAgents();
    const agentIndex = agents.findIndex(agent => agent.id === agentId);
    
    if (agentIndex >= 0) {
      agents[agentIndex].usageCount++;
      agents[agentIndex].lastUsed = new Date().toISOString();
      await this.saveAgents(agents);
    }
  }

  /**
   * Get agent with full configuration context
   */
  async getAgentWithContext(agentId: string): Promise<{
    agent: AIAgent;
    llmConfig: any;
    mcpServers: any[];
  } | null> {
    const agent = await this.getAgent(agentId);
    if (!agent) return null;

    // Load LLM configuration
    const llmStorageKey = `user_llm_configs_${this.tenantId}`;
    const llmConfigs = JSON.parse(localStorage.getItem(llmStorageKey) || '[]');
    const llmConfig = llmConfigs.find((config: any) => config.id === agent.llmConfigId);

    // Load MCP servers
    const mcpStorageKey = `user_mcp_servers_${this.tenantId}`;
    const allMcpServers = JSON.parse(localStorage.getItem(mcpStorageKey) || '[]');
    const mcpServers = allMcpServers.filter((server: any) => 
      agent.enabledMcpServers.includes(server.id)
    );

    return {
      agent,
      llmConfig: llmConfig || null,
      mcpServers
    };
  }

  /**
   * Initialize default agents for new tenants - inherits from master template
   */
  private async initializeDefaultAgents(): Promise<AIAgent[]> {
    const agents: AIAgent[] = [];
    
    // Get available LLM configs and MCP servers for this tenant
    const llmStorageKey = `user_llm_configs_${this.tenantId}`;
    const mcpStorageKey = `user_mcp_servers_${this.tenantId}`;
    
    const llmConfigs = JSON.parse(localStorage.getItem(llmStorageKey) || '[]');
    const mcpServers = JSON.parse(localStorage.getItem(mcpStorageKey) || '[]');
    
    // Always create default agents for demonstration purposes
    // In production, this would check for actual LLM configs and MCP servers
    if (true) {
      const defaultLlm = llmConfigs.length > 0 
        ? (llmConfigs.find((config: any) => config.isEnabled) || llmConfigs[0])
        : { id: 'demo-llm-config', name: 'Demo LLM' };
        
      const enabledMcpServers = mcpServers.length > 0
        ? mcpServers.filter((server: any) => server.isEnabled).map((server: any) => server.id)
        : ['mcp-local-grc-server']; // Default to local GRC server

      // Create agents from ALL presets (master template) for new tenants
      for (const preset of AGENT_PRESETS) {
        const agent: AIAgent = {
          id: `agent-${preset.id}-${this.tenantId}`,
          name: preset.name,
          description: preset.description,
          persona: preset.persona,
          systemPrompt: preset.systemPrompt,
          llmConfigId: defaultLlm.id,
          enabledMcpServers: enabledMcpServers,
          capabilities: preset.capabilities,
          useCase: preset.useCase,
          isEnabled: true, // All inherited agents are enabled by default
          createdAt: new Date().toISOString(),
          usageCount: 0,
          avatar: preset.avatar,
          color: preset.color
        };

        agents.push(agent);
      }
    }

    if (agents.length > 0) {
      await this.saveAgents(agents);
      console.log(`[Agent Service] Initialized ${agents.length} default AI agents from master template for tenant:`, this.tenantId);

      // Initialize sample metrics for the new agents
      await this.initializeSampleMetrics(agents);
    }

    return agents;
  }

  /**
   * Initialize sample metrics for demonstration purposes
   */
  private async initializeSampleMetrics(agents: AIAgent[]): Promise<void> {
    const { createAgentMetricsService } = await import('./agentMetricsService');
    const metricsService = createAgentMetricsService(this.tenantId);

    for (const agent of agents) {
      await metricsService.generateSampleMetrics(agent.id);
    }
    
    console.log(`[Agent Service] Initialized sample metrics for ${agents.length} agents`);
  }

  /**
   * Save agents to storage
   */
  private async saveAgents(agents: AIAgent[]): Promise<void> {
    const storageKey = `ai_agents_${this.tenantId}`;
    localStorage.setItem(storageKey, JSON.stringify(agents));
  }

  /**
   * Validate agent configuration
   */
  async validateAgent(agent: AIAgent): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check if LLM config exists
    const llmStorageKey = `user_llm_configs_${this.tenantId}`;
    const llmConfigs = JSON.parse(localStorage.getItem(llmStorageKey) || '[]');
    const llmConfig = llmConfigs.find((config: any) => config.id === agent.llmConfigId);
    
    if (!llmConfig) {
      issues.push('LLM configuration not found');
    } else if (!llmConfig.isEnabled) {
      issues.push('LLM configuration is disabled');
    }

    // Check MCP servers
    const mcpStorageKey = `user_mcp_servers_${this.tenantId}`;
    const allMcpServers = JSON.parse(localStorage.getItem(mcpStorageKey) || '[]');
    const availableServers = allMcpServers.filter((server: any) => 
      agent.enabledMcpServers.includes(server.id)
    );

    if (availableServers.length === 0) {
      issues.push('No MCP servers configured');
    }

    const enabledServers = availableServers.filter((server: any) => server.isEnabled);
    if (enabledServers.length === 0) {
      issues.push('No enabled MCP servers');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

// Export factory function
export const createAgentService = (tenantId: string) => {
  return new AgentService(tenantId);
};