import { AIAgent, AGENT_PRESETS } from '@/types/agent';
import { apiClient, ApiError } from '@/services/apiClient';

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
      const response = await apiClient.getAgents();
      return response.agents.map(mapAgentProperties);
    } catch (error) {
      console.error('Error loading AI agents:', error);
      if (error instanceof ApiError && error.code === 'AUTHENTICATION_REQUIRED') {
        // Redirect to login or handle authentication
        throw error;
      }
      return [];
    }
  }

  /**
   * Get enabled AI agents
   */
  async getEnabledAgents(): Promise<AIAgent[]> {
    try {
      const response = await apiClient.getAgents({ enabled: true });
      return response.agents.map(mapAgentProperties);
    } catch (error) {
      console.error('Error loading enabled AI agents:', error);
      return [];
    }
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(agentId: string): Promise<AIAgent | null> {
    try {
      const response = await apiClient.getAgent(agentId);
      return mapAgentProperties(response.agent);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return null;
      }
      console.error('Error loading AI agent:', error);
      throw error;
    }
  }

  /**
   * Create a new AI agent
   */
  async createAgent(agentData: {
    name: string;
    description?: string;
    persona?: string;
    systemPrompt?: string;
    llmConfigId?: string;
    enabledMcpServers?: string[];
    avatar?: string;
    color?: string;
  }): Promise<AIAgent> {
    try {
      const response = await apiClient.createAgent({
        name: agentData.name,
        description: agentData.description,
        persona: agentData.persona,
        system_prompt: agentData.systemPrompt,
        llm_config_id: agentData.llmConfigId,
        enabled_mcp_servers: agentData.enabledMcpServers || [],
        avatar: agentData.avatar,
        color: agentData.color
      });
      return mapAgentProperties(response.agent);
    } catch (error) {
      console.error('Error creating AI agent:', error);
      throw error;
    }
  }

  /**
   * Update an existing agent
   */
  async updateAgent(agentId: string, updates: {
    name?: string;
    description?: string;
    persona?: string;
    systemPrompt?: string;
    llmConfigId?: string;
    enabledMcpServers?: string[];
    avatar?: string;
    color?: string;
    isEnabled?: boolean;
  }): Promise<AIAgent | null> {
    try {
      const response = await apiClient.updateAgent(agentId, {
        name: updates.name,
        description: updates.description,
        persona: updates.persona,
        system_prompt: updates.systemPrompt,
        llm_config_id: updates.llmConfigId,
        enabled_mcp_servers: updates.enabledMcpServers,
        avatar: updates.avatar,
        color: updates.color,
        is_enabled: updates.isEnabled
      });
      return mapAgentProperties(response.agent);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return null;
      }
      console.error('Error updating AI agent:', error);
      throw error;
    }
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<boolean> {
    try {
      await apiClient.deleteAgent(agentId);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return false; // Agent not found
      }
      console.error('Error deleting AI agent:', error);
      throw error;
    }
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
    try {
      const response = await apiClient.createAgentFromPreset({
        preset_id: presetId,
        llm_config_id: llmConfigId,
        mcp_server_ids: mcpServerIds,
        customizations
      });
      return mapAgentProperties(response.agent);
    } catch (error) {
      console.error('Error creating agent from preset:', error);
      throw error;
    }
  }

  /**
   * Record agent usage
   */
  async recordUsage(agentId: string, metrics?: {
    sessionId?: string;
    tokensUsed?: number;
    responseTimeMs?: number;
    toolsUsed?: string[];
    success?: boolean;
  }): Promise<void> {
    try {
      await apiClient.recordAgentUsage(agentId, {
        session_id: metrics?.sessionId,
        tokens_used: metrics?.tokensUsed,
        response_time_ms: metrics?.responseTimeMs,
        tools_used: metrics?.toolsUsed,
        success: metrics?.success
      });
    } catch (error) {
      console.error('Error recording agent usage:', error);
      // Don't throw error for usage recording failures
    }
  }

  /**
   * Get agent with full configuration context
   */
  async getAgentWithContext(agentId: string): Promise<{
    agent: AIAgent;
    llmConfig: any;
    mcpServers: any[];
    validation: {
      isValid: boolean;
      issues: string[];
    };
  } | null> {
    try {
      const response = await apiClient.getAgent(agentId);
      return {
        agent: mapAgentProperties(response.agent),
        llmConfig: response.llm_config || null,
        mcpServers: response.mcp_servers || [],
        validation: {
          isValid: response.validation.is_valid,
          issues: response.validation.issues
        }
      };
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return null;
      }
      console.error('Error loading agent with context:', error);
      throw error;
    }
  }

  /**
   * Get available agent presets
   */
  async getAgentPresets(): Promise<any[]> {
    try {
      const response = await apiClient.getAgentPresets();
      return response.presets;
    } catch (error) {
      console.error('Error loading agent presets:', error);
      // Fallback to static presets if API fails
      return AGENT_PRESETS;
    }
  }

  /**
   * Get agent metrics
   */
  async getAgentMetrics(agentId: string, options?: {
    period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    try {
      return await apiClient.getAgentMetrics(agentId, {
        period: options?.period,
        start_date: options?.startDate,
        end_date: options?.endDate
      });
    } catch (error) {
      console.error('Error loading agent metrics:', error);
      throw error;
    }
  }

  /**
   * Validate agent configuration (now handled by backend)
   */
  async validateAgent(agent: AIAgent): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    try {
      const response = await this.getAgentWithContext(agent.agent_id || agent.id);
      if (!response) {
        return {
          isValid: false,
          issues: ['Agent not found']
        };
      }
      return response.validation;
    } catch (error) {
      console.error('Error validating agent:', error);
      return {
        isValid: false,
        issues: ['Validation failed']
      };
    }
  }
}

// Export factory function
export const createAgentService = (tenantId: string) => {
  return new AgentService(tenantId);
};

// Backward compatibility - map old property names to new ones
function mapAgentProperties(agent: any): AIAgent {
  if (!agent) return agent;
  
  return {
    ...agent,
    // Map new backend property names to frontend expected names
    id: agent.agent_id || agent.id,
    isEnabled: agent.is_enabled !== undefined ? agent.is_enabled : agent.isEnabled,
    usageCount: agent.usage_count !== undefined ? agent.usage_count : agent.usageCount,
    lastUsed: agent.last_used_at || agent.lastUsed,
    createdAt: agent.created_at || agent.createdAt,
    updatedAt: agent.updated_at || agent.updatedAt,
    systemPrompt: agent.system_prompt || agent.systemPrompt,
    llmConfigId: agent.llm_config_id || agent.llmConfigId,
    enabledMcpServers: agent.enabled_mcp_servers || agent.enabledMcpServers || []
  };
}