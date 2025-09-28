/**
 * Backend Database Agent Service
 * COMPLETE REPLACEMENT for localStorage-based agentService.ts
 * Uses our new database-backed backend APIs instead of localStorage
 */

import { AIAgent } from '@/types/agent';

export class BackendAgentService {
  // Use direct backend URL in development, Container Apps backend in production
  private baseUrl = import.meta.env.DEV
    ? 'http://localhost:8080/api/v1'
    : (import.meta.env.VITE_API_BASE_URL || 'https://grc-backend-simple.calmmeadow-5080198e.australiasoutheast.azurecontainerapps.io/api/v1');

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 [Backend Agents] Testing database connection...');

      const response = await fetch(`${this.baseUrl}/simple-agents`);

      if (!response.ok) {
        console.warn('⚠️ [Backend Agents] Connection test failed:', response.status);
        return false;
      }

      const data = await response.json();
      console.log('✅ [Backend Agents] Database connection successful');
      return data.success || true;
    } catch (error) {
      console.error('❌ [Backend Agents] Database connection failed:', error);
      return false;
    }
  }

  /**
   * Get all agents
   * REPLACES: JSON.parse(localStorage.getItem(`ai_agents_${tenantId}`) || '[]')
   */
  async getAgents(): Promise<AIAgent[]> {
    try {
      console.log('🔍 [Backend Agents] Loading agents from database...');

      // Get auth context for headers
      const authService = await import('@/lib/auth');
      const user = authService.authService.getCurrentUser();
      const tenant = authService.authService.getCurrentTenant();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (user?.id) {
        headers['x-user-id'] = user.id;
      }
      if (tenant?.id) {
        headers['x-tenant-id'] = tenant.id;
      }

      const response = await fetch(`${this.baseUrl}/simple-agents`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to load agents: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load agents');
      }

      console.log(`✅ [Backend Agents] Loaded ${data.data.agents.length} agents from database`);
      return data.data.agents;
    } catch (error) {
      console.error('❌ [Backend Agents] Failed to load agents:', error);
      throw error;
    }
  }

  /**
   * Create agent
   * REPLACES: localStorage.setItem with new agent added to array
   */
  async createAgent(agentData: {
    name: string;
    description?: string;
    systemPrompt?: string;
    llmConfigId?: string;
    enabledMcpServers?: string[];
  }): Promise<AIAgent> {
    try {
      console.log('➕ [Backend Agents] Creating agent:', agentData.name);

      // Get auth context for headers
      const authService = await import('@/lib/auth');
      const user = authService.authService.getCurrentUser();
      const tenant = authService.authService.getCurrentTenant();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (user?.id) {
        headers['x-user-id'] = user.id;
      }
      if (tenant?.id) {
        headers['x-tenant-id'] = tenant.id;
      }

      const response = await fetch(`${this.baseUrl}/simple-agents/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: agentData.name,
          description: agentData.description,
          systemPrompt: agentData.systemPrompt,
          llmConfigId: agentData.llmConfigId,
          enabledMcpServers: agentData.enabledMcpServers || []
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create agent: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create agent');
      }

      console.log('✅ [Backend Agents] Created agent:', data.data.name);
      return data.data;
    } catch (error) {
      console.error('❌ [Backend Agents] Failed to create agent:', error);
      throw error;
    }
  }

  /**
   * Update agent
   * REPLACES: localStorage.setItem with updated agents array
   */
  async updateAgent(agentId: string, updates: Partial<AIAgent>): Promise<AIAgent> {
    try {
      console.log('📝 [Backend Agents] Updating agent:', agentId, 'with updates:', updates);
      console.log('📝 [Backend Agents] Request URL will be:', `${this.baseUrl}/simple-agents/${agentId}`);

      // Get auth context for headers
      const authService = await import('@/lib/auth');
      const user = authService.authService.getCurrentUser();
      const tenant = authService.authService.getCurrentTenant();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (user?.id) {
        headers['x-user-id'] = user.id;
      }
      if (tenant?.id) {
        headers['x-tenant-id'] = tenant.id;
      }

      const response = await fetch(`${this.baseUrl}/simple-agents/${agentId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update agent: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update agent');
      }

      console.log('✅ [Backend Agents] Updated agent in database');
      return data.data;
    } catch (error) {
      console.error('❌ [Backend Agents] Failed to update agent:', error);
      throw error;
    }
  }

  /**
   * Delete agent
   * REPLACES: localStorage.setItem with filtered agents array
   */
  async deleteAgent(agentId: string): Promise<boolean> {
    try {
      console.log('🗑️ [Backend Agents] Deleting agent:', agentId);

      // Get auth context for headers
      const authService = await import('@/lib/auth');
      const user = authService.authService.getCurrentUser();
      const tenant = authService.authService.getCurrentTenant();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (user?.id) {
        headers['x-user-id'] = user.id;
      }
      if (tenant?.id) {
        headers['x-tenant-id'] = tenant.id;
      }

      const response = await fetch(`${this.baseUrl}/simple-agents/${agentId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to delete agent: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete agent');
      }

      console.log('✅ [Backend Agents] Deleted agent from database');
      return true;
    } catch (error) {
      console.error('❌ [Backend Agents] Failed to delete agent:', error);
      throw error;
    }
  }

  /**
   * Get enabled agents
   */
  async getEnabledAgents(): Promise<AIAgent[]> {
    const allAgents = await this.getAgents();
    return allAgents.filter(agent => agent.isEnabled !== false);
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<AIAgent | null> {
    const agents = await this.getAgents();
    return agents.find(agent => agent.id === agentId) || null;
  }

  /**
   * Get agent with context (including MCP servers, LLM configs, etc.)
   * Required by AgentChatModal
   */
  async getAgentWithContext(agentId: string): Promise<{ agent: AIAgent; mcpServers?: any[]; llmConfig?: any } | null> {
    try {
      console.log(`🔍 [Backend Agents] Loading agent context for agent: ${agentId}`);
      
      const agent = await this.getAgent(agentId);
      if (!agent) {
        console.error(`❌ [Backend Agents] Agent not found: ${agentId}`);
        return null;
      }
      
      console.log(`📋 [Backend Agents] Agent loaded:`, { id: agent.id, name: agent.name, llmConfigId: agent.llmConfigId });

      // Load LLM configuration from database
      let llmConfig = null;
      if (agent.llmConfigId) {
        try {
          console.log(`🤖 [Backend Agents] Loading LLM config: ${agent.llmConfigId}`);
          const llmResponse = await fetch(`${this.baseUrl}/simple-llm-configs`);
          if (llmResponse.ok) {
            const llmData = await llmResponse.json();
            if (llmData.success && llmData.data.llm_configs) {
              const rawConfig = llmData.data.llm_configs.find((config: any) => config.config_id === agent.llmConfigId);
              if (rawConfig) {
                // Transform database format to LLM service format
                llmConfig = {
                  provider: rawConfig.provider,
                  model: rawConfig.model,
                  apiKey: rawConfig.api_key,
                  endpoint: rawConfig.endpoint,
                  temperature: rawConfig.temperature,
                  maxTokens: rawConfig.max_tokens,
                  responseFormat: rawConfig.response_format,
                  isEnabled: rawConfig.is_enabled === 1,
                  id: rawConfig.config_id,
                  name: rawConfig.name
                };
                console.log(`✅ [Backend Agents] Found LLM config:`, { id: llmConfig.id, name: llmConfig.name, provider: llmConfig.provider, endpoint: llmConfig.endpoint });
              } else {
                console.warn(`⚠️ [Backend Agents] LLM config not found for ID: ${agent.llmConfigId}`);
              }
            }
          }
        } catch (error) {
          console.error(`❌ [Backend Agents] Error loading LLM config:`, error);
        }
      }

      // Load MCP servers from database
      let mcpServers: any[] = [];
      if (agent.enabledMcpServers && agent.enabledMcpServers.length > 0) {
        try {
          console.log(`🛠️ [Backend Agents] Loading MCP configs for servers:`, agent.enabledMcpServers);
          const mcpResponse = await fetch(`${this.baseUrl}/simple-mcp-configs`);
          if (mcpResponse.ok) {
            const mcpData = await mcpResponse.json();
            if (mcpData.success && mcpData.data.mcp_servers) {
              mcpServers = mcpData.data.mcp_servers.filter((server: any) => 
                agent.enabledMcpServers.includes(server.id) && server.is_enabled
              );
              console.log(`✅ [Backend Agents] Found ${mcpServers.length} enabled MCP servers:`, mcpServers.map(s => s.name));
            }
          }
        } catch (error) {
          console.error(`❌ [Backend Agents] Error loading MCP servers:`, error);
        }
      } else {
        console.log(`ℹ️ [Backend Agents] No enabled MCP servers for agent: ${agent.name}`);
      }

      // Provide fallback LLM config if none found
      if (!llmConfig) {
        console.warn(`⚠️ [Backend Agents] Using fallback LLM config for agent: ${agent.name}`);
        llmConfig = {
          id: 'fallback',
          name: 'Fallback OpenAI',
          provider: 'openai',
          model: 'gpt-4',
          endpoint: 'https://api.openai.com',
          isEnabled: true,
          temperature: 0.7,
          maxTokens: 2000
        };
      }

      console.log(`✅ [Backend Agents] Agent context loaded successfully:`, {
        agentName: agent.name,
        llmConfig: llmConfig ? { id: llmConfig.id, name: llmConfig.name, provider: llmConfig.provider } : 'None',
        mcpServerCount: mcpServers.length
      });

      return {
        agent,
        mcpServers,
        llmConfig
      };

    } catch (error) {
      console.error(`❌ [Backend Agents] Error loading agent context for ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Record usage for an agent
   * Required by AgentChatModal
   */
  async recordUsage(agentId: string, usage?: { tokensUsed?: number; requestType?: string }): Promise<void> {
    try {
      console.log(`📊 [Backend Agents] Recording usage for agent ${agentId}:`, usage || 'basic usage');
      // TODO: Implement actual usage recording in database
    } catch (error) {
      console.error('❌ [Backend Agents] Failed to record usage:', error);
    }
  }
}

// Export factory function for compatibility
export const createAgentService = (tenantId?: string) => {
  console.log(`🔄 [Backend Agents] Initialized with database backend (tenant: ${tenantId})`);
  return new BackendAgentService();
};